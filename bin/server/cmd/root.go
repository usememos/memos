package cmd

import (
	"fmt"
	"os"

	"memos/common"
	"memos/server"
	"memos/store"
)

const (
	greetingBanner = `
███╗   ███╗███████╗███╗   ███╗ ██████╗ ███████╗
████╗ ████║██╔════╝████╗ ████║██╔═══██╗██╔════╝
██╔████╔██║█████╗  ██╔████╔██║██║   ██║███████╗
██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██║   ██║╚════██║
██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝███████║
╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝
`
)

type Main struct {
	profile *common.Profile
}

func (m *Main) Run() error {
	db := store.NewDB(m.profile)
	if err := db.Open(); err != nil {
		return fmt.Errorf("cannot open db: %w", err)
	}

	s := server.NewServer(m.profile)

	storeInstance := store.New(db)
	s.Store = storeInstance

	if err := s.Run(); err != nil {
		return err
	}

	return nil
}

func Execute() {
	profile := common.GetProfile()
	m := Main{
		profile: profile,
	}

	println(greetingBanner)
	fmt.Printf("Version %s has started at :%d\n", profile.Version, profile.Port)

	if err := m.Run(); err != nil {
		fmt.Printf("error: %+v\n", err)
		os.Exit(1)
	}
}
