package tutor

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/tutor/v1"
)

type ITutorV1 interface {
	SpeechToText(ctx context.Context, req *v1.SpeechToTextReq) (res *v1.SpeechToTextRes, err error)
	GetChatHistory(ctx context.Context, req *v1.GetChatHistoryReq) (res *v1.GetChatHistoryRes, err error)
	ClearChatHistory(ctx context.Context, req *v1.ClearChatHistoryReq) (res *v1.ClearChatHistoryRes, err error)
	SummarizeLesson(ctx context.Context, req *v1.SummarizeLessonReq) (res *v1.SummarizeLessonRes, err error)
	GenerateConceptMap(ctx context.Context, req *v1.GenerateConceptMapReq) (res *v1.GenerateConceptMapRes, err error)
	VerifyWatching(ctx context.Context, req *v1.VerifyWatchingReq) (res *v1.VerifyWatchingRes, err error)
}
