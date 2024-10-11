//nolint:all
package cron

import (
	"io"
	"log"
	"reflect"
	"sync"
	"testing"
	"time"
)

func appendingJob(slice *[]int, value int) Job {
	var m sync.Mutex
	return FuncJob(func() {
		m.Lock()
		*slice = append(*slice, value)
		m.Unlock()
	})
}

func appendingWrapper(slice *[]int, value int) JobWrapper {
	return func(j Job) Job {
		return FuncJob(func() {
			appendingJob(slice, value).Run()
			j.Run()
		})
	}
}

func TestChain(t *testing.T) {
	var nums []int
	var (
		append1 = appendingWrapper(&nums, 1)
		append2 = appendingWrapper(&nums, 2)
		append3 = appendingWrapper(&nums, 3)
		append4 = appendingJob(&nums, 4)
	)
	NewChain(append1, append2, append3).Then(append4).Run()
	if !reflect.DeepEqual(nums, []int{1, 2, 3, 4}) {
		t.Error("unexpected order of calls:", nums)
	}
}

func TestChainRecover(t *testing.T) {
	panickingJob := FuncJob(func() {
		panic("panickingJob panics")
	})

	t.Run("panic exits job by default", func(*testing.T) {
		defer func() {
			if err := recover(); err == nil {
				t.Errorf("panic expected, but none received")
			}
		}()
		NewChain().Then(panickingJob).
			Run()
	})

	t.Run("Recovering JobWrapper recovers", func(*testing.T) {
		NewChain(Recover(PrintfLogger(log.New(io.Discard, "", 0)))).
			Then(panickingJob).
			Run()
	})

	t.Run("composed with the *IfStillRunning wrappers", func(*testing.T) {
		NewChain(Recover(PrintfLogger(log.New(io.Discard, "", 0)))).
			Then(panickingJob).
			Run()
	})
}

type countJob struct {
	m       sync.Mutex
	started int
	done    int
	delay   time.Duration
}

func (j *countJob) Run() {
	j.m.Lock()
	j.started++
	j.m.Unlock()
	time.Sleep(j.delay)
	j.m.Lock()
	j.done++
	j.m.Unlock()
}

func (j *countJob) Started() int {
	defer j.m.Unlock()
	j.m.Lock()
	return j.started
}

func (j *countJob) Done() int {
	defer j.m.Unlock()
	j.m.Lock()
	return j.done
}

func TestChainDelayIfStillRunning(t *testing.T) {
	t.Run("runs immediately", func(*testing.T) {
		var j countJob
		wrappedJob := NewChain(DelayIfStillRunning(DiscardLogger)).Then(&j)
		go wrappedJob.Run()
		time.Sleep(2 * time.Millisecond) // Give the job 2ms to complete.
		if c := j.Done(); c != 1 {
			t.Errorf("expected job run once, immediately, got %d", c)
		}
	})

	t.Run("second run immediate if first done", func(*testing.T) {
		var j countJob
		wrappedJob := NewChain(DelayIfStillRunning(DiscardLogger)).Then(&j)
		go func() {
			go wrappedJob.Run()
			time.Sleep(time.Millisecond)
			go wrappedJob.Run()
		}()
		time.Sleep(3 * time.Millisecond) // Give both jobs 3ms to complete.
		if c := j.Done(); c != 2 {
			t.Errorf("expected job run twice, immediately, got %d", c)
		}
	})

	t.Run("second run delayed if first not done", func(*testing.T) {
		var j countJob
		j.delay = 10 * time.Millisecond
		wrappedJob := NewChain(DelayIfStillRunning(DiscardLogger)).Then(&j)
		go func() {
			go wrappedJob.Run()
			time.Sleep(time.Millisecond)
			go wrappedJob.Run()
		}()

		// After 5ms, the first job is still in progress, and the second job was
		// run but should be waiting for it to finish.
		time.Sleep(5 * time.Millisecond)
		started, done := j.Started(), j.Done()
		if started != 1 || done != 0 {
			t.Error("expected first job started, but not finished, got", started, done)
		}

		// Verify that the second job completes.
		time.Sleep(25 * time.Millisecond)
		started, done = j.Started(), j.Done()
		if started != 2 || done != 2 {
			t.Error("expected both jobs done, got", started, done)
		}
	})
}

func TestChainSkipIfStillRunning(t *testing.T) {
	t.Run("runs immediately", func(*testing.T) {
		var j countJob
		wrappedJob := NewChain(SkipIfStillRunning(DiscardLogger)).Then(&j)
		go wrappedJob.Run()
		time.Sleep(2 * time.Millisecond) // Give the job 2ms to complete.
		if c := j.Done(); c != 1 {
			t.Errorf("expected job run once, immediately, got %d", c)
		}
	})

	t.Run("second run immediate if first done", func(*testing.T) {
		var j countJob
		wrappedJob := NewChain(SkipIfStillRunning(DiscardLogger)).Then(&j)
		go func() {
			go wrappedJob.Run()
			time.Sleep(time.Millisecond)
			go wrappedJob.Run()
		}()
		time.Sleep(3 * time.Millisecond) // Give both jobs 3ms to complete.
		if c := j.Done(); c != 2 {
			t.Errorf("expected job run twice, immediately, got %d", c)
		}
	})

	t.Run("second run skipped if first not done", func(*testing.T) {
		var j countJob
		j.delay = 10 * time.Millisecond
		wrappedJob := NewChain(SkipIfStillRunning(DiscardLogger)).Then(&j)
		go func() {
			go wrappedJob.Run()
			time.Sleep(time.Millisecond)
			go wrappedJob.Run()
		}()

		// After 5ms, the first job is still in progress, and the second job was
		// aleady skipped.
		time.Sleep(5 * time.Millisecond)
		started, done := j.Started(), j.Done()
		if started != 1 || done != 0 {
			t.Error("expected first job started, but not finished, got", started, done)
		}

		// Verify that the first job completes and second does not run.
		time.Sleep(25 * time.Millisecond)
		started, done = j.Started(), j.Done()
		if started != 1 || done != 1 {
			t.Error("expected second job skipped, got", started, done)
		}
	})

	t.Run("skip 10 jobs on rapid fire", func(*testing.T) {
		var j countJob
		j.delay = 10 * time.Millisecond
		wrappedJob := NewChain(SkipIfStillRunning(DiscardLogger)).Then(&j)
		for i := 0; i < 11; i++ {
			go wrappedJob.Run()
		}
		time.Sleep(200 * time.Millisecond)
		done := j.Done()
		if done != 1 {
			t.Error("expected 1 jobs executed, 10 jobs dropped, got", done)
		}
	})

	t.Run("different jobs independent", func(*testing.T) {
		var j1, j2 countJob
		j1.delay = 10 * time.Millisecond
		j2.delay = 10 * time.Millisecond
		chain := NewChain(SkipIfStillRunning(DiscardLogger))
		wrappedJob1 := chain.Then(&j1)
		wrappedJob2 := chain.Then(&j2)
		for i := 0; i < 11; i++ {
			go wrappedJob1.Run()
			go wrappedJob2.Run()
		}
		time.Sleep(100 * time.Millisecond)
		var (
			done1 = j1.Done()
			done2 = j2.Done()
		)
		if done1 != 1 || done2 != 1 {
			t.Error("expected both jobs executed once, got", done1, "and", done2)
		}
	})
}
