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

	// Seed rich Vietnamese academic & AI confusion dataset
	if err := postgres.SeedDatabase(global.DB); err != nil {
		log.Printf("WARNING: SeedDatabase reported error: %v", err)
	}

	// Initialize Redis (with in-memory fallback)
	redis.InitRedis()
	defer redis.CloseRedis()

	// Warm up Multimodal Confusion Predictor (12 features -> MLP 64-32-16 + LR)
	pred := service.GetConfusionPredictor()
	log.Printf("ConfusionPredictor loaded (Ready=%v)", pred.IsReady())

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
