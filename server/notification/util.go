package notification

// 中文注释：安全与工具函数（基础 SSRF 防护、活动标题辅助）。

import (
    "errors"
    "fmt"
    "net"
    "net/url"
    "strings"
)

// validateOutboundURL 基础 SSRF 防护：
// - 仅允许 http/https
// - 禁止回环/内网/链路本地/元数据网段
func validateOutboundURL(raw string) error {
    u, err := url.Parse(raw)
    if err != nil {
        return err
    }
    scheme := strings.ToLower(u.Scheme)
    if scheme != "http" && scheme != "https" {
        return fmt.Errorf("unsupported scheme: %s", scheme)
    }
    host := u.Hostname()
    if host == "" {
        return errors.New("empty host")
    }
    ips, err := net.LookupIP(host)
    if err != nil {
        return fmt.Errorf("dns lookup failed: %w", err)
    }
    for _, ip := range ips {
        if isDisallowedIP(ip) {
            return fmt.Errorf("disallowed target ip: %s", ip.String())
        }
    }
    return nil
}

func isDisallowedIP(ip net.IP) bool {
    // 回环
    if ip.IsLoopback() {
        return true
    }
    // 私网/链路本地/多播等
    privateCIDRs := []string{
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16", // 链路本地
        "127.0.0.0/8",
        // 常见云元数据
        "169.254.169.254/32",
    }
    for _, cidr := range privateCIDRs {
        _, block, _ := net.ParseCIDR(cidr)
        if block.Contains(ip) {
            return true
        }
    }
    // IPv6 本地/链路本地
    if ip.To4() == nil {
        v6Blocks := []string{
            "::1/128",   // loopback
            "fc00::/7",  // unique local
            "fe80::/10", // link local
        }
        for _, c := range v6Blocks {
            _, block, _ := net.ParseCIDR(c)
            if block.Contains(ip) {
                return true
            }
        }
    }
    return false
}

func activityTitle(activity string) string {
    switch strings.ToLower(activity) {
    case "memos.memo.created":
        return "Memo Created"
    case "memos.memo.updated":
        return "Memo Updated"
    case "memos.memo.deleted":
        return "Memo Deleted"
    default:
        return activity
    }
}

