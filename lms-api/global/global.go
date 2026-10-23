package global

import (
	"github.com/gogf/gf/v2/os/glog"
	"gorm.io/gorm"

	"github.com/hieu/lms-confusion/lms-api/internal/pgqueue"
	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

var (
	Logger         *glog.Logger
	Token          token.Maker
	DB             *gorm.DB
	QueuePublisher *pgqueue.Publisher
)
