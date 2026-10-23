package roadmap

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/roadmap/v1"
)

type IRoadmapV1 interface {
	GetCourseRoadmap(ctx context.Context, req *v1.GetCourseRoadmapReq) (res *v1.GetCourseRoadmapRes, err error)
	SaveCourseRoadmap(ctx context.Context, req *v1.SaveCourseRoadmapReq) (res *v1.SaveCourseRoadmapRes, err error)
	GetPersonalRoadmap(ctx context.Context, req *v1.GetPersonalRoadmapReq) (res *v1.GetPersonalRoadmapRes, err error)
	SavePersonalRoadmap(ctx context.Context, req *v1.SavePersonalRoadmapReq) (res *v1.SavePersonalRoadmapRes, err error)
	SuggestElectives(ctx context.Context, req *v1.SuggestElectivesReq) (res *v1.SuggestElectivesRes, err error)
	GetStudyPlan(ctx context.Context, req *v1.GetStudyPlanReq) (res *v1.GetStudyPlanRes, err error)
	CreateStudyPlan(ctx context.Context, req *v1.CreateStudyPlanReq) (res *v1.CreateStudyPlanRes, err error)
}
