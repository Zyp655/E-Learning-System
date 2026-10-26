# Plan V2 — Phát hiện Bối rối Đa phương thức chỉ dùng Dữ liệu Mở

> Trạng thái: ĐỀ XUẤT (chưa triển khai) · Ngày: 2026-10-26
> Ràng buộc: **không thu dữ liệu thật**, chỉ dùng dataset công khai. Chạy được trên máy M5/16GB (không cần GPU).

---

## 0. Vấn đề cốt lõi phải giải

1. Không có dataset mở nào chứa cùng lúc **khuôn mặt + hành vi xem video + quiz** của cùng một người → không thể train một model fusion 12 đặc trưng “end-to-end” một cách trung thực.
2. Các dataset có **tỉ lệ bối rối (base rate) khác nhau** (DAiSEE ~10%, proxy MOOC ~?%, ASSISTments ~?%) → không thể cộng xác suất của chúng một cách ngây thơ.
3. Biểu cảm khuôn mặt **khác nhau giữa từng người** → model chung bị nhiễu lớn (lý do chính khiến DAiSEE chỉ đạt AUC ~0.66).
4. Bối rối phụ thuộc mạnh vào **nội dung đoạn video** (đoạn khó → nhiều người bối rối), nhưng hệ thống hiện chỉ nhìn tín hiệu cá nhân.
5. Webcam chất lượng thay đổi theo thời gian (tối, quay đầu, che mặt) → độ tin cậy của nhánh khuôn mặt phải **thay đổi động**.

## 1. Phương pháp đề xuất — **SP-BEF** (Segment-Prior Bayesian Evidence Fusion)

```
            ┌──────────── Prior theo đoạn video (crowd/content) ───────────┐
            │  π_s = P(bối rối | đoạn s)  ← học từ hotspot tua lại MOOCCubeX │
            └──────────────────────────────┬───────────────────────────────┘
                                           ▼
 Face branch (DAiSEE, browser ONNX) ── LLR_face × r_face(t) ─┐
 Behavior branch (MOOCCubeX/EdNet)  ── LLR_beh  × r_beh     ─┼─► HMM 2 trạng thái (forward filter)
 Quiz branch (ASSISTments)          ── LLR_quiz × r_quiz    ─┘        │
                                                                       ▼
                                                  Quyết định theo chi phí kỳ vọng
                                                  + hysteresis + cooldown → Can thiệp
```

### 1.1 Các đóng góp (điểm mới)
| # | Đóng góp | Giải quyết vấn đề |
|---|---|---|
| C1 | **Fusion bằng Likelihood Ratio đã hiệu chỉnh**: mỗi nhánh train trên dataset riêng, hiệu chỉnh (isotonic/Platt), rồi **khử base rate của dataset gốc**: `LLR_m = logit(p_m) − logit(b_m)`. Tổng log-odds hợp lệ khi giả định độc lập có điều kiện. | 1, 2 |
| C2 | **Chuẩn hoá theo baseline cá nhân trên thiết bị**: z-score blendshape so với 60–90s đầu phiên của chính học sinh (on-device, không gửi ảnh). | 3 |
| C3 | **Prior theo đoạn video** từ hành vi đám đông (mật độ tua lại/giảm tốc trên trục thời gian video) — cold-start bằng prior đồng nhất, cập nhật dần bằng log ẩn danh của chính LMS. | 4 |
| C4 | **Trọng số tin cậy động** `r_face(t)` theo chất lượng khung hình (độ sáng, confidence landmark, |yaw|/|pitch|, tỉ lệ frame có mặt). Thiếu modality → `r=0`, không cần giá trị giả. | 5 |
| C5 | **HMM 2 trạng thái** thay cho “3 lần liên tiếp ≥ 0.6”: mô hình hoá bối rối là trạng thái ẩn có quán tính, transition phụ thuộc π_s. | độ ổn định |
| C6 | **Giao thức đánh giá “Virtual Learner” bán tổng hợp**: ghép các mẫu **thật** từ 3 dataset theo cùng nhãn để đánh giá fusion; công bố rõ giả định. | đánh giá khi không có dữ liệu chung |

