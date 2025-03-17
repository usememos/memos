package importer

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"path"
	"strings"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const keepRoot = "Takeout/Keep"

type scannerState int

const (
	scannerRoot scannerState = iota
	scannerKeep
)

type keepScanner struct {
	dir   fs.FS
	state scannerState

	result *ImportResult
}

func (s *keepScanner) walk() error {
	return fs.WalkDir(s.dir, ".", s.scan)
}

func (s *keepScanner) scan(fp string, d fs.DirEntry, err error) error {
	if err != nil {
		return fmt.Errorf("%s: %w", fp, err)
	}

	switch s.state {
	case scannerRoot:
		err = s.handleRoot(fp, d)
	case scannerKeep:
		err = s.handleKeep(fp, d)
	default:
		err = fmt.Errorf("unknown state %d", s.state)
	}

	if err != nil {
		fmt.Printf("[%d] %s: %s\n", s.state, fp, err)
	}

	return nil
}

func (s *keepScanner) handleRoot(fp string, d fs.DirEntry) error {
	if d.IsDir() && fp == keepRoot {
		s.state = scannerKeep
	}

	return nil
}

func (s *keepScanner) handleKeep(fp string, d fs.DirEntry) error {
	switch {
	case !strings.HasPrefix(fp, keepRoot+"/"):
		s.state = scannerRoot
		return nil
	case d.IsDir():
		return fmt.Errorf("unexpected directory: %s", fp)
	case strings.EqualFold(d.Name(), "Labels.txt"):
		return nil
	}

	mimeType := mime.TypeByExtension(path.Ext(fp))

	switch mimeType {
	default:
		return fmt.Errorf("unsupported file type: %s", path.Ext(fp))
	case "text/html":
		return nil
	case "image/jpeg", "image/png":
		return s.handleFile(fp, s.handleImage)
	case "application/json":
		return s.handleFile(fp, s.handleNote)
	}
}

func (s *keepScanner) handleFile(fp string, handler func(fs.File) error) error {
	f, err := s.dir.Open(fp)
	if err != nil {
		return fmt.Errorf("open: %w", err)
	}
	defer f.Close()

	return handler(f)
}

func (s *keepScanner) handleImage(f fs.File) error {
	info, err := f.Stat()
	if err != nil {
		return fmt.Errorf("stat: %w", err)
	}

	name := info.Name()
	updatedTs := info.ModTime().Unix()

	res := store.Resource{
		// ID, UID, MemoID

		// CreatorID:
		CreatedTs: updatedTs,
		UpdatedTs: updatedTs,

		Filename: name,
		Type:     mime.TypeByExtension(path.Ext(name)),
		Size:     info.Size(),
		// StorageType, Reference, Payload
	}

	res.Blob, err = io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("read: %w", err)
	}

	s.result.Resources = append(s.result.Resources, res)

	return nil
}

type keepNote struct {
	Color                   string `json:"color"`
	IsTrashed               bool   `json:"isTrashed"`
	IsPinned                bool   `json:"isPinned"`
	IsArchived              bool   `json:"isArchived"`
	TextContent             string `json:"textContent"`
	Title                   string `json:"title"`
	UserEditedTimestampUsec int64  `json:"userEditedTimestampUsec"`
	CreatedTimestampUsec    int64  `json:"createdTimestampUsec"`
	TextContentHTML         string `json:"textContentHtml"`

	Labels []struct {
		Name string `json:"name"`
	} `json:"labels"`

	Annotations []struct {
		Description string `json:"description"`
		Source      string `json:"source"`
		Title       string `json:"title"`
		URL         string `json:"url"`
	} `json:"annotations"`

	Attachments []struct {
		FilePath string `json:"filePath"`
		Mimetype string `json:"mimetype"`
	} `json:"attachments"`

	ListContent []struct {
		TextHTML  string `json:"textHtml"`
		Text      string `json:"text"`
		IsChecked bool   `json:"isChecked"`
	} `json:"listContent"`
}

func (s *keepScanner) handleNote(f fs.File) error {
	dec := json.NewDecoder(f)
	dec.DisallowUnknownFields()

	var note keepNote
	if err := dec.Decode(&note); err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	var content strings.Builder

	if note.Title != "" {
		content.WriteString("# " + note.Title + "\n\n")
	}

	if note.TextContent != "" {
		content.WriteString(note.TextContent + "\n\n")
	}

	memo := store.Memo{
		// ID, UID, ParentID

		// RowStatus:
		// CreatorID:
		CreatedTs: note.CreatedTimestampUsec / 1e6,
		UpdatedTs: note.UserEditedTimestampUsec / 1e6,

		// Content:
		Visibility: store.Private, // There are no privacy settings in keep
		Pinned:     note.IsPinned,
		Payload:    new(storepb.MemoPayload),
	}

	memo.Payload.Tags = append(memo.Payload.Tags, "keep/imported")

	switch {
	case note.IsTrashed:
		memo.Payload.Tags = append(memo.Payload.Tags, "keep/trashed")
		fallthrough
	case note.IsArchived:
		memo.RowStatus = store.Archived
	default:
		memo.RowStatus = store.Normal
	}

	for _, label := range note.Labels {
		memo.Payload.Tags = append(memo.Payload.Tags, label.Name)
	}

	curMemo := len(s.result.Memos)
	for _, attachment := range note.Attachments {
		refs := s.result.FileMemos[attachment.FilePath]
		s.result.FileMemos[attachment.FilePath] = append(refs, curMemo)
	}

	memo.Payload.Property.HasLink = len(note.Annotations) > 0
	memo.Payload.Property.HasTaskList = len(note.ListContent) > 0

	for _, item := range note.Annotations {
		content.WriteString("# ")

		if item.Title != "" {
			content.WriteString(item.Title + ": ")
		}

		if item.URL != "" {
			if item.Source != "" {
				content.WriteString("[" + item.Source + "]")
			} else {
				content.WriteString("[" + item.URL + "]")
			}

			content.WriteString("(" + item.URL + ")\n")
		} else if item.Source != "" {
			content.WriteString(item.Source + "\n")
		}

		if item.Description != "" {
			content.WriteString(item.Description + "\n\n")
		}
	}

	for _, item := range note.ListContent {
		memo.Payload.Property.HasIncompleteTasks = memo.Payload.Property.HasIncompleteTasks || !item.IsChecked

		content.WriteString("- [")
		if item.IsChecked {
			content.WriteRune('x')
		} else {
			content.WriteRune(' ')
		}

		content.WriteString("] " + item.Text + "\n")
	}

	memo.Content = content.String()

	s.result.Memos = append(s.result.Memos, memo)
	return nil
}

func takeoutConverter(ctx context.Context, data []byte) (*ImportResult, error) {
	var scanner keepScanner

	buf := bytes.NewReader(data)

	var err error
	scanner.dir, err = zip.NewReader(buf, int64(buf.Len()))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	err = scanner.walk()
	if err != nil {
		return nil, fmt.Errorf("read content: %w", err)
	}

	return scanner.result, errors.New("not implemented")
}
