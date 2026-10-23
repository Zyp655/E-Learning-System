package pgqueue

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Delivery struct {
	ID       int64
	Queue    string
	Topic    string
	EventID  string
	Payload  []byte
	Attempts int
}

type HandlerFunc func(ctx context.Context, d Delivery) error

type ConsumerConfig struct {
	Subscriptions     map[string][]string
	PollOrder         []string
	Workers           int
	BatchSize         int
	VisibilityTimeout time.Duration
	MaxAttempts       int
	IdlePoll          time.Duration
	DeadRetention     time.Duration
}

type Consumer struct {
	db     *gorm.DB
	cfg    ConsumerConfig
	cancel context.CancelFunc
	wg     sync.WaitGroup
	mu     sync.Mutex
}

func NewConsumer(db *gorm.DB, cfg ConsumerConfig) *Consumer {
	if cfg.Workers <= 0 {
		cfg.Workers = 3
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 10
	}
	if cfg.VisibilityTimeout <= 0 {
		cfg.VisibilityTimeout = 120 * time.Second
	}
	if cfg.MaxAttempts <= 0 {
		cfg.MaxAttempts = 5
	}
	if cfg.IdlePoll <= 0 {
		cfg.IdlePoll = 2 * time.Second
	}
	if cfg.DeadRetention <= 0 {
		cfg.DeadRetention = 14 * 24 * time.Hour
	}
	if len(cfg.PollOrder) == 0 {
		for q := range cfg.Subscriptions {
			cfg.PollOrder = append(cfg.PollOrder, q)
		}
		sort.Strings(cfg.PollOrder)
	}
	return &Consumer{db: db, cfg: cfg}
}

func (c *Consumer) Start(handler HandlerFunc) error {
	if handler == nil {
		return errors.New("pgqueue: handler is required")
	}
	if len(c.cfg.PollOrder) == 0 {
		return errors.New("pgqueue: no queues configured")
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cancel != nil {
		return errors.New("pgqueue: consumer already running")
	}
	ctx, cancel := context.WithCancel(context.Background())
	c.cancel = cancel

	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		for {
			err := c.syncSubscriptions(ctx)
			if err == nil {
				break
			}
			log.Printf("PGQUEUE: subscription sync failed (retrying in 10s): %v", err)
			if !sleepCtx(ctx, 10*time.Second) {
				return
			}
		}
		log.Printf("PGQUEUE: subscriptions synced, starting %d workers for queues %v", c.cfg.Workers, c.cfg.PollOrder)

		for i := 0; i < c.cfg.Workers; i++ {
			c.wg.Add(1)
			go c.worker(ctx, handler)
		}
	}()
	return nil
}

func (c *Consumer) Stop() {
	c.mu.Lock()
	cancel := c.cancel
	c.mu.Unlock()
	if cancel == nil {
		return
	}
	cancel()
	c.wg.Wait()
}

func (c *Consumer) syncSubscriptions(ctx context.Context) error {
	queues := make([]string, 0, len(c.cfg.Subscriptions))
	for q := range c.cfg.Subscriptions {
		queues = append(queues, q)
	}
	sort.Strings(queues)

	return c.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, queue := range queues {
			topics := c.cfg.Subscriptions[queue]
			if len(topics) == 0 {
				continue
			}
			rows := make([]Subscription, 0, len(topics))
			for _, t := range topics {
				rows = append(rows, Subscription{Queue: queue, Topic: t, CreatedAt: time.Now()})
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error; err != nil {
				return fmt.Errorf("add subscriptions for %s: %w", queue, err)
			}
		}
		return nil
	})
}

func (c *Consumer) worker(ctx context.Context, handler HandlerFunc) {
	defer c.wg.Done()
	for {
		if ctx.Err() != nil {
			return
		}
		batch, err := c.claim(ctx)
		if err != nil || len(batch) == 0 {
			if !sleepCtx(ctx, c.cfg.IdlePoll) {
				return
			}
			continue
		}
		var batchWg sync.WaitGroup
		for _, m := range batch {
			batchWg.Add(1)
			go func(m claimed) {
				defer batchWg.Done()
				c.process(ctx, m, handler)
			}(m)
		}
		batchWg.Wait()
	}
}

