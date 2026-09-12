package ratelimit

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type clock struct{ now time.Time }

func (c *clock) Now() time.Time          { return c.now }
func (c *clock) Advance(d time.Duration) { c.now = c.now.Add(d) }
func newClock() *clock                   { return &clock{now: time.Date(2026, 9, 12, 10, 0, 0, 0, time.UTC)} }
func policy(limit int, window time.Duration) Policy {
	return Policy{"test": {Limit: limit, Window: window}}
}

func TestAllowedDoesNotConsume(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(2, time.Minute), WithClock(c.Now))
	for range 10 {
		require.True(t, l.Allowed("test", "k", 1).Allowed)
	}
	require.Equal(t, 2, l.Allowed("test", "k", 1).Remaining)
}

func TestHitThenRefuse(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(3, time.Minute), WithClock(c.Now))
	l.Hit("test", "k", 1)
	l.Hit("test", "k", 1)
	d := l.Allowed("test", "k", 1)
	require.True(t, d.Allowed)
	require.Equal(t, 1, d.Remaining)
	l.Hit("test", "k", 1)
	d = l.Allowed("test", "k", 1)
	require.False(t, d.Allowed)
	require.Equal(t, 0, d.Remaining)
	require.Equal(t, time.Minute, d.RetryAfter)
	require.Equal(t, 3, d.Rule.Limit)

	// Another key is independent.
	require.True(t, l.Allowed("test", "other", 1).Allowed)
	// An unknown scope is unlimited.
	require.True(t, l.Allowed("unknown", "k", 1).Allowed)
}

func TestCost(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(10, time.Minute), WithClock(c.Now))
	require.True(t, l.Allowed("test", "k", 10).Allowed)
	require.False(t, l.Allowed("test", "k", 11).Allowed)
	l.Hit("test", "k", 7)
	require.True(t, l.Allowed("test", "k", 3).Allowed)
	require.False(t, l.Allowed("test", "k", 4).Allowed)
}

func TestSlidingWindow(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(10, time.Minute), WithClock(c.Now))
	l.Hit("test", "k", 10)
	require.False(t, l.Allowed("test", "k", 1).Allowed)

	// Half a window later, half of the previous window still counts.
	c.Advance(90 * time.Second)
	d := l.Allowed("test", "k", 1)
	require.True(t, d.Allowed)
	require.Equal(t, 5, d.Remaining)

	// Two windows later nothing counts.
	c.Advance(2 * time.Minute)
	require.Equal(t, 10, l.Allowed("test", "k", 1).Remaining)
}

func TestRetryAfterShrinksTowardWindowEnd(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(1, time.Minute), WithClock(c.Now))
	c.Advance(20 * time.Second)
	l.Hit("test", "k", 1)
	require.Equal(t, 40*time.Second, l.Allowed("test", "k", 1).RetryAfter)
	c.Advance(39*time.Second + 500*time.Millisecond)
	require.Equal(t, time.Second, l.Allowed("test", "k", 1).RetryAfter, "never advertises less than a second")
}

func TestCapacityEvictsExpiredThenFailsOpen(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(1, time.Minute), WithClock(c.Now), WithCapacity(2))
	l.Hit("test", "a", 1)
	l.Hit("test", "b", 1)
	require.False(t, l.Allowed("test", "a", 1).Allowed)

	// At capacity with nothing expired: the new key is not tracked, so it stays allowed.
	l.Hit("test", "c", 1)
	require.True(t, l.Allowed("test", "c", 1).Allowed, "fails open at capacity")

	// Once the old entries expire they are evicted and new keys are tracked again.
	c.Advance(3 * time.Minute)
	l.Hit("test", "c", 1)
	require.False(t, l.Allowed("test", "c", 1).Allowed)
}

func TestDefaultPolicyCoversEveryScope(t *testing.T) {
	p := DefaultPolicy()
	for _, scope := range []Scope{
		ScopeAnonymous, ScopeAuthenticated, ScopeSignInIP, ScopeSignInAccount, ScopeSignupIP, ScopeValidateIP,
		ScopePasswordResetIP, ScopePasswordResetEmail, ScopeLinkMetadata, ScopeUploadUser, ScopeTranscribeUser, ScopeWriteUser,
	} {
		rule, ok := p.Rule(scope)
		require.True(t, ok, scope)
		require.Positive(t, rule.Limit, scope)
		require.Positive(t, rule.Window, scope)
	}
}
