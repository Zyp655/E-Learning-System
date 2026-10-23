package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

type ListNotificationsReq struct {
	g.Meta `path:"/notifications" method:"get" tags:"Notifications" summary:"Danh sách thông báo của người dùng"`
}
type ListNotificationsRes struct {
	Items       []entity.Notification `json:"items"`
	UnreadCount int64                 `json:"unreadCount"`
}

type MarkNotificationReadReq struct {
	g.Meta `path:"/notifications/:id/read" method:"put" tags:"Notifications" summary:"Đánh dấu thông báo đã đọc"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type MarkNotificationReadRes struct {
	Success bool `json:"success"`
}

type MarkAllNotificationsReadReq struct {
	g.Meta `path:"/notifications/read-all" method:"put" tags:"Notifications" summary:"Đánh dấu tất cả thông báo đã đọc"`
}
type MarkAllNotificationsReadRes struct {
	Success bool `json:"success"`
}
