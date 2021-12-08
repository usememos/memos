package common

import (
	"time"

	"github.com/google/uuid"
)

func GenUUID() string {
	return uuid.New().String()
}

func GetNowDateTimeStr() string {
	return time.Now().Format("RFC3339")
}
