package cmd

import (
	"fmt"
	"os"

	"memos/server"
	"memos/store"
)

type Main struct {
	profile *Profile

	server *server.Server

	db *store.DB
}

func Execute() {
	m := Main{}
	profile := GetProfile()
	m.profile = &profile

	err := m.Run()
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
