package pgqueue

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Publisher struct {
	db *gorm.DB
}

func NewPublisher(db *gorm.DB) *Publisher {
	return &Publisher{db: db}
}

func (p *Publisher) Publish(ctx context.Context, topic string, payload []byte) (int64, error) {
	if p.db == nil {
		return 0, nil
	}
	var subs []Subscription
	if err := p.db.WithContext(ctx).Where("topic = ?", topic).Find(&subs).Error; err != nil {
		return 0, fmt.Errorf("pgqueue publish %s: %w", topic, err)
	}
	if len(subs) == 0 {
		return 0, nil
	}
	eventID := uuid.NewString()
	now := time.Now()
	msgs := make([]Message, 0, len(subs))
	for _, sub := range subs {
		msgs = append(msgs, Message{
			Queue:       sub.Queue,
			Topic:       topic,
			Payload:     string(payload),
			EventID:     eventID,
			Status:      StatusPending,
			Attempts:    0,
			AvailableAt: now,
			CreatedAt:   now,
		})
	}
	if err := p.db.WithContext(ctx).Create(&msgs).Error; err != nil {
		return 0, fmt.Errorf("pgqueue publish %s: %w", topic, err)
	}
	return int64(len(msgs)), nil
}
