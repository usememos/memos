package frontend

import (
	"context"
	"embed"
	"encoding/xml"
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/httphandler"
	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
)

//go:embed dist/*
var embeddedFiles embed.FS

const (
	frontendHTMLCacheControl        = "no-cache, no-store, must-revalidate"
	frontendStaticAssetCacheControl = "public, max-age=3600"
	frontendHashedAssetCacheControl = "public, max-age=2592000, immutable"
)

type FrontendService struct {
	Profile *profile.Profile
	Store   *store.Store
}

func NewFrontendService(profile *profile.Profile, store *store.Store) *FrontendService {
	return &FrontendService{
		Profile: profile,
		Store:   store,
	}
}

func (s *FrontendService) Serve(_ context.Context, mux *http.ServeMux, fallback http.Handler) {
	mux.Handle("/robots.txt", httphandler.GET(httphandler.Func(s.getRobotsTXT), nil))
	mux.Handle("/sitemap.xml", httphandler.GET(httphandler.Func(s.getSitemapXML), nil))
	mux.Handle("/", s.Handler(fallback))
}

// Handler serves static files and SPA routes, passing API namespaces to fallback.
func (*FrontendService) Handler(fallback http.Handler) http.Handler {
	frontendFS := getFileSystem("dist")
	return httphandler.Func(func(w http.ResponseWriter, r *http.Request) error {
		requestPath := r.URL.Path
		if shouldSkipFrontendStatic(requestPath) {
			fallback.ServeHTTP(w, r)
			return nil
		}
		setFrontendCacheHeaders(w, requestPath)
		filename := strings.TrimPrefix(path.Clean("/"+requestPath), "/")
		if filename == "" {
			filename = "index.html"
		}
		info, err := fs.Stat(frontendFS, filename)
		if err == nil && info.IsDir() {
			filename = path.Join(filename, "index.html")
			_, err = fs.Stat(frontendFS, filename)
		}
		if err != nil {
			if !shouldServeFrontendHTML(requestPath) {
				return &httphandler.Error{Code: http.StatusNotFound, Message: http.StatusText(http.StatusNotFound)}
			}
			filename = "index.html"
		}
		// ServeContent avoids FileServer's /index.html and directory redirects.
		file, err := frontendFS.Open(filename)
		if err != nil {
			return err
		}
		defer file.Close()
		info, err = file.Stat()
		if err != nil {
			return err
		}
		content, ok := file.(io.ReadSeeker)
		if !ok {
			return errors.New("frontend file does not support seeking")
		}
		http.ServeContent(w, r, info.Name(), info.ModTime(), content)
		return nil
	})
}

func shouldSkipFrontendStatic(requestPath string) bool {
	if requestPath == "/robots.txt" || requestPath == "/sitemap.xml" {
		return true
	}
	return hasPathPrefix(requestPath, "/api") ||
		hasPathPrefix(requestPath, "/file") ||
		// RFC 8615 reserves this namespace for protocol metadata. The SPA
		// fallback already refuses it (see shouldServeFrontendHTML), but the
		// 404 that results would otherwise inherit the static asset cache
		// policy and be stored by clients and CDNs for an hour.
		hasPathPrefix(requestPath, "/.well-known") ||
		requestPath == "/memos.api" ||
		strings.HasPrefix(requestPath, "/memos.api.")
}

// SetCacheHeaders applies the frontend cache policy before route dispatch.
// Dynamic namespaces and discovery routes manage their own cache headers.
func SetCacheHeaders(w http.ResponseWriter, r *http.Request) {
	if !shouldSkipFrontendStatic(r.URL.Path) {
		setFrontendCacheHeaders(w, r.URL.Path)
	}
}

func setFrontendCacheHeaders(w http.ResponseWriter, requestPath string) {
	if shouldServeFrontendHTML(requestPath) {
		w.Header().Set("Cache-Control", frontendHTMLCacheControl)
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		return
	}

	cacheControl := frontendStaticAssetCacheControl
	if strings.HasPrefix(requestPath, "/assets/") {
		cacheControl = frontendHashedAssetCacheControl
	}
	w.Header().Set("Cache-Control", cacheControl)
}

