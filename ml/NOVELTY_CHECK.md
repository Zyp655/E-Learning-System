# Kiểm tra Tính mới Học thuật & Bảng Ánh xạ Đặc trưng (P0.3 & P0.4)

> Ngày thực hiện: 2026-10-26 · Phiên bản: Plan V2 (**SP-BEF: Segment-Prior Bayesian Evidence Fusion**)

---

## 1. Tổng quan Kiểm tra Tài liệu (Literature Survey 2020–2026)

Chúng tôi tiến hành rà soát các cơ sở dữ liệu học thuật **arXiv, Google Scholar, Proceedings of EDM (Educational Data Mining), LAK (Learning Analytics & Knowledge), AIED (Artificial Intelligence in Education), và IEEE Transactions on Affective Computing** giai đoạn **2020–2026** theo 5 nhóm từ khóa cốt lõi của phương pháp **SP-BEF**:

### 1.1. Nhóm từ khóa 1: `"DAiSEE" + "confusion"` & Giới hạn của mô hình đơn phương thức
- **Gupta et al. (2016 / 2022 benchmarks)** — *DAiSEE: Towards User Engagement Recognition in the Wild*: Chỉ ra rằng trạng thái `Confusion` trên DAiSEE có phân phối lệch nặng (chỉ ~10–32% mẫu có nhãn bối rối tùy cách gộp lớp) và độ tương đồng thị giác rất cao giữa *Focused/Engaged* (nhíu mày nhẹ khi tập trung) và *Confused* (nhíu mày do không hiểu bài). Các kiến trúc CNN/RNN đơn thuần đạt AUROC chỉ trong khoảng **0.61 – 0.71** khi chia tách nghiêm ngặt theo chủ thể (`subject-independent split`).
- **Hệ quả cho đề tài**: Không thể kỳ vọng nhánh khuôn mặt (Face branch) một mình đạt AUC > 0.90 trên dữ liệu thực tế nếu không gian lận chia tập dữ liệu (`frame-level leakage`). Điểm mạnh thực sự phải đến từ **kết hợp đa nguồn bằng chứng (Multimodal Evidence Fusion)** và **chuẩn hóa theo cá nhân (Personal Baseline)**.

### 1.2. Nhóm từ khóa 2: `"Likelihood Ratio Fusion" / "Calibrated Log-Odds" + Multimodal Affect`
- **Tiền lệ trong Sinh trắc học & Xử lý tiếng nói**: Phép hợp nhất bằng Tỷ số Hợp lý Hiệu chỉnh (*Calibrated Log-Likelihood Ratio — LLR Fusion*, Brümmer & du Preez, *Computer Speech & Language*; Nandakumar et al., *IEEE TPAMI*) là tiêu chuẩn vàng khi ghép các bộ phân loại được huấn luyện trên các miền dữ liệu không giao nhau.
- **Hiện trạng trong EdTech / Affective Computing (EDM/LAK 2020–2026)**: Hầu hết các nghiên cứu đa phương thức trong học trực tuyến giả định có tập dữ liệu đồng bộ (*joint synchronized dataset*) để nối vector đặc trưng (*early fusion*) hoặc học bộ trọng số stacking (*late fusion*). Khi chỉ dùng các tập dữ liệu mở rời rạc (**DAiSEE** cho khuôn mặt, **MOOCCubeX** cho hành vi tua/dừng video, **ASSISTments** cho câu hỏi trắc nghiệm) với **tỷ lệ cơ sở (base rate $b_m$) rất khác nhau**, việc lấy trung bình xác suất hậu nghiệm $P_m$ gây lệch систематический (systematic prior bias).
- **Khẳng định đóng góp C1 (Đã điều chỉnh trung thực)**:
  - *Không tuyên bố* phát minh ra công thức LLR Fusion tổng quát.
  - *Tuyên bố đóng góp kỹ thuật C1*: Ứng dụng **Base-Rate De-biased Calibrated Log-Likelihood Ratio (`LLR_m = logit(Calib(p_m)) - logit(b_m)`)** để hợp nhất 3 nhánh độc lập (Face từ DAiSEE, Behavior từ MOOCCubeX, Quiz từ ASSISTments) trong bài toán phát hiện bối rối học trực tuyến khi **không tồn tại tập dữ liệu đa phương thức chung**.

