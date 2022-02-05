package cmd

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Profile struct {
	// mode can be "release" or "dev"
	mode string
	// port is the binding port for server.
	port int
	// dsn points to where Memos stores its own data
	dsn string
}

func checkDSN(dataDir string) (string, error) {
	// Convert to absolute path if relative path is supplied.
	if !filepath.IsAbs(dataDir) {
		absDir, err := filepath.Abs(filepath.Dir(os.Args[0]) + "/" + dataDir)
		if err != nil {
			return "", err
		}
		dataDir = absDir
	}

	// Trim trailing / in case user supplies
	dataDir = strings.TrimRight(dataDir, "/")

	if _, err := os.Stat(dataDir); err != nil {
		error := fmt.Errorf("unable to access --data %s, %w", dataDir, err)
		return "", error
	}

	return dataDir, nil
}

// GetDevProfile will return a profile for dev.
func GetProfile() Profile {
	mode := flag.String("mode", "dev", "")
	port := flag.Int("port", 8080, "")
	data := flag.String("data", "", "")

	flag.Parse()

	dataDir, err := checkDSN(*data)
	if err != nil {
		fmt.Printf("%+v\n", err)
		os.Exit(1)
	}

	dsn := fmt.Sprintf("file:%s/memos_%s.db", dataDir, *mode)

	return Profile{
		mode: *mode,
		port: *port,
		dsn:  dsn,
	}
}
