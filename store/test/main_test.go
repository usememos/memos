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
	drivers := []string{"sqlite", "mysql", "postgres"}
	_, currentFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Dir(filepath.Dir(filepath.Dir(currentFile)))

	// Build the docker image once for all tests to use
	fmt.Println("Building memos docker image for tests (memos-test:local)...")
	buildCmd := exec.Command("docker", "build", "-f", "store/test/Dockerfile", "-t", "memos-test:local", ".")
	buildCmd.Dir = projectRoot
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr
	if err := buildCmd.Run(); err != nil {
		fmt.Printf("Failed to build docker image: %v\n", err)
		// We don't exit here, we let the tests try to run (and maybe fail or rebuild)
		// strictly speaking we should probably fail, but let's be robust.
		// Actually, if build fails, tests relying on it will fail or try to rebuild.
		// Let's exit to be clear.
		panic(fmt.Sprintf("failed to build docker image: %v", err))
	}

	var failed []string
	for _, driver := range drivers {
		fmt.Printf("\n==================== %s ====================\n\n", driver)

		cmd := exec.Command("go", "test", "-v", "-count=1", "./store/test/...")
		cmd.Dir = projectRoot
		cmd.Env = append(os.Environ(), "DRIVER="+driver, "MEMOS_TEST_IMAGE_BUILT=1")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			failed = append(failed, driver)
		}
	}

	fmt.Println()
	if len(failed) > 0 {
		fmt.Printf("FAIL: %v\n", failed)
		panic("some drivers failed")
	}
	fmt.Println("PASS: all drivers")
}
