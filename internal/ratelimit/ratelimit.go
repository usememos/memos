// Package ratelimit bounds how often a caller may do something. It provides a
// declarative policy table, an in-memory sliding-window limiter, and the
// seams a deployment fills to add a challenge or a signup policy.
package ratelimit

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// Scope names one counted activity. Scopes are the rows of the policy table.
type Scope string

// Scopes shipped by the open-source binary. See docs/design/api-abuse-controls.md.
const (
	// ScopeAnonymous is the catch-all budget for requests without an identity, per client address.
	ScopeAnonymous Scope = "anonymous"
	// ScopeAuthenticated is the catch-all budget for requests with an identity, per user.
	ScopeAuthenticated Scope = "authenticated"
	// ScopeSignInIP counts failed sign-ins per client address.
	ScopeSignInIP Scope = "signin_ip"
	// ScopeSignInAccount counts failed password sign-ins per submitted username.
	ScopeSignInAccount Scope = "signin_account"
	// ScopeSignupIP counts self-service registrations per client address.
	ScopeSignupIP Scope = "signup_ip"
	// ScopeValidateIP counts validate-only registration probes per client address.
	ScopeValidateIP Scope = "validate_ip"
	// ScopePasswordResetIP is reserved for the password reset flow, per client address.
	ScopePasswordResetIP Scope = "password_reset_ip"
	// ScopePasswordResetEmail is reserved for the password reset flow, per canonical email.
	ScopePasswordResetEmail Scope = "password_reset_email"
	// ScopeLinkMetadata counts link preview fetches per URL requested.
	ScopeLinkMetadata Scope = "link_metadata"
	// ScopeUploadUser counts upload starts per user.
	ScopeUploadUser Scope = "upload_user"
	// ScopeTranscribeUser counts transcription calls per user.
	ScopeTranscribeUser Scope = "transcribe_user"
	// ScopeWriteUser counts content creation per user.
	ScopeWriteUser Scope = "write_user"
)

// Rule is the limit for one scope: at most Limit units within Window.
type Rule struct {
	Limit  int
	Window time.Duration
}

// Policy maps scopes to rules. A scope missing from the policy is unlimited.
type Policy map[Scope]Rule

// Rule returns the rule for scope and whether one exists.
func (p Policy) Rule(scope Scope) (Rule, bool) {
	rule, ok := p[scope]
	return rule, ok
}

// DefaultPolicy is the table shipped by the open-source binary. The numbers
// are starting points sized so that a household or small office behind one
// address is never throttled in ordinary use.
func DefaultPolicy() Policy {
	return Policy{
		ScopeAnonymous:          {Limit: 300, Window: time.Minute},
		ScopeAuthenticated:      {Limit: 600, Window: time.Minute},
		ScopeSignInIP:           {Limit: 30, Window: 15 * time.Minute},
		ScopeSignInAccount:      {Limit: 10, Window: 15 * time.Minute},
		ScopeSignupIP:           {Limit: 10, Window: time.Hour},
		ScopeValidateIP:         {Limit: 60, Window: time.Minute},
		ScopePasswordResetIP:    {Limit: 10, Window: time.Hour},
		ScopePasswordResetEmail: {Limit: 3, Window: time.Hour},
		ScopeLinkMetadata:       {Limit: 60, Window: time.Minute},
		ScopeUploadUser:         {Limit: 120, Window: time.Minute},
		ScopeTranscribeUser:     {Limit: 20, Window: time.Hour},
		ScopeWriteUser:          {Limit: 120, Window: time.Minute},
	}
}

// Decision is the answer to an Allowed call.
type Decision struct {
	// Allowed is true when the request may proceed.
	Allowed bool
	// Rule is the rule that was consulted; zero when the scope is unlimited.
	Rule Rule
	// Remaining is how many units are left in the window before the call.
	Remaining int
	// RetryAfter is how long the caller should wait when refused.
	RetryAfter time.Duration
}

// Limiter answers whether an activity may proceed and records that it did.
// Allowed is a read and Hit is a write, so a caller can check before doing
// work and record only when the work counts, such as a failed sign-in.
type Limiter interface {
	Allowed(scope Scope, key string, cost int) Decision
	Hit(scope Scope, key string, cost int)
}

// Challenge verifies a proof-of-humanity token. Provider and SiteKey are
// exposed through the instance profile so the web app can render the
// matching widget. A nil Challenge means none is configured.
type Challenge interface {
	Provider() string
	SiteKey() string
	Verify(ctx context.Context, scope Scope, token string, clientIP string) error
}

// SignupPolicy decides whether a self-service registration may proceed. A
// nil SignupPolicy allows every registration.
type SignupPolicy interface {
	AllowSignup(ctx context.Context, canonicalEmail string, clientIP string) error
}

// MemoryLimiter is a sliding-window counter kept in process memory. Each key
// holds the count for the current fixed window and the previous one; the
// estimate weights the previous window by how much of it still overlaps the
// sliding window. Memory is constant per key.
type MemoryLimiter struct {
	policy   Policy
	now      func() time.Time
	capacity int

	mu           sync.Mutex
	entries      map[entryKey]*entry
	lastFailOpen time.Time
}

