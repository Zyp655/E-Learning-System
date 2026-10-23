.PHONY: help infra-up infra-down dev-api dev-web dev-admin build-api build-web build-admin lint-ds test-api

help:
	@echo "LMS Confusion Detection & Intelligent AI Tutor — Commands:"
	@echo "  make infra-up      - Start PostgreSQL (pgvector), Redis, MinIO via Docker Compose"
	@echo "  make infra-down    - Stop infrastructure containers"
	@echo "  make dev-api       - Run Go backend (lms-api) on :8000"
	@echo "  make dev-web       - Run Next.js frontend (lms-web) on :3000"
	@echo "  make dev-admin     - Run React Admin dashboard (lms-admin) on :3001"
	@echo "  make lint-ds       - Run StrongBody Design System linter on lms-web"
	@echo "  make build-api     - Compile lms-api binary"
	@echo "  make build-web     - Build lms-web production bundle"
	@echo "  make build-admin   - Build lms-admin production bundle"

infra-up:
	docker compose up -d postgres redis minio

infra-down:
	docker compose down

dev-api:
	cd lms-api && go run main.go development

dev-web:
	cd lms-web && npm run dev

dev-admin:
	cd lms-admin && npm start

lint-ds:
	cd lms-web && npm run lint:ds -- --all

build-api:
	cd lms-api && go build -o bin/lms-api main.go

build-web:
	cd lms-web && npm run build

build-admin:
	cd lms-admin && npm run build

test-api:
	cd lms-api && go test -v ./...
