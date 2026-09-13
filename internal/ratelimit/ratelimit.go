// Package ratelimit bounds how often a caller may do something. It provides a
// declarative policy table, an in-memory sliding-window limiter, and the
// seams a deployment fills to add a challenge or a signup policy.
package ratelimit

import (
	"context"
	"log/slog"
	"math"
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
// Consume does both atomically and is what every-attempt-counts callers use.
// A caller that only counts some outcomes, such as a failed sign-in, still
// consumes up front so concurrent attempts cannot share one remaining unit,
// and calls Refund when the outcome turns out not to count. Allowed is a
// read and Hit a write for callers that need neither.
type Limiter interface {
	Consume(scope Scope, key string, cost int) Decision
	Refund(scope Scope, key string, cost int)
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
	return l.decide(scope, key, cost, false)
}

// Consume admits and records cost units in one step, so concurrent callers
// cannot all be admitted on the strength of the same remaining budget.
func (l *MemoryLimiter) Consume(scope Scope, key string, cost int) Decision {
	return l.decide(scope, key, cost, true)
}

// Refund gives back cost units consumed earlier in the same window. It never
// drives the count below zero, so a refund after the window rolled is harmless.
func (l *MemoryLimiter) Refund(scope Scope, key string, cost int) {
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
	current, ok := l.lookup(entryKey{scope, key}, rule, now)
	if !ok {
		return
	}
	current.current = max(current.current-cost, 0)
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
	l.record(entryKey{scope, key}, rule, now, cost)
}

// decide evaluates the budget under one lock and, when charge is set,
// records the cost in the same critical section.
func (l *MemoryLimiter) decide(scope Scope, key string, cost int, charge bool) Decision {
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
	id := entryKey{scope, key}
	var state entry
	if current, ok := l.lookup(id, rule, now); ok {
		state = *current
	} else {
		state = entry{windowStart: now.Truncate(rule.Window)}
	}
	used := state.estimate(rule, now)
	remaining := max(rule.Limit-used, 0)
	if used+cost <= rule.Limit {
		if charge {
			l.record(id, rule, now, cost)
		}
		return Decision{Allowed: true, Rule: rule, Remaining: remaining}
	}
	return Decision{Allowed: false, Rule: rule, Remaining: remaining, RetryAfter: state.retryAfter(rule, now, cost)}
}

// record adds cost to the entry for id, creating it when there is room. The
// caller holds the lock.
func (l *MemoryLimiter) record(id entryKey, rule Rule, now time.Time, cost int) {
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

// evictionSample bounds the work done per call at capacity. Go map iteration
// starts at a random bucket, so inspecting a fixed number of entries samples
// the table; expired entries dominate a table that has been full for a
// while, so a small sample frees room in amortized constant time instead of
// scanning every entry under the lock.
const evictionSample = 32

// makeRoom evicts expired entries when the cap is reached, inspecting at most
// evictionSample entries. It returns false when the sample held nothing
// expired, in which case the caller fails open. The caller holds the lock.
func (l *MemoryLimiter) makeRoom(now time.Time) bool {
	if len(l.entries) < l.capacity {
		return true
	}
	inspected := 0
	for id, current := range l.entries {
		if inspected >= evictionSample {
			break
		}
		inspected++
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

// retryAfter is the delay until a request of cost would be admitted, in whole
// seconds and never less than one. It inverts estimate with the same integer
// truncation: the previous window's share decays through the current window,
// and at the boundary the current count becomes the previous one and decays
// in turn. The result is the first whole second strictly after the instant
// the estimate drops far enough.
func (e *entry) retryAfter(rule Rule, now time.Time, cost int) time.Duration {
	budget := rule.Limit - cost
	if budget < 0 {
		// A single request larger than the limit never fits; advertise one window.
		return rule.Window
	}
	windowEnd := e.windowStart.Add(rule.Window)
	var ready time.Time
	switch {
	case e.current <= budget && e.previous > 0:
		// Admitted once floor(previous * overlap) <= budget - current, that is
		// once overlap < (budget - current + 1) / previous.
		ready = e.windowStart.Add(decayTime(rule.Window, e.previous, budget-e.current+1))
	case e.current <= budget:
		ready = now
	default:
		// Only the next window can admit it, once the current count, then the
		// previous one, has decayed: overlap < (budget + 1) / current.
		ready = windowEnd.Add(decayTime(rule.Window, e.current, budget+1))
	}
	wait := ready.Sub(now)
	if wait < 0 {
		wait = 0
	}
	// Floor plus one second lands strictly after the boundary even when the
	// wait is a whole number of seconds, and is never less than one.
	return time.Duration(math.Floor(wait.Seconds()))*time.Second + time.Second
}

// decayTime is how far into a window a count of total must decay before its
// weighted share, total * (1 - t/window), falls below allowance. It is
// computed in integer nanoseconds with ceiling division so the boundary is
// never placed a rounding error too early.
func decayTime(window time.Duration, total, allowance int) time.Duration {
	if allowance >= total {
		return 0
	}
	numerator := int64(window) * int64(total-allowance)
	denominator := int64(total)
	return time.Duration((numerator + denominator - 1) / denominator)
}
