package quiz

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/quiz/v1"
)

type IQuizV1 interface {
	ListQuizzes(ctx context.Context, req *v1.ListQuizzesReq) (res *v1.ListQuizzesRes, err error)
	GetQuizDetail(ctx context.Context, req *v1.GetQuizDetailReq) (res *v1.GetQuizDetailRes, err error)
	SubmitQuiz(ctx context.Context, req *v1.SubmitQuizReq) (res *v1.SubmitQuizRes, err error)
	AdaptiveQuiz(ctx context.Context, req *v1.AdaptiveQuizReq) (res *v1.AdaptiveQuizRes, err error)
	GenerateQuiz(ctx context.Context, req *v1.GenerateQuizReq) (res *v1.GenerateQuizRes, err error)
	GenerateModuleQuiz(ctx context.Context, req *v1.GenerateModuleQuizReq) (res *v1.GenerateModuleQuizRes, err error)
	GenerateQuizFromFile(ctx context.Context, req *v1.GenerateQuizFromFileReq) (res *v1.GenerateQuizFromFileRes, err error)
	GenerateQuizFromImage(ctx context.Context, req *v1.GenerateQuizFromImageReq) (res *v1.GenerateQuizFromImageRes, err error)
	GetLeaderboard(ctx context.Context, req *v1.GetLeaderboardReq) (res *v1.GetLeaderboardRes, err error)
	GetQuizStatistics(ctx context.Context, req *v1.GetQuizStatisticsReq) (res *v1.GetQuizStatisticsRes, err error)
	CreateQuizRoom(ctx context.Context, req *v1.CreateQuizRoomReq) (res *v1.CreateQuizRoomRes, err error)
	JoinQuizRoom(ctx context.Context, req *v1.JoinQuizRoomReq) (res *v1.JoinQuizRoomRes, err error)
}