> ⚠️ **Về “chưa ai làm”**: từng mảnh (LLR fusion, HMM, personal baseline) đều có tiền lệ riêng lẻ. Tính mới nằm ở **tổ hợp + bài toán (confusion trong LMS, on-device, không có dữ liệu chung)**. Bước P0.3 bắt buộc kiểm tra tài liệu để khẳng định/điều chỉnh claim trước khi viết báo cáo. Không được claim nếu chưa kiểm tra.

### 1.2 Công thức
- Hiệu chỉnh nhánh m: `p_m = Calib_m(f_m(x))`, base rate train `b_m`.
- `LLR_m(t) = logit(p_m) − logit(b_m)`, cắt về `[−4, 4]` để chống quá tự tin.
- Dự đoán trước: `P⁻(t) = a·P(t−1) + β(π_s)·(1 − P(t−1))` (a = xác suất giữ trạng thái bối rối, β tăng theo π_s).
- Hậu nghiệm: `logit P(t) = logit P⁻(t) + Σ_m r_m(t)·w_m·LLR_m(t)`.
- `w_m` (hệ số co theo độ tin cậy từng nhánh) chọn trên tập Virtual Learner validation; báo cáo độ nhạy.
- Can thiệp khi `P(t) ≥ θ_on` trong ≥ T giây; tắt khi `< θ_off` (θ_off < θ_on); cooldown sau mỗi lần can thiệp. θ chọn theo chi phí `C_FP` (làm phiền) vs `C_FN` (bỏ sót).

---

## 2. Dữ liệu

| Nhánh | Dataset | Truy cập | Nhãn | Ghi chú |
|---|---|---|---|---|
| Face (train) | DAiSEE | Đăng ký form IIT-H | Confusion 0–3 (clip 10s) | Split chính thức đã theo subject |
| Face (test ngoài) | OL-SFED | Email tác giả | confusion | Cross-dataset — nếu được cấp |
| Face (test ngoài) | Classroom images (Mendeley 6dbdkb8g3d) | Tải trực tiếp | confusion/boredom | Ảnh tĩnh → chỉ test frame-level |
| Face (tuỳ chọn) | ConfusionBench (arXiv 2603.17267) | Chờ công bố | confusion có chuyên gia | Nếu có trước P2 thì dùng làm test |
| Behavior | MOOCCubeX | GitHub THU-KEG | **Proxy**: sai bài tập liên quan sau video | Cần xác minh schema (pause/seek/speed) |
| Behavior (dự phòng) | EdNet KT4 | Google Drive, CC BY-NC | Proxy tương tự | Dùng nếu MOOCCubeX thiếu sự kiện |
| Quiz | ASSISTments 2012–13 (with-predictions) | Công khai | Confidence(CONFUSED) từ detector | Nhãn yếu, ghi rõ |
| Prior đoạn video | MOOCCubeX (aggregate) | như trên | Hotspot tua lại | |

---

## 3. Các giai đoạn

### P0 — Chuẩn bị & xác minh (rủi ro cao nhất, làm trước)
- P0.1 Môi trường: Python 3.11 (`uv`), pin toàn bộ version trong `requirements.lock`; seed cố định.
- P0.2 Tải dữ liệu, ghi checksum SHA256 vào `ml/data/MANIFEST.json`. Dữ liệu ngoài `git` (`.gitignore`).
- P0.3 **Kiểm tra tính mới**: tìm arXiv/Google Scholar/EDM/LAK/AIED 2020–2026 với các từ khoá (likelihood-ratio fusion + confusion, segment prior + affect, personal baseline blendshape). Ghi kết quả vào `ml/NOVELTY_CHECK.md`. Điều chỉnh C1–C6 nếu trùng.
- P0.4 **Xác minh schema** MOOCCubeX/EdNet có đủ để tính F1–F6 không. Nếu không → thu hẹp đặc trưng hành vi về những gì cả dataset và LMS cùng có (quy tắc: **đặc trưng train = đặc trưng runtime**).
- **Gate P0**: có dữ liệu cho cả 3 nhánh + bảng ánh xạ đặc trưng dataset ↔ LMS.

