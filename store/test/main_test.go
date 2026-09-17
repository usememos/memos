package test

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestMain(m *testing.M) {
	// If DRIVER is set, run tests for that driver only
	if os.Getenv("DRIVER") != "" {
		defer TerminateContainers()
		m.Run() //nolint:revive // Exit code is handled by test runner
		return
	}

	// No DRIVER set - run tests for all drivers sequentially
	runAllDrivers()
}

func runAllDrivers() {
	// Each run names a driver and the extra environment it needs.
	runs := []struct {
		label string
		env   []string
	}{
		{"sqlite", []string{"DRIVER=sqlite"}},
		{"mysql", []string{"DRIVER=mysql"}},
		{"postgres", []string{"DRIVER=postgres"}},
	}
	_, currentFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Dir(filepath.Dir(filepath.Dir(currentFile)))

	var failed []string
	for _, run := range runs {
		fmt.Printf("\n==================== %s ====================\n\n", run.label)

		cmd := exec.Command("go", "test", "-v", "-count=1", "./store/test/...")
		cmd.Dir = projectRoot
		env := append(os.Environ(), run.env...)
		cmd.Env = env
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			failed = append(failed, run.label)
		}
	}

	fmt.Println()
	if len(failed) > 0 {
		fmt.Printf("FAIL: %v\n", failed)
		panic("some drivers failed")
	}
	fmt.Println("PASS: all drivers")
}
