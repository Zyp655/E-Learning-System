package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Regression: with JWT_SECRET unset the API signed tokens with a secret committed to the repository, so a
// forged {"permissions":"Admin"} token was accepted by /v1/admin/* (verified against a running server).
func TestConfigValidate_RejectsPublicJWTSecretOutsideDevelopment(t *testing.T) {
	cfg := func(env, secret string) *Config {
		return &Config{ServerCfg: ServerConfig{AppEnv: env}, JwtCfg: JwtConfig{SecretKey: secret}}
	}

	for _, env := range []string{"", "development", "dev", "local", "test", "Development"} {
		assert.NoError(t, cfg(env, DefaultJWTSecret).Validate(), "dev env %q may use the default secret", env)
	}
	for _, env := range []string{"production", "staging", "prod"} {
		assert.Error(t, cfg(env, DefaultJWTSecret).Validate(), "env %q must reject the public default secret", env)
		// docker-compose.yml falls back to a second public value when JWT_SECRET is not exported.
		assert.Error(t, cfg(env, ComposeDefaultJWTSecret).Validate(), "env %q must reject the docker-compose default secret", env)
		assert.Error(t, cfg(env, "").Validate(), "env %q must reject an empty secret", env)
		assert.Error(t, cfg(env, "   ").Validate(), "env %q must reject a blank secret", env)
		assert.NoError(t, cfg(env, "a-private-secret-from-the-deployment-env-0123").Validate())
	}
}

// Regression: SeedDatabase ran on every startup, including production, creating admin/teacher/student
// accounts that all share the public password 123456.
func TestDemoSeedPlan_DecisionTable(t *testing.T) {
	cfg := func(env, demoData, pwd string) *Config {
		return &Config{ServerCfg: ServerConfig{AppEnv: env}, SeedCfg: SeedConfig{DemoData: demoData, DemoPassword: pwd}}
	}
	cases := []struct {
		name, env, demoData, pwd string
		wantEnabled              bool
		wantPwd                  string
		wantErr                  bool
	}{
		{"dev default seeds with dev password", "development", "", "", true, DevSeedPassword, false},
		{"empty env counts as dev", "", "", "", true, DevSeedPassword, false},
		{"test env seeds", "test", "", "", true, DevSeedPassword, false},
		{"dev custom password", "local", "", "custom", true, "custom", false},
		{"dev explicit opt-out", "dev", "false", "", false, "", false},
		{"production default does not seed", "production", "", "", false, "", false},
		{"production default ignores password", "production", "", "a-strong-password", false, "", false},
		{"production opt-out", "staging", "false", "", false, "", false},
		{"production opt-in without password fails", "production", "true", "", false, "", true},
		{"production opt-in with 123456 fails", "production", "true", "123456", false, "", true},
		{"production opt-in with short password fails", "production", "true", "short7!", false, "", true},
		{"production opt-in with strong password", "production", "true", "a-strong-password", true, "a-strong-password", false},
		{"invalid bool fails", "production", "maybe", "a-strong-password", false, "", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			enabled, pwd, err := cfg(tc.env, tc.demoData, tc.pwd).DemoSeedPlan()
			if tc.wantErr {
				assert.Error(t, err)
				assert.False(t, enabled)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tc.wantEnabled, enabled)
			assert.Equal(t, tc.wantPwd, pwd)
		})
	}
}

