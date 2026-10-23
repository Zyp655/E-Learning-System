package cron

import (
	"context"
	"log"
	"time"

	"github.com/hieu/lms-confusion/lms-api/internal/service"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

type AttendanceCron struct {
	db        *gorm.DB
	scheduler *cron.Cron
}

func NewAttendanceCron(db *gorm.DB) *AttendanceCron {
	return &AttendanceCron{
		db:        db,
		scheduler: cron.New(),
	}
}

func (c *AttendanceCron) Start() error {
	engine := service.NewAttendanceEngine(c.db)
	// Finalize daily online attendance at 23:59 every day
	_, err := c.scheduler.AddFunc("59 23 * * *", func() {
		ctx := context.Background()
		count, err := engine.FinalizeDay(ctx, time.Now())
		if err != nil {
			log.Printf("[ATTENDANCE_CRON] Error finalizing daily attendance: %v", err)
		} else {
			log.Printf("[ATTENDANCE_CRON] Finalized %d online learning logs at 23:59", count)
		}
	})
	if err != nil {
		return err
	}
	c.scheduler.Start()
	log.Println("AI Online Attendance Cron scheduled daily at 23:59")
	return nil
}

func (c *AttendanceCron) Stop() {
	if c.scheduler != nil {
		c.scheduler.Stop()
	}
}
