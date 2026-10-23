FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/bin/lms-api main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata ffmpeg

WORKDIR /app
COPY --from=builder /app/bin/lms-api /app/lms-api
COPY --from=builder /app/manifest /app/manifest
COPY --from=builder /app/resource /app/resource

EXPOSE 8000
CMD ["/app/lms-api", "production"]
