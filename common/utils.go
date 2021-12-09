package common

import (
	"time"

	"github.com/google/uuid"
)

func GenUUID() string {
	return uuid.New().String()
}

func GetNowDateTimeStr() string {
	return time.Now().Format("2006/01/02 15:04:05")
}
