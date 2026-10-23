package notification

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/notification/v1"
)

type INotificationV1 interface {
	ListNotifications(ctx context.Context, req *v1.ListNotificationsReq) (res *v1.ListNotificationsRes, err error)
	MarkNotificationRead(ctx context.Context, req *v1.MarkNotificationReadReq) (res *v1.MarkNotificationReadRes, err error)
	MarkAllNotificationsRead(ctx context.Context, req *v1.MarkAllNotificationsReadReq) (res *v1.MarkAllNotificationsReadRes, err error)
}
