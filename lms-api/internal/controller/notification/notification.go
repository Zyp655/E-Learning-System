package notification

import (
	"context"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/notification"
	v1 "github.com/hieu/lms-confusion/lms-api/api/notification/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) notification.INotificationV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) ListNotifications(ctx context.Context, req *v1.ListNotificationsReq) (res *v1.ListNotificationsRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var items []entity.Notification
	c.svc.DB().WithContext(ctx).Where("user_id = ?", userID).Order("id DESC").Limit(30).Find(&items)

	var unread int64
	c.svc.DB().WithContext(ctx).Model(&entity.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&unread)

	return &v1.ListNotificationsRes{
		Items:       items,
		UnreadCount: unread,
	}, nil
}

func (c *ControllerV1) MarkNotificationRead(ctx context.Context, req *v1.MarkNotificationReadReq) (res *v1.MarkNotificationReadRes, err error) {
	now := time.Now()
	c.svc.DB().WithContext(ctx).Model(&entity.Notification{}).Where("id = ?", req.ID).Updates(map[string]interface{}{
		"is_read": true,
		"read_at": now,
	})
	return &v1.MarkNotificationReadRes{Success: true}, nil
}

func (c *ControllerV1) MarkAllNotificationsRead(ctx context.Context, req *v1.MarkAllNotificationsReadReq) (res *v1.MarkAllNotificationsReadRes, err error) {
	userID := consts.CurrentUserID(ctx)
	now := time.Now()
	c.svc.DB().WithContext(ctx).Model(&entity.Notification{}).Where("user_id = ?", userID).Updates(map[string]interface{}{
		"is_read": true,
		"read_at": now,
	})
	return &v1.MarkAllNotificationsReadRes{Success: true}, nil
}
