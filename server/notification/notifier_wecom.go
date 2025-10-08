package notification

// 中文注释：企业微信机器人适配。

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"

    v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

var httpTimeout = 30 * time.Second

type weComTextPayload struct {
    MsgType string       `json:"msgtype"`
    Text    weComContent `json:"text"`
}

type weComContent struct {
    Content string `json:"content"`
}

type weComResp struct {
    ErrCode int    `json:"errcode"`
    ErrMsg  string `json:"errmsg"`
}

func sendWeCom(ctx context.Context, url string, memo *v1pb.Memo, activity string) error {
    if err := validateOutboundURL(url); err != nil {
        return err
    }
    title := activityTitle(activity)
    text := fmt.Sprintf("%s\nCreator: %s\nSnippet: %s", title, memo.GetCreator(), memo.GetSnippet())
    if memo.GetSnippet() == "" {
        // 兜底：直接截断 content
        c := memo.GetContent()
        if len([]rune(c)) > 64 {
            c = string([]rune(c)[:64]) + "..."
        }
        text = fmt.Sprintf("%s\nCreator: %s\nSnippet: %s", title, memo.GetCreator(), c)
    }
    payload := weComTextPayload{
        MsgType: "text",
        Text:    weComContent{Content: text},
    }
    b, _ := json.Marshal(payload)
    req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(b))
    if err != nil {
        return err
    }
    req.Header.Set("Content-Type", "application/json")
    client := &http.Client{Timeout: httpTimeout}
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    var r weComResp
    if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
        return err
    }
    if r.ErrCode != 0 {
        return fmt.Errorf("wecom error: %d %s", r.ErrCode, r.ErrMsg)
    }
    return nil
}

