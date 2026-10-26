# Báo cáo Thực nghiệm V2.1 — SP-BEF

> Seed `42` · MediaPipe FaceLandmarker `0.10.14 (float16)` · Toàn bộ số liệu trong file này được sinh tự động bởi `run_sp_bef_pipeline.py` từ `models/sp_bef_params.json`.
> Bản V2.1 sửa các lỗi của V2.0: (1) nhãn DAiSEE (boredom/engagement/frustration) từng bị dùng làm đặc trưng khuôn mặt; (2) nhãn nhánh hành vi từng được sinh từ chính các đặc trưng; (3) tập DAiSEE từng bị lấy mẫu cân bằng 14/14 mỗi người; (4) baseline stacking dùng hệ số tự đặt; (5) ablation C2 bị mô phỏng bằng cách nhân LLR × 0.55. Các con số của V2.0 không còn giá trị.

## 1. Dữ liệu & chia tách

| Nhánh | Dữ liệu | train / val / test | Đơn vị chia | Base rate (train) | Base rate (test) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Khuôn mặt | DAiSEE, split chính thức, **toàn bộ clip** có mặt người | 5411 / 1698 / 1703 | subject (69/22/20) | 0.3262 | 0.3230 |
| Hành vi | MOOCCubeX `user-video` + `user-problem` (phần đầu) + `course.json` + `exercise-problem` | 2482 / 275 / 748 | user (537 user) | 0.1309 | 0.1644 |
| Quiz | ASSISTments 2017 (toàn bộ file) | 652620 / 133745 / 156451 | student (1709 học sinh) | 0.1947 | 0.1831 |

Giao tập subject/user/student giữa train, val, test đều bằng ∅ (assert trong pipeline và `tests/test_sp_bef.py`).

## 2. Từng nhánh (đánh giá một lần trên test)

### 2.1 Khuôn mặt (DAiSEE)
Đặc trưng: chỉ lấy từ pixel qua MediaPipe (blendshape, EAR, tư thế đầu, độ trôi mũi, các điểm affect heuristic giống hệt trình duyệt). Không có cột nhãn nào.

Chọn bộ đặc trưng trên **validation**:

| Bộ đặc trưng | val AUROC | val AUPRC |
| :--- | :--- | :--- |
| `raw` | 0.6051 | 0.4639 |
| `raw_plus_c2` | 0.5594 | 0.4260 |

- Chọn: `raw` (15 đặc trưng).
- Test: **AUROC = 0.6207** (95% CI [0.592, 0.6485]), AUPRC = 0.4185 (luôn-âm = 0.3230), ECE trước/sau hiệu chỉnh = 0.0285 / 0.0346, Brier = 0.2113.
- Ablation hậu kiểm (không dùng để chọn model): `posthoc_test_auroc_raw_plus_c2` = 0.6510.
- Nhận định: tín hiệu khuôn mặt trên DAiSEE **yếu** (AUROC gần 0.5–0.6). Nhãn DAiSEE gán cho cả clip 10s và có độ đồng thuận thấp. Nguồn đặc trưng: video gốc DAiSEE, MediaPipe 10 fps (~100 frame/clip), cùng hàm gộp cửa sổ 10s như trình duyệt.

### 2.2 Hành vi xem video (MOOCCubeX)
- Nhãn proxy (cố định trước khi train, không tính từ đặc trưng): fail rate >= 0.5 on same-chapter problems submitted within 14 days after first watch.
- Test: **AUROC = 0.5088** (95% CI [0.4705, 0.5453]), AUPRC = 0.1736 (luôn-âm = 0.1644), ECE = 0.0518, Brier = 0.1411.
- Prior theo đoạn video (C3): `uniform_cold_start (no per-segment confusion labels in open data)`. Dữ liệu mở không có nhãn bối rối theo từng đoạn nên **C3 chưa được kiểm chứng** và không nằm trong ablation.

### 2.3 Quiz (ASSISTments)
- Nhãn: ASSISTments 2017 confidence(CONFUSED) >= 0.20. Lưu ý: confidence(CONFUSED) is itself a detector output built from interaction features (correctness, attempts, time), so this branch partly re-learns that detector.
- Test: **AUROC = 0.7846** (95% CI [0.7815, 0.7877]), AUPRC = 0.4476 (luôn-âm = 0.1831), ECE = 0.0222, Brier = 0.1211.

| Ngưỡng nhãn | Base rate | Test AUROC | Test AUPRC |
| :--- | :--- | :--- | :--- |
| `th_0.10` | 0.1947 | 0.7846 | 0.4476 |
| `th_0.40` | 0.1320 | 0.7212 | 0.2376 |
| `th_0.70` | 0.1320 | 0.7212 | 0.2376 |

## 3. Fusion — Virtual Learner (bán tổng hợp)

