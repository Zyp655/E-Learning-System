package middleware

import (
	"strings"

	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

func (m *middlewareStr) AuthorizationMiddleware(permission []string) func(r *ghttp.Request) {
	return func(r *ghttp.Request) {
		payload := r.Context().Value(consts.AuthorizationKey)
		if payload == nil {
			r.Response.WriteStatusExit(401, g.Map{
				"code":    40106,
				"message": "unauthorized",
				"data":    nil,
			})
			return
		}

		authPayload, ok := payload.(*token.Payload)
		if !ok {
			r.Response.WriteStatusExit(403, g.Map{
				"code":    40303,
				"message": "invalid payload type",
				"data":    nil,
			})
			return
		}

		for _, p := range permission {
			if strings.EqualFold(authPayload.Permissions, p) ||
				strings.EqualFold(authPayload.Permissions, consts.PermAdmin) ||
				strings.EqualFold(authPayload.Permissions, consts.PermSuper) {
				r.Middleware.Next()
				return
			}
		}

		r.Response.WriteStatusExit(403, g.Map{
			"code":    40303,
			"message": "permission denied",
			"data":    nil,
		})
	}
}
