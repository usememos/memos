package cron

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCronNew(t *testing.T) {
	c := New()

	expectedInterval := 1 * time.Minute
	if c.interval != expectedInterval {
		t.Fatalf("Expected default interval %v, got %v", expectedInterval, c.interval)
	}

	expectedTimezone := time.UTC
	if c.timezone.String() != expectedTimezone.String() {
		t.Fatalf("Expected default timezone %v, got %v", expectedTimezone, c.timezone)
	}

	if len(c.jobs) != 0 {
		t.Fatalf("Expected no jobs by default, got \n%v", c.jobs)
	}

	if c.ticker != nil {
		t.Fatal("Expected the ticker NOT to be initialized")
	}
}

func TestCronSetInterval(t *testing.T) {
	c := New()

	interval := 2 * time.Minute

	c.SetInterval(interval)

	if c.interval != interval {
		t.Fatalf("Expected interval %v, got %v", interval, c.interval)
	}
}

func TestCronSetTimezone(t *testing.T) {
	c := New()

	timezone, _ := time.LoadLocation("Asia/Tokyo")

	c.SetTimezone(timezone)

	if c.timezone.String() != timezone.String() {
		t.Fatalf("Expected timezone %v, got %v", timezone, c.timezone)
	}
}

func TestCronAddAndRemove(t *testing.T) {
	c := New()

	if err := c.Add("test0", "* * * * *", nil); err == nil {
		t.Fatal("Expected nil function error")
	}

	if err := c.Add("test1", "invalid", func() {}); err == nil {
		t.Fatal("Expected invalid cron expression error")
	}

	if err := c.Add("test2", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	if err := c.Add("test3", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	if err := c.Add("test4", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	// overwrite test2
	if err := c.Add("test2", "1 2 3 4 5", func() {}); err != nil {
		t.Fatal(err)
	}

	if err := c.Add("test5", "1 2 3 4 5", func() {}); err != nil {
		t.Fatal(err)
	}

	// mock job deletion
	c.Remove("test4")

	// try to remove non-existing (should be no-op)
	c.Remove("missing")

	// check job keys
	{
		expectedKeys := []string{"test3", "test2", "test5"}

		if v := len(c.jobs); v != len(expectedKeys) {
			t.Fatalf("Expected %d jobs, got %d", len(expectedKeys), v)
		}

		for _, k := range expectedKeys {
			if c.jobs[k] == nil {
				t.Fatalf("Expected job with key %s, got nil", k)
			}
		}
	}

	// check the jobs schedule
	{
		expectedSchedules := map[string]string{
			"test2": `{"minutes":{"1":{}},"hours":{"2":{}},"days":{"3":{}},"months":{"4":{}},"daysOfWeek":{"5":{}}}`,
			"test3": `{"minutes":{"0":{},"1":{},"10":{},"11":{},"12":{},"13":{},"14":{},"15":{},"16":{},"17":{},"18":{},"19":{},"2":{},"20":{},"21":{},"22":{},"23":{},"24":{},"25":{},"26":{},"27":{},"28":{},"29":{},"3":{},"30":{},"31":{},"32":{},"33":{},"34":{},"35":{},"36":{},"37":{},"38":{},"39":{},"4":{},"40":{},"41":{},"42":{},"43":{},"44":{},"45":{},"46":{},"47":{},"48":{},"49":{},"5":{},"50":{},"51":{},"52":{},"53":{},"54":{},"55":{},"56":{},"57":{},"58":{},"59":{},"6":{},"7":{},"8":{},"9":{}},"hours":{"0":{},"1":{},"10":{},"11":{},"12":{},"13":{},"14":{},"15":{},"16":{},"17":{},"18":{},"19":{},"2":{},"20":{},"21":{},"22":{},"23":{},"3":{},"4":{},"5":{},"6":{},"7":{},"8":{},"9":{}},"days":{"1":{},"10":{},"11":{},"12":{},"13":{},"14":{},"15":{},"16":{},"17":{},"18":{},"19":{},"2":{},"20":{},"21":{},"22":{},"23":{},"24":{},"25":{},"26":{},"27":{},"28":{},"29":{},"3":{},"30":{},"31":{},"4":{},"5":{},"6":{},"7":{},"8":{},"9":{}},"months":{"1":{},"10":{},"11":{},"12":{},"2":{},"3":{},"4":{},"5":{},"6":{},"7":{},"8":{},"9":{}},"daysOfWeek":{"0":{},"1":{},"2":{},"3":{},"4":{},"5":{},"6":{}}}`,
			"test5": `{"minutes":{"1":{}},"hours":{"2":{}},"days":{"3":{}},"months":{"4":{}},"daysOfWeek":{"5":{}}}`,
		}
		for k, v := range expectedSchedules {
			raw, err := json.Marshal(c.jobs[k].schedule)
			if err != nil {
				t.Fatal(err)
			}

			if string(raw) != v {
				t.Fatalf("Expected %q schedule \n%s, \ngot \n%s", k, v, raw)
			}
		}
	}
}

func TestCronMustAdd(t *testing.T) {
	c := New()

	defer func() {
		if r := recover(); r == nil {
			t.Errorf("test1 didn't panic")
		}
	}()

	c.MustAdd("test1", "* * * * *", nil)

	c.MustAdd("test2", "* * * * *", func() {})

	if _, ok := c.jobs["test2"]; !ok {
		t.Fatal("Couldn't find job test2")
	}
}

func TestCronRemoveAll(t *testing.T) {
	c := New()

	if err := c.Add("test1", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	if err := c.Add("test2", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	if err := c.Add("test3", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	if v := len(c.jobs); v != 3 {
		t.Fatalf("Expected %d jobs, got %d", 3, v)
	}

	c.RemoveAll()

	if v := len(c.jobs); v != 0 {
		t.Fatalf("Expected %d jobs, got %d", 0, v)
	}
}

func TestCronTotal(t *testing.T) {
	c := New()

	if v := c.Total(); v != 0 {
		t.Fatalf("Expected 0 jobs, got %v", v)
	}

	if err := c.Add("test1", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	if err := c.Add("test2", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	// overwrite
	if err := c.Add("test1", "* * * * *", func() {}); err != nil {
		t.Fatal(err)
	}

	if v := c.Total(); v != 2 {
		t.Fatalf("Expected 2 jobs, got %v", v)
	}
}

func TestCronStartStop(t *testing.T) {
	c := New()

	c.SetInterval(1 * time.Second)

	test1 := 0
	test2 := 0

	err := c.Add("test1", "* * * * *", func() {
		test1++
	})
	require.NoError(t, err)

	err = c.Add("test2", "* * * * *", func() {
		test2++
	})
	require.NoError(t, err)

	expectedCalls := 3

	// call twice Start to check if the previous ticker will be reseted
	c.Start()
	c.Start()

	time.Sleep(3250 * time.Millisecond)

	// call twice Stop to ensure that the second stop is no-op
	c.Stop()
	c.Stop()

	if test1 != expectedCalls {
		t.Fatalf("Expected %d test1, got %d", expectedCalls, test1)
	}
	if test2 != expectedCalls {
		t.Fatalf("Expected %d test2, got %d", expectedCalls, test2)
	}

	// resume for ~5 seconds
	c.Start()
	time.Sleep(5250 * time.Millisecond)
	c.Stop()

	expectedCalls += 5

	if test1 != expectedCalls {
		t.Fatalf("Expected %d test1, got %d", expectedCalls, test1)
	}
	if test2 != expectedCalls {
		t.Fatalf("Expected %d test2, got %d", expectedCalls, test2)
	}
}
