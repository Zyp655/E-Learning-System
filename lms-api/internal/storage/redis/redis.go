package redis

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/redis/go-redis/v9"
)

var (
	client     *redis.Client
	memFallback sync.Map
)

func InitRedis() {
	cfg := config.GetConfig().RedisCfg
	client = redis.NewClient(&redis.Options{
		Addr:     cfg.Address,
		Password: cfg.Password,
		DB:       cfg.Db,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("WARNING: Redis not reachable at %s (%v) — using in-memory cache fallback", cfg.Address, err)
	} else {
		log.Printf("Redis connected at %s", cfg.Address)
	}
}

func GetClient() *redis.Client {
	return client
}

func Set(ctx context.Context, key string, val string, ttl time.Duration) {
	if client != nil {
		if err := client.Set(ctx, key, val, ttl).Err(); err == nil {
			return
		}
	}
	memFallback.Store(key, val)
}

func Get(ctx context.Context, key string) (string, bool) {
	if client != nil {
		if v, err := client.Get(ctx, key).Result(); err == nil {
			return v, true
		}
	}
	if v, ok := memFallback.Load(key); ok {
		return v.(string), true
	}
	return "", false
}

func Del(ctx context.Context, key string) {
	if client != nil {
		_ = client.Del(ctx, key).Err()
	}
	memFallback.Delete(key)
}

func CloseRedis() {
	if client != nil {
		_ = client.Close()
	}
}
