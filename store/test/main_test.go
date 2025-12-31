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
		code := m.Run()
		TerminateContainers()
		os.Exit(code)
	}

	// No DRIVER set - run tests for all drivers sequentially
	runAllDrivers()
}

func runAllDrivers() {
	drivers := []string{"sqlite", "mysql", "postgres"}
	_, currentFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Dir(filepath.Dir(filepath.Dir(currentFile)))

	var failed []string
	for _, driver := range drivers {
		fmt.Printf("\n==================== %s ====================\n\n", driver)

		cmd := exec.Command("go", "test", "-v", "-count=1", "./store/test/...")
		cmd.Dir = projectRoot
		cmd.Env = append(os.Environ(), "DRIVER="+driver)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			failed = append(failed, driver)
		}
	}

	fmt.Println()
	if len(failed) > 0 {
		fmt.Printf("FAIL: %v\n", failed)
		os.Exit(1)
	}
	fmt.Println("PASS: all drivers")
	os.Exit(0)
}