// shouldServeFrontendHTML reports whether an unknown path is an SPA route
// that loads index.html. Paths with a file extension are assets, and paths
// with a hidden segment are never app routes: no username, memo UID, or fixed
// route begins with a dot. This keeps the SPA out of "/.well-known/", which
// RFC 8615 reserves for registered metadata that clients probe and expect a
// 404 for when the server does not offer it, and out of probes like "/.git/".
func shouldServeFrontendHTML(requestPath string) bool {
	if requestPath == "/" || requestPath == "/index.html" {
		return true
	}
	return path.Ext(requestPath) == "" && !strings.Contains(requestPath, "/.")
}

func hasPathPrefix(requestPath, prefix string) bool {
	return requestPath == prefix || strings.HasPrefix(requestPath, prefix+"/")
}

func getFileSystem(path string) fs.FS {
	sub, err := fs.Sub(embeddedFiles, path)
	if err != nil {
		panic(err)
	}
	return sub
}

func (s *FrontendService) getRobotsTXT(w http.ResponseWriter, r *http.Request) error {
	if err := s.requirePublicAccess(r.Context()); err != nil {
		return err
	}
	instanceURL, err := normalizeInstanceURL(s.Profile.InstanceURL)
	if err != nil {
		return err
	}

	robotsTXT := strings.Join([]string{
		"User-agent: *",
		"Allow: /",
		"Host: " + instanceURL,
		"Sitemap: " + instanceURL + "/sitemap.xml",
	}, "\n")
	return httphandler.Text(w, http.StatusOK, robotsTXT)
}

func (s *FrontendService) getSitemapXML(w http.ResponseWriter, r *http.Request) error {
	if err := s.requirePublicAccess(r.Context()); err != nil {
		return err
	}
	instanceURL, err := normalizeInstanceURL(s.Profile.InstanceURL)
	if err != nil {
		return err
	}

	normal := store.Normal
	memos, err := s.Store.ListMemos(r.Context(), &store.FindMemo{
		RowStatus:       &normal,
		VisibilityList:  []store.Visibility{store.Public},
		Access:          &store.MemoAccessScope{AllowPublic: true},
		ExcludeComments: true,
	})
	if err != nil {
		return errors.Wrap(err, "failed to list public memos for sitemap")
	}
	// The set of public memo URLs changes with audience updates. Require
	// revalidation so a revoked URL is not retained by an intermediary cache.
	w.Header().Set("Cache-Control", "public, no-cache")

	urls := make([]sitemapURL, 0, len(memos))
	for _, memo := range memos {
		urls = append(urls, sitemapURL{
			Loc: instanceURL + "/memos/" + memo.UID,
		})
	}

	w.Header().Set("Content-Type", "application/xml; charset=UTF-8")
	w.WriteHeader(http.StatusOK)
	if _, err := io.WriteString(w, xml.Header); err != nil {
		return err
	}
	return xml.NewEncoder(w).Encode(sitemapURLSet{
		XMLNS: sitemapXMLNamespace,
		URLs:  urls,
	})
}

func (s *FrontendService) requirePublicAccess(ctx context.Context) error {
	allowsAnonymous, err := s.Store.AllowsAnonymousAccess(ctx)
	if err != nil {
		return &httphandler.Error{Code: http.StatusInternalServerError, Message: "failed to get instance access policy", Cause: err}
	}
	if !allowsAnonymous {
		return &httphandler.Error{Code: http.StatusNotFound, Message: "public instance discovery is unavailable"}
	}
	return nil
}

func normalizeInstanceURL(instanceURL string) (string, error) {
	instanceURL = strings.TrimRight(instanceURL, "/")
	if instanceURL == "" {
		return "", &httphandler.Error{Code: http.StatusNotFound, Message: "instance URL is not configured"}
	}
	return instanceURL, nil
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	XMLNS   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

type sitemapURL struct {
	Loc string `xml:"loc"`
}

//nolint:revive
const sitemapXMLNamespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