type entryKey struct {
	scope Scope
	key   string
}

type entry struct {
	windowStart time.Time
	current     int
	previous    int
}

// DefaultCapacity bounds how many keys the limiter tracks before it starts
// failing open.
const DefaultCapacity = 100_000

// MemoryOption tunes a MemoryLimiter.
type MemoryOption func(*MemoryLimiter)

// WithClock replaces the time source, for tests.
func WithClock(now func() time.Time) MemoryOption {
	return func(l *MemoryLimiter) { l.now = now }
}

// WithCapacity replaces the key cap.
func WithCapacity(capacity int) MemoryOption {
	return func(l *MemoryLimiter) { l.capacity = capacity }
}

// NewMemoryLimiter creates a limiter over the given policy.
func NewMemoryLimiter(policy Policy, options ...MemoryOption) *MemoryLimiter {
	limiter := &MemoryLimiter{
		policy:   policy,
		now:      time.Now,
		capacity: DefaultCapacity,
		entries:  map[entryKey]*entry{},
	}
	for _, option := range options {
		option(limiter)
	}
	return limiter
}

// Allowed reports whether cost more units fit in the window for scope and key.
func (l *MemoryLimiter) Allowed(scope Scope, key string, cost int) Decision {
	rule, ok := l.policy.Rule(scope)
	if !ok {
		return Decision{Allowed: true}
	}
	if cost < 1 {
		cost = 1
	}
	now := l.now()

	l.mu.Lock()
	defer l.mu.Unlock()
	used := 0
	windowStart := now.Truncate(rule.Window)
	if current, ok := l.lookup(entryKey{scope, key}, rule, now); ok {
		used = current.estimate(rule, now)
		windowStart = current.windowStart
	}
	remaining := max(rule.Limit-used, 0)
	if used+cost <= rule.Limit {
		return Decision{Allowed: true, Rule: rule, Remaining: remaining}
	}
	retryAfter := windowStart.Add(rule.Window).Sub(now)
	if retryAfter < time.Second {
		retryAfter = time.Second
	}
	return Decision{Allowed: false, Rule: rule, Remaining: remaining, RetryAfter: retryAfter}
}

// Hit records cost units against scope and key.
func (l *MemoryLimiter) Hit(scope Scope, key string, cost int) {
	rule, ok := l.policy.Rule(scope)
	if !ok {
		return
	}
	if cost < 1 {
		cost = 1
	}
	now := l.now()

	l.mu.Lock()
	defer l.mu.Unlock()
	id := entryKey{scope, key}
	current, ok := l.lookup(id, rule, now)
	if !ok {
		if !l.makeRoom(now) {
			return
		}
		current = &entry{windowStart: now.Truncate(rule.Window)}
		l.entries[id] = current
	}
	current.current += cost
}

// lookup returns the live entry for id, rolling its windows forward first.
// The caller holds the lock.
func (l *MemoryLimiter) lookup(id entryKey, rule Rule, now time.Time) (*entry, bool) {
	current, ok := l.entries[id]
	if !ok {
		return nil, false
	}
	current.roll(rule, now)
	return current, true
}

// makeRoom evicts expired entries when the cap is reached. It returns false
// when nothing could be evicted, in which case the caller fails open. The
// caller holds the lock.
func (l *MemoryLimiter) makeRoom(now time.Time) bool {
	if len(l.entries) < l.capacity {
		return true
	}
	for id, current := range l.entries {
		rule, ok := l.policy.Rule(id.scope)
		if !ok || now.Sub(current.windowStart) >= 2*rule.Window {
			delete(l.entries, id)
		}
	}
	if len(l.entries) < l.capacity {
		return true
	}
	if now.Sub(l.lastFailOpen) >= time.Minute {
		l.lastFailOpen = now
		slog.Warn("rate limiter is at capacity and failing open", slog.Int("capacity", l.capacity))
	}
	return false
}

// roll advances the entry so that windowStart is the fixed window containing
// now, carrying the previous window's count when it is adjacent and dropping
// it otherwise.
func (e *entry) roll(rule Rule, now time.Time) {
	windowStart := now.Truncate(rule.Window)
	switch {
	case windowStart.Equal(e.windowStart):
	case windowStart.Equal(e.windowStart.Add(rule.Window)):
		e.previous = e.current
		e.current = 0
		e.windowStart = windowStart
	default:
		e.previous = 0
		e.current = 0
		e.windowStart = windowStart
	}
}

// estimate is the sliding-window count: the current window plus the share of
// the previous window that still overlaps the last Window of time.
func (e *entry) estimate(rule Rule, now time.Time) int {
	elapsed := now.Sub(e.windowStart)
	overlap := 1 - float64(elapsed)/float64(rule.Window)
	if overlap < 0 {
		overlap = 0
	}
	return e.current + int(float64(e.previous)*overlap)
}
