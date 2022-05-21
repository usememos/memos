package store

import (
	"database/sql"
	"errors"
)

func FormatError(err error) error {
	if err == nil {
		return nil
	}

	switch err {
	case sql.ErrNoRows:
		return errors.New("data not found")
	default:
		return err
	}
}
