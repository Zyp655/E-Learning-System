# Hệ thống Học trực tuyến Thông minh Tích hợp Phát hiện Bối rối Đa phương thức (SP-BEF) và Trợ lý Ảo 3-Tier Video RAG

Dự án xây dựng nền tảng Học trực tuyến thông minh toàn diện theo kiến trúc 4 phân hệ:

1. **Mô hình Phát hiện Bối rối Đa phương thức `SP-BEF` ([`ml/`](./ml))**:
   - **Segment-Prior Bayesian Evidence Fusion (SP-BEF)** huấn luyện hoàn toàn trên 3 tập dữ liệu mở thực tế với chia tách nghiêm ngặt theo chủ thể (`train ∩ val ∩ test = ∅`):
     - **Nhánh Khuôn mặt (DAiSEE)**: MediaPipe FaceLandmarker `0.10.14` → 15 đặc trưng cửa sổ (blendshape, EAR, tư thế đầu) → hồi quy logistic chạy trên trình duyệt, kèm trọng số tin cậy động $r_{\text{face}}(t)$ (`C4`). Huấn luyện trên video gốc DAiSEE (MediaPipe 10 fps, toàn bộ clip, base rate tự nhiên): test **AUROC 0.621 (CI 95% 0.592–0.649)**. Tín hiệu có thật nhưng yếu. Chuẩn hóa baseline cá nhân (`C2`) kém hơn trên validation nên không được dùng.
     - **Nhánh Hành vi xem video (MOOCCubeX)**: nhãn proxy = sai ≥ 50% bài tập cùng chương trong 14 ngày sau khi xem. Test **AUROC 0.509 (CI 0.471–0.545)**, không có tín hiệu nên nhánh bị **tắt** (`w_beh = 0`).
     - **Nhánh Quiz (ASSISTments 2017)**: Test **AUROC 0.785 (CI 0.782–0.788)**. Nhãn là đầu ra của detector `confidence(CONFUSED)` (nhãn yếu).
     - **Fusion** (khử base-rate LLR `C1` + HMM 2 trạng thái & hysteresis `C5`) trên giao thức **Virtual Learner** bán tổng hợp: AUROC 0.676, phát hiện ~11% đợt bối rối với 1.95 can thiệp sai/giờ. Chi tiết, so sánh với baseline và các giới hạn: [`ml/REPORT_V2.md`](./ml/REPORT_V2.md).
2. **Backend API (`lms-api`) theo kiến trúc `strongbody-api`**:
   - Go 1.25 + GoFrame v2 + GORM + PostgreSQL (`pgvector`) + Redis + `pgqueue` + `gcron`.
   - Dịch vụ `ConfusionPredictor` (SP-BEF runtime khớp số học $\le 10^{-5}$ với Python/TypeScript qua `ml/golden/parity_vectors.json`) và `AITutorService` (3-Tier Video RAG + GPT-4o Vision + 3 Personas `socrates`/`coach`/`expert` + SSE Streaming + Voice TTS).
3. **Frontend Học viên & Giảng viên (`lms-web`) theo kiến trúc & UI `strongbody-web`**:
   - Next.js 16 App Router + Tailwind CSS v4 + **StrongBody Design System** (`DESIGN_SYSTEM.md`, `tokens.css`, `npm run lint:ds -- --all` đạt **0 vi phạm**).
   - Tích hợp đầy đủ các luồng học tập chuẩn Coursera: **Course Gradebook trọng số (#2)**, **Specializations & Capstone (#4)**, **In-Browser Coding Lab (#5)**, **Personalized Deadlines & 1-Click Reset Deadlines (#6)**, **Honor Code & Similarity Score (#7)**, và **Reading View + Autoplay Next 5s (#8)**.
4. **Hệ thống Quản trị (`lms-admin`) theo kiến trúc `strongbody_admin`**:
   - React 18 + Ant Design v5 (`#0A3150`) + TanStack Query + Redux.
   - Quản lý giáo trình 4 tầng (`Course -> Modules -> Lessons -> VideoSegments`), giám sát vi phạm sinh trắc học & đạo văn (`/app/proctoring`), và cấu hình siêu tham số **SP-BEF** (`/app/ai-settings`).

---

## Cấu trúc Dự án

- [`ml/`](./ml): Pipeline nghiên cứu & huấn luyện **SP-BEF V2** (`PLAN_V2_CONFUSION.md`, `NOVELTY_CHECK.md`, `REPORT_V2.md`, `sp_bef/`, `tests/test_sp_bef.py`).
- [`lms-api/`](./lms-api): Backend API Server (Go 1.25 + GoFrame v2 + GORM + `pgvector` + SP-BEF).
- [`lms-web/`](./lms-web): Ứng dụng Web cho Học viên & Giảng viên (Next.js App Router + StrongBody Design System).
- [`lms-admin/`](./lms-admin): Hệ thống Quản trị Đào tạo & Cấu hình SP-BEF (React 18 + Ant Design v5).

---

## Kiểm thử Toàn diện (`make verify` — Gate P7)

Chạy một lệnh duy nhất tại thư mục gốc để kiểm tra toàn bộ checklist **ML (`pytest`) + Go (`go vet` & `go test -race`) + Web (`vitest`, `tsc`, `lint:ds`, `next build`) + Admin (`build`)**:

```bash
make verify
```
