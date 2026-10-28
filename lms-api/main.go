package main

import (
	"context"
	"log"

	"github.com/gogf/gf/v2/os/gctx"
	"github.com/gogf/gf/v2/os/glog"

	"github.com/hieu/lms-confusion/lms-api/global"
	"github.com/hieu/lms-confusion/lms-api/internal/cmd"
	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/cron"
	"github.com/hieu/lms-confusion/lms-api/internal/pgqueue"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	"github.com/hieu/lms-confusion/lms-api/internal/storage/postgres"
	"github.com/hieu/lms-confusion/lms-api/internal/storage/redis"
	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

func main() {
	cfg := config.GetConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Invalid configuration: %v", err)
	}
	// Decide on the demo seed before touching the DB so a weak production password fails fast.
	seedEnabled, seedPassword, err := cfg.DemoSeedPlan()
	if err != nil {
		log.Fatalf("Invalid demo seed configuration: %v", err)
	}
	global.Logger = glog.New()

	tokenMaker, err := token.NewJWTMaker(cfg.JwtCfg.SecretKey)
	if err != nil {
		log.Fatalf("Failed to initialize JWT token maker: %v", err)
	}
	global.Token = tokenMaker

	// Connect Database (PostgreSQL + pgvector with automatic SQLite fallback)
	dbConn := postgres.GetDatabaseConnection()
	global.DB = dbConn.Connection
	defer func() {
		_ = dbConn.Close()
	}()

	// Seed the Vietnamese demo dataset only in development or with explicit SEED_DEMO_DATA=true opt-in.
	if seedEnabled {
		if err := postgres.SeedDatabase(global.DB, seedPassword); err != nil {
			log.Printf("WARNING: SeedDatabase reported error: %v", err)
		}
	} else {
		log.Printf("Demo seed disabled (APP_ENV=%s); set SEED_DEMO_DATA=true and SEED_DEMO_PASSWORD to enable", cfg.ServerCfg.AppEnv)
	}

	// Initialize Redis (with in-memory fallback)
	redis.InitRedis()
	defer redis.CloseRedis()

	// Warm up the SP-BEF confusion predictor and apply the persisted admin settings (confusion_settings).
	pred := service.GetConfusionPredictor()
	log.Printf("ConfusionPredictor loaded (Ready=%v)", pred.IsReady())
	if found, err := service.LoadConfusionSettings(context.Background(), global.DB, pred); err != nil {
		log.Printf("WARNING: confusion settings: %v", err)
	} else if found {
		log.Printf("Confusion settings loaded from confusion_settings")
	}

	// Initialize pgqueue Publisher & Consumer
	global.QueuePublisher = pgqueue.NewPublisher(global.DB)
	queueConsumer := pgqueue.NewConsumer(global.DB, pgqueue.ConsumerConfig{
		Subscriptions: map[string][]string{
			"lms-api-worker": {
				consts.TopicVideoUploaded,
				consts.TopicDocumentUploaded,
				consts.TopicConfusionLogged,
			},
		},
		Workers: 2,
	})
	_ = queueConsumer.Start(func(ctx context.Context, d pgqueue.Delivery) error {
		log.Printf("[pgqueue] Processed job topic=%s eventID=%s", d.Topic, d.EventID)
		return nil
	})
	defer queueConsumer.Stop()

	// Start Cron Schedulers (23:59 AI Attendance, 07/12/16/20h Smart Reminders, Heatmap Rollup)
	attendanceCron := cron.NewAttendanceCron(global.DB)
	_ = attendanceCron.Start()
	defer attendanceCron.Stop()

	notifCron := cron.NewNotificationCron(global.DB)
	_ = notifCron.Start()
	defer notifCron.Stop()

	heatmapCron := cron.NewHeatmapRollupCron(global.DB)
	_ = heatmapCron.Start()
	defer heatmapCron.Stop()

	cmd.Main.Run(gctx.GetInitCtx())
}
