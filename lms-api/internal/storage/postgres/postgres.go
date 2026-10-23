package postgres

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/pgqueue"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Database struct {
	Connection *gorm.DB
	HasVector  bool
}

var (
	dbInstance *Database
	dbOnce     sync.Once
)

func GetDatabaseConnection() *Database {
	dbOnce.Do(func() {
		db, hasVec := dbConnect()
		dbInstance = &Database{
			Connection: db,
			HasVector:  hasVec,
		}
	})
	return dbInstance
}

func dbConnect() (*gorm.DB, bool) {
	cfg := config.GetConfig().DbCfg
	gormCfg := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	}

	var db *gorm.DB
	var err error
	hasVector := false

	if cfg.Driver == "sqlite" {
		db, err = gorm.Open(sqlite.Open("lms_confusion_dev.db"), gormCfg)
		if err != nil {
			log.Fatalf("failed to open sqlite db: %v", err)
		}
		log.Println("Connected to SQLite database (lms_confusion_dev.db)")
	} else {
		dsn := fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s connect_timeout=3",
			cfg.Host, cfg.User, cfg.Password, cfg.DbName, cfg.Port, cfg.SSLMode, cfg.TimeZone,
		)
		db, err = gorm.Open(postgres.Open(dsn), gormCfg)
		if err != nil {
			if cfg.FallbackSQLite {
				log.Printf("WARNING: PostgreSQL unreachable (%v) — falling back to local SQLite (lms_confusion_dev.db)", err)
				db, err = gorm.Open(sqlite.Open("lms_confusion_dev.db"), gormCfg)
				if err != nil {
					log.Fatalf("failed to open fallback sqlite db: %v", err)
				}
			} else {
				log.Fatalf("failed to connect to PostgreSQL: %v", err)
			}
		} else {
			sqlDB, sqlErr := db.DB()
			if sqlErr == nil {
				sqlDB.SetMaxOpenConns(20)
				sqlDB.SetMaxIdleConns(5)
				sqlDB.SetConnMaxLifetime(30 * time.Minute)
			}
			// Initialize pgvector and pg_trgm extensions if available
			if vecErr := db.Exec("CREATE EXTENSION IF NOT EXISTS vector").Error; vecErr == nil {
				hasVector = true
				log.Println("PostgreSQL extension 'vector' (pgvector) enabled")
			} else {
				log.Printf("PostgreSQL 'vector' extension not available (%v), using JSON vector fallback", vecErr)
			}
			_ = db.Exec("CREATE EXTENSION IF NOT EXISTS pg_trgm").Error
		}
	}

	if err := AutoMigrate(db, hasVector); err != nil {
		log.Printf("WARNING: AutoMigrate reported error: %v", err)
	}

	return db, hasVector
}

func AutoMigrate(db *gorm.DB, hasVector bool) error {
	models := append(entity.AllEntities(), &pgqueue.Message{}, &pgqueue.Subscription{})
	if err := db.AutoMigrate(models...); err != nil {
		return err
	}

	if hasVector && db.Dialector.Name() == "postgres" {
		_ = db.Exec("ALTER TABLE courses ADD COLUMN IF NOT EXISTS embedding vector(1536)").Error
		_ = db.Exec("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS embedding vector(1536)").Error
		_ = db.Exec("ALTER TABLE video_segments ADD COLUMN IF NOT EXISTS embedding vector(1536)").Error
	}
	return nil
}

func (d *Database) Close() error {
	if d == nil || d.Connection == nil {
		return nil
	}
	sqlDB, err := d.Connection.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
