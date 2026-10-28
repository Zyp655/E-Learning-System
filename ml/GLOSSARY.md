# Bảng thuật ngữ & ký hiệu SP-BEF

Giải thích các ký hiệu xuất hiện trong `sp_bef_params.json`, code (`ml/sp_bef/core.py`, `lms-web/src/features/confusion-cv/spBefCore.ts`, `lms-api/internal/service/confusion_predictor.go`), API và giao diện. Giá trị trong bảng là giá trị đang ship trong `models/sp_bef_params.json`.

## 1. Ý tưởng chung trong một câu

Mỗi **nhánh** (khuôn mặt, hành vi xem video, quiz, mắt khi đọc) đưa ra một **bằng chứng** "có bối rối hay không". SP-BEF cộng các bằng chứng đó lên một **niềm tin ban đầu**, mỗi bằng chứng được nhân với **độ tin cậy lúc đó** và **trọng số của nhánh**, rồi so với **ngưỡng** để quyết định có mở AI Tutor hay không:

```
log-odds(bối rối) = logit(prior)  +  Σ_nhánh  r · w · LLR
                    ───────────     ──────────────────────
                    niềm tin ban     bằng chứng của từng nhánh
                    đầu (HMM)
```

## 2. Các nhánh (branch)

| Hậu tố | Nhánh | Dữ liệu huấn luyện | Trạng thái |
|---|---|---|---|
| `face` | Biểu cảm khuôn mặt qua webcam (MediaPipe blendshape, EAR, tư thế đầu) | DAiSEE | Bật |
| `beh` | Hành vi xem video (pause, tua lại, giảm tốc) | MOOCCubeX | **Tắt** (không có tín hiệu trên test) |
| `quiz` | Kết quả quiz (độ đúng, thời gian, số lần thử) | ASSISTments 2017 | Bật |
| `gaze` | Chuyển động mắt khi đọc trong Reading View | Log đọc của chính LMS | **Tắt**, đang thu nhãn |

Mỗi ký hiệu dưới đây có một bản cho mỗi nhánh, ví dụ `w_face`, `w_beh`, `w_quiz`, `w_gaze`.

## 3. Ký hiệu cốt lõi

| Ký hiệu | Tên | Ý nghĩa | Khoảng giá trị |
|---|---|---|---|
| `LLR` (`llr_face`, `llr_gaze`, …) | Log-likelihood ratio | **Bằng chứng** của một nhánh: dương = nghiêng về bối rối, âm = nghiêng về không bối rối, 0 = không nói gì. Tính bằng `logit(p_hiệu_chỉnh) − logit(base_rate)` để bỏ ảnh hưởng tỉ lệ bối rối riêng của từng dataset (C1). | [−4, 4] (bị cắt ở `llr_clip = 4`) |
| `r` (`r_face`, `r_gaze`, …) | Reliability, độ tin cậy | **Lúc này** tín hiệu của nhánh đáng tin đến đâu: thiếu sáng, quay mặt đi, chưa hiệu chuẩn mắt… làm `r` giảm. `r = 0` nghĩa là nhánh vắng mặt, không đóng góp gì (C4). | [0, 1] |
| `w` (`w_face`, `w_gaze`, …) | Weight, trọng số nhánh | **Nói chung** nhánh này được tin bao nhiêu, cố định theo kết quả kiểm định. `w = 0` = nhánh bị **tắt** dù vẫn chạy và vẫn tính `LLR`. | ≥ 0 |
| `contrib` (`contrib_face`, …) | Đóng góp | `r × w × LLR`: lượng log-odds nhánh cộng vào posterior. Đây là số giao diện hiển thị để giải thích "vì sao hệ thống nghĩ bạn bối rối". | |
| `base_rate` | Tỉ lệ nền | Tỉ lệ mẫu bối rối trong tập huấn luyện của nhánh (face 0.326, quiz 0.195, beh 0.131). Dùng để khử thiên lệch trong `LLR`. | (0, 1) |
| `prior_prob` | Prior | Niềm tin "đang bối rối" **trước khi** xem bằng chứng của bước hiện tại, suy từ bước trước qua HMM. | (0, 1) |
| `posterior_prob` | Posterior | Niềm tin **sau khi** cộng bằng chứng. Đây là "xác suất bối rối" hệ thống báo ra. | (0, 1) |
| `segment_prior`, π_s | Prior theo đoạn | Mức độ "đoạn nội dung này dễ gây bối rối" (C3). Hiện là hằng số `cold_start_prior = 0.1309` vì dữ liệu mở không có nhãn theo đoạn. | [0.02, 0.85] |
| `level` | Mức độ | `none` < 0.25 ≤ `mild` < θ_off ≤ `moderate` < θ_on ≤ `high`; `unknown` khi mọi `r = 0`. | |

