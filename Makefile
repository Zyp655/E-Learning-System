.PHONY: help infra-up infra-down dev-api dev-web dev-admin build-api build-web build-admin lint-ds test-api test-ml test-web verify

help:
	@echo "LMS Confusion Detection (SP-BEF V2) & Intelligent AI Tutor — Commands:"
	@echo "  make verify        - Run full P7 verification gate (ML pytest + Go race tests + Web vitest/tsc/lint:ds/build + Admin build)"
	@echo "  make test-ml       - Run SP-BEF V2 ML pytest suite (leakage, reproducibility, ONNX/golden parity, quality gates)"
	@echo "  make test-api      - Run Go backend vet and race-enabled test suite"
	@echo "  make test-web      - Run Web unit tests (vitest), TypeScript check, and Design System linter"
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

test-ml:
	cd ml && .venv/bin/pytest -v

test-api:
	cd lms-api && go vet ./... && go test -race -v ./...

test-web:
	cd lms-web && npm run test:unit && npx tsc --noEmit && npm run lint:ds -- --all

verify:
	@echo "=== [1/4] Verifying ML Pipeline (pytest: Leakage, Reproducibility, ONNX Parity, Quality Gates) ==="
	cd ml && .venv/bin/pytest -v
	@echo "=== [2/4] Verifying Go Backend (go vet & go test -race) ==="
	cd lms-api && go vet ./... && go test -race -v ./... && go build -o bin/lms-api main.go
	@echo "=== [3/4] Verifying Web Frontend (vitest, tsc, lint:ds, next build) ==="
	cd lms-web && npm run test:unit && npx tsc --noEmit && npm run lint:ds -- --all && npm run build
	@echo "=== [4/4] Verifying Admin Dashboard (react-scripts build) ==="
	cd lms-admin && npm run build
	@echo "=== ALL P7 VERIFICATION GATES PASSED SUCCESSFULLY ==="
