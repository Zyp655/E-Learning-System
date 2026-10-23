package config

import (
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerCfg       ServerConfig
	DbCfg           DatabaseConfig
	RedisCfg        RedisConfig
	JwtCfg          JwtConfig
	OpenAICfg       OpenAIConfig
	S3Cfg           S3Config
	ConfusionCfg    ConfusionConfig
	MessagingBroker string
}

type ServerConfig struct {
	Port       int
	ServerHost string
	WebUrl     string
	AppEnv     string
}

type DatabaseConfig struct {
	Driver         string
	Host           string
	Port           string
	User           string
	Password       string
	DbName         string
	SSLMode        string
	TimeZone       string
	FallbackSQLite bool
}

type RedisConfig struct {
	Address  string
	Password string
	Db       int
}

type JwtConfig struct {
	SecretKey   string
	TimeAccess  time.Duration
	TimeRefresh time.Duration
}

type OpenAIConfig struct {
	APIKey         string
	Model          string
	EmbeddingModel string
	TTSModel       string
	TTSVoice       string
}

type S3Config struct {
	Endpoint        string
	Region          string
	BucketName      string
	AccessKeyID     string
	SecretAccessKey string
}

type ConfusionConfig struct {
	MLThreshold             float64
	RuleThreshold           float64
	SlidingWindowSize       int
	CooldownSeconds         int
	FaceSimilarityThreshold float64
	MaxAbsentChecks         int
}

var (
	cfgInstance *Config
	cfgOnce     sync.Once
)

func GetConfig() *Config {
	cfgOnce.Do(func() {
		_ = godotenv.Load()
		cfgInstance = &Config{
			ServerCfg: ServerConfig{
				Port:       getEnvInt("SERVER_PORT", 8000),
				ServerHost: getEnv("SERVER_HOST", "http://localhost:8000"),
				WebUrl:     getEnv("WEB_URL", "http://localhost:3000"),
				AppEnv:     getEnv("APP_ENV", "development"),
			},
			DbCfg: DatabaseConfig{
				Driver:         getEnv("DB_DRIVER", "postgres"),
				Host:           getEnv("DB_HOST", "localhost"),
				Port:           getEnv("DB_PORT", "5432"),
				User:           getEnv("DB_USER", "lms_user"),
				Password:       getEnv("DB_PASSWORD", "lms_password"),
				DbName:         getEnv("DB_NAME", "lms_confusion"),
				SSLMode:        getEnv("DB_SSLMODE", "disable"),
				TimeZone:       getEnv("DB_TIMEZONE", "Asia/Ho_Chi_Minh"),
				FallbackSQLite: getEnvBool("DB_FALLBACK_SQLITE", true),
			},
			RedisCfg: RedisConfig{
				Address:  getEnv("REDIS_ADDR", "localhost:6379"),
				Password: getEnv("REDIS_PASSWORD", ""),
				Db:       getEnvInt("REDIS_DB", 0),
			},
			JwtCfg: JwtConfig{
				SecretKey:   getEnv("JWT_SECRET", "lms-confusion-super-secret-jwt-key-2026-min-32-chars"),
				TimeAccess:  time.Duration(getEnvInt("JWT_ACCESS_TTL_MINUTES", 120)) * time.Minute,
				TimeRefresh: time.Duration(getEnvInt("JWT_REFRESH_TTL_HOURS", 168)) * time.Hour,
			},
			OpenAICfg: OpenAIConfig{
				APIKey:         getEnv("OPENAI_API_KEY", ""),
				Model:          getEnv("OPENAI_MODEL", "gpt-4o-mini"),
				EmbeddingModel: getEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
				TTSModel:       getEnv("OPENAI_TTS_MODEL", "tts-1"),
				TTSVoice:       getEnv("OPENAI_TTS_VOICE", "nova"),
			},
			S3Cfg: S3Config{
				Endpoint:        getEnv("S3_ENDPOINT", "http://localhost:9000"),
				Region:          getEnv("S3_REGION", "us-east-1"),
				BucketName:      getEnv("S3_BUCKET", "lms-media"),
				AccessKeyID:     getEnv("S3_ACCESS_KEY", "minioadmin"),
				SecretAccessKey: getEnv("S3_SECRET_KEY", "minioadmin123"),
			},
			ConfusionCfg: ConfusionConfig{
				MLThreshold:             getEnvFloat("CONFUSION_ML_THRESHOLD", 0.60),
				RuleThreshold:           getEnvFloat("CONFUSION_RULE_THRESHOLD", 35.0),
				SlidingWindowSize:       getEnvInt("CONFUSION_WINDOW_SIZE", 3),
				CooldownSeconds:         getEnvInt("CONFUSION_COOLDOWN_SECONDS", 300),
				FaceSimilarityThreshold: getEnvFloat("FACE_SIMILARITY_THRESHOLD", 0.55),
				MaxAbsentChecks:         getEnvInt("MAX_ABSENT_CHECKS", 6),
			},
			MessagingBroker: getEnv("MESSAGING_BROKER", "postgres"),
		}
	})
	return cfgInstance
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}
