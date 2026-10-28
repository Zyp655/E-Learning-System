# Hệ thống Học trực tuyến Thông minh Tích hợp Phát hiện Bối rối Đa phương thức (SP-BEF) và Trợ lý Ảo 3-Tier Video RAG

Dự án xây dựng nền tảng Học trực tuyến thông minh toàn diện theo kiến trúc 4 phân hệ:

1. **Mô hình Phát hiện Bối rối Đa phương thức `SP-BEF` ([`ml/`](./ml))**:
   - **Segment-Prior Bayesian Evidence Fusion (SP-BEF)** huấn luyện hoàn toàn trên 3 tập dữ liệu mở thực tế với chia tách nghiêm ngặt theo chủ thể (`train ∩ val ∩ test = ∅`):
     - **Nhánh Khuôn mặt (DAiSEE)**: MediaPipe FaceLandmarker `0.10.14` → 15 đặc trưng cửa sổ (blendshape, EAR, tư thế đầu) → hồi quy logistic chạy trên trình duyệt, kèm trọng số tin cậy động $r_{\text{face}}(t)$ (`C4`). Huấn luyện trên video gốc DAiSEE (MediaPipe 10 fps, toàn bộ clip, base rate tự nhiên): test **AUROC 0.621 (CI 95% 0.592–0.649)**. Tín hiệu có thật nhưng yếu. Chuẩn hóa baseline cá nhân (`C2`) kém hơn trên validation nên không được dùng.
     - **Nhánh Hành vi xem video (MOOCCubeX)**: nhãn proxy = sai ≥ 50% bài tập cùng chương trong 14 ngày sau khi xem. Test **AUROC 0.509 (CI 0.471–0.545)**, không có tín hiệu nên nhánh bị **tắt** (`w_beh = 0`).
     - **Nhánh Quiz (ASSISTments 2017)**: Test **AUROC 0.785 (CI 0.782–0.788)**. Nhãn là đầu ra của detector `confidence(CONFUSED)` (nhãn yếu).
     - **Nhánh Gaze khi đọc (Reading View)**: theo dõi iris qua webcam → đặc trưng đọc theo đoạn (đọc lại, quay lui dòng, thời gian dừng), dựa trên phần eye tracking của Zhuang et al. 2025 (arXiv:2508.14442). Đang **thu nhãn** qua câu hỏi sau mỗi đoạn; nhánh chưa huấn luyện nên **tắt** (`w_gaze = 0`). Xem [`ml/README.md`](./ml/README.md).
     - **Fusion** (khử base-rate LLR `C1` + HMM 2 trạng thái & hysteresis `C5`) trên giao thức **Virtual Learner** bán tổng hợp: AUROC 0.676, phát hiện ~11% đợt bối rối với 1.95 can thiệp sai/giờ. Chi tiết, so sánh với baseline và các giới hạn: [`ml/REPORT_V2.md`](./ml/REPORT_V2.md).
2. **Backend API (`lms-api`) theo kiến trúc `strongbody-api`**:
   - Go 1.25 + GoFrame v2 + GORM + PostgreSQL (`pgvector`) + Redis + `pgqueue` + `gcron`.
   - Dịch vụ `ConfusionPredictor` (SP-BEF runtime khớp số học $\le 10^{-5}$ với Python/TypeScript qua `ml/golden/parity_vectors.json`) và `AITutorService` (3-Tier Video RAG + GPT-4o Vision + 3 Personas `socrates`/`coach`/`expert` + SSE Streaming + Voice TTS).
