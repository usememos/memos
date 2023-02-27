package main

import (
	_ "github.com/mattn/go-sqlite3"

	"github.com/usememos/memos/cmd"
)

func main() {
	err := cmd.Execute()
	if err != nil {
		panic(err)
	}
}
