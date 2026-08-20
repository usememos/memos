package profile

import "testing"

func TestAllowAnonymous(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want bool
	}{
		{"empty url stays private", "", false},
		{"configured url alone is private", "https://memos.example.com", false},
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

func TestAllowAnonymousExplicitPolicy(t *testing.T) {
	p := &Profile{}
	if p.AllowAnonymous() {
		t.Fatal("fresh profile must default to private")
	}
	p.SetAllowAnonymous(true)
	if !p.AllowAnonymous() {
		t.Fatal("explicit public policy must be reported")
	}
	p.SetAllowAnonymous(false)
	if p.AllowAnonymous() {
		t.Fatal("explicit private policy must be reported")
	}
}
