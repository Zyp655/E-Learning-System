package discussion

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/discussion"
	v1 "github.com/hieu/lms-confusion/lms-api/api/discussion/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) discussion.IDiscussionV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) ListLessonDiscussions(ctx context.Context, req *v1.ListLessonDiscussionsReq) (res *v1.ListLessonDiscussionsRes, err error) {
	var comments []entity.Comment
	c.svc.DB().WithContext(ctx).
		Preload("User").
		Where("lesson_id = ?", req.ID).
		Order("is_pinned DESC, path ASC, id ASC").
		Find(&comments)
	return &v1.ListLessonDiscussionsRes{Comments: comments}, nil
}

func (c *ControllerV1) CreateLessonComment(ctx context.Context, req *v1.CreateLessonCommentReq) (res *v1.CreateLessonCommentRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var u entity.User
	c.svc.DB().WithContext(ctx).First(&u, userID)

	depth := 0
	parentPath := ""
	if req.ParentID > 0 {
		var parent entity.Comment
		if err := c.svc.DB().WithContext(ctx).First(&parent, req.ParentID).Error; err == nil {
			depth = parent.Depth + 1
			parentPath = parent.Path
		}
	}

	isTeacher := strings.EqualFold(u.Role, "teacher") || strings.EqualFold(u.Role, "admin")
	item := entity.Comment{
		CourseID:          req.CourseID,
		LessonID:          req.ID,
		UserID:            userID,
		ParentID:          req.ParentID,
		Depth:             depth,
		Content:           req.Content,
		VideoTimestamp:    req.VideoTimestamp,
		IsTeacherResponse: isTeacher,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}

	if parentPath != "" {
		item.Path = fmt.Sprintf("%s/%d", parentPath, item.ID)
		if isTeacher {
			c.svc.DB().WithContext(ctx).Model(&entity.Comment{}).Where("id = ?", req.ParentID).Update("is_answered", true)
		}
	} else {
		item.Path = fmt.Sprintf("%d", item.ID)
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	c.svc.DB().WithContext(ctx).Preload("User").First(&item, item.ID)

	return &v1.CreateLessonCommentRes{Comment: &item}, nil
}

func (c *ControllerV1) UpdateComment(ctx context.Context, req *v1.UpdateCommentReq) (res *v1.UpdateCommentRes, err error) {
	var item entity.Comment
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.CommentNotFound.New("Không tìm thấy bình luận")
	}
	item.Content = req.Content
	c.svc.DB().WithContext(ctx).Save(&item)
	c.svc.DB().WithContext(ctx).Preload("User").First(&item, item.ID)
	return &v1.UpdateCommentRes{Comment: &item}, nil
}

func (c *ControllerV1) DeleteComment(ctx context.Context, req *v1.DeleteCommentReq) (res *v1.DeleteCommentRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Comment{}, req.ID)
	return &v1.DeleteCommentRes{Success: true}, nil
}

func (c *ControllerV1) VoteComment(ctx context.Context, req *v1.VoteCommentReq) (res *v1.VoteCommentRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var item entity.Comment
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.CommentNotFound.New("Không tìm thấy bình luận")
	}
	c.svc.DB().WithContext(ctx).Create(&entity.CommentVote{
		CommentID: item.ID,
		UserID:    userID,
		VoteType:  req.VoteType,
	})
	if req.VoteType >= 0 {
		item.UpvoteCount++
	} else {
		item.DownvoteCount++
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	c.svc.DB().WithContext(ctx).Preload("User").First(&item, item.ID)
	return &v1.VoteCommentRes{Comment: &item}, nil
}

func (c *ControllerV1) PinComment(ctx context.Context, req *v1.PinCommentReq) (res *v1.PinCommentRes, err error) {
	var item entity.Comment
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.CommentNotFound.New("Không tìm thấy bình luận")
	}
	item.IsPinned = req.IsPinned
	c.svc.DB().WithContext(ctx).Save(&item)
	c.svc.DB().WithContext(ctx).Preload("User").First(&item, item.ID)
	return &v1.PinCommentRes{Comment: &item}, nil
}

func (c *ControllerV1) UpdateCommentStatus(ctx context.Context, req *v1.UpdateCommentStatusReq) (res *v1.UpdateCommentStatusRes, err error) {
	var item entity.Comment
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.CommentNotFound.New("Không tìm thấy bình luận")
	}
	item.IsAnswered = req.IsAnswered
	c.svc.DB().WithContext(ctx).Save(&item)
	c.svc.DB().WithContext(ctx).Preload("User").First(&item, item.ID)
	return &v1.UpdateCommentStatusRes{Comment: &item}, nil
}

func (c *ControllerV1) ListConversations(ctx context.Context, req *v1.ListConversationsReq) (res *v1.ListConversationsRes, err error) {
	var items []entity.ChatConversation
	c.svc.DB().WithContext(ctx).
		Preload("Student").
		Preload("Teacher").
		Order("id DESC").
		Find(&items)
	return &v1.ListConversationsRes{Conversations: items}, nil
}

func (c *ControllerV1) GetConversationMessages(ctx context.Context, req *v1.GetConversationMessagesReq) (res *v1.GetConversationMessagesRes, err error) {
	var conv entity.ChatConversation
	if err := c.svc.DB().WithContext(ctx).Preload("Student").Preload("Teacher").First(&conv, req.ID).Error; err != nil {
		return nil, resCode.ConversationNotFound.New("Không tìm thấy hội thoại")
	}
	var messages []entity.ChatMessage
	c.svc.DB().WithContext(ctx).Preload("Sender").Where("conversation_id = ?", req.ID).Order("id ASC").Find(&messages)
	return &v1.GetConversationMessagesRes{
		Conversation: &conv,
		Messages:     messages,
	}, nil
}

func (c *ControllerV1) SendChatMessage(ctx context.Context, req *v1.SendChatMessageReq) (res *v1.SendChatMessageRes, err error) {
	userID := consts.CurrentUserID(ctx)
	msg := entity.ChatMessage{
		ConversationID: req.ID,
		SenderID:       userID,
		Content:        req.Content,
		MessageType:    req.MessageType,
		AttachmentURL:  req.AttachmentURL,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&msg).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	now := time.Now()
	c.svc.DB().WithContext(ctx).Model(&entity.ChatConversation{}).Where("id = ?", req.ID).Updates(map[string]interface{}{
		"last_message":    req.Content,
		"last_message_at": now,
	})
	c.svc.DB().WithContext(ctx).Preload("Sender").First(&msg, msg.ID)
	return &v1.SendChatMessageRes{Message: &msg}, nil
}
