package profile

import "testing"

func TestAllowAnonymous(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want bool
	}{
		{"empty is private", "", false},
		{"whitespace only is private", "   ", false},
		{"configured url is public", "https://memos.example.com", true},
		{"configured url with padding is public", "  https://memos.example.com  ", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := &Profile{InstanceURL: c.url}
			if got := p.AllowAnonymous(); got != c.want {
				t.Fatalf("AllowAnonymous() with InstanceURL=%q = %v, want %v", c.url, got, c.want)
			}
		})
	}
}
