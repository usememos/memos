package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"github.com/usememos/memos/store"
	"time"
)

func SetUserCache(ctx context.Context, rdb *redis.Client, user *store.User) error {
	key := fmt.Sprintf("user:%d", user.ID)
	data, err := json.Marshal(user)
	if err != nil {
		return err
	}
	return rdb.Set(ctx, key, data, time.Hour).Err() // 缓存 1 小时
}

func GetUserCache(ctx context.Context, rdb *redis.Client, userID int) (*store.User, error) {
	key := fmt.Sprintf("user:%d", userID)
	data, err := rdb.Get(ctx, key).Bytes()
	if err == redis.Nil {
		log.Debug("User does not exist in redis")
		return nil, nil // 缓存未命中
	}
	if err != nil {
		log.Errorf("Error getting user from redis, err is: %s", err)
		return nil, err
	}

	var user store.User
	if err := json.Unmarshal(data, &user); err != nil {
		log.Errorf("unmarshal data to user error: %s", err)
		return nil, err
	}

	return &user, nil
}
