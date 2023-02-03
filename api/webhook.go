package api

type WebhookTriggerType int

const (
	TriggerMemoCreate WebhookTriggerType = 1
	TriggerMemoUpdate WebhookTriggerType = 2
	TriggerMemoDelete WebhookTriggerType = 4
)

type Webhook struct {
	ID          int                `json:"id"`
	CreatorID   int                `json:"creatorId"`
	CreatedTs   int64              `json:"createdTs"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Enabled     bool               `json:"enabled"`
	Type        WebhookTriggerType `json:"type"`
	Headers     string             `json:"Headers"`
	Body        string             `json:"Body"`
}

type WebhookCreate struct {
	CreatorID   int                `json:"creatorId"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Enabled     bool               `json:"enabled"`
	Type        WebhookTriggerType `json:"type"`
	Headers     string             `json:"Headers"`
	Body        string             `json:"Body"`
}

type WebhookPatch struct {
	ID          int                 `json:"id"`
	Name        *string             `json:"name"`
	Description *string             `json:"description"`
	Enabled     *bool               `json:"enabled"`
	Type        *WebhookTriggerType `json:"type"`
	Headers     *string             `json:"Headers"`
	Body        *string             `json:"Body"`
}

type WebhookFind struct {
	ID        *int    `json:"id"`
	CreatorID *int    `json:"creatorId"`
	Name      *string `json:"name"`
	Enabled   *bool   `json:"enabled"`
}

type WebhookDelete struct {
	ID int `json:"id"`
}
