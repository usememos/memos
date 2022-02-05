package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"memos/server"
	"memos/store"
)

var (
	dataDir string
)

type Profile struct {
	// mode can be "release" or "dev"
	mode string
	// port is the binding port for server.
	port int
	// dsn points to where Memos stores its own data
	dsn string
}

func checkDataDir() error {
	// Convert to absolute path if relative path is supplied.
	if !filepath.IsAbs(dataDir) {
		absDir, err := filepath.Abs(filepath.Dir(os.Args[0]) + "/" + dataDir)
		if err != nil {
			return err
		}
		dataDir = absDir
	}

	// Trim trailing / in case user supplies
	dataDir = strings.TrimRight(dataDir, "/")

	if _, err := os.Stat(dataDir); err != nil {
		error := fmt.Errorf("unable to access --data %s, %w", dataDir, err)
		return error
	}

	return nil
}

type Main struct {
	profile *Profile

	server *server.Server

	db *store.DB
}

func Execute() {
	err := checkDataDir()
	if err != nil {
		fmt.Printf("%+v\n", err)
		os.Exit(1)
	}

	m := Main{}
	profile := GetDevProfile(dataDir)
	m.profile = &profile

	err = m.Run()
	if err != nil {
		fmt.Printf("%+v\n", err)
		os.Exit(1)
	}
}

func (m *Main) Run() error {
	db := store.NewDB(m.profile.dsn)

	if err := db.Open(); err != nil {
		return fmt.Errorf("cannot open db: %w", err)
	}

	m.db = db

	s := server.NewServer(m.profile.port)

	s.ShortcutService = store.NewShortcutService(db)
	s.MemoService = store.NewMemoService(db)
	s.UserService = store.NewUserService(db)
	s.ShortcutService = store.NewShortcutService(db)
	s.ResourceService = store.NewResourceService(db)

	m.server = s

	if err := s.Run(); err != nil {
		return err
	}

	return nil
}
