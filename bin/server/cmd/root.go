package cmd

import (
	"fmt"
	"os"

	"github.com/usememos/memos/server"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
	DB "github.com/usememos/memos/store/db"
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
	profile *profile.Profile
}

func (m *Main) Run() error {
	db := DB.NewDB(m.profile)
	if err := db.Open(); err != nil {
		return fmt.Errorf("cannot open db: %w", err)
	}

	s := server.NewServer(m.profile)

	storeInstance := store.New(db.Db, m.profile)
	s.Store = storeInstance

	println(greetingBanner)
	fmt.Printf("Version %s has started at :%d\n", m.profile.Version, m.profile.Port)

	return s.Run()
}

func Execute() {
	profile := profile.GetProfile()
	m := Main{
		profile: profile,
	}

	println("---")
	println("profile")
	println("mode:", profile.Mode)
	println("port:", profile.Port)
	println("dsn:", profile.DSN)
	println("version:", profile.Version)
	println("---")

	if err := m.Run(); err != nil {
		fmt.Printf("error: %+v\n", err)
		os.Exit(1)
	}
}