### Vậy `w_gaze` là gì?

`w_gaze` là **trọng số của nhánh mắt khi đọc** trong phép cộng ở mục 1. Hiện `w_gaze = 0`: trình duyệt vẫn theo dõi mắt, vẫn tính `llr_gaze` và `r_gaze`, vẫn ghi mẫu có nhãn, nhưng `contrib_gaze = r_gaze × 0 × llr_gaze = 0` nên **không ảnh hưởng quyết định**. Lý do: nhánh chưa được huấn luyện trên dữ liệu thật. `ml/07_train_gaze_branch.py` chỉ đặt `w_gaze = 1` khi khoảng tin cậy 95% của AUROC > 0.5 trên cả validation và test.

## 4. Bộ lọc HMM và quy tắc can thiệp (C5)

| Ký hiệu | Giá trị | Ý nghĩa |
|---|---|---|
| `hmm_keep_confused` (a) | 0.6 | Xác suất đang bối rối thì bước sau **vẫn** bối rối (quán tính). |
| `hmm_beta0`, `hmm_beta1` (β₀, β₁) | 0.04, 0.45 | Xác suất **chuyển sang** bối rối: β = β₀ + β₁·π_s, đoạn khó hơn thì dễ chuyển hơn. |
| công thức prior | | `prior = a · posterior_trước + β · (1 − posterior_trước)` |
| `theta_on` (θ_on) | 0.40 | Posterior ≥ θ_on đủ lâu → coi là bối rối. |
| `theta_off` (θ_off) | 0.25 | Đã đang can thiệp thì chỉ thoát khi posterior < θ_off (hysteresis, tránh bật/tắt liên tục). |
| `min_hold_sec` | 10 s | Posterior phải ≥ θ_on liên tục ít nhất chừng này mới can thiệp. |
| `high_duration_sec` | | Số giây posterior đã ở trên θ_on. |
| `cooldown_sec` | 180 s | Sau một lần can thiệp, chờ chừng này mới được can thiệp lại. |
| `dt_sec` | 5 s | Khoảng thời gian giả định giữa hai bước cập nhật. |
| `is_confused` / `should_intervene` | | Đang ở trạng thái bối rối / bước này nên mở AI Tutor (chỉ đúng một lần mỗi đợt, ngoài cooldown). |

## 5. Ví dụ số (tính bằng `sp_bef_step` với tham số đang ship)

Bước trước posterior = 0.15, π_s = 0.1309, nhánh mặt `llr_face = 1.0`, `r_face = 0.8`; nhánh mắt `llr_gaze = 2.0`, `r_gaze = 0.9`; không có quiz.

1. β = 0.04 + 0.45 × 0.1309 = 0.0989 → prior = 0.6 × 0.15 + 0.0989 × 0.85 = **0.174** (logit −1.557)
2. `contrib_face` = 0.8 × 0.7 × 1.0 = **0.56**
3. `contrib_gaze` = 0.9 × **0** × 2.0 = **0** (vì `w_gaze = 0`)
4. posterior = sigmoid(−1.557 + 0.56) = **0.270** → `moderate`

