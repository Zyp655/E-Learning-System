package user

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/user/v1"
)

type IUserV1 interface {
	GetProfile(ctx context.Context, req *v1.GetProfileReq) (res *v1.GetProfileRes, err error)
	UpdateProfile(ctx context.Context, req *v1.UpdateProfileReq) (res *v1.UpdateProfileRes, err error)
	ChangePassword(ctx context.Context, req *v1.ChangePasswordReq) (res *v1.ChangePasswordRes, err error)
	ApplyTeacher(ctx context.Context, req *v1.ApplyTeacherReq) (res *v1.ApplyTeacherRes, err error)
}
