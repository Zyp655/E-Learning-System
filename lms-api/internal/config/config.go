package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
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
	SeedCfg         SeedConfig
	WsCfg           WebSocketConfig
	MessagingBroker string
}

// SeedConfig controls the demo dataset (admin/teacher/student accounts sharing one password).
type SeedConfig struct {
	// DemoData is the raw SEED_DEMO_DATA value: "" means "default for APP_ENV", otherwise a bool string.
	DemoData string
	// DemoPassword is SEED_DEMO_PASSWORD, the password of every seeded account.
	DemoPassword string
}

// WebSocketConfig controls browser WebSocket upgrades.
type WebSocketConfig struct {
	// AllowedOrigins lists the browser origins (scheme://host[:port]) allowed to open a WebSocket.
	AllowedOrigins []string
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

// ConfusionConfig holds the admin-tunable confusion settings (GET/PUT /v1/admin/confusion/settings).
// Read it with GetConfusionConfig and change it with UpdateConfusionConfig/SetConfusionConfig: admin updates
// and concurrent predictions must not touch Config.ConfusionCfg directly.
type ConfusionConfig struct {
	// MLThreshold is legacy (pre SP-BEF MLP threshold). The SP-BEF decision uses SPBEF.ThetaOn; MLThreshold is
	// only a fallback for theta_on when the loaded sp_bef_params.json has theta_on <= 0 (never with shipped params).
	MLThreshold float64 `json:"mlThreshold"`
	// RuleThreshold is echoed in the predict response (ruleThreshold) for the client-side hybrid rule score.
	RuleThreshold float64 `json:"ruleThreshold"`
	// SlidingWindowSize, CooldownSeconds, FaceSimilarityThreshold and MaxAbsentChecks are legacy: stored and
	// returned for the admin UI but not read by the server (SP-BEF uses cooldown_sec from sp_bef_params.json).
	SlidingWindowSize       int     `json:"slidingWindowSize"`
	CooldownSeconds         int     `json:"cooldownSeconds"`
	FaceSimilarityThreshold float64 `json:"faceSimilarityThreshold"`
	MaxAbsentChecks         int     `json:"maxAbsentChecks"`
	// SPBEF are admin overrides of the SP-BEF fusion parameters; nil fields use sp_bef_params.json.
	SPBEF SPBEFOverrides `json:"spBefOverrides"`
}

// SPBEFOverrides overrides SP-BEF fusion parameters from sp_bef_params.json. A nil field keeps the shipped value.
// Never mutate a pointed-to value in place: replace the pointer (copies share pointers, see Clone).
type SPBEFOverrides struct {
	ThetaOn         *float64 `json:"thetaOn,omitempty"`
	ThetaOff        *float64 `json:"thetaOff,omitempty"`
	MinHoldSec      *float64 `json:"minHoldSec,omitempty"`
	WFace           *float64 `json:"wFace,omitempty"`
	WBeh            *float64 `json:"wBeh,omitempty"`
	WQuiz           *float64 `json:"wQuiz,omitempty"`
	HMMKeepConfused *float64 `json:"hmmKeepConfused,omitempty"`
}

// Clone returns a deep copy so callers can never observe or cause in-place pointer writes.
func (o SPBEFOverrides) Clone() SPBEFOverrides {
	cp := func(p *float64) *float64 {
		if p == nil {
			return nil
		}
		v := *p
		return &v
	}
	return SPBEFOverrides{
		ThetaOn:         cp(o.ThetaOn),
		ThetaOff:        cp(o.ThetaOff),
		MinHoldSec:      cp(o.MinHoldSec),
		WFace:           cp(o.WFace),
		WBeh:            cp(o.WBeh),
		WQuiz:           cp(o.WQuiz),
		HMMKeepConfused: cp(o.HMMKeepConfused),
	}
}

// confusionMu guards Config.ConfusionCfg (written by PUT /admin/confusion/settings, read by every prediction).
var confusionMu sync.RWMutex

// GetConfusionConfig returns a race-free snapshot of the confusion settings.
func GetConfusionConfig() ConfusionConfig {
	c := GetConfig()
	confusionMu.RLock()
	defer confusionMu.RUnlock()
	out := c.ConfusionCfg
	out.SPBEF = c.ConfusionCfg.SPBEF.Clone()
	return out
}

// SetConfusionConfig atomically replaces the confusion settings.
func SetConfusionConfig(cc ConfusionConfig) {
	c := GetConfig()
	cc.SPBEF = cc.SPBEF.Clone()
	confusionMu.Lock()
	c.ConfusionCfg = cc
	confusionMu.Unlock()
}

// UpdateConfusionConfig applies fn to a copy of the settings under the write lock and stores the result unless
// fn returns an error. It returns the stored (or unchanged, on error) settings.
func UpdateConfusionConfig(fn func(*ConfusionConfig) error) (ConfusionConfig, error) {
	c := GetConfig()
	confusionMu.Lock()
	defer confusionMu.Unlock()
	next := c.ConfusionCfg
	next.SPBEF = c.ConfusionCfg.SPBEF.Clone()
	if err := fn(&next); err != nil {
		cur := c.ConfusionCfg
		cur.SPBEF = cur.SPBEF.Clone()
		return cur, err
	}
	next.SPBEF = next.SPBEF.Clone()
	c.ConfusionCfg = next
	out := next
	out.SPBEF = next.SPBEF.Clone()
	return out, nil
}

var (
	cfgInstance *Config
	cfgOnce     sync.Once
)

// DefaultJWTSecret is the development-only fallback used when JWT_SECRET is unset. It is public (committed
// in this repository), so anyone can sign tokens with it, including tokens with Admin permissions.
const DefaultJWTSecret = "lms-confusion-super-secret-jwt-key-2026-min-32-chars"

// ComposeDefaultJWTSecret is the fallback JWT_SECRET in docker-compose.yml. It is also public.
const ComposeDefaultJWTSecret = "lms-confusion-super-secret-jwt-key-2026"

// publicJWTSecrets lists every JWT secret value committed to this repository (config default, .env.example,
// docker-compose.yml). None of them may be used outside local development.
var publicJWTSecrets = map[string]struct{}{
	DefaultJWTSecret:        {},
	ComposeDefaultJWTSecret: {},
}

// DevSeedPassword is the well-known password of the demo accounts in local development (documented in README).
const DevSeedPassword = "123456"

// MinSeedPasswordLength is the minimum SEED_DEMO_PASSWORD length outside local development.
const MinSeedPasswordLength = 8

// IsDevEnv reports whether appEnv is a local development/test environment (empty counts as development).
func IsDevEnv(appEnv string) bool {
	env := strings.ToLower(strings.TrimSpace(appEnv))
	return env == "" || env == "development" || env == "dev" || env == "local" || env == "test"
}

// DemoSeedPlan decides whether the demo dataset is seeded and with which password.
//
//   - Development (IsDevEnv): seeded unless SEED_DEMO_DATA=false; password is SEED_DEMO_PASSWORD or DevSeedPassword.
//   - Any other APP_ENV: seeded only with SEED_DEMO_DATA=true, and SEED_DEMO_PASSWORD must be set, at least
//     MinSeedPasswordLength characters and not DevSeedPassword; otherwise an error is returned and startup must stop.
func (c *Config) DemoSeedPlan() (enabled bool, password string, err error) {
	raw := strings.TrimSpace(c.SeedCfg.DemoData)
	dev := IsDevEnv(c.ServerCfg.AppEnv)
	enabled = dev
	if raw != "" {
		b, perr := strconv.ParseBool(raw)
		if perr != nil {
			return false, "", fmt.Errorf("SEED_DEMO_DATA=%q is not a boolean", raw)
		}
		enabled = b
	}
	if !enabled {
		return false, "", nil
	}
	password = c.SeedCfg.DemoPassword
	if dev {
		if password == "" {
			password = DevSeedPassword
		}
		return true, password, nil
	}
	if password == "" {
		return false, "", fmt.Errorf("APP_ENV=%s with SEED_DEMO_DATA=true requires SEED_DEMO_PASSWORD", c.ServerCfg.AppEnv)
	}
	if len(password) < MinSeedPasswordLength || password == DevSeedPassword {
		return false, "", fmt.Errorf("APP_ENV=%s requires SEED_DEMO_PASSWORD with at least %d characters that is not the public development password", c.ServerCfg.AppEnv, MinSeedPasswordLength)
	}
	return true, password, nil
}

// DefaultWSAllowedOrigins are the lms-web (3000) and lms-admin (3001) development origins.
var DefaultWSAllowedOrigins = []string{"http://localhost:3000", "http://localhost:3001"}

// Credentials committed to this repository (config defaults, .env.example, docker-compose.yml). They are fine for
// local development but must never be used by a deployed API.
const (
	DefaultDBPassword  = "lms_password"
	DefaultS3AccessKey = "minioadmin"
	DefaultS3SecretKey = "minioadmin123"
)

// Validate rejects configurations that are unsafe outside local development.
func (c *Config) Validate() error {
	if IsDevEnv(c.ServerCfg.AppEnv) {
		return nil
	}
	_, isPublic := publicJWTSecrets[strings.TrimSpace(c.JwtCfg.SecretKey)]
	if strings.TrimSpace(c.JwtCfg.SecretKey) == "" || isPublic {
		return fmt.Errorf("APP_ENV=%s requires JWT_SECRET to be set to a private value (the built-in default is public)", c.ServerCfg.AppEnv)
	}
	if !strings.EqualFold(strings.TrimSpace(c.DbCfg.Driver), "sqlite") && c.DbCfg.Password == DefaultDBPassword {
		return fmt.Errorf("APP_ENV=%s requires DB_PASSWORD to be set to a private value (the built-in default is public)", c.ServerCfg.AppEnv)
	}
	if c.S3Cfg.AccessKeyID == DefaultS3AccessKey || c.S3Cfg.SecretAccessKey == DefaultS3SecretKey {
		return fmt.Errorf("APP_ENV=%s requires S3_ACCESS_KEY and S3_SECRET_KEY to be set to private values (the MinIO defaults are public)", c.ServerCfg.AppEnv)
	}
	return nil
}

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
			DbCfg: loadDatabaseConfig(getEnv("APP_ENV", "development")),
			RedisCfg: RedisConfig{
				Address:  getEnv("REDIS_ADDR", "localhost:6379"),
				Password: getEnv("REDIS_PASSWORD", ""),
				Db:       getEnvInt("REDIS_DB", 0),
			},
			JwtCfg: JwtConfig{
				SecretKey:   getEnv("JWT_SECRET", DefaultJWTSecret),
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
				AccessKeyID:     getEnv("S3_ACCESS_KEY", DefaultS3AccessKey),
				SecretAccessKey: getEnv("S3_SECRET_KEY", DefaultS3SecretKey),
			},
			ConfusionCfg: ConfusionConfig{
				MLThreshold:             getEnvFloat("CONFUSION_ML_THRESHOLD", 0.60),
				RuleThreshold:           getEnvFloat("CONFUSION_RULE_THRESHOLD", 35.0),
				SlidingWindowSize:       getEnvInt("CONFUSION_WINDOW_SIZE", 3),
				CooldownSeconds:         getEnvInt("CONFUSION_COOLDOWN_SECONDS", 300),
				FaceSimilarityThreshold: getEnvFloat("FACE_SIMILARITY_THRESHOLD", 0.55),
				MaxAbsentChecks:         getEnvInt("MAX_ABSENT_CHECKS", 6),
			},
			SeedCfg: SeedConfig{
				DemoData:     os.Getenv("SEED_DEMO_DATA"),
				DemoPassword: os.Getenv("SEED_DEMO_PASSWORD"),
			},
			WsCfg: WebSocketConfig{
				AllowedOrigins: getEnvList("WS_ALLOWED_ORIGINS", append(append([]string{}, DefaultWSAllowedOrigins...), getEnv("WEB_URL", "http://localhost:3000"))),
			},
			MessagingBroker: getEnv("MESSAGING_BROKER", "postgres"),
		}
	})
	return cfgInstance
}

// loadDatabaseConfig reads the DB_* env vars. DB_FALLBACK_SQLITE defaults to true only in local development:
// a deployed API whose PostgreSQL is unreachable must fail instead of silently serving an empty local SQLite file.
func loadDatabaseConfig(appEnv string) DatabaseConfig {
	return DatabaseConfig{
		Driver:         getEnv("DB_DRIVER", "postgres"),
		Host:           getEnv("DB_HOST", "localhost"),
		Port:           getEnv("DB_PORT", "5432"),
		User:           getEnv("DB_USER", "lms_user"),
		Password:       getEnv("DB_PASSWORD", DefaultDBPassword),
		DbName:         getEnv("DB_NAME", "lms_confusion"),
		SSLMode:        getEnv("DB_SSLMODE", "disable"),
		TimeZone:       getEnv("DB_TIMEZONE", "Asia/Ho_Chi_Minh"),
		FallbackSQLite: getEnvBool("DB_FALLBACK_SQLITE", IsDevEnv(appEnv)),
	}
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

// getEnvList parses a comma-separated env var, dropping blanks; fallback is used when the var is unset or blank.
func getEnvList(key string, fallback []string) []string {
	var out []string
	for _, part := range strings.Split(os.Getenv(key), ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}
