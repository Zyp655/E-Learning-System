package media

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/media/v1"
)

type IMediaV1 interface {
	PresignUpload(ctx context.Context, req *v1.PresignUploadReq) (res *v1.PresignUploadRes, err error)
	UploadMedia(ctx context.Context, req *v1.UploadMediaReq) (res *v1.UploadMediaRes, err error)
	TranscribeVideo(ctx context.Context, req *v1.TranscribeVideoReq) (res *v1.TranscribeVideoRes, err error)
	ExtractDocument(ctx context.Context, req *v1.ExtractDocumentReq) (res *v1.ExtractDocumentRes, err error)
}
