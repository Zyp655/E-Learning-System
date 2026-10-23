package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

type ListLessonDiscussionsReq struct {
	g.Meta `path:"/lessons/:id/discussions" method:"get" tags:"Discussion & Chat" summary:"Danh sách thảo luận bài học dạng cây Materialized Path (path = '1/5/12')"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type ListLessonDiscussionsRes struct {
	Comments []entity.Comment `json:"comments"`
}

type CreateLessonCommentReq struct {
	g.Meta         `path:"/lessons/:id/discussions" method:"post" tags:"Discussion & Chat" summary:"Đăng bình luận / câu hỏi mới vào bài học (hỗ trợ đa cấp Materialized Path & @mention)"`
	ID             int64  `json:"id" in:"path" v:"required"`
	CourseID       int64  `json:"courseId"`
	ParentID       int64  `json:"parentId"`
	Content        string `json:"content" v:"required"`
	VideoTimestamp int    `json:"videoTimestamp"`
}
type CreateLessonCommentRes struct {
	Comment *entity.Comment `json:"comment"`
}

type UpdateCommentReq struct {
	g.Meta  `path:"/comments/:id" method:"put" tags:"Discussion & Chat" summary:"Chỉnh sửa nội dung bình luận"`
	ID      int64  `json:"id" in:"path" v:"required"`
	Content string `json:"content" v:"required"`
}
type UpdateCommentRes struct {
	Comment *entity.Comment `json:"comment"`
}

type DeleteCommentReq struct {
	g.Meta `path:"/comments/:id" method:"delete" tags:"Discussion & Chat" summary:"Xóa bình luận"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteCommentRes struct {
	Success bool `json:"success"`
}

type VoteCommentReq struct {
	g.Meta   `path:"/comments/:id/vote" method:"post" tags:"Discussion & Chat" summary:"Bình chọn Upvote (+1) hoặc Downvote (-1) cho câu hỏi/bình luận"`
	ID       int64 `json:"id" in:"path" v:"required"`
	VoteType int   `json:"voteType" d:"1"`
}
type VoteCommentRes struct {
	Comment *entity.Comment `json:"comment"`
}

type PinCommentReq struct {
	g.Meta   `path:"/comments/:id/pin" method:"put" tags:"Discussion & Chat" summary:"Giảng viên ghim hoặc bỏ ghim bình luận quan trọng"`
	ID       int64 `json:"id" in:"path" v:"required"`
	IsPinned bool  `json:"isPinned" d:"true"`
}
type PinCommentRes struct {
	Comment *entity.Comment `json:"comment"`
}

type UpdateCommentStatusReq struct {
	g.Meta     `path:"/comments/:id/status" method:"put" tags:"Discussion & Chat" summary:"Giảng viên đánh dấu câu hỏi thảo luận đã được giải đáp (is_answered)"`
	ID         int64 `json:"id" in:"path" v:"required"`
	IsAnswered bool  `json:"isAnswered" d:"true"`
}
type UpdateCommentStatusRes struct {
	Comment *entity.Comment `json:"comment"`
}

type ListConversationsReq struct {
	g.Meta `path:"/chat/conversations" method:"get" tags:"Discussion & Chat" summary:"Danh sách hội thoại nhắn tin trực tiếp 1-1 giữa Sinh viên và Giảng viên"`
}
type ListConversationsRes struct {
	Conversations []entity.ChatConversation `json:"conversations"`
}

type GetConversationMessagesReq struct {
	g.Meta `path:"/chat/conversations/:id/messages" method:"get" tags:"Discussion & Chat" summary:"Lịch sử tin nhắn 1-1 của cuộc hội thoại"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type GetConversationMessagesRes struct {
	Conversation *entity.ChatConversation `json:"conversation"`
	Messages     []entity.ChatMessage     `json:"messages"`
}

type SendChatMessageReq struct {
	g.Meta        `path:"/chat/conversations/:id/messages" method:"post" tags:"Discussion & Chat" summary:"Gửi tin nhắn trực tiếp 1-1"`
	ID            int64  `json:"id" in:"path" v:"required"`
	Content       string `json:"content" v:"required"`
	MessageType   string `json:"messageType" d:"text"`
	AttachmentURL string `json:"attachmentUrl"`
}
type SendChatMessageRes struct {
	Message *entity.ChatMessage `json:"message"`
}
