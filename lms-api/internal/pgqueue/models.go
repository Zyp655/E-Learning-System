package pgqueue

import "time"

const (
	StatusPending = "pending"
	StatusDead    = "dead"
)

type Message struct {
	ID          int64      `gorm:"primaryKey"`
	Queue       string     `gorm:"type:varchar(128);not null;index:idx_queue_messages_claim,priority:1"`
	Topic       string     `gorm:"type:varchar(128);not null"`
	Payload     string     `gorm:"type:text;not null"`
	EventID     string     `gorm:"type:varchar(64);not null"`
	Status      string     `gorm:"type:varchar(16);not null;default:pending;index:idx_queue_messages_claim,priority:2"`
	Attempts    int        `gorm:"not null;default:0"`
	AvailableAt time.Time  `gorm:"not null;index:idx_queue_messages_claim,priority:3"`
	LockedUntil *time.Time `gorm:"index"`
	LockToken   string     `gorm:"type:varchar(64);not null;default:''"`
	LastError   string     `gorm:"type:text;not null;default:''"`
	CreatedAt   time.Time
}

func (Message) TableName() string { return "queue_messages" }

type Subscription struct {
	Queue     string `gorm:"primaryKey;type:varchar(128)"`
	Topic     string `gorm:"primaryKey;type:varchar(128);index"`
	CreatedAt time.Time
}

func (Subscription) TableName() string { return "queue_subscriptions" }
