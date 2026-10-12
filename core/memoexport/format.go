package memoexport

import (
	"encoding/json"
	"time"
)

const (
	// Format is the value of the manifest's format member.
	Format = "memos-export"
	// legacyFormat identifies exports written before the format was renamed.
	legacyFormat = "memos-archive"
	// FormatVersion is the newest version this package writes.
	FormatVersion = "1.0"
	// FormatMajor is the major version this package reads.
	FormatMajor = 1
	// MediaType is the HTTP Content-Type of an export. It is deliberately not
	// stored inside the container: a leading "mimetype" entry makes macOS
	// Archive Utility treat the file as an unknown document package and
	// refuse to expand it.
	MediaType = "application/vnd.usememos.export+zip"

	// ManifestEntry holds the archive-level record and identifies the format.
	ManifestEntry = "manifest.json"
	// MemosDir holds one record and one content file per memo.
	MemosDir = "memos/"
	// AttachmentsDir holds attachment bytes under attachments/<uid>/<name>.
	AttachmentsDir = "attachments/"

	// ScopeKindUser is the only scope kind written in 1.0.
	ScopeKindUser = "USER"

	// RelationReference is the only relation type written in 1.0.
	RelationReference = "REFERENCE"
)

// Manifest is the archive-level record stored at manifest.json.
type Manifest struct {
	Format        string    `json:"format"`
	FormatVersion string    `json:"formatVersion"`
	Generator     Generator `json:"generator"`
	ExportTime    string    `json:"exportTime"`
	Scope         Scope     `json:"scope"`
	Counts        *Counts   `json:"counts,omitempty"`
}

// Generator names the software that wrote the archive.
type Generator struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// Scope says whose memos the archive holds.
type Scope struct {
	Kind string     `json:"kind"`
	User *ScopeUser `json:"user,omitempty"`
}

// ScopeUser identifies the exporting user.
type ScopeUser struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName,omitempty"`
}

// Counts lets readers detect truncation and report progress.
type Counts struct {
	Memos       int `json:"memos"`
	Attachments int `json:"attachments"`
}

// Memo is the record stored at memos/<uid>.json.
type Memo struct {
	UID         string       `json:"uid"`
	Creator     string       `json:"creator"`
	CreateTime  string       `json:"createTime"`
	UpdateTime  string       `json:"updateTime"`
	State       string       `json:"state"`
	Visibility  string       `json:"visibility"`
	Pinned      bool         `json:"pinned"`
	ContentPath string       `json:"contentPath"`
	Tags        []string     `json:"tags,omitempty"`
	Location    *Location    `json:"location,omitempty"`
	Space       *Space       `json:"space,omitempty"`
	Parent      string       `json:"parent,omitempty"`
	Relations   []Relation   `json:"relations,omitempty"`
	Attachments []Attachment `json:"attachments,omitempty"`
	Reactions   []Reaction   `json:"reactions,omitempty"`
}

// Location mirrors the public API Location message.
type Location struct {
	Placeholder string  `json:"placeholder,omitempty"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

// Space names the Space a memo was placed in.
type Space struct {
	UID   string `json:"uid"`
	Title string `json:"title,omitempty"`
}

// Relation is an outgoing REFERENCE relation.
type Relation struct {
	Type string `json:"type"`
	Memo string `json:"memo"`
}

// Attachment is one entry of a memo record's attachments list.
type Attachment struct {
	UID          string `json:"uid"`
	Filename     string `json:"filename"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
	SHA256       string `json:"sha256,omitempty"`
	Path         string `json:"path,omitempty"`
	ExternalLink string `json:"externalLink,omitempty"`
	CreateTime   string `json:"createTime"`
	// MediaMetadata is the public API MediaMetadata message in its proto3
	// JSON mapping. It is carried verbatim so this package needs no proto
	// dependency.
	MediaMetadata json.RawMessage `json:"mediaMetadata,omitempty"`
}

// Reaction mirrors the public API Reaction message with a username creator.
type Reaction struct {
	ReactionType string `json:"reactionType"`
	Creator      string `json:"creator"`
	CreateTime   string `json:"createTime,omitempty"`
}

// FormatTime renders a Unix timestamp as the archive's RFC 3339 UTC form.
func FormatTime(unix int64) string {
	return time.Unix(unix, 0).UTC().Format(time.RFC3339)
}

// ParseTime reads an archive timestamp. It accepts fractional seconds and any
// RFC 3339 offset, and returns the instant as Unix seconds.
func ParseTime(value string) (int64, error) {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return 0, err
	}
	return parsed.Unix(), nil
}

// ContentPath is the entry name writers use for a memo's content.
func ContentPath(uid string) string {
	return MemosDir + uid + ".md"
}

// RecordPath is the entry name of a memo record.
func RecordPath(uid string) string {
	return MemosDir + uid + ".json"
}

// AttachmentPath is the entry name writers use for attachment bytes.
func AttachmentPath(uid, filename string) string {
	return AttachmentsDir + uid + "/" + SafeFilename(filename)
}
