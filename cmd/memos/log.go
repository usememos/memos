package main

import (
	"io"
	"log/slog"

	"github.com/pkg/errors"
)

func parseSlogLevel(s string) (slog.Level, error) {
	var l slog.Level
	if err := l.UnmarshalText([]byte(s)); err != nil {
		return l, errors.Errorf("unknown log level %q: must be debug, info, warn, or error", s)
	}
	return l, nil
}

func newLogger(level slog.Level, w io.Writer) *slog.Logger {
	return slog.New(slog.NewTextHandler(w, &slog.HandlerOptions{Level: level}))
}
