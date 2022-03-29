package cmd

import (
	"fmt"
	"os"

	"memos/common"
	"memos/server"
	"memos/store"
)

type Main struct {
	profile *common.Profile

	server *server.Server

	db *store.DB
}

func (m *Main) Run() error {
	db := store.NewDB(m.profile)
	if err := db.Open(); err != nil {
		return fmt.Errorf("cannot open db: %w", err)
	}

	m.db = db

	s := server.NewServer(m.profile)

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

func Execute() {
	profile := common.GetProfile()
	m := Main{
		profile: &profile,
	}

	err := m.Run()
	if err != nil {
		fmt.Printf("%+v\n", err)
		os.Exit(1)
	}
}
