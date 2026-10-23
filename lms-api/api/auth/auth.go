package auth

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/auth/v1"
)

type IAuthV1 interface {
	Register(ctx context.Context, req *v1.RegisterReq) (res *v1.RegisterRes, err error)
	Login(ctx context.Context, req *v1.LoginReq) (res *v1.LoginRes, err error)
	RefreshToken(ctx context.Context, req *v1.RefreshTokenReq) (res *v1.RefreshTokenRes, err error)
	VerifySession(ctx context.Context, req *v1.VerifySessionReq) (res *v1.VerifySessionRes, err error)
	ForgotPassword(ctx context.Context, req *v1.ForgotPasswordReq) (res *v1.ForgotPasswordRes, err error)
	ResetPassword(ctx context.Context, req *v1.ResetPasswordReq) (res *v1.ResetPasswordRes, err error)
	GetFace(ctx context.Context, req *v1.GetFaceReq) (res *v1.GetFaceRes, err error)
	RegisterFace(ctx context.Context, req *v1.RegisterFaceReq) (res *v1.RegisterFaceRes, err error)
	DeleteFace(ctx context.Context, req *v1.DeleteFaceReq) (res *v1.DeleteFaceRes, err error)
	ReportFaceViolation(ctx context.Context, req *v1.ReportFaceViolationReq) (res *v1.ReportFaceViolationRes, err error)
}
