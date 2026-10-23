package middleware

import (
	"context"
	"strings"

	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/hieu/lms-confusion/lms-api/global"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
)

func (m *middlewareStr) AuthenticationMiddleware(allowedScopes []string, isPublic bool) func(r *ghttp.Request) {
	return func(r *ghttp.Request) {
		authorization := r.GetHeader(consts.AuthorizationHeader)
		if authorization == "" {
			if qToken := r.GetQuery("token").String(); qToken != "" {
				authorization = "Bearer " + qToken
			}
		}
		authorizationScope := r.GetHeader(consts.AuthorizationScope)
		if authorizationScope == "" {
			authorizationScope = "lms-web"
		}

		validScope := false
		for _, s := range allowedScopes {
			if consts.CONFIG_SCOPE[authorizationScope] == s {
				validScope = true
				break
			}
		}

		if !validScope {
			r.Response.WriteStatusExit(403, g.Map{
				"code":    40303,
				"message": "unauthorized application scope",
				"data":    nil,
			})
			return
		}

		if isPublic {
			ctx := context.WithValue(r.Context(), consts.AuthorizationScope, consts.CONFIG_SCOPE[authorizationScope])
			if authorization != "" && global.Token != nil {
				fields := strings.Fields(authorization)
				if len(fields) >= 2 && strings.EqualFold(fields[0], consts.AuthorizationType) {
					if payload, err := global.Token.VerifyToken(fields[1]); err == nil {
						ctx = context.WithValue(ctx, consts.AuthorizationKey, payload)
					}
				}
			}
			r.SetCtx(ctx)
			r.Middleware.Next()
			return
		}

		if authorization == "" {
			r.Response.WriteStatusExit(401, g.Map{
				"code":    40102,
				"message": "please provide authorization",
				"data":    nil,
			})
			return
		}

		fields := strings.Fields(authorization)
		if len(fields) < 2 || !strings.EqualFold(fields[0], consts.AuthorizationType) {
			r.Response.WriteStatusExit(401, g.Map{
				"code":    40101,
				"message": "invalid authorization header format",
				"data":    nil,
			})
			return
		}

		payload, err := global.Token.VerifyToken(fields[1])
		if err != nil {
			r.Response.WriteStatusExit(401, g.Map{
				"code":    40101,
				"message": "verify token invalid",
				"data":    nil,
			})
			return
		}

		ctx := context.WithValue(r.Context(), consts.AuthorizationKey, payload)
		ctx = context.WithValue(ctx, consts.AuthorizationScope, authorizationScope)
		ctx = context.WithValue(ctx, "token", fields[1])
		r.SetCtx(ctx)
		r.Middleware.Next()
	}
}

func (m *middlewareStr) AuthenticationMiddlewareWithOptionalJWT(allowedScopes []string) func(r *ghttp.Request) {
	return m.AuthenticationMiddleware(allowedScopes, true)
}
