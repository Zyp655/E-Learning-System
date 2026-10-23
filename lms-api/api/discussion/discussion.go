package discussion

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/discussion/v1"
)

type IDiscussionV1 interface {
	ListLessonDiscussions(ctx context.Context, req *v1.ListLessonDiscussionsReq) (res *v1.ListLessonDiscussionsRes, err error)
	CreateLessonComment(ctx context.Context, req *v1.CreateLessonCommentReq) (res *v1.CreateLessonCommentRes, err error)
	UpdateComment(ctx context.Context, req *v1.UpdateCommentReq) (res *v1.UpdateCommentRes, err error)
	DeleteComment(ctx context.Context, req *v1.DeleteCommentReq) (res *v1.DeleteCommentRes, err error)
	VoteComment(ctx context.Context, req *v1.VoteCommentReq) (res *v1.VoteCommentRes, err error)
	PinComment(ctx context.Context, req *v1.PinCommentReq) (res *v1.PinCommentRes, err error)
	UpdateCommentStatus(ctx context.Context, req *v1.UpdateCommentStatusReq) (res *v1.UpdateCommentStatusRes, err error)
	ListConversations(ctx context.Context, req *v1.ListConversationsReq) (res *v1.ListConversationsRes, err error)
	GetConversationMessages(ctx context.Context, req *v1.GetConversationMessagesReq) (res *v1.GetConversationMessagesRes, err error)
	SendChatMessage(ctx context.Context, req *v1.SendChatMessageReq) (res *v1.SendChatMessageRes, err error)
}