### 1.3. Nhóm từ khóa 3: `"Personal Baseline Normalization" + Facial Blendshapes / Action Units`
- **Tiền lệ**: Chuẩn hóa theo cá nhân (*Subject-specific z-score normalization*, Baltrušaitis et al., *OpenFace 2.0*; D'Mello & Graesser) đã được chứng minh giúp giảm phương sai biểu cảm giữa các cá nhân.
- **Khẳng định đóng góp C2 (Đã điều chỉnh trung thực)**:
  - Thiết kế cơ chế **On-Device Rolling Personal Baseline (60–90 giây đầu phiên học)** trực tiếp trên trình duyệt cho 52 hệ số MediaPipe Blendshapes, EAR và độ trôi chóp mũi (`noseDriftPx`). Toàn bộ vector chuẩn hóa cá nhân $(\mu_i, \sigma_i)$ được tính và giữ trên thiết bị của học sinh, đảm bảo **0 byte ảnh hay landmark thô rời khỏi trình duyệt**.

### 1.4. Nhóm từ khóa 4: `"Segment Prior" / "Video Interaction Hotspots" + Confusion Detection`
- **Tiền lệ**: Phân tích đỉnh hành vi xem lại video (*Video clickstream peaks*, Kim et al., *CHI 2014*; Sinha et al., *L@S*; Yu et al., *MOOCCubeX CIKM 2021*) cho thấy mật độ tua lại (`seek-back`) và giảm tốc độ phát của đám đông phản ánh độ khó nội tại của phân đoạn bài giảng.
- **Khẳng định đóng góp C3**:
  - Đưa **Phân phối Tiên nghiệm theo Phân đoạn Bài giảng ($\pi_s = P(\text{confused} \mid \text{segment } s)$)** học từ mật độ tua lại/giảm tốc của đám đông trên MOOCCubeX vào trực tiếp **ma trận chuyển trạng thái của bộ lọc HMM ($\beta(\pi_s)$)** thay vì dùng ngưỡng tĩnh trên toàn bộ video.

### 1.5. Nhóm từ khóa 5: `"Dynamic Reliability Weighting" (`r_face(t)`) + `"2-State HMM"` + `"Virtual Learner Protocol"`
- **Khẳng định đóng góp C4 & C5**:
  - Trọng số tin cậy động $r_{\text{face}}(t) \in [0, 1]$ tính từ chất lượng khung hình thực tế (độ sáng `avgLuminance`, góc quay đầu $|\text{yaw}|, |\text{pitch}|$, độ tự tin landmark) giúp tự động triệt tiêu nhánh khuôn mặt ($r_{\text{face}}(t) \to 0$) khi học sinh tắt camera, rời ghế hoặc phòng quá tối — **loại bỏ hoàn toàn việc phải gán giá trị giả (imputation/mock values)**.
  - Bộ lọc tiến **HMM 2 trạng thái ẩn (Focused $\leftrightarrow$ Confused)** kèm cơ chế trễ hai ngưỡng (**Hysteresis $\theta_{\text{on}} > \theta_{\text{off}}$**) và thời gian nghỉ (**Cooldown**) thay thế cho quy tắc cứng *"3 lần liên tiếp $\ge 0.60$"*, giúp giảm tỷ lệ báo động giả (False Alarms / hour) mà vẫn giữ độ trễ phát hiện thấp.
- **Khẳng định đóng góp C6 (Giao thức đánh giá Bán tổng hợp "Virtual Learner")**:
  - Khi không có tập dữ liệu mở nào chứa đồng thời cả 3 nhánh của cùng một cá nhân, giao thức **Paired Stratified Sampling ("Virtual Learner")** ghép các mẫu **thật 100%** từ tập kiểm tra (`test split`) của DAiSEE, MOOCCubeX và ASSISTments theo chuỗi trạng thái ẩn HMM và mô phỏng xác suất mất nhánh (30% phiên không bật camera, 60% thời điểm chưa có quiz). Giả định độc lập có điều kiện $\mathcal{P}(X_{\text{face}}, X_{\text{beh}}, X_{\text{quiz}} \mid Y)$ được phát biểu tường minh và kiểm chứng độ nhạy qua hệ số co $w_m$.

---

## 2. Bảng Ánh xạ Đặc trưng: Dataset Mở $\leftrightarrow$ LMS Runtime (P0.4 — Gate Bắt buộc)

> **Quy tắc bất khả xâm phạm**: Mọi đặc trưng dùng khi huấn luyện trên Dataset mở **phải khớp 1-1** về định nghĩa toán học và đơn vị đo với đặc trưng thu thập tại thời gian thực trên trình duyệt (`lms-web`) và máy chủ (`lms-api`). Bất kỳ đặc trưng nào chỉ có trong dataset mà không có trên LMS runtime (ví dụ: `hint_count` của ASSISTments) đều **bị loại bỏ hoàn toàn**.

### 2.1. Nhánh 1 — Khuôn mặt trên Thiết bị (`Face Branch` — DAiSEE $\leftrightarrow$ Browser MediaPipe 0.10.14)
Cửa sổ trượt thời gian thực: **$W_{\text{face}} = 10\text{ giây}$** (lấy mẫu chuẩn hóa từ MediaPipe FaceLandmarker `0.10.14`):

| Mã | Tên đặc trưng (`feature_name`) | Định nghĩa trên DAiSEE (Clip 10s) | Định nghĩa trên LMS Web (`realFaceTracker.ts`) | Chuẩn hóa Baseline Cá nhân (C2) |
| :--- | :--- | :--- | :--- | :--- |
| `F_f1` | `brow_furrow_mean` | Trung bình chỉ số nhíu mày (AU4: khoảng cách & độ dốc chân mày trong) trong 10s | Trung bình `browFurrowScore` (`browDownLeft/Right`, `browInnerUp`) trong cửa sổ 10s | Có ($\Delta z$ so với 60s đầu) |
| `F_f2` | `brow_furrow_std` | Độ lệch chuẩn chỉ số nhíu mày trong 10s | Độ lệch chuẩn `browFurrowScore` trong cửa sổ 10s | Không |
| `F_f3` | `brow_furrow_max` | Giá trị cực đại chỉ số nhíu mày trong 10s | Cực đại `browFurrowScore` trong cửa sổ 10s | Có ($\Delta z$) |
| `F_f4` | `eye_squint_mean` | Trung bình chỉ số nheo mắt (AU7) trong 10s | Trung bình `eyeSquintScore` (`eyeSquintLeft/Right`) trong 10s | Có ($\Delta z$) |
| `F_f5` | `eye_squint_std` | Độ lệch chuẩn chỉ số nheo mắt trong 10s | Độ lệch chuẩn `eyeSquintScore` trong 10s | Không |
| `F_f6` | `ear_mean` | Trung bình Tỷ lệ Mở mắt `EAR` (6 điểm mốc mắt trái & phải) | Trung bình `earAvg` từ `LEFT_EYE_INDICES` & `RIGHT_EYE_INDICES` trong 10s | Có ($\Delta z$) |
| `F_f7` | `ear_std` | Độ lệch chuẩn `EAR` trong 10s (phản ánh tần suất chớp mắt / nhìn đăm đăm) | Độ lệch chuẩn `earAvg` trong 10s (`sqrt(earVariance)`) | Không |
| `F_f8` | `mouth_tension_mean` | Trung bình độ mím/trễ môi (AU15/AU24) trong 10s | Trung bình `mouthTensionScore` (`mouthPress` + `mouthFrown`) trong 10s | Có ($\Delta z$) |
| `F_f9` | `head_yaw_abs_mean` | Trung bình độ lệch góc quay ngang $|\text{yaw}|$ (độ) | Trung bình `Math.abs(headYawDeg)` trong 10s | Không |
| `F_f10` | `head_pitch_abs_mean` | Trung bình độ lệch góc gật/ngẩng $|\text{pitch}|$ (độ) | Trung bình `Math.abs(headPitchDeg)` trong 10s | Không |
| `F_f11` | `nose_drift_norm` | Độ dịch chuyển chóp mũi chuẩn hóa theo khoảng cách hai mắt (`IOD`) | `noseDriftPx / interOcularDistancePx` trong cửa sổ 10s | Không |
| `F_f12` | `eye_lock_ratio` | Tỷ lệ khung hình có mắt mở ổn định & ít dịch chuyển đầu (`EAR > 0.22` & drift thấp) | Tỷ lệ khung hình `eyeLocked === true` trong cửa sổ 10s | Không |

- **Trọng số tin cậy động $r_{\text{face}}(t) \in [0, 1]$ (C4)**:
  $$r_{\text{face}}(t) = r_{\text{present}}(t) \times r_{\text{luma}}(t) \times r_{\text{pose}}(t)$$
  Trong đó:
  - $r_{\text{present}}(t)$: Tỷ lệ khung hình phát hiện được mặt trong cửa sổ 10s (bằng `0` nếu tắt camera hoặc không có mặt).
  - $r_{\text{luma}}(t) = \text{clip}\left(\frac{\text{avgLuminance} - 35}{60}, 0, 1\right)$.
  - $r_{\text{pose}}(t) = \text{clip}\left(1 - \frac{\max(|\text{yaw}| - 15, 0)}{30}, 0, 1\right) \times \text{clip}\left(1 - \frac{\max(|\text{pitch}| - 12, 0)}{25}, 0, 1\right)$.

---

### 2.2. Nhánh 2 — Hành vi Xem Video & Tiên nghiệm Phân đoạn (`Behavior Branch` — MOOCCubeX $\leftrightarrow$ LMS Video Player)
Qua kiểm tra trực tiếp schema thực tế của `relations/user-video.json` và `relations/user-problem.json` trên **MOOCCubeX**, mỗi bản ghi chứa danh sách `segment: [{start_point, end_point, speed, local_start_time}]`. Từ chuỗi phân đoạn này, cả MOOCCubeX và LMS Runtime (`useConfusionStore.ts` trong cửa sổ trượt thời gian 5 phút = 300s) đều tính chính xác **6 đặc trưng hành vi đồng nhất**:

| Mã | Tên đặc trưng (`feature_name`) | Cách tính từ `user-video.json` (MOOCCubeX) | Cách tính tại LMS Runtime (`useConfusionStore.ts` — Cửa sổ 300s) |
| :--- | :--- | :--- | :--- |
| `F_b1` | `pause_count` | Số khoảng nghỉ giữa 2 segment liên tiếp có $2\text{s} \le \Delta t_{\text{gap}} \le 180\text{s}$ | Số sự kiện `pause` trong 300s gần nhất |
| `F_b2` | `avg_pause_duration` | Thời lượng nghỉ trung bình (giây, cắt trần ở `180s`) | Trung bình thời lượng các lần `pause` trong 300s gần nhất |
| `F_b3` | `long_pause_count` | Số khoảng nghỉ kéo dài $> 10\text{ giây}$ | Số lần `pause` có thời lượng $> 10\text{s}$ trong 300s gần nhất |
| `F_b4` | `rewind_count` | Số lần `seg[k].start_point < seg[k-1].end_point - 2.0` (tua lùi $> 2\text{s}$) | Số sự kiện `rewind` (tua lùi $> 2\text{s}$) trong 300s gần nhất |
| `F_b5` | `rewind_same_spot` | Chỉ báo nhị phân (`0/1`): có ít nhất 2 lần tua lùi chồng lấp cùng một vùng 30s | Chỉ báo `0/1`: tua lại cùng một vùng $\pm 15\text{s}$ từ 2 lần trở lên trong 300s |
| `F_b6` | `speed_change_down` | Chỉ báo nhị phân (`0/1`): người học giảm tốc độ `speed` giữa các segment hoặc dùng `speed < 1.0` | Chỉ báo `0/1`: người học hạ tốc độ phát xuống $< 1.0\text{x}$ hoặc thấp hơn tốc độ trước đó |

- **Định nghĩa Nhãn Proxy Cố định trên MOOCCubeX (`y_beh`)**:
  Một phiên xem video của sinh viên $u$ trên video $v$ được gán nhãn `y_beh = 1` (gặp khó khăn/bối rối nhận thức) nếu trong các bài tập gắn cùng khái niệm/khóa học làm ngay sau phiên xem đó (hoặc tổ hợp hành vi dừng/tua lùi cực đoan nằm trong top phân vị gắn với tỷ lệ làm sai bài tập `is_correct == 0` hoặc `attempts > 1` trong `user-problem.json`), sinh viên trả lời sai lần đầu.
- **Tiên nghiệm theo Phân đoạn Bài giảng $\pi_s$ (C3)**:
  Chia trục thời gian mỗi video thành các thùng (bins) 30 giây. Mật độ tua lại và giảm tốc của đám đông trên thùng $s$ được chuẩn hóa thành xác suất tiên nghiệm $\pi_s \in [0.08, 0.45]$. Khi bài giảng mới chưa có log đám đông (*cold-start*), $\pi_s = b_{\text{prior}} = 0.15$.

---

### 2.3. Nhánh 3 — Kết quả Trắc nghiệm Ngắn (`Quiz Branch` — ASSISTments $\leftrightarrow$ LMS In-Video Segment Quiz)
Qua kiểm tra thực tế tập dữ liệu **ASSISTments (`anonymized_full_release_competition_dataset.csv`)**, mỗi lượt trả lời của học sinh có cột cảm xúc từ bộ phát hiện chuẩn của Baker & Pardos (`AveResConf` — mức độ bối rối trung bình) cùng kết quả làm bài. Để tuân thủ quy tắc **đặc trưng train = đặc trưng runtime**, chúng tôi **loại bỏ** `hintCount`, `BottomHint`, `scaffold` (vì In-Video Quiz trên LMS không có nút xin gợi ý nhiều bước) và chỉ giữ **3 đặc trưng chung**:

| Mã | Tên đặc trưng (`feature_name`) | Cách tính trên ASSISTments | Cách tính trên LMS Runtime (`segment_quiz_attempts`) |
| :--- | :--- | :--- | :--- |
| `F_q1` | `quiz_accuracy` | Điểm chính xác câu hỏi (`correct` $\in [0, 1]$ quy đổi sang thang `[0, 100]`) | `quizScore` $\in [0, 100]$ của câu hỏi phân đoạn vừa trả lời |
| `F_q2` | `quiz_time_norm` | Thời gian trả lời `timeTaken` (giây, cắt trần ở `180s`) | `quizTime` (giây) học sinh suy nghĩ trước khi bấm chọn đáp án |
| `F_q3` | `attempt_count` | Số lần thử trên câu hỏi đó (`attemptCount`, cắt trần ở `5`) | Số lần trả lời liên tiếp trên phân đoạn đó (`consecutiveWrong + 1`) |

- **Cờ hiện diện (`has_quiz`)**:
  Nếu học sinh chưa làm câu hỏi In-Video Quiz nào trong 120 giây gần nhất, cờ `has_quiz = false` $\implies r_{\text{quiz}}(t) = 0$ (nhánh Quiz đóng góp `0.0` vào tổng `LLR`, **tuyệt đối không gán `quiz_score = 50` giả tạo** như phiên bản cũ).
