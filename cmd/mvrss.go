package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

var (
	mvrssCmdFlagFrom = "from"
	mvrssCmdFlagTo   = "to"
	mvrssCmd         = &cobra.Command{
		Use:   "mvrss", // `mvrss` is a shortened for 'means move resource'
		Short: "Move resource between storage",
		Run: func(cmd *cobra.Command, _ []string) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			from, err := cmd.Flags().GetString(mvrssCmdFlagFrom)
			if err != nil {
				fmt.Printf("failed to get from storage, error: %+v\n", err)
				return
			}

			to, err := cmd.Flags().GetString(mvrssCmdFlagTo)
			if err != nil {
				fmt.Printf("failed to get to storage, error: %+v\n", err)
				return
			}

			if from != "local" || to != "db" {
				fmt.Printf("only local=>db be supported currently\n")
				return
			}

			db := db.NewDB(profile)
			if err := db.Open(); err != nil {
				fmt.Printf("failed to open db, error: %+v\n", err)
				return
			}
			if err := db.Migrate(ctx); err != nil {
				fmt.Printf("failed to migrate db, error: %+v\n", err)
				return
			}

			s := store.New(db.DBInstance, profile)
			resources, err := s.ListResources(ctx, &store.FindResource{})
			if err != nil {
				fmt.Printf("failed to list resources, error: %+v\n", err)
				return
			}

			var emptyString string
			for _, res := range resources {
				if res.InternalPath == "" {
					continue
				}

				buf, err := os.ReadFile(res.InternalPath)
				if err != nil {
					fmt.Printf("Resource %5d failed to read file: %s\n", res.ID, err)
					continue
				}

				if len(buf) != int(res.Size) {
					fmt.Printf("Resource %5d size of file %d != %d\n", res.ID, len(buf), res.Size)
					continue
				}

				update := store.UpdateResource{
					ID:           res.ID,
					Blob:         buf,
					InternalPath: &emptyString,
				}
				_, err = s.UpdateResource(ctx, &update)
				if err != nil {
					fmt.Printf("Resource %5d failed to update: %s\n", res.ID, err)
					continue
				}

				fmt.Printf("Resource %5d copy %12d bytes from %s\n", res.ID, len(buf), res.InternalPath)
			}
			fmt.Println("done")
		},
	}
)

func init() {
	mvrssCmd.Flags().String(mvrssCmdFlagFrom, "local", "From storage")
	mvrssCmd.Flags().String(mvrssCmdFlagTo, "db", "To Storage")

	rootCmd.AddCommand(mvrssCmd)
}