Nếu sau này `w_gaze = 1`: `contrib_gaze` = 1.8, posterior = sigmoid(−1.557 + 0.56 + 1.8) = **0.691** → `high`.

## 6. Hiệu chỉnh & đánh giá

| Ký hiệu | Ý nghĩa |
|---|---|
| `isotonic_xp`, `isotonic_fp` | Bảng nội suy hiệu chỉnh xác suất (isotonic regression) để "70%" thật sự nghĩa là đúng khoảng 70% số lần. Rỗng = không hiệu chỉnh. |
| `scaler_mean`, `scaler_scale`, `coefficients`, `intercept` | Chuẩn hoá đặc trưng và hệ số hồi quy logistic của nhánh. |
| `trained`, `enabled` | Nhánh đã được huấn luyện trên dữ liệu thật chưa / đã qua kiểm định để bật chưa. |
| AUROC, `*_auroc_ci95` | Khả năng xếp hạng ca bối rối trên ca không bối rối (0.5 = đoán mò, 1 = hoàn hảo) và khoảng tin cậy 95% bootstrap. Nhánh chỉ được bật khi cận dưới > 0.5. |
| ECE | Expected Calibration Error: sai lệch trung bình giữa xác suất dự đoán và tần suất thực. |
| `cold_start_prior` | Prior mặc định khi chưa có dữ liệu theo đoạn (= base rate). |
| C1–C6 | Các thành phần thiết kế trong [`PLAN_V2_CONFUSION.md`](./PLAN_V2_CONFUSION.md): C1 fusion bằng LLR, C2 baseline cá nhân, C3 prior theo đoạn, C4 độ tin cậy động, C5 HMM, C6 đánh giá Virtual Learner. |

## 7. Nhánh mắt khi đọc (`gaze`)

| Ký hiệu | Ý nghĩa |
|---|---|
| `dwell_ratio` | Thời gian nhìn đoạn ÷ thời gian dự kiến theo tốc độ đọc của chính người đó (`readingWpm`). > 1 = đọc chậm hơn thường lệ. |
| `reread_count` | Số lần quay lại đoạn sau khi đã rời đi. |
| `para_regression_rate` | Số lần nhảy về đoạn phía trước, tính trên 100 từ. |
| `sweep_ratio` | Số *return sweep* (mắt nhảy từ cuối dòng về đầu dòng) ÷ (số dòng − 1). ≈ 1 là đọc một lượt; > 1 là có dòng bị đọc lại. |
| `gaze_transition_entropy` | Mức "lộn xộn" khi mắt di chuyển ngang trong đoạn (0 = đều đặn trái→phải, 1 = nhảy lung tung). Theo Krejtz et al. 2015. |
| `saccade_rate` | Số lần chuyển điểm nhìn mỗi giây trong đoạn. |
| `calibration_error_norm` | Sai số hiệu chuẩn theo chiều dọc ÷ chiều cao đoạn trung vị. ≤ 0.5 = tốt, ≥ 1.5 = quá nhiễu (giao diện hiện "Độ chính xác tốt / trung bình / quá nhiễu"). |
| `r_gaze` | `compute_gaze_reliability`: tích của chất lượng hiệu chuẩn, tỉ lệ khung hình có mặt, tỉ lệ điểm nhìn rơi vào chữ (`on_text_ratio`) và mức quay đầu (yaw). |
| `label_source` | Nguồn nhãn của mẫu: `designed_stimulus` (bài 199, nhãn theo thiết kế) hoặc `self_report` (người đọc trả lời câu hỏi). |
| `stimulus_type` | `control` (đoạn mạch lạc), `factual` (sai sự thật / xáo cụm từ), `contextual` (thuật ngữ chuyên ngành dày đặc). |
| `prompt_probability` | Xác suất câu hỏi tự báo cáo được hiện sau một đoạn (0.5, không phụ thuộc mô hình). |
| `reading_difficulty_slope` | Hệ số chuyển điểm độ khó văn bản thành prior theo đoạn; chưa có trong params = tắt. |