3. **Frontend Học viên & Giảng viên (`lms-web`) theo kiến trúc & UI `strongbody-web`**:
   - Next.js 15 App Router (đang cài `next@15.5.x`) + Tailwind CSS v4 + **StrongBody Design System** (`DESIGN_SYSTEM.md`, `tokens.css`, `npm run lint:ds -- --all` đạt **0 vi phạm**).
   - Giao diện các luồng học tập chuẩn Coursera: **Course Gradebook trọng số (#2)**, **Specializations & Capstone (#4)**, **In-Browser Coding Lab (#5)**, **Personalized Deadlines & 1-Click Reset Deadlines (#6)**, **Honor Code & Similarity Score (#7)**, và **Reading View + Autoplay Next 5s (#8)**.
   - Trạng thái tích hợp: trang đăng nhập gọi `POST /v1/auth/login` và lưu `lms_access_token`. `src/api/client.ts` chỉ dùng dữ liệu mẫu (`src/api/mockData.ts`) cho yêu cầu đọc (GET) khi không kết nối được backend; lỗi HTTP và mọi thao tác ghi đều báo lỗi thật cho người dùng. Trợ lý AI gọi endpoint SSE `/v1/student/tutor/stream-chat` (`src/api/tutorStream.ts`).
   - Lint: `npm run lint:setup` (cài một lần bộ ESLint riêng trong `lms-web/tools/eslint`), sau đó `npm run lint`. Lint không nằm trong `make verify`.
4. **Hệ thống Quản trị (`lms-admin`) theo kiến trúc `strongbody_admin`**:
   - React 18 + Ant Design v5 (`#0A3150`) + TanStack Query + Redux.
   - Quản lý giáo trình 4 tầng (`Course -> Modules -> Lessons -> VideoSegments`), giám sát vi phạm sinh trắc học & đạo văn (`/app/proctoring`), và màn hình siêu tham số **SP-BEF** (`/app/ai-settings`). Các tham số SP-BEF chỉnh tại `/app/ai-settings` được gửi tới `PUT /v1/admin/confusion/settings`, lưu vào CSDL và áp dụng ngay cho runtime (xem mục cấu hình bên dưới).
   - Đăng nhập luôn xác thực qua `POST /v1/auth/login` và yêu cầu vai trò `admin`/`super`; sai mật khẩu hoặc lỗi HTTP bị từ chối. Chế độ Demo ngoại tuyến chỉ bật khi đặt `REACT_APP_DEMO_MODE=true` và không kết nối được backend (mặc định `false`, xem `lms-admin/.env.example`).

---

## Cấu trúc Dự án

- [`ml/`](./ml): Pipeline nghiên cứu & huấn luyện **SP-BEF V2** (`PLAN_V2_CONFUSION.md`, `NOVELTY_CHECK.md`, `REPORT_V2.md`, `GLOSSARY.md` — bảng ký hiệu, `sp_bef/`, `tests/test_sp_bef.py`).
- [`lms-api/`](./lms-api): Backend API Server (Go 1.25 + GoFrame v2 + GORM + `pgvector` + SP-BEF).
- [`lms-web/`](./lms-web): Ứng dụng Web cho Học viên & Giảng viên (Next.js App Router + StrongBody Design System).
- [`lms-admin/`](./lms-admin): Hệ thống Quản trị Đào tạo & Cấu hình SP-BEF (React 18 + Ant Design v5).

---

## Cấu hình bảo mật của `lms-api`

- **Dữ liệu demo (seed)**: khi `APP_ENV` là `development`/`dev`/`local`/`test` (hoặc để trống), API tự tạo dữ liệu mẫu nếu CSDL chưa có người dùng. Các tài khoản `admin@lms.edu.vn`, `teacher@lms.edu.vn`, `student@lms.edu.vn` dùng mật khẩu `123456` (có thể đổi bằng `SEED_DEMO_PASSWORD`; tắt bằng `SEED_DEMO_DATA=false`). Với mọi `APP_ENV` khác (ví dụ `production`), seed **không chạy** trừ khi đặt `SEED_DEMO_DATA=true`; khi đó bắt buộc có `SEED_DEMO_PASSWORD` dài ít nhất 8 ký tự và khác `123456`, nếu không API dừng ngay khi khởi động. Endpoint admin `seed-data` tuân theo cùng quy tắc.
- **WebSocket**: chỉ chấp nhận upgrade khi header `Origin` trống (client không phải trình duyệt), cùng host với API, hoặc nằm trong `WS_ALLOWED_ORIGINS` (danh sách phân tách bằng dấu phẩy; mặc định `http://localhost:3000,http://localhost:3001` và `WEB_URL`).
- **Phòng thi đấu quiz** (`/v1/ws/quiz/:roomCode`): người chơi phải tham gia trước qua `POST /v1/student/quiz/rooms/:roomCode/join` (chủ phòng được thêm tự động khi tạo phòng). Phòng không tồn tại trả 404, người ngoài phòng trả 403. Chỉ chủ phòng gửi được `start_game`; câu hỏi gửi cho người chơi không kèm đáp án và lời giải; điểm được chấm phía server, mỗi câu chỉ tính một lần cho mỗi người chơi (lưu ở bảng `room_answers` có khóa duy nhất, nên vẫn đúng sau khi khởi động lại hoặc khi chạy nhiều bản sao). Điểm thưởng tốc độ (200 thay vì 150) do server đo: câu thứ `i` (theo thứ tự) mở từ `startedAt + i * questionTimeSeconds` (gửi trong `game_started`), trả lời đúng trong nửa đầu thời gian của câu được thưởng; trường `timeMs` của client bị bỏ qua. Tham gia phòng chạy trong transaction và `room_players` có khóa duy nhất `(room_id, user_id)`, nên không vượt quá `MaxPlayers` và không tạo người chơi trùng.
- **Quyền sở hữu khóa học**: giảng viên chỉ sửa/xóa/thêm chương, bài, phân đoạn và phản hồi đánh giá trong khóa học của chính mình; Admin quản lý được mọi khóa học.
- **Thông tin đăng nhập mặc định**: với `APP_ENV` khác môi trường phát triển, API từ chối khởi động nếu `DB_PASSWORD` vẫn là `lms_password` (trừ khi `DB_DRIVER=sqlite`) hoặc `S3_ACCESS_KEY`/`S3_SECRET_KEY` vẫn là `minioadmin`/`minioadmin123`. `DB_FALLBACK_SQLITE` mặc định là `true` chỉ trong môi trường phát triển; ở môi trường khác mặc định là `false` (API dừng khi không kết nối được PostgreSQL) trừ khi đặt rõ `DB_FALLBACK_SQLITE=true`.
- **Cấu hình phát hiện bối rối** (`GET/PUT /v1/admin/confusion/settings`): ngoài các trường cũ, có thể ghi đè tham số SP-BEF `thetaOn`, `thetaOff`, `minHoldSec`, `wFace`, `wBeh`, `wQuiz`, `hmmKeepConfused` (ràng buộc `0 < thetaOff < thetaOn < 1`, `minHoldSec > 0`, trọng số `>= 0` và không đồng thời bằng 0, `0 < hmmKeepConfused < 1`; `resetSpBefOverrides: true` trả về giá trị trong `sp_bef_params.json`). Cấu hình được lưu vào bảng `confusion_settings` và nạp lại khi khởi động. Khi chạy nhiều bản sao (replica) `lms-api`, lệnh PUT chỉ áp dụng ngay cho bản sao nhận yêu cầu; các bản sao khác dùng giá trị mới sau khi khởi động lại. `mlThreshold`, `slidingWindowSize`, `cooldownSeconds`, `faceSimilarityThreshold`, `maxAbsentChecks` là trường cũ (`legacyFields`): vẫn được lưu nhưng server không dùng.

---

## Kiểm thử Toàn diện (`make verify` — Gate P7)

Chạy một lệnh duy nhất tại thư mục gốc để kiểm tra toàn bộ checklist **ML (`pytest`) + Go (`go vet` & `go test -race`) + Web (`vitest`, `tsc`, `lint:ds`, `next build`) + Admin (`jest`, `build`)**:

```bash
make verify
```

Các test cần dữ liệu thô trong `ml/data/` (bị gitignore) sẽ được **skip** kèm lý do khi thiếu dữ liệu (ví dụ trên clone sạch). Biến môi trường liên quan:

- `SP_BEF_DATA_DIR`: thư mục dữ liệu thay cho `ml/data` (dùng cho cả test và `ml/run_sp_bef_pipeline.py`).
- `SP_BEF_REQUIRE_DATA=1`: biến các lần skip do thiếu dữ liệu thành lỗi (dùng trên máy có đủ dữ liệu).
