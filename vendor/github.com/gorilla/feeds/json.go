package feeds

import (
	"encoding/json"
	"strings"
	"time"
)

const jsonFeedVersion = "https://jsonfeed.org/version/1"

// JSONAuthor represents the author of the feed or of an individual item
// in the feed
type JSONAuthor struct {
	Name   string `json:"name,omitempty"`
	Url    string `json:"url,omitempty"`
	Avatar string `json:"avatar,omitempty"`
}

// JSONAttachment represents a related resource. Podcasts, for instance, would
// include an attachment that’s an audio or video file.
type JSONAttachment struct {
	Url      string        `json:"url,omitempty"`
	MIMEType string        `json:"mime_type,omitempty"`
	Title    string        `json:"title,omitempty"`
	Size     int32         `json:"size,omitempty"`
	Duration time.Duration `json:"duration_in_seconds,omitempty"`
}

// MarshalJSON implements the json.Marshaler interface.
// The Duration field is marshaled in seconds, all other fields are marshaled
// based upon the definitions in struct tags.
func (a *JSONAttachment) MarshalJSON() ([]byte, error) {
	type EmbeddedJSONAttachment JSONAttachment
	return json.Marshal(&struct {
		Duration float64 `json:"duration_in_seconds,omitempty"`
		*EmbeddedJSONAttachment
	}{
		EmbeddedJSONAttachment: (*EmbeddedJSONAttachment)(a),
		Duration:               a.Duration.Seconds(),
	})
}

// UnmarshalJSON implements the json.Unmarshaler interface.
// The Duration field is expected to be in seconds, all other field types
// match the struct definition.
func (a *JSONAttachment) UnmarshalJSON(data []byte) error {
	type EmbeddedJSONAttachment JSONAttachment
	var raw struct {
		Duration float64 `json:"duration_in_seconds,omitempty"`
		*EmbeddedJSONAttachment
	}
	raw.EmbeddedJSONAttachment = (*EmbeddedJSONAttachment)(a)

	err := json.Unmarshal(data, &raw)
	if err != nil {
		return err
	}

	if raw.Duration > 0 {
		nsec := int64(raw.Duration * float64(time.Second))
		raw.EmbeddedJSONAttachment.Duration = time.Duration(nsec)
	}

	return nil
}

// JSONItem represents a single entry/post for the feed.
type JSONItem struct {
	Id            string           `json:"id"`
	Url           string           `json:"url,omitempty"`
	ExternalUrl   string           `json:"external_url,omitempty"`
	Title         string           `json:"title,omitempty"`
	ContentHTML   string           `json:"content_html,omitempty"`
	ContentText   string           `json:"content_text,omitempty"`
	Summary       string           `json:"summary,omitempty"`
	Image         string           `json:"image,omitempty"`
	BannerImage   string           `json:"banner_,omitempty"`
	PublishedDate *time.Time       `json:"date_published,omitempty"`
	ModifiedDate  *time.Time       `json:"date_modified,omitempty"`
	Author        *JSONAuthor      `json:"author,omitempty"`
	Tags          []string         `json:"tags,omitempty"`
	Attachments   []JSONAttachment `json:"attachments,omitempty"`
}

// JSONHub describes an endpoint that can be used to subscribe to real-time
// notifications from the publisher of this feed.
type JSONHub struct {
	Type string `json:"type"`
	Url  string `json:"url"`
}

// JSONFeed represents a syndication feed in the JSON Feed Version 1 format.
// Matching the specification found here: https://jsonfeed.org/version/1.
type JSONFeed struct {
	Version     string      `json:"version"`
	Title       string      `json:"title"`
	HomePageUrl string      `json:"home_page_url,omitempty"`
	FeedUrl     string      `json:"feed_url,omitempty"`
	Description string      `json:"description,omitempty"`
	UserComment string      `json:"user_comment,omitempty"`
	NextUrl     string      `json:"next_url,omitempty"`
	Icon        string      `json:"icon,omitempty"`
	Favicon     string      `json:"favicon,omitempty"`
	Author      *JSONAuthor `json:"author,omitempty"`
	Expired     *bool       `json:"expired,omitempty"`
	Hubs        []*JSONItem `json:"hubs,omitempty"`
	Items       []*JSONItem `json:"items,omitempty"`
}

// JSON is used to convert a generic Feed to a JSONFeed.
type JSON struct {
	*Feed
}

// ToJSON encodes f into a JSON string. Returns an error if marshalling fails.
func (f *JSON) ToJSON() (string, error) {
	return f.JSONFeed().ToJSON()
}

// ToJSON encodes f into a JSON string. Returns an error if marshalling fails.
func (f *JSONFeed) ToJSON() (string, error) {
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return "", err
	}

	return string(data), nil
}

// JSONFeed creates a new JSONFeed with a generic Feed struct's data.
func (f *JSON) JSONFeed() *JSONFeed {
	feed := &JSONFeed{
		Version:     jsonFeedVersion,
		Title:       f.Title,
		Description: f.Description,
	}

	if f.Link != nil {
		feed.HomePageUrl = f.Link.Href
	}
	if f.Author != nil {
		feed.Author = &JSONAuthor{
			Name: f.Author.Name,
		}
	}
	for _, e := range f.Items {
		feed.Items = append(feed.Items, newJSONItem(e))
	}
	return feed
}

func newJSONItem(i *Item) *JSONItem {
	item := &JSONItem{
		Id:      i.Id,
		Title:   i.Title,
		Summary: i.Description,

		ContentHTML: i.Content,
	}

	if i.Link != nil {
		item.Url = i.Link.Href
	}
	if i.Source != nil {
		item.ExternalUrl = i.Source.Href
	}
	if i.Author != nil {
		item.Author = &JSONAuthor{
			Name: i.Author.Name,
		}
	}
	if !i.Created.IsZero() {
		item.PublishedDate = &i.Created
	}
	if !i.Updated.IsZero() {
		item.ModifiedDate = &i.Updated
	}
	if i.Enclosure != nil && strings.HasPrefix(i.Enclosure.Type, "image/") {
		item.Image = i.Enclosure.Url
	}

	return item
}