Nhánh tham gia fusion (CI 95% của AUROC > 0.5 trên cả validation và test; CI val/test: face [0.5757, 0.6316]/[0.592, 0.6485], behavior [0.5174, 0.668]/[0.4705, 0.5453], quiz [0.7934, 0.7998]/[0.7815, 0.7877]): face=bật, behavior=TẮT (w=0), quiz=bật.

Giao thức: 300 học sinh ảo × 48 bước × 5s. Trạng thái ẩn theo chuỗi Markov cố định (vào = 0.06, giữ = 0.8), **không phụ thuộc π_s**. Mỗi bước dùng đầu ra thật của từng nhánh có nhãn khớp trạng thái; clip khuôn mặt giữ 2 bước, phiên hành vi giữ tối đa 12 bước (bằng chứng có tương quan theo thời gian). Quiz xuất hiện ở 15% số bước; 30% phiên tắt camera; 25% bước camera kém (giả định: LLR nhiễu, r_face thấp).

Siêu tham số SP-BEF (w_face=0.7, w_beh=0.0, w_quiz=1.0, a_keep=0.6, theta_on/off=0.4/0.25 — ngưỡng chọn để recall cao nhất với ≤ 2 can thiệp sai/giờ, cùng ngưỡng áp cho mọi phương pháp) và baseline stacking được **fit trên VL-val** (dựng từ tập val của các nhánh); bảng dưới là **VL-test** (dựng từ tập test).

| Phương pháp | AUROC | AUPRC | ECE | Brier | Recall đợt | Độ trễ TB | Can thiệp sai/giờ |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| (a) Legacy Rule (avg, 3 consecutive >= 0.60) | 0.5618 | 0.2504 | 0.1155 | 0.1871 | 0.00 | — | 0.00 |
| (b) Naive Probability Average | 0.5781 | 0.2688 | 0.0410 | 0.1764 | 0.10 | 12.6s | 10.95 |
| (c) Logistic Stacking (trained on VL-val) | 0.5919 | 0.3135 | 0.0419 | 0.1693 | 0.19 | 14.2s | 4.95 |
| (d) SP-BEF (tuned on VL-val) | 0.6761 | 0.4027 | 0.0228 | 0.1604 | 0.11 | 18.9s | 1.95 |
| Ablation: w/o C1 (raw logit, no base-rate removal) | 0.5810 | 0.2773 | 0.0974 | 0.1809 | 0.00 | — | 0.00 |
| Ablation: face model with C2 personal baseline | 0.6825 | 0.4109 | 0.0298 | 0.1600 | 0.11 | 19.2s | 1.85 |
| Ablation: w/o C4 (r_face binary) | 0.6431 | 0.3292 | 0.0367 | 0.1716 | 0.13 | 15.4s | 6.75 |
| Ablation: w/o C5 (no HMM memory / hysteresis) | 0.6195 | 0.3422 | 0.1176 | 0.1811 | 0.07 | 13.6s | 1.00 |

### Nhận xét (sinh tự động từ bảng)
- So với **(a) Legacy Rule (avg, 3 consecutive >= 0.60)**: AUROC SP-BEF 0.6761 cao hơn 0.5618; Brier 0.1604 vs 0.1871; can thiệp sai/giờ 1.95 vs 0.00.
- So với **(b) Naive Probability Average**: AUROC SP-BEF 0.6761 cao hơn 0.5781; Brier 0.1604 vs 0.1764; can thiệp sai/giờ 1.95 vs 10.95.
- So với **(c) Logistic Stacking (trained on VL-val)**: AUROC SP-BEF 0.6761 cao hơn 0.5919; Brier 0.1604 vs 0.1693; can thiệp sai/giờ 1.95 vs 4.95.
- Ablation: w/o C1 (raw logit, no base-rate removal): ΔAUROC (Full − ablation) = +0.0951, ΔBrier = -0.0205.
- Ablation: face model with C2 personal baseline: ΔAUROC (Full − ablation) = -0.0064, ΔBrier = +0.0004.
- Ablation: w/o C4 (r_face binary): ΔAUROC (Full − ablation) = +0.0330, ΔBrier = -0.0112.
- Ablation: w/o C5 (no HMM memory / hysteresis): ΔAUROC (Full − ablation) = +0.0566, ΔBrier = -0.0207.

## 4. Giới hạn
1. Fusion được đánh giá trên dữ liệu **bán tổng hợp**. Giả định độc lập có điều kiện giữa các nhánh đúng theo cách dựng VL nên kết quả fusion là cận trên; cần dữ liệu thật đồng thời ba phương thức để khẳng định.
2. Lợi ích của C4 trong VL phụ thuộc giả định "camera kém ⇒ LLR nhiễu" do chính giao thức đặt ra.
3. Nhãn hành vi (sai bài tập cùng chương) và nhãn quiz (đầu ra detector) là nhãn yếu, không phải nhãn bối rối do người quan sát.
4. Nhánh khuôn mặt: kết quả trên DAiSEE thấp; không nên quảng bá là "phát hiện bối rối bằng camera" mà không có dữ liệu tốt hơn (OL-SFED, ConfusionBench khi công bố).
