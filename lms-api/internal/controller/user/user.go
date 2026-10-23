package user

import (
	"context"

	"golang.org/x/crypto/bcrypt"

	"github.com/hieu/lms-confusion/lms-api/api/user"
	v1 "github.com/hieu/lms-confusion/lms-api/api/user/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) user.IUserV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) GetProfile(ctx context.Context, req *v1.GetProfileReq) (res *v1.GetProfileRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var u entity.User
	if err := c.svc.DB().WithContext(ctx).Preload("StudentProfile").First(&u, userID).Error; err != nil {
		return nil, resCode.UserNotFound.New("Không tìm thấy thông tin người dùng")
	}
	var streak entity.UserStreak
	c.svc.DB().WithContext(ctx).Where("user_id = ?", userID).First(&streak)

	var faceCount int64
	c.svc.DB().WithContext(ctx).Model(&entity.FaceEmbedding{}).Where("user_id = ?", userID).Count(&faceCount)

	return &v1.GetProfileRes{
		User:              &u,
		StudentProfile:    u.StudentProfile,
		Streak:            &streak,
		HasFaceRegistered: faceCount > 0,
	}, nil
}

func (c *ControllerV1) UpdateProfile(ctx context.Context, req *v1.UpdateProfileReq) (res *v1.UpdateProfileRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var u entity.User
	if err := c.svc.DB().WithContext(ctx).First(&u, userID).Error; err != nil {
		return nil, resCode.UserNotFound.New("Không tìm thấy người dùng")
	}

	updates := map[string]interface{}{}
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}
	if req.Bio != "" {
		updates["bio"] = req.Bio
	}
	if req.AvatarURL != "" {
		updates["avatar_url"] = req.AvatarURL
	}
	if req.StudentCode != "" {
		updates["student_code"] = req.StudentCode
	}
	if len(updates) > 0 {
		c.svc.DB().WithContext(ctx).Model(&u).Updates(updates)
	}

	var sp entity.StudentProfile
	if err := c.svc.DB().WithContext(ctx).Where("user_id = ?", userID).First(&sp).Error; err != nil {
		sp = entity.StudentProfile{
			UserID:           userID,
			StudentCode:      req.StudentCode,
			Major:            req.Major,
			AcademicYear:     req.AcademicYear,
			Level:            req.Level,
			CareerGoal:       req.CareerGoal,
			PreferredPersona: req.PreferredPersona,
		}
		c.svc.DB().WithContext(ctx).Create(&sp)
	} else {
		spUpdates := map[string]interface{}{}
		if req.Major != "" {
			spUpdates["major"] = req.Major
		}
		if req.AcademicYear > 0 {
			spUpdates["academic_year"] = req.AcademicYear
		}
		if req.Level != "" {
			spUpdates["level"] = req.Level
		}
		if req.CareerGoal != "" {
			spUpdates["career_goal"] = req.CareerGoal
		}
		if req.PreferredPersona != "" {
			spUpdates["preferred_persona"] = req.PreferredPersona
		}
		if len(spUpdates) > 0 {
			c.svc.DB().WithContext(ctx).Model(&sp).Updates(spUpdates)
		}
	}

	c.svc.DB().WithContext(ctx).Preload("StudentProfile").First(&u, userID)
	return &v1.UpdateProfileRes{
		User:           &u,
		StudentProfile: u.StudentProfile,
	}, nil
}

func (c *ControllerV1) ChangePassword(ctx context.Context, req *v1.ChangePasswordReq) (res *v1.ChangePasswordRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var u entity.User
	if err := c.svc.DB().WithContext(ctx).First(&u, userID).Error; err != nil {
		return nil, resCode.UserNotFound.New("Không tìm thấy người dùng")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return nil, resCode.PasswordWrong.New("Mật khẩu hiện tại không chính xác")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, resCode.HashPasswordFailed.WithError(err)
	}
	c.svc.DB().WithContext(ctx).Model(&u).Update("password_hash", string(hash))
	return &v1.ChangePasswordRes{
		Success: true,
		Message: "Đổi mật khẩu thành công",
	}, nil
}

func (c *ControllerV1) ApplyTeacher(ctx context.Context, req *v1.ApplyTeacherReq) (res *v1.ApplyTeacherRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var u entity.User
	c.svc.DB().WithContext(ctx).First(&u, userID)

	app := entity.TeacherApplication{
		UserID:            userID,
		FullName:          req.FullName,
		Email:             u.Email,
		Specialization:    req.Specialization,
		Degree:            req.Degree,
		YearsOfExperience: req.YearsOfExperience,
		Bio:               req.Bio,
		CertificateURL:    req.CertificateURL,
		Status:            "pending",
	}
	if err := c.svc.DB().WithContext(ctx).Create(&app).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.ApplyTeacherRes{Application: &app}, nil
}