### P1 — Dọn nợ kỹ thuật hiện tại (không phụ thuộc dữ liệu, làm song song P0)
1. Xoá/khóa mọi đường giả: `synthetic_sim` báo có mặt, `pixel_cv_fallback` dựng 478 landmark giả, vector 192-d sin/cos giả (`realFaceTracker.ts`).
2. `confusion_predictor.go`: bỏ `quiz_score==0 → 50`; dùng cờ `has_quiz`.
3. `useConfusionStore.ts`: cửa sổ trượt theo **thời gian** (vd 60s/5 phút) cho mọi bộ đếm; reset streak đúng cách; bỏ giá trị mock khởi tạo.
4. `controller/confusion/confusion.go`: bỏ `FeatureImportance` hardcode → trả đóng góp LLR từng nhánh (giải thích thật).
5. `src/api/index.ts`: bỏ “MLP” giả ở client; fallback = trạng thái “không xác định”, không phải con số bịa.
6. README: gỡ bảng kết quả synthetic (AUC 1.0), sửa mô tả cho đúng thực tế.

### P2 — Nhánh Face (on-device)
- Trích đặc trưng bằng **đúng MediaPipe FaceLandmarker (Tasks API, cùng version với web: 0.10.14)** trên DAiSEE @ 10 fps.
- Đặc trưng theo cửa sổ 10s: thống kê (mean/std/max/slope) của 52 blendshape, head pose (từ transformation matrix), EAR, blink rate, gaze drift; **thêm bản chuẩn hoá baseline cá nhân** (C2; trên DAiSEE dùng clip đầu của mỗi subject làm baseline và loại clip đó khỏi đánh giá).
- Model ứng viên: LR, LightGBM, GRU nhỏ (≤ 50k tham số). Chọn theo AUC/AUPRC trên validation; test chỉ chạy **1 lần** cuối.
- Hiệu chỉnh isotonic trên validation. Báo cáo: AUROC, **AUPRC**, F1@θ, ECE, Brier; so với baseline “luôn âm” và bảng ablation cũ.
- Model chất lượng khung hình → `r_face(t)` (C4).
- Xuất ONNX → `onnxruntime-web` trong Web Worker. Ngân sách: ≤ 5 ms/lần suy luận, model ≤ 2 MB.
- Cross-dataset test: OL-SFED / Mendeley (nếu có).

### P3 — Nhánh Behavior + Prior đoạn video
- Dựng phiên xem từ log MOOCCubeX/EdNet → đặc trưng giống LMS runtime (theo bảng P0.4).
- Nhãn proxy: sai ≥1 bài tập gắn khái niệm của video trong N phút sau (định nghĩa cố định trước khi train, ghi vào code).
- LR + LightGBM, `GroupKFold` theo **user**, hiệu chỉnh, lưu `b_beh`.
- Prior π_s (C3): mật độ seek-back/slow-down chuẩn hoá theo vị trí video → hotspot → ánh xạ sang xác suất bằng hồi quy trên nhãn proxy. Cold-start = base rate.

### P4 — Nhánh Quiz
- ASSISTments: đặc trưng chỉ những gì LMS có (đúng/sai, thời gian chuẩn hoá theo câu, số lần thử). Bỏ đặc trưng LMS không có (vd hint).
- Nhãn: ngưỡng hoá Confidence(CONFUSED) (ngưỡng chọn trước, báo cáo độ nhạy). `GroupKFold` theo student.

### P5 — Fusion SP-BEF + đánh giá Virtual Learner
- Cài SP-BEF thuần Python (tham chiếu) **và** Go (runtime) từ cùng một file tham số JSON.
- Virtual Learner: với mỗi “học sinh ảo” chọn chuỗi trạng thái ẩn theo HMM, lấy mẫu **thật** của từng nhánh từ tập **test** có nhãn tương ứng; mô phỏng thiếu modality (không camera 30%, không quiz 60%), camera kém chất lượng.
- So sánh: (a) luật hiện tại “3 lần ≥ 0.6”, (b) trung bình xác suất, (c) stacking, (d) SP-BEF đầy đủ, + ablation bỏ từng C1–C5.
- Chỉ số: AUROC/AUPRC theo thời điểm, độ trễ phát hiện (s), số can thiệp sai / giờ, ECE.
- Nêu rõ giới hạn: giả định độc lập có điều kiện, nhãn proxy.

