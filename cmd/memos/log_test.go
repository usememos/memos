package main

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"
)

func TestParseSlogLevel(t *testing.T) {
	tests := []struct {
		input     string
		wantLevel slog.Level
		wantErr   bool
	}{
		{"debug", slog.LevelDebug, false},
		{"info", slog.LevelInfo, false},
		{"warn", slog.LevelWarn, false},
		{"error", slog.LevelError, false},
		{"DEBUG", slog.LevelDebug, false},
		{"INFO", slog.LevelInfo, false},
		{"WARN", slog.LevelWarn, false},
		{"ERROR", slog.LevelError, false},
		{"invalid", slog.LevelInfo, true},
		{"", slog.LevelInfo, true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := parseSlogLevel(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseSlogLevel(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
			if got != tt.wantLevel {
				t.Errorf("parseSlogLevel(%q) = %v, want %v", tt.input, got, tt.wantLevel)
			}
		})
	}
}

func TestNewLoggerLevelFiltering(t *testing.T) {
	tests := []struct {
		level        slog.Level
		logAt        slog.Level
		msg          string
		shouldAppear bool
	}{
		// debug passes all
		{slog.LevelDebug, slog.LevelDebug, "debug-msg", true},
		{slog.LevelDebug, slog.LevelInfo, "info-msg", true},
		{slog.LevelDebug, slog.LevelWarn, "warn-msg", true},
		{slog.LevelDebug, slog.LevelError, "error-msg", true},
		// info suppresses debug
		{slog.LevelInfo, slog.LevelDebug, "debug-suppressed", false},
		{slog.LevelInfo, slog.LevelInfo, "info-visible", true},
		{slog.LevelInfo, slog.LevelWarn, "warn-visible", true},
		// warn suppresses debug+info
		{slog.LevelWarn, slog.LevelDebug, "debug-suppressed", false},
		{slog.LevelWarn, slog.LevelInfo, "info-suppressed", false},
		{slog.LevelWarn, slog.LevelWarn, "warn-visible", true},
		{slog.LevelWarn, slog.LevelError, "error-visible", true},
		// error suppresses everything below
		{slog.LevelError, slog.LevelDebug, "debug-suppressed", false},
		{slog.LevelError, slog.LevelInfo, "info-suppressed", false},
		{slog.LevelError, slog.LevelWarn, "warn-suppressed", false},
		{slog.LevelError, slog.LevelError, "error-visible", true},
	}

	for _, tt := range tests {
		var buf bytes.Buffer
		logger := newLogger(tt.level, &buf)
		logger.Log(context.TODO(), tt.logAt, tt.msg)

		appeared := strings.Contains(buf.String(), tt.msg)
		if appeared != tt.shouldAppear {
			t.Errorf("level=%s logAt=%s msg=%q: appeared=%v want=%v",
				tt.level, tt.logAt, tt.msg, appeared, tt.shouldAppear)
		}
	}
}

func TestNewLoggerOutputFormat(t *testing.T) {
	var buf bytes.Buffer
	logger := newLogger(slog.LevelDebug, &buf)
	logger.Info("hello-world", "key", "value")

	out := buf.String()
	if !strings.Contains(out, "hello-world") {
		t.Errorf("expected message in output, got: %s", out)
	}
	if !strings.Contains(out, "key=value") {
		t.Errorf("expected key=value attr in output, got: %s", out)
	}
	if !strings.Contains(out, "INFO") {
		t.Errorf("expected level in output, got: %s", out)
	}
}

func TestNewLoggerDoesNotMutateGlobalDefault(t *testing.T) {
	original := slog.Default()
	var buf bytes.Buffer
	_ = newLogger(slog.LevelError, &buf)
	if slog.Default() != original {
		t.Error("newLogger must not change slog.Default()")
	}
}
