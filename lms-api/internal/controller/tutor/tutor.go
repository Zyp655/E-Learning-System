package tutor

import (
	"context"

	"github.com/hieu/lms-confusion/lms-api/api/tutor"
	v1 "github.com/hieu/lms-confusion/lms-api/api/tutor/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) tutor.ITutorV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) SpeechToText(ctx context.Context, req *v1.SpeechToTextReq) (res *v1.SpeechToTextRes, err error) {
	text, err := c.svc.Tutor().SpeechToText(ctx, req.AudioBase64, req.PromptText)
	if err != nil {
		return nil, err
	}
	return &v1.SpeechToTextRes{
		Text:     text,
		Language: "vi",
	}, nil
}

func (c *ControllerV1) GetChatHistory(ctx context.Context, req *v1.GetChatHistoryReq) (res *v1.GetChatHistoryRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var messages []entity.TutorChatMessage
	q := c.svc.DB().WithContext(ctx).Where("user_id = ?", userID)
	if req.LessonID > 0 {
		q = q.Where("lesson_id = ?", req.LessonID)
	}
	q.Order("id ASC").Find(&messages)
	return &v1.GetChatHistoryRes{Messages: messages}, nil
}

func (c *ControllerV1) ClearChatHistory(ctx context.Context, req *v1.ClearChatHistoryReq) (res *v1.ClearChatHistoryRes, err error) {
	userID := consts.CurrentUserID(ctx)
	q := c.svc.DB().WithContext(ctx).Where("user_id = ?", userID)
	if req.LessonID > 0 {
		q = q.Where("lesson_id = ?", req.LessonID)
	}
	q.Delete(&entity.TutorChatMessage{})
	return &v1.ClearChatHistoryRes{Success: true}, nil
}

func (c *ControllerV1) SummarizeLesson(ctx context.Context, req *v1.SummarizeLessonReq) (res *v1.SummarizeLessonRes, err error) {
	md, err := c.svc.Tutor().SummarizeLesson(ctx, req.LessonID)
	if err != nil {
		return nil, err
	}
	return &v1.SummarizeLessonRes{
		LessonID: req.LessonID,
		Markdown: md,
	}, nil
}

func (c *ControllerV1) GenerateConceptMap(ctx context.Context, req *v1.GenerateConceptMapReq) (res *v1.GenerateConceptMapRes, err error) {
	graph, err := c.svc.Tutor().GenerateConceptMap(ctx, req.LessonID)
	if err != nil {
		return nil, err
	}
	return &v1.GenerateConceptMapRes{
		LessonID: req.LessonID,
		Graph:    graph,
	}, nil
}

func (c *ControllerV1) VerifyWatching(ctx context.Context, req *v1.VerifyWatchingReq) (res *v1.VerifyWatchingRes, err error) {
	q, err := c.svc.Tutor().VerifyWatching(ctx, req.LessonID, req.CurrentTimestamp)
	if err != nil {
		return nil, err
	}
	return &v1.VerifyWatchingRes{VerifyWatchingQuestion: q}, nil
}
