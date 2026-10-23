# Hệ thống Học trực tuyến (LMS) Tích hợp Mô hình Phát hiện Sự Bối rối của Học sinh qua Computer Vision và Trợ lý Ảo Giải thích Nội dung Thông minh

Dự án xây dựng nền tảng Học trực tuyến thông minh toàn diện, kết hợp:
1. **Nghiệp vụ LMS & Mô hình AI/CV từ `LMS` (ALARMM):** 18 phân hệ chức năng, 58 bảng cơ sở dữ liệu PostgreSQL + `pgvector`, phát hiện bối rối đa phương thức (Computer Vision + Hành vi xem video + Quiz), xác thực khuôn mặt chống học hộ (MobileFaceNet 3 góc mặt), và Trợ lý ảo giải thích nội dung chủ động đa phương thức (Multi-Modal Video RAG + 3 Personas + Voice Streaming).
2. **Kiến trúc Backend (`lms-api`) từ `strongbody-api`:** Go 1.25 + GoFrame v2 + GORM + PostgreSQL (`pgvector`) + Redis + `pgqueue` + `gcron`.
3. **Kiến trúc & Giao diện Frontend (`lms-web`) từ `strongbody-web`:** Next.js App Router (SSR-first) + Tailwind CSS v4 + **StrongBody Design System** (`DESIGN_SYSTEM.md`, `tokens.css`, bố cục Nền xám `bg-muted` + Card trắng `cardVariants`, font Plus Jakarta Sans, Heroicons `<Icon>`, `npm run lint:ds`).
4. **Kiến trúc Quản trị (`lms-admin`) từ `strongbody_admin`:** React 18 + Ant Design v5 (`#0A3150`) + TanStack Query + Redux + Axios.

---

## Cấu trúc Dự án

- [`plan.md`](./plan.md): Bản kế hoạch kiến trúc, CSDL, API và mô hình AI/CV chi tiết.
- [`lms-api/`](./lms-api): Backend API Server (Go 1.25 + GoFrame v2 + GORM + `pgvector` + `pgqueue`).
- [`lms-web/`](./lms-web): Ứng dụng Web cho Học sinh & Giảng viên (Next.js App Router + StrongBody Design System).
- [`lms-admin/`](./lms-admin): Hệ thống Quản trị Đào tạo & Cấu hình AI (React 18 + Ant Design v5).
- [`ml/`](./ml): Pipeline huấn luyện mô hình Computer Vision (DAiSEE Landmark BiLSTM, EfficientNetV2-S + SE + BiLSTM + Attention, 12-Feature Multimodal Classifier, Ablation Study & xuất ONNX).

---

## Hướng dẫn Khởi chạy Nhanh

### 1. Khởi chạy Hạ tầng (PostgreSQL + `pgvector`, Redis, MinIO)
```bash
make infra-up
```

### 2. Khởi chạy Backend (`lms-api` — Port `8000`)
```bash
make dev-api
# Swagger UI: http://localhost:8000/swagger
```

### 3. Khởi chạy Frontend Học sinh & Giảng viên (`lms-web` — Port `3000`)
```bash
make dev-web
# Kiểm tra tuân thủ StrongBody Design System:
make lint-ds
```

### 4. Khởi chạy Trang Quản trị (`lms-admin` — Port `3001`)
```bash
make dev-admin
```
