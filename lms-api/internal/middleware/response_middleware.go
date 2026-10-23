package middleware

import (
	"mime"
	"net/http"
	"strconv"

	"github.com/gogf/gf/v2/errors/gcode"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/gogf/gf/v2/net/ghttp"
)

type DefaultHandlerResponse struct {
	Code    int         `json:"code"    dc:"Error code"`
	Message string      `json:"message" dc:"Error message"`
	Data    interface{} `json:"data"    dc:"Result data for certain request according API definition"`
}

const (
	contentTypeEventStream  = "text/event-stream"
	contentTypeOctetStream  = "application/octet-stream"
	contentTypeMixedReplace = "multipart/x-mixed-replace"
)

var (
	streamContentType = []string{contentTypeEventStream, contentTypeOctetStream, contentTypeMixedReplace}
)

func (m *middlewareStr) ResponseMiddleware() func(r *ghttp.Request) {
	return func(r *ghttp.Request) {
		r.Middleware.Next()

		if r.Response.BufferLength() > 0 || r.Response.Writer.BytesWritten() > 0 {
			return
		}

		// Bypass JSON wrapper for SSE / Streaming responses
		mediaType, _, _ := mime.ParseMediaType(r.Response.Header().Get("Content-Type"))
		for _, ct := range streamContentType {
			if mediaType == ct {
				return
			}
		}

		var (
			msg  string
			err  = r.GetError()
			res  = r.GetHandlerResponse()
			code = gerror.Code(err)
		)

		if err != nil {
			if code == gcode.CodeNil {
				code = gcode.CodeInternalError
			}
			msg = err.Error()
		} else {
			if r.Response.Status > 0 && r.Response.Status != http.StatusOK {
				switch r.Response.Status {
				case http.StatusNotFound:
					code = gcode.CodeNotFound
				case http.StatusForbidden:
					code = gcode.CodeNotAuthorized
				default:
					code = gcode.CodeUnknown
				}
				err = gerror.NewCode(code, msg)
				r.SetError(err)
			} else {
				code = gcode.CodeOK
			}
			msg = code.Message()
		}

		httpStatus := http.StatusOK
		length := len(strconv.Itoa(code.Code()))
		if length == 5 {
			httpStatus = code.Code() / 100
		} else if length == 6 {
			httpStatus = code.Code() / 1000
		}
		if code.Code() == 51 {
			httpStatus = http.StatusBadRequest
		}

		r.Response.WriteHeader(httpStatus)
		r.Response.WriteJson(DefaultHandlerResponse{
			Code:    code.Code(),
			Message: msg,
			Data:    res,
		})
	}
}
