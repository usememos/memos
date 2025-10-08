package notification

// 中文注释：类型与公共辅助。

type webhookType string

const (
    webhookTypeRAW   webhookType = "RAW"
    webhookTypeWeCom webhookType = "WECOM"
    webhookTypeBark  webhookType = "BARK"
)

