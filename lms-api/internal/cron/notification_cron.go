package cron

import (
	"fmt"
	"log"
	"time"

	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

type NotificationCron struct {
	db        *gorm.DB
	scheduler *cron.Cron
}

func NewNotificationCron(db *gorm.DB) *NotificationCron {
	return &NotificationCron{
		db:        db,
		scheduler: cron.New(),
	}
}

func (c *NotificationCron) Start() error {
	// 07:00 Morning summary
	_, _ = c.scheduler.AddFunc("0 7 * * *", func() {
		c.dispatchSmartReminders("morning_summary")
	})
	// 12:00 Midday check-in
	_, _ = c.scheduler.AddFunc("0 12 * * *", func() {
		c.dispatchSmartReminders("reminder_12")
	})
	// 16:00 Afternoon check-in
	_, _ = c.scheduler.AddFunc("0 16 * * *", func() {
		c.dispatchSmartReminders("reminder_16")
	})
	// 20:00 Urgent evening warning before 23:59 attendance cutoff
	_, _ = c.scheduler.AddFunc("0 20 * * *", func() {
		c.dispatchSmartReminders("urgent_20")
	})

	c.scheduler.Start()
	log.Println("Smart Notification Cron scheduled at 07:00, 12:00, 16:00, 20:00")
	return nil
}

func (c *NotificationCron) dispatchSmartReminders(slot string) {
	today := time.Now().Format("2006-01-02")

	var schedules []entity.Schedule
	if err := c.db.Find(&schedules).Error; err != nil {
		return
	}

	for _, sched := range schedules {
		msg := fmt.Sprintf("Nhắc lịch học (%s): %s tại phòng %s (%s - %s)", slot, sched.Title, sched.Room, sched.StartTime, sched.EndTime)
		_ = c.db.Create(&entity.AINotificationLog{
			UserID:           sched.UserID,
			ScheduleID:       sched.ID,
			NotificationSlot: slot,
			SentDate:         today,
			Title:            "Nhắc học thông minh AI",
			Message:          msg,
			Channel:          "in_app",
		}).Error
	}
}

func (c *NotificationCron) Stop() {
	if c.scheduler != nil {
		c.scheduler.Stop()
	}
}
