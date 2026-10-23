package cmd

import (
	"context"

	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/gogf/gf/v2/net/goai"
	"github.com/gogf/gf/v2/os/gcmd"
	"github.com/gogf/gf/v2/os/gfile"
	"go.opentelemetry.io/otel"
	otelnoop "go.opentelemetry.io/otel/trace/noop"

	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/middleware"
	"github.com/hieu/lms-confusion/lms-api/internal/router"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

var (
	Main = gcmd.Command{
		Name:  "main",
		Usage: "main",
		Brief: "start lms-api http server",
		Func: func(ctx context.Context, parser *gcmd.Parser) (err error) {
			s := g.Server()
			s.SetDumpRouterMap(false)

			s.SetConfigWithMap(g.Map{
				"clientMaxBodySize": 100 * 1024 * 1024, // 100MB
			})

			mw := middleware.NewMiddleware()

			s.Use(mw.CORS())
			s.Use(mw.LocaleMiddleware())
			s.Use(mw.RequestMetadataMiddleware())
			s.Use(mw.ResponseMiddleware())
			s.Use(func(r *ghttp.Request) {
				g.Log().Infof(r.GetCtx(), "[HTTP] %s %s", r.Method, r.URL.Path)
				r.Middleware.Next()
			})

			s.SetPort(config.GetConfig().ServerCfg.Port)

			_ = setUpSwagger(s)

			otel.SetTracerProvider(otelnoop.NewTracerProvider())

			_ = gfile.Mkdir("./uploads")
			s.AddStaticPath("/uploads", "./uploads")

			r := s.Group("/v1")
			router.Router(r)

			s.BindHandler("GET:/health", func(r *ghttp.Request) {
				pred := service.GetConfusionPredictor()
				r.Response.WriteJson(map[string]interface{}{
					"status":              "ok",
					"service":             "lms-api",
					"confusionModelReady": pred.IsReady(),
				})
			})

			s.Run()
			return nil
		},
	}
)

func setUpSwagger(s *ghttp.Server) error {
	s.GetOpenApi().Info.Title = "LMS Confusion & Multi-Modal AI Tutor API"
	s.GetOpenApi().Info.Description = "GoFrame v2 Backend for Real-Time Confusion Detection (CV + 12-Feature MLP/LR) & 3-Tier Video RAG AI Tutor"
	s.GetOpenApi().Info.Version = "1.0.0"
	s.GetOpenApi().Servers = &goai.Servers{
		{
			URL:         config.GetConfig().ServerCfg.ServerHost,
			Description: "LMS API Server",
		},
	}
	s.GetOpenApi().Security = &goai.SecurityRequirements{
		{
			"bearerAuth": []string{},
		},
	}
	s.GetOpenApi().Components.SecuritySchemes = goai.SecuritySchemes{
		"bearerAuth": goai.SecuritySchemeRef{
			Value: &goai.SecurityScheme{
				Type:        "http",
				Scheme:      "bearer",
				Description: "Bearer token authentication",
				Name:        "Authorization",
				In:          "header",
			},
		},
	}

	htmlContent := gfile.GetBytes(gfile.Join(gfile.MainPkgPath(), "resource", "template", "swagger.html"))
	if len(htmlContent) > 0 {
		s.SetSwaggerUITemplate(string(htmlContent))
	}
	s.SetOpenApiPath("/api.json")
	s.SetSwaggerPath("/swagger")
	return nil
}