type claimed struct {
	ID        int64
	Queue     string
	Topic     string
	Payload   string
	EventID   string
	Attempts  int
	LockToken string
}

func (c *Consumer) claim(ctx context.Context) ([]claimed, error) {
	dialect := c.db.Dialector.Name()
	token := uuid.NewString()
	var rows []claimed

	if dialect == "postgres" {
		queues := strings.Join(c.cfg.PollOrder, ",")
		err := c.db.WithContext(ctx).Raw(`
			UPDATE queue_messages m
			SET locked_until = now() + ? * interval '1 second',
			    lock_token = ?,
			    attempts = m.attempts + 1
			FROM (
				SELECT id FROM queue_messages
				WHERE queue = ANY(string_to_array(?, ','))
				  AND status = ?
				  AND available_at <= now()
				  AND (locked_until IS NULL OR locked_until < now())
				ORDER BY array_position(string_to_array(?, ','), queue), id
				LIMIT ?
				FOR UPDATE SKIP LOCKED
			) picked
			WHERE m.id = picked.id
			RETURNING m.id, m.queue, m.topic, m.payload, m.event_id, m.attempts, m.lock_token`,
			int(c.cfg.VisibilityTimeout.Seconds()), token, queues, StatusPending, queues, c.cfg.BatchSize,
		).Scan(&rows).Error
		return rows, err
	}

	// Fallback for SQLite dev mode
	now := time.Now()
	lockUntil := now.Add(c.cfg.VisibilityTimeout)
	var msgs []Message
	err := c.db.WithContext(ctx).
		Where("queue IN ? AND status = ? AND available_at <= ? AND (locked_until IS NULL OR locked_until < ?)",
			c.cfg.PollOrder, StatusPending, now, now).
		Order("id ASC").
		Limit(c.cfg.BatchSize).
		Find(&msgs).Error
	if err != nil || len(msgs) == 0 {
		return nil, err
	}
	for _, m := range msgs {
		res := c.db.WithContext(ctx).Model(&Message{}).
			Where("id = ? AND (locked_until IS NULL OR locked_until < ?)", m.ID, now).
			Updates(map[string]interface{}{
				"locked_until": lockUntil,
				"lock_token":   token,
				"attempts":     m.Attempts + 1,
			})
		if res.Error == nil && res.RowsAffected > 0 {
			rows = append(rows, claimed{
				ID:        m.ID,
				Queue:     m.Queue,
				Topic:     m.Topic,
				Payload:   m.Payload,
				EventID:   m.EventID,
				Attempts:  m.Attempts + 1,
				LockToken: token,
			})
		}
	}
	return rows, nil
}

func (c *Consumer) process(ctx context.Context, m claimed, handler HandlerFunc) {
	err := safeHandle(ctx, handler, Delivery{
		ID:       m.ID,
		Queue:    m.Queue,
		Topic:    m.Topic,
		EventID:  m.EventID,
		Payload:  []byte(m.Payload),
		Attempts: m.Attempts,
	})

	settleCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	db := c.db.WithContext(settleCtx)

	if err == nil {
		_ = db.Where("id = ? AND lock_token = ?", m.ID, m.LockToken).Delete(&Message{}).Error
		return
	}

	status := StatusPending
	if m.Attempts >= c.cfg.MaxAttempts {
		status = StatusDead
	}
	nextAvail := time.Now().Add(30 * time.Second)
	_ = db.Model(&Message{}).
		Where("id = ? AND lock_token = ?", m.ID, m.LockToken).
		Updates(map[string]interface{}{
			"status":       status,
			"available_at": nextAvail,
			"locked_until": nil,
			"lock_token":   "",
			"last_error":   err.Error(),
		}).Error
}

func safeHandle(ctx context.Context, handler HandlerFunc, d Delivery) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("handler panic: %v", r)
		}
	}()
	return handler(ctx, d)
}

func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
