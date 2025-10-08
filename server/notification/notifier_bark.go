package notification

// 中文注释：Bark 推送适配。

import (
    "context"
    "fmt"
    "net/http"
    "net/url"
    "path"
    "strings"

    v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func sendBark(ctx context.Context, base string, memo *v1pb.Memo, activity string) error {
    // 允许用户直接粘贴 https://api.day.app/{key} 或自建 bark-server 根地址。
    if err := validateOutboundURL(base); err != nil {
        return err
    }
    u, err := url.Parse(base)
    if err != nil {
        return err
    }
    title := activityTitle(activity)
    body := memo.GetSnippet()
    if body == "" {
        body = memo.GetContent()
        if len([]rune(body)) > 64 {
            body = string([]rune(body)[:64]) + "..."
        }
    }
    // 拼接 /{title}/{body}
    u.Path = path.Join(u.Path, url.PathEscape(strings.TrimSpace(title)), url.PathEscape(strings.TrimSpace(body)))
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
    if err != nil {
        return err
    }
    client := &http.Client{Timeout: httpTimeout}
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    // Bark 返回 200 视作成功，不强制解析 body。
    if resp.StatusCode < 200 || resp.StatusCode > 299 {
        return fmt.Errorf("bark status: %d", resp.StatusCode)
    }
    return nil
}
