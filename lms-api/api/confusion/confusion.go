package confusion

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/confusion/v1"
)

type IConfusionV1 interface {
	PredictConfusion(ctx context.Context, req *v1.PredictConfusionReq) (res *v1.PredictConfusionRes, err error)
	ExplainConfusion(ctx context.Context, req *v1.ExplainConfusionReq) (res *v1.ExplainConfusionRes, err error)
	LogConfusionSession(ctx context.Context, req *v1.LogConfusionSessionReq) (res *v1.LogConfusionSessionRes, err error)
	ResolveConfusionEpisode(ctx context.Context, req *v1.ResolveConfusionEpisodeReq) (res *v1.ResolveConfusionEpisodeRes, err error)
	GetTeacherConfusionAnalytics(ctx context.Context, req *v1.GetTeacherConfusionAnalyticsReq) (res *v1.GetTeacherConfusionAnalyticsRes, err error)
	GenerateTeacherBehaviorReport(ctx context.Context, req *v1.GenerateTeacherBehaviorReportReq) (res *v1.GenerateTeacherBehaviorReportRes, err error)
}