### P6 — Tích hợp hệ thống
- Web: Worker chạy MediaPipe + face ONNX + baseline cá nhân + `r_face`; gửi **LLR + r** mỗi 2–5s (không gửi ảnh/landmark).
- Go: `ConfusionFusion` service (HMM state lưu Redis theo `session_id`), API trả `P`, đóng góp từng nhánh, trạng thái can thiệp.
- Admin: cấu hình θ_on/θ_off/cooldown/w_m, xem phân bố LLR.

### P7 — Kiểm thử “không lỗi cơ bản” (Gate bắt buộc trước khi báo xong)

**ML (pytest)**
- [ ] Không rò rỉ: assert giao tập subject/user giữa train/val/test = ∅.
- [ ] Tái lập: chạy lại cùng seed → metric chênh ≤ 1e-6 (model tất định) / ≤ 0.5% (GRU).
- [ ] Không NaN/Inf trong đặc trưng; xử lý frame không có mặt.
- [ ] **Parity**: cùng input → Python vs ONNX (onnxruntime) vs onnxruntime-web vs Go: sai số ≤ 1e-5 (golden files `ml/golden/*.json`).
- [ ] Đặc trưng Python trích từ video == đặc trưng TS trích từ cùng video (golden video, sai số ≤ 1e-3).
- [ ] Gate chất lượng: Face AUROC > baseline cũ (0.661) trên test chính thức DAiSEE; ECE ≤ 0.05 sau hiệu chỉnh; không nhánh nào thua baseline “luôn âm” về AUPRC.

**Go**
- [ ] `go vet ./...`, `go test -race ./...` pass.
- [ ] Table-driven test fusion: thiếu modality, mọi giá trị biên (0, âm, NaN, rất lớn), LLR clip, hysteresis, cooldown, reset phiên.
- [ ] Test API `/v1/student/confusion/predict`: validate input, 4xx khi sai schema.

**Web**
- [ ] Thêm `vitest`: cửa sổ trượt thời gian, reset streak, baseline cá nhân, `r_face`.
- [ ] `tsc --noEmit`, `next lint`, `npm run lint:ds`, `next build` pass.
- [ ] **E2E Playwright** với webcam giả (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=clip.y4m` từ clip DAiSEE confused/not-confused): kiểm tra pipeline end-to-end ra đúng hướng P(t), không treo, không memory leak (chạy 10 phút).
- [ ] Kịch bản lỗi: từ chối quyền camera, mất mặt, phòng tối, mất mạng (API lỗi) → UI hiển thị “không xác định”, không bịa số.
- [ ] Hiệu năng: ≥ 15 fps xử lý, main thread không bị block > 50 ms.

**Quy trình**: một lệnh `make verify` ở gốc chạy toàn bộ checklist trên; chỉ coi là xong khi `make verify` xanh và kết quả được ghi vào `ml/REPORT_V2.md` (số liệu thật, kể cả số xấu).

---

## 4. Rủi ro & phương án

| Rủi ro | Ảnh hưởng | Phương án |
|---|---|---|
| Không lấy được DAiSEE | Chặn P2 | Dùng ConfusionBench/OL-SFED; nếu không có → face branch chỉ còn heuristic có hiệu chỉnh, báo cáo rõ |
| MOOCCubeX thiếu pause/speed | Đặc trưng hành vi nghèo | EdNet KT4; hoặc thu hẹp F1–F6 |
| Nhãn proxy yếu | Nhánh behavior AUC thấp | Báo cáo trung thực; w_beh nhỏ; ablation chứng minh vẫn có ích |
| Giả định độc lập sai | Fusion quá tự tin | Clip LLR, hệ số co w_m, hiệu chỉnh sau fusion |
| Face AUC vẫn thấp (~0.7) | Kỳ vọng | Đây là giới hạn của DAiSEE; điểm mạnh nằm ở fusion + prior + HMM |

## 5. Thứ tự & ước lượng
P0 + P1 (song song) → P2 → P3 ∥ P4 → P5 → P6 → P7.
Khối lượng lớn nhất: P2 (trích MediaPipe trên ~9k clip — vài giờ CPU trên M5) và P7 (E2E).
