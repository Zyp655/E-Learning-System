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

// httpStatusForCode maps a response code to the HTTP status sent with the JSON envelope.
// Project codes carry the status in their leading digits (40001 -> 400, 404001 -> 404); GoFrame's
// built-in 2-digit gcode values (50 InternalError, 61 NotAuthorized, 65 NotFound, ...) must not fall
// through to 200, otherwise clients treat failures as successful responses.
func httpStatusForCode(code int) int {
	switch code {
	case gcode.CodeOK.Code():
		return http.StatusOK
	case gcode.CodeValidationFailed.Code(), gcode.CodeInvalidParameter.Code(), gcode.CodeMissingParameter.Code(),
		gcode.CodeInvalidOperation.Code(), gcode.CodeOperationFailed.Code(), gcode.CodeInvalidRequest.Code(),
		gcode.CodeBusinessValidationFailed.Code():
		return http.StatusBadRequest
	case gcode.CodeNotAuthorized.Code(), gcode.CodeSecurityReason.Code():
		return http.StatusForbidden
	case gcode.CodeNotFound.Code():
		return http.StatusNotFound
	case gcode.CodeNotImplemented.Code(), gcode.CodeNotSupported.Code():
		return http.StatusNotImplemented
	case gcode.CodeServerBusy.Code():
		return http.StatusServiceUnavailable
	}

	var status int
	switch len(strconv.Itoa(code)) {
	case 3:
		status = code
	case 5:
		status = code / 100
	case 6:
		status = code / 1000
	}
	if status >= 100 && status <= 599 {
		return status
	}
	// Remaining framework codes (50 InternalError, 52 DbOperationError, 64 Unknown, 68 InternalPanic, ...)
	// and any unrecognised code are server-side failures.
	return http.StatusInternalServerError
}

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

		r.Response.WriteHeader(httpStatusForCode(code.Code()))
		r.Response.WriteJson(DefaultHandlerResponse{
			Code:    code.Code(),
			Message: msg,
			Data:    res,
		})
	}
}
