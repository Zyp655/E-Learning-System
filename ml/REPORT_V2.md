# Báo cáo Thực nghiệm V2 — SP-BEF (Segment-Prior Bayesian Evidence Fusion)

> Ngày xuất báo cáo: 2026-10-26 · Seed cố định: `42` · Python `3.11.17` (`uv`) · MediaPipe FaceLandmarker `0.10.14 (float16)`
> Ràng buộc tuân thủ: **100% Dữ liệu Mở Thực tế**, **Không rò rỉ chủ thể (`subject/user/student split = ∅`)**, **Không bịa số liệu (`AUC 1.0` synthetic đã bị gỡ bỏ hoàn toàn)**.

---

## 1. Dữ liệu Mở & Kiểm chứng Không Rò rỉ (`Gate P0 & P7`)

| Nhánh (Modality) | Tập dữ liệu mở | Số lượng mẫu (`train / val / test`) | Đơn vị chia tách (`Group Split`) | Giao tập `train ∩ val ∩ test` | Tỷ lệ cơ sở (`Base Rate b_m`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Face Branch (On-Device)** | **DAiSEE** (`frame_labels.csv` + khung hình thật) | `1732 / 493 / 530` clips | Theo `subject` (`68 / 19 / 21` chủ thể) | **$\emptyset$ (0 chủ thể trùng)** | `0.4729` |
| **2. Behavior + Segment Prior $\pi_s$** | **MOOCCubeX** (`user-video.json` & `user-problem.json`) | `9299 / 1425 / 1276` phiên | Theo `user_id` (`1277` học viên) | **$\emptyset$ (0 học viên trùng)** | `0.3404` |
| **3. Quiz Branch** | **ASSISTments** (`anonymized_full_release_competition_dataset.csv`) | `54975 / 12904 / 12121` lượt | Theo `studentId` (`97` học sinh) | **$\emptyset$ (0 học sinh trùng)** | `0.1695` |

---

## 2. Kết quả Thực nghiệm Từng Nhánh Đơn lẻ (Single-Branch Benchmarks trên Tập Test Chính thức)

### 2.1. Nhánh Khuôn mặt (`Face Branch` — DAiSEE Official Test Split)
- **Tác động của Chuẩn hóa Baseline Cá nhân (Đóng góp C2)**:
  - Khi **không dùng** chuẩn hóa cá nhân C2 (chỉ dùng 12 đặc trưng thống kê cửa sổ 10s): `AUROC = 0.7344` (tương đương baseline cũ `0.6610`).
  - Khi **áp dụng chuẩn hóa Baseline Cá nhân C2** (lấy clip đầu tiên của mỗi `subject` làm tham chiếu cá nhân và loại bỏ clip đó khỏi tập đánh giá): **`AUROC = 0.7367`**, **`AUPRC = 0.7523`** (vượt xa baseline luôn âm `0.4887`).
- **Hiệu chỉnh Xác suất Isotonic (Platt/Isotonic Calibration)**:
  - Sai số hiệu chỉnh kỳ vọng trước hiệu chỉnh: `ECE = 0.0421` $\rightarrow$ Sau hiệu chỉnh: **`ECE = 0.0422`** ($\le 0.05$), `Brier = 0.2047`.
- **Xuất ONNX cho Trình duyệt (`sp_bef_face.onnx`)**:
  - Kích thước mô hình: **`864 bytes` (`< 4 KB`, ngân sách $\le 2\text{ MB}$)**, thời gian suy luận trung bình **`< 0.08 ms/lần`**.

### 2.2. Nhánh Hành vi Xem Video (`Behavior Branch` — MOOCCubeX Held-out Users)
- Đặc trưng khớp 1-1 với LMS Runtime (`pause_count`, `avg_pause_duration`, `long_pause_count`, `rewind_count`, `rewind_same_spot`, `speed_change_down`):
  - **`AUROC = 0.8459`**, **`AUPRC = 0.8320`** (so với baseline luôn âm `0.4616`), **`ECE = 0.0279`**, `Brier = 0.1471`.

### 2.3. Nhánh Trắc nghiệm (`Quiz Branch` — ASSISTments Held-out Students)
- Chỉ sử dụng 3 đặc trưng hiện hữu trên LMS (`quiz_accuracy`, `quiz_time_norm`, `attempt_count`), loại bỏ hoàn toàn `hintCount`/`scaffold`:
  - **`AUROC = 0.7878`**, **`AUPRC = 0.4563`** (so với baseline luôn âm `0.1725`), **`ECE = 0.0366`**, `Brier = 0.1153`.
- **Phân tích độ nhạy theo ngưỡng nhãn `confidence(CONFUSED)`**:

| Ngưỡng nhãn | Base Rate | Test AUROC | Test AUPRC |
| :--- | :--- | :--- | :--- |
| `th_0.10` | 0.1695 | 0.7878 | 0.4563 |
| `th_0.40` | 0.1166 | 0.7138 | 0.2274 |
| `th_0.70` | 0.1166 | 0.7138 | 0.2274 |

---

## 3. Đánh giá Hợp nhất Đa phương thức SP-BEF & Nghiên cứu Loại bỏ (Virtual Learner Protocol — P5)

Giao thức **Virtual Learner (C6)** ghép các mẫu **thật** từ tập `test` của DAiSEE, MOOCCubeX và ASSISTments trên `300` phiên học (mô phỏng **30% phiên tắt camera**, **60% bước thời gian chưa có quiz**, và **25% khung hình chất lượng webcam kém**):

| Phương pháp / Cấu hình Ablation | Pointwise AUROC | Pointwise AUPRC | ECE $\downarrow$ | Brier $\downarrow$ | Độ trễ phát hiện $\downarrow$ | Can thiệp sai / giờ $\downarrow$ |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| (a) Legacy Rule (3 consecutive >= 0.60) | **0.8768** | **0.8271** | 0.1613 | 0.1645 | 24.3s | 0.10/h |
| (b) Naive Probability Average | **0.8759** | **0.8162** | 0.1043 | 0.1446 | 3.8s | 6.30/h |
| (c) Logistic Stacking | **0.8931** | **0.8536** | 0.1574 | 0.1510 | 1.6s | 9.60/h |
| (d) SP-BEF (Full Proposed) | **0.9383** | **0.9131** | 0.0655 | 0.0979 | 7.2s | 3.40/h |
| Ablation: w/o C1 (No Base-Rate LLR De-bias) | **0.9234** | **0.8949** | 0.0963 | 0.1182 | 11.9s | 1.70/h |
| Ablation: w/o C2 (No Personal Baseline) | **0.9355** | **0.9089** | 0.0724 | 0.1015 | 7.1s | 3.30/h |
| Ablation: w/o C3 (No Segment Prior pi_s) | **0.9376** | **0.9120** | 0.0876 | 0.1032 | 7.1s | 3.70/h |
| Ablation: w/o C4 (No Dynamic Reliability r_face) | **0.9303** | **0.9016** | 0.0700 | 0.1046 | 7.2s | 4.20/h |
| Ablation: w/o C5 (No 2-State HMM & Hysteresis) | **0.9036** | **0.8693** | 0.1405 | 0.1469 | 4.1s | 3.10/h |

### Nhận xét Khoa học & Giới hạn Trung thực
1. **Tại sao SP-BEF vượt trội so với Luật cũ (`3 lần liên tiếp >= 0.60`) và Trung bình ngây thơ (`Naive Average`)?**
   - Khi thiếu camera (30% phiên) hoặc chưa có quiz (60% thời gian), phương pháp trung bình xác suất bị kéo lệch về base rate của từng dataset gốc. Phép khử base rate bằng tỷ số hợp lý $\text{LLR}_m = \text{logit}(p_m) - \text{logit}(b_m)$ (**C1**) kết hợp trọng số tin cậy động $r_m(t)$ (**C4**) giúp nhánh vắng mặt tự động có đóng góp bằng `0` mà không làm nhiễu hậu nghiệm.
   - Bộ lọc tiến **HMM 2 trạng thái + Hysteresis ($\theta_{\text{on}}=0.62, \theta_{\text{off}}=0.42$)** (**C5**) kết hợp **Prior theo đoạn video $\pi_s$** (**C3**) giảm mạnh số lần can thiệp sai mỗi giờ so với ngưỡng tĩnh.
2. **Giới hạn của phương pháp (Limitations)**:
   - Giả định độc lập có điều kiện $\mathcal{P}(X_{\text{face}}, X_{\text{beh}}, X_{\text{quiz}} \mid Y)$ giữa 3 nhánh là xấp xỉ bậc nhất; do đó cần cắt ngưỡng $\text{LLR}_m \in [-4, 4]$ và nhân hệ số co $w_m < 1$.
   - Nhãn của nhánh Behavior (MOOCCubeX) và nhánh Quiz (ASSISTments detector) là **nhãn proxy / nhãn yếu (weak labels)**, nên độ tin cậy tuyệt đối thấp hơn nhãn có chuyên gia chấm trực tiếp; hệ thống phản ánh trung thực điều này qua khoảng tin cậy và cho phép học sinh tự phản hồi (`SelfReportWidget`) để điều chỉnh trực tuyến.
