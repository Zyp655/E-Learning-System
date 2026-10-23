package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/hieu/lms-confusion/lms-api/api/auth"
	v1 "github.com/hieu/lms-confusion/lms-api/api/auth/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) auth.IAuthV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) Register(ctx context.Context, req *v1.RegisterReq) (res *v1.RegisterRes, err error) {
	bundle, err := c.svc.RegisterUser(ctx, req.Email, req.Password, req.FullName, req.Role, req.StudentCode, req.Major, req.AcademicYear)
	if err != nil {
		return nil, err
	}
	return &v1.RegisterRes{AuthTokenBundle: bundle}, nil
}

func (c *ControllerV1) Login(ctx context.Context, req *v1.LoginReq) (res *v1.LoginRes, err error) {
	bundle, err := c.svc.LoginUser(ctx, req.Email, req.Password, req.Scope)
	if err != nil {
		return nil, err
	}
	return &v1.LoginRes{AuthTokenBundle: bundle}, nil
}

func (c *ControllerV1) RefreshToken(ctx context.Context, req *v1.RefreshTokenReq) (res *v1.RefreshTokenRes, err error) {
	bundle, err := c.svc.RefreshAccessToken(ctx, req.RefreshToken)
	if err != nil {
		return nil, err
	}
	return &v1.RefreshTokenRes{AuthTokenBundle: bundle}, nil
}

func (c *ControllerV1) VerifySession(ctx context.Context, req *v1.VerifySessionReq) (res *v1.VerifySessionRes, err error) {
	userID := consts.CurrentUserID(ctx)
	payload := consts.CurrentPayload(ctx)
	var user entity.User
	if err := c.svc.DB().WithContext(ctx).Preload("StudentProfile").First(&user, userID).Error; err != nil {
		return nil, resCode.UserNotFound.New("Không tìm thấy người dùng")
	}
	valid := true
	if payload != nil && payload.SessionID != "" && user.ActiveSessionToken != "" && payload.SessionID != user.ActiveSessionToken {
		valid = false
	}
	return &v1.VerifySessionRes{
		Valid:        valid,
		SessionToken: user.ActiveSessionToken,
		User:         &user,
	}, nil
}

func (c *ControllerV1) ForgotPassword(ctx context.Context, req *v1.ForgotPasswordReq) (res *v1.ForgotPasswordRes, err error) {
	var user entity.User
	if err := c.svc.DB().WithContext(ctx).Where("email = ?", req.Email).First(&user).Error; err != nil {
		return nil, resCode.EmailNotFound.New("Không tìm thấy tài khoản với email này")
	}
	tokenStr := uuid.NewString()
	reset := entity.PasswordResetToken{
		UserID:    user.ID,
		Token:     tokenStr,
		ExpiresAt: time.Now().Add(30 * time.Minute),
	}
	c.svc.DB().WithContext(ctx).Create(&reset)
	return &v1.ForgotPasswordRes{
		ResetToken: tokenStr,
		Message:    "Mã khôi phục mật khẩu đã được tạo thành công (hiệu lực 30 phút).",
	}, nil
}

func (c *ControllerV1) ResetPassword(ctx context.Context, req *v1.ResetPasswordReq) (res *v1.ResetPasswordRes, err error) {
	var reset entity.PasswordResetToken
	if err := c.svc.DB().WithContext(ctx).Where("token = ? AND used = ?", req.ResetToken, false).First(&reset).Error; err != nil {
		return nil, resCode.PasswordResetTokenExpired.New("Mã khôi phục không hợp lệ hoặc đã hết hạn")
	}
	if time.Now().After(reset.ExpiresAt) {
		return nil, resCode.PasswordResetTokenExpired.New("Mã khôi phục đã hết hạn")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, resCode.HashPasswordFailed.WithError(err)
	}
	c.svc.DB().WithContext(ctx).Model(&entity.User{}).Where("id = ?", reset.UserID).Update("password_hash", string(hash))
	c.svc.DB().WithContext(ctx).Model(&reset).Update("used", true)
	return &v1.ResetPasswordRes{
		Success: true,
		Message: "Đặt lại mật khẩu thành công.",
	}, nil
}

func (c *ControllerV1) GetFace(ctx context.Context, req *v1.GetFaceReq) (res *v1.GetFaceRes, err error) {
	userID := consts.CurrentUserID(ctx)
	list, err := c.svc.GetFaceEmbeddings(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &v1.GetFaceRes{
		HasRegistered: len(list) > 0,
		Embeddings:    list,
	}, nil
}

func (c *ControllerV1) RegisterFace(ctx context.Context, req *v1.RegisterFaceReq) (res *v1.RegisterFaceRes, err error) {
	userID := consts.CurrentUserID(ctx)
	list, err := c.svc.RegisterFaceEmbeddings(ctx, userID, req.Poses, req.DeviceInfo)
	if err != nil {
		return nil, err
	}
	return &v1.RegisterFaceRes{
		Success:    true,
		Embeddings: list,
	}, nil
}

func (c *ControllerV1) DeleteFace(ctx context.Context, req *v1.DeleteFaceReq) (res *v1.DeleteFaceRes, err error) {
	userID := consts.CurrentUserID(ctx)
	if err := c.svc.DeleteFaceEmbeddings(ctx, userID); err != nil {
		return nil, err
	}
	return &v1.DeleteFaceRes{Success: true}, nil
}

func (c *ControllerV1) ReportFaceViolation(ctx context.Context, req *v1.ReportFaceViolationReq) (res *v1.ReportFaceViolationRes, err error) {
	userID := consts.CurrentUserID(ctx)
	v, err := c.svc.ReportFaceViolation(ctx, userID, req.LessonID, req.CourseID, req.ViolationType, req.VideoTimestamp, req.DurationSeconds, req.SimilarityScore, req.Details)
	if err != nil {
		return nil, err
	}
	return &v1.ReportFaceViolationRes{Violation: v}, nil
}