// Regression: outside development the API started with the public DB password lms_password and the MinIO
// defaults minioadmin/minioadmin123.
func TestConfigValidate_RejectsDefaultCredentialsOutsideDevelopment(t *testing.T) {
	const secret = "a-private-secret-from-the-deployment-env-0123"
	good := func(env string) *Config {
		return &Config{
			ServerCfg: ServerConfig{AppEnv: env},
			JwtCfg:    JwtConfig{SecretKey: secret},
			DbCfg:     DatabaseConfig{Driver: "postgres", Password: "a-private-db-password"},
			S3Cfg:     S3Config{AccessKeyID: "deploy-access-key", SecretAccessKey: "deploy-secret-key"},
		}
	}
	for _, env := range []string{"production", "staging"} {
		assert.NoError(t, good(env).Validate())

		c := good(env)
		c.DbCfg.Password = DefaultDBPassword
		assert.ErrorContains(t, c.Validate(), "DB_PASSWORD")
		c.DbCfg.Driver = "sqlite"
		assert.NoError(t, c.Validate(), "the DB password is irrelevant with DB_DRIVER=sqlite")

		c = good(env)
		c.S3Cfg.AccessKeyID = DefaultS3AccessKey
		assert.ErrorContains(t, c.Validate(), "S3_ACCESS_KEY")
		c = good(env)
		c.S3Cfg.SecretAccessKey = DefaultS3SecretKey
		assert.ErrorContains(t, c.Validate(), "S3_SECRET_KEY")
	}
	dev := good("development")
	dev.DbCfg.Password, dev.S3Cfg.AccessKeyID, dev.S3Cfg.SecretAccessKey = DefaultDBPassword, DefaultS3AccessKey, DefaultS3SecretKey
	assert.NoError(t, dev.Validate(), "local development keeps the docker-compose defaults")
}

// Regression: DB_FALLBACK_SQLITE defaulted to true everywhere, so a production API with an unreachable
// PostgreSQL silently served an empty local SQLite file.
func TestLoadDatabaseConfig_SQLiteFallbackDefaultsToDevOnly(t *testing.T) {
	t.Setenv("DB_FALLBACK_SQLITE", "")
	t.Setenv("DB_PASSWORD", "")
	for _, env := range []string{"", "development", "test", "local"} {
		assert.True(t, loadDatabaseConfig(env).FallbackSQLite, "env %q", env)
	}
	for _, env := range []string{"production", "staging"} {
		assert.False(t, loadDatabaseConfig(env).FallbackSQLite, "env %q", env)
	}
	assert.Equal(t, DefaultDBPassword, loadDatabaseConfig("production").Password)

	t.Setenv("DB_FALLBACK_SQLITE", "true")
	assert.True(t, loadDatabaseConfig("production").FallbackSQLite, "explicit opt-in is honoured")
	t.Setenv("DB_FALLBACK_SQLITE", "false")
	assert.False(t, loadDatabaseConfig("development").FallbackSQLite, "explicit opt-out is honoured")
}

func TestUpdateConfusionConfig_ErrorKeepsStateAndCopiesAreIndependent(t *testing.T) {
	orig := GetConfusionConfig()
	t.Cleanup(func() { SetConfusionConfig(orig) })

	on := 0.7
	SetConfusionConfig(ConfusionConfig{MLThreshold: 0.6, SPBEF: SPBEFOverrides{ThetaOn: &on}})
	on = 0.1 // the caller's variable must not alias the stored value
	got := GetConfusionConfig()
	require.NotNil(t, got.SPBEF.ThetaOn)
	assert.Equal(t, 0.7, *got.SPBEF.ThetaOn)
	*got.SPBEF.ThetaOn = 0.2 // nor may a snapshot
	assert.Equal(t, 0.7, *GetConfusionConfig().SPBEF.ThetaOn)

	_, err := UpdateConfusionConfig(func(c *ConfusionConfig) error {
		c.MLThreshold = 0.9
		*c.SPBEF.ThetaOn = 0.3
		return assert.AnError
	})
	assert.ErrorIs(t, err, assert.AnError)
	assert.Equal(t, 0.6, GetConfusionConfig().MLThreshold)
	assert.Equal(t, 0.7, *GetConfusionConfig().SPBEF.ThetaOn)

	next, err := UpdateConfusionConfig(func(c *ConfusionConfig) error {
		c.MLThreshold = 0.65
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, 0.65, next.MLThreshold)
	assert.Equal(t, 0.65, GetConfusionConfig().MLThreshold)
}
