# Hệ thống Học trực tuyến Thông minh Tích hợp Phát hiện Bối rối Đa phương thức (SP-BEF) và Trợ lý Ảo 3-Tier Video RAG

Dự án xây dựng nền tảng Học trực tuyến thông minh toàn diện theo kiến trúc 4 phân hệ:

1. **Mô hình Phát hiện Bối rối Đa phương thức `SP-BEF` ([`ml/`](./ml))**:
   - **Segment-Prior Bayesian Evidence Fusion (SP-BEF)** huấn luyện hoàn toàn trên 3 tập dữ liệu mở thực tế với chia tách nghiêm ngặt theo chủ thể (`train ∩ val ∩ test = ∅`):
     - **Nhánh Khuôn mặt (`Face Branch` — DAiSEE)**: MediaPipe FaceLandmarker `0.10.14` (478 3D Landmarks + 52 Blendshapes + `EAR` Eye-Lock) kết hợp **Chuẩn hóa Baseline Cá nhân trên thiết bị (`C2`)** và **Trọng số tin cậy động $r_{\text{face}}(t)$ (`C4`)**, xuất mô hình `sp_bef_face.onnx` (`864 bytes`, `< 0.1 ms` suy luận). Đạt **`AUROC = 0.7367, AUPRC = 0.7523, ECE = 0.0422`** trên tập `test` chính thức của DAiSEE.
     - **Nhánh Hành vi & Tiên nghiệm Phân đoạn (`Behavior Branch & Segment Prior π_s` — MOOCCubeX)**: Cửa sổ trượt thời gian thực 300s (`pause_count`, `avg_pause_duration`, `long_pause_count`, `rewind_count`, `rewind_same_spot`, `speed_change_down`) và mật độ tua lại đám đông $\pi_s$ (`C3`). Đạt **`AUROC = 0.8459, AUPRC = 0.8320, ECE = 0.0279`**.
     - **Nhánh Trắc nghiệm (`Quiz Branch` — ASSISTments)**: Điểm chính xác, thời gian làm bài và số lần thử trên câu hỏi In-Video Segment Quiz (`has_quiz` flag). Đạt **`AUROC = 0.7878, AUPRC = 0.4563, ECE = 0.0366`**.
     - **Hợp nhất Tỷ số Hợp lý Hiệu chỉnh (`C1`) + Bộ lọc tiến HMM 2 Trạng thái & Hysteresis (`C5`)**: Đạt **`AUROC = 0.9383, AUPRC = 0.9131, ECE = 0.0655`** trên giao thức đánh giá **Virtual Learner (`C6`)** (mô phỏng 30% phiên tắt camera, 60% bước chưa có quiz, 25% khung hình chất lượng kém). Xem chi tiết tại [`ml/REPORT_V2.md`](./ml/REPORT_V2.md).
2. **Backend API (`lms-api`) theo kiến trúc `strongbody-api`**:
   - Go 1.25 + GoFrame v2 + GORM + PostgreSQL (`pgvector`) + Redis + `pgqueue` + `gcron`.
   - Dịch vụ `ConfusionPredictor` (SP-BEF runtime khớp số học $\le 10^{-5}$ với Python/ONNX/TypeScript qua `ml/golden/parity_vectors.json`) và `AITutorService` (3-Tier Video RAG + GPT-4o Vision + 3 Personas `socrates`/`coach`/`expert` + SSE Streaming + Voice TTS).
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
