package main

import (
	"os"

	_ "github.com/mattn/go-sqlite3"

	"github.com/usememos/memos/bin/server/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
