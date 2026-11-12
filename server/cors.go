package server

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/usememos/memos/internal/httphandler"
	"github.com/usememos/memos/internal/profile"
)

func newCORSMiddleware(profile *profile.Profile, mux *http.ServeMux) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Add("Vary", "Origin")
			origin := r.Header.Get("Origin")
			preflight := r.Method == http.MethodOptions
			allowMethods := ""
			if preflight {
				handler, _ := mux.Handler(httphandler.RoutingRequest(r))
				if route, ok := handler.(interface{ AllowedMethods() string }); ok {
					allowMethods = route.AllowedMethods()
					if allowMethods != "" {
						h.Set("Allow", allowMethods)
					}
				}
			}
			if origin != "" && origin != "null" {
				h.Set("Access-Control-Allow-Origin", origin)
				// Cookie access remains restricted to trusted origins. Other origins
				// may use Authorization tokens, but must not read credentialed responses.
				if isAllowedCORSOrigin(profile, r.Host, origin) {
					h.Set("Access-Control-Allow-Credentials", "true")
				}
				if preflight {
					h.Add("Vary", "Access-Control-Request-Method")
					h.Add("Vary", "Access-Control-Request-Headers")
					if allowMethods == "" {
						allowMethods = "GET,HEAD,PUT,PATCH,POST,DELETE"
					}
					h.Set("Access-Control-Allow-Methods", allowMethods)
					if headers := r.Header.Get("Access-Control-Request-Headers"); headers != "" {
						h.Set("Access-Control-Allow-Headers", headers)
					}
				}
			}
			if preflight {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isAllowedCORSOrigin(profile *profile.Profile, requestHost, origin string) bool {
	originURL, err := url.Parse(origin)
	if err != nil || originURL.Scheme == "" || originURL.Host == "" {
		return false
	}

	if strings.EqualFold(originURL.Host, requestHost) {
		return true
	}

	if profile == nil || profile.InstanceURL == "" {
		return false
	}
	instanceURL, err := url.Parse(profile.InstanceURL)
	if err != nil || instanceURL.Scheme == "" || instanceURL.Host == "" {
		return false
	}
	return strings.EqualFold(originURL.Scheme, instanceURL.Scheme) && strings.EqualFold(originURL.Host, instanceURL.Host)
}
