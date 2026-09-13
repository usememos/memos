package ratelimit

import (
	"sync"
	"sync/atomic"
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
	// At the boundary the three hits still count in full; one second later
	// their weighted share has dropped to two.
	require.Equal(t, 61*time.Second, d.RetryAfter)
	require.Equal(t, 3, d.Rule.Limit)
	c.Advance(60 * time.Second)
	require.False(t, l.Allowed("test", "k", 1).Allowed)
	c.Advance(time.Second)
	require.True(t, l.Allowed("test", "k", 1).Allowed)

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

func TestRetryAfterIsWhenTheRequestWouldSucceed(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(1, time.Minute), WithClock(c.Now))
	c.Advance(20 * time.Second)
	l.Hit("test", "k", 1)

	// The hit becomes the previous window at 10:01:00, where it still counts in
	// full; one second later its weighted share truncates to zero.
	d := l.Allowed("test", "k", 1)
	require.False(t, d.Allowed)
	require.Equal(t, 41*time.Second, d.RetryAfter)

	// One second short of the advertised delay is refused; the delay itself is enough.
	c.Advance(d.RetryAfter - time.Second)
	require.False(t, l.Allowed("test", "k", 1).Allowed)
	c.Advance(time.Second)
	require.True(t, l.Allowed("test", "k", 1).Allowed)
}

func TestRetryAfterWithinTheCurrentWindow(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(10, time.Minute), WithClock(c.Now))
	l.Hit("test", "k", 10)
	c.Advance(time.Minute) // the ten hits are now the previous window
	l.Hit("test", "k", 2)  // current 2, previous 10: estimate 12 at the boundary

	// Admitted once floor(10 * (1 - t/60s)) <= 7, which first holds just after
	// t = 12s, so the advertised delay is 13s.
	d := l.Allowed("test", "k", 1)
	require.False(t, d.Allowed)
	require.Equal(t, 13*time.Second, d.RetryAfter)
	c.Advance(12 * time.Second)
	require.False(t, l.Allowed("test", "k", 1).Allowed)
	c.Advance(time.Second)
	require.True(t, l.Allowed("test", "k", 1).Allowed)
}

func TestRetryAfterNeverBelowOneSecond(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(60, time.Minute), WithClock(c.Now))
	l.Hit("test", "k", 60)
	// Exactly at the boundary the previous window still counts in full.
	c.Advance(time.Minute)
	d := l.Allowed("test", "k", 1)
	require.False(t, d.Allowed)
	require.Equal(t, time.Second, d.RetryAfter)
	c.Advance(time.Second)
	require.True(t, l.Allowed("test", "k", 1).Allowed)
}

func TestRetryAfterForOversizedCost(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(2, time.Minute), WithClock(c.Now))
	d := l.Allowed("test", "k", 3)
	require.False(t, d.Allowed)
	require.Equal(t, time.Minute, d.RetryAfter)
}

func TestConsumeIsAtomicUnderConcurrency(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(1, time.Minute), WithClock(c.Now))

	const racers = 64
	var wg sync.WaitGroup
	start := make(chan struct{})
	var admitted atomic.Int32
	for range racers {
		wg.Go(func() {
			<-start
			if l.Consume("test", "k", 1).Allowed {
				admitted.Add(1)
			}
		})
	}
	close(start)
	wg.Wait()
	require.Equal(t, int32(1), admitted.Load(), "exactly one concurrent consume may succeed")

	// Consume records the cost it admits and refuses once spent.
	l2 := NewMemoryLimiter(policy(2, time.Minute), WithClock(c.Now))
	require.True(t, l2.Consume("test", "k", 1).Allowed)
	require.Equal(t, 1, l2.Consume("test", "k", 1).Remaining)
	require.False(t, l2.Consume("test", "k", 1).Allowed)
	// A refused consume charges nothing.
	require.Equal(t, 0, l2.Allowed("test", "k", 1).Remaining)
	require.True(t, l2.Consume("unknown", "k", 1).Allowed)
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

func TestRefundGivesBackWhatWasConsumed(t *testing.T) {
	c := newClock()
	l := NewMemoryLimiter(policy(2, time.Minute), WithClock(c.Now))
	require.True(t, l.Consume("test", "k", 1).Allowed)
	require.True(t, l.Consume("test", "k", 1).Allowed)
	require.False(t, l.Consume("test", "k", 1).Allowed)
	l.Refund("test", "k", 1)
	require.Equal(t, 1, l.Allowed("test", "k", 1).Remaining)
	// A refund never drives the count negative, and an unknown key is a no-op.
	l.Refund("test", "k", 5)
	require.Equal(t, 2, l.Allowed("test", "k", 1).Remaining)
	l.Refund("test", "never-seen", 1)
	require.Equal(t, 2, l.Allowed("test", "never-seen", 1).Remaining)
}

func TestCapacityEvictionIsBoundedPerCall(t *testing.T) {
	c := newClock()
	const capacity = 4 * evictionSample
	l := NewMemoryLimiter(policy(1, time.Minute), WithClock(c.Now), WithCapacity(capacity))
	for i := range capacity {
		l.Hit("test", "k"+string(rune('a'+i%26))+string(rune('a'+i/26)), 1)
	}
	require.Len(t, l.entries, capacity)
	c.Advance(3 * time.Minute) // everything has expired

	// Each new key at capacity inspects only a sample, so one call frees at
	// most evictionSample entries rather than sweeping the whole table.
	l.Hit("test", "fresh", 1)
	require.Len(t, l.entries, capacity-evictionSample+1)
	require.False(t, l.Allowed("test", "fresh", 1).Allowed, "the fresh key was tracked")
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
