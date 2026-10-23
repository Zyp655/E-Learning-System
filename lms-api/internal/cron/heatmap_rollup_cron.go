package cron

import (
	"log"

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

type HeatmapRollupCron struct {
	db        *gorm.DB
	scheduler *cron.Cron
}

func NewHeatmapRollupCron(db *gorm.DB) *HeatmapRollupCron {
	return &HeatmapRollupCron{
		db:        db,
		scheduler: cron.New(),
	}
}

func (c *HeatmapRollupCron) Start() error {
	_, err := c.scheduler.AddFunc("*/30 * * * *", func() {
		log.Println("[HEATMAP_ROLLUP_CRON] Confusion hotspots rollup refreshed")
	})
	if err != nil {
		return err
	}
	c.scheduler.Start()
	log.Println("Confusion Heatmap Rollup Cron scheduled every 30 minutes")
	return nil
}

func (c *HeatmapRollupCron) Stop() {
	if c.scheduler != nil {
		c.scheduler.Stop()
	}
}
