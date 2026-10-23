import type {
  AssignmentItem,
  AtRiskStudentItem,
  CodingChallengeItem,
  CourseGradebook,
  CourseItem,
  DailyAttendanceStatus,
  DiscussionComment,
  QuizItem,
  RoadmapEdgeItem,
  RoadmapNodeItem,
  ScheduleItem,
  SpecializationItem,
  StudentAcademicProfile,
  TaskItem,
  TopicSkillStat,
} from './types';

export const MOCK_STUDENT_PROFILE: StudentAcademicProfile = {
  userId: 101,
  fullName: 'Nguyễn Minh Hiếu',
  email: 'hieu.nm215401@sis.hust.edu.vn',
  studentCode: '20215401',
  departmentId: 1,
  departmentName: 'Trường Công nghệ Thông tin & Truyền thông (SoICT)',
  major: 'Khoa học Máy tính & Trí tuệ Nhân tạo (CS-AI)',
  studentClass: 'KHMT-01-K66',
  academicYear: 3,
  level: 'intermediate',
  faceRegistered: true,
  cameraConsentGranted: true,
};

export const MOCK_COURSES: CourseItem[] = [
  {
    id: 1,
    title: 'Học sâu & Thị giác Máy tính Thời gian thực (Deep Learning & Real-Time CV)',
    slug: 'deep-learning-real-time-computer-vision',
    code: 'IT4409',
    credits: 3,
    description:
      'Khóa học chuyên sâu về Mạng Nơ-ron Tích chập (CNN), MobileFaceNet, MediaPipe 478 3D Landmarks, mô hình chuỗi thời gian BiLSTM-Attention và triển khai ONNX Runtime ngay trên trình duyệt.',
    category: 'Trí tuệ Nhân tạo & Thị giác Máy tính',
    department: 'Khoa Khoa học Máy tính',
    major: 'Khoa học Máy tính & AI',
    level: 'intermediate',
    durationMinutes: 420,
    lessonsCount: 7,
    studentsCount: 348,
    rating: 4.9,
    reviewsCount: 86,
    progressPercent: 68,
    lastLessonId: 101,
    aiMatchScore: 98,
    aiMatchReason: 'Khớp 98% với chuyên ngành KHMT & AI Năm 3 và đề tài NCKH Phát hiện Bối rối qua Computer Vision',
    deadlineStatus: 'approaching',
    nextDeadlineDate: '2026-10-25 23:59',
    specializationId: 1,
    tags: ['Computer Vision', 'BiLSTM', 'MediaPipe', 'ONNX Runtime', 'pgvector RAG'],
    instructor: {
      id: 501,
      name: 'PGS.TS. Trần Quang Minh',
      title: 'Trưởng nhóm Nghiên cứu Thị giác Máy tính & Học sâu',
      department: 'Khoa Khoa học Máy tính',
      verified: true,
    },
    modules: [
      {
        id: 11,
        courseId: 1,
        title: 'Chương 1: Trích xuất Đặc trưng Khuôn mặt 3D & Sinh trắc học MobileFaceNet',
        description: 'Nền tảng hình học 478 điểm mốc MediaPipe, chuẩn hóa Nose-Centered và đối sánh Cosine 192 chiều.',
        orderIndex: 1,
        dueDate: '2026-10-25 23:59',
        isOverdue: false,
        lessons: [
          {
            id: 101,
            moduleId: 11,
            courseId: 1,
            title: 'Bài 1.1: Mô hình Chuỗi thời gian BiLSTM + SE-Attention Phát hiện Sự Bối rối từ Khuôn mặt & Hành vi',
            type: 'video',
            durationMinutes: 18,
            durationSeconds: 1080,
            isFreePreview: true,
            orderIndex: 1,
            transcriptStatus: 'ready',
            videoUrl: '/demo-lecture.mp4',
            completed: true,
            summary:
              'Bài giảng phân tích chi tiết kiến trúc kết hợp 478 điểm mốc 3D MediaPipe, chỉ số mở mắt EAR (Eye Aspect Ratio), độ đứng yên ánh nhìn (Gaze Stillness) với mạng BiLSTM 2 lớp có cơ chế Temporal Attention và bộ phân loại đa phương thức 12 đặc trưng.',
            attachments: [
              { id: 1, name: 'Slide_Bai_1_1_BiLSTM_Attention_DAiSEE.pdf', type: 'PDF', size: '4.2 MB' },
              { id: 2, name: 'Notebook_Multimodal_12Features_MLP.ipynb', type: 'Code', size: '850 KB' },
              { id: 3, name: 'Bang_Dac_Trung_F1_F12_Chuan_Hoa.docx', type: 'DOCX', size: '1.1 MB' },
            ],
            segments: [
              {
                id: 1001,
                lessonId: 101,
                segmentIndex: 1,
                title: 'Phân đoạn 1 (00:00 – 06:00): Chuẩn hóa 478 Landmarks 3D & Chỉ số Đờ mắt EAR / Gaze Stillness',
                startTimestamp: 0,
                endTimestamp: 360,
                transcript:
                  '[00:00] Chào các bạn sinh viên ngành Khoa học Máy tính. Trong phân đoạn đầu tiên hôm nay, chúng ta giải quyết bài toán cốt lõi: làm sao phát hiện học sinh đang bối rối trên trình duyệt mà không gửi bất kỳ ảnh webcam nào lên máy chủ. [01:15] Đầu tiên, khi ánh sáng phòng học yếu (độ chói trung bình luminance dưới 95), bộ tiền xử lý trên Canvas sẽ tự động nâng độ sáng và độ tương phản cục bộ. [02:30] Tiếp theo, MediaPipe Face Landmarker trích xuất 478 điểm mốc 3D. Ta lấy đỉnh mũi (landmark số 1) làm gốc tọa độ để bất biến với vị trí ngồi xa hay gần. [03:45] Đặc biệt, khi sinh viên gặp một công thức toán hoặc đoạn code phức tạp, họ thường nhìn chằm chằm không chớp mắt. Ta định lượng hiện tượng này bằng độ dịch chuyển đỉnh mũi dưới 3.5 pixel qua 5 khung hình (Gaze Stillness) kết hợp tỷ lệ mở mắt EAR lớn hơn 0.22 và phương sai EAR nhỏ hơn 0.002 (Eye-Lock), từ đó nhân hệ số khuếch đại bối rối gazeBoost bằng 1.6.',
                summary:
                  'Chuẩn hóa 478 điểm mốc 3D lấy đỉnh mũi làm gốc, tiền xử lý thiếu sáng tự động và công thức tính Eye Aspect Ratio (EAR) kết hợp Gaze Stillness để bắt trạng thái nhìn đờ mắt khi gặp kiến thức khó.',
                keyFormulas: [
                  'EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)',
                  'Var(EAR) < 0.002 & EAR > 0.22 & Drift(Nose) < 3.5px => gazeBoost = 1.6',
                ],
                codeSnippet: `def compute_ear(eye_pts):
    v1 = np.linalg.norm(eye_pts[1] - eye_pts[5])
    v2 = np.linalg.norm(eye_pts[2] - eye_pts[4])
    h  = np.linalg.norm(eye_pts[0] - eye_pts[3])
    return (v1 + v2) / (2.0 * max(h, 1e-6))`,
                confusionHotspotRate: 24,
                rewindCount: 19,
                pauseCount: 31,
                topStudentQuestions: [
                  'Tại sao cần chuẩn hóa tọa độ 478 điểm mốc theo đỉnh mũi (landmark 1) trước khi đưa vào MLP?',
                  'Làm sao phân biệt mắt mở to do tập trung đọc với mắt đờ (Eye-Lock) do bối rối?',
                ],
                quizQuestion: {
                  question:
                    'Trong thuật toán phát hiện đờ mắt (Eye-Lock) khi học sinh gặp công thức khó, điều kiện nào của chỉ số EAR kích hoạt hệ số khuếch đại gazeBoost = 1.6 (khi đi kèm Gaze Stillness)?',
                  options: [
                    'EAR > 0.22 và phương sai Var(EAR) < 0.002 trong 5 khung hình gần nhất',
                    'EAR < 0.12 (mắt nhắm liên tục) trong 10 giây',
                    'EAR dao động mạnh với Var(EAR) > 0.05',
                    'Không phụ thuộc vào EAR mà chỉ dựa vào góc xoay đầu yaw > 45 độ',
                  ],
                  correctIndex: 0,
                  explanation:
                    'Khi học sinh nhìn chằm chằm vào công thức khó mà không chớp mắt, mắt mở ổn định (EAR > 0.22) và gần như không dao động (Var(EAR) < 0.002) kết hợp đầu đứng yên (drift < 3.5px).',
                },
              },
              {
                id: 1002,
                lessonId: 101,
                segmentIndex: 2,
                title: 'Phân đoạn 2 (06:00 – 12:00): Kiến trúc SE-Block, BiLSTM 2 Lớp & Cơ chế Temporal Attention',
                startTimestamp: 360,
                endTimestamp: 720,
                transcript:
                  '[06:00] Bước sang phân đoạn thứ hai, tại sao chúng ta không chỉ phân loại từng ảnh đơn lẻ? Bởi vì sự bối rối là một quá trình diễn biến theo thời gian: sinh viên đang tập trung (focused), sau đó nhíu mày (AU4 brow furrow), nheo mắt (AU7 eye squint) rồi mím môi suy nghĩ. [07:40] Chuỗi 30 khung hình liên tiếp được đi qua khối Squeeze-and-Excitation (SE-Block) để tự động gán trọng số ưu tiên cho các kênh đặc trưng vùng lông mày và mắt. [09:10] Sau đó, mạng BiLSTM 2 lớp đọc chuỗi theo cả chiều thuận và chiều nghịch để nắm bắt ngữ cảnh chuyển đổi cảm xúc. [10:30] Cuối cùng, tầng Temporal Attention Pooling tính trọng số alpha_t cho từng thời điểm t, giúp mô hình tập trung đúng vào khoảnh khắc sinh viên nhíu mày sâu nhất thay vì bị làm loãng bởi các khung hình trung tính.',
                summary:
                  'Mô hình hóa diễn biến cảm xúc theo chuỗi thời gian bằng khối Squeeze-and-Excitation (SE-Block), mạng BiLSTM 2 chiều và tầng gộp Temporal Attention kết hợp hàm mất mát Focal Loss.',
                keyFormulas: [
                  'alpha_t = softmax(v^T * tanh(W_h * h_t + b_h))',
                  'c = sum_{t=1..T}(alpha_t * h_t),  FocalLoss = -alpha * (1 - p_t)^gamma * log(p_t)',
                ],
                codeSnippet: `class TemporalAttention(nn.Module):
    def forward(self, h): # h: [B, T, 2*H]
        scores = self.v(torch.tanh(self.w(h))) # [B, T, 1]
        weights = torch.softmax(scores, dim=1)
        return torch.sum(weights * h, dim=1), weights`,
                confusionHotspotRate: 68,
                rewindCount: 84,
                pauseCount: 96,
                topStudentQuestions: [
                  'Tại sao trong công thức Temporal Attention lại dùng hàm tanh(W_h * h_t) trước khi nhân với vector ngữ cảnh v^T?',
                  'Sự khác biệt giữa việc lấy hidden state cuối cùng h_T của BiLSTM với việc tính tổng có trọng số sum(alpha_t * h_t) là gì?',
                  'Tham số gamma = 2.0 trong Focal Loss giải quyết vấn đề mất cân bằng lớp trên tập DAiSEE như thế nào?',
                ],
                quizQuestion: {
                  question:
                    'Vai trò chính của tầng Temporal Attention Pooling đặt phía sau mạng BiLSTM 2 lớp trong mô hình nhận diện bối rối là gì?',
                  options: [
                    'Tự động gán trọng số cao hơn cho các khung hình chứa biểu cảm nhíu mày/bối rối rõ nét nhất trong chuỗi thời gian',
                    'Giảm kích thước ảnh đầu vào từ 260x260 xuống 112x112',
                    'Thay thế hoàn toàn hàm kích hoạt Softmax ở đầu ra',
                    'Mã hóa âm thanh giọng giảng viên thành văn bản',
                  ],
                  correctIndex: 0,
                  explanation:
                    'Trong một đoạn 5–10 giây, biểu cảm bối rối thường chỉ xuất hiện rõ ở vài giây cao điểm; Temporal Attention giúp tổng hợp vector ngữ cảnh tập trung vào đúng các khung hình đó.',
                },
              },
              {
                id: 1003,
                lessonId: 101,
                segmentIndex: 3,
                title: 'Phân đoạn 3 (12:00 – 18:00): Hợp nhất Đa phương thức 12 Đặc trưng (F1–F12) & Can thiệp RAG 3 Tầng',
                startTimestamp: 720,
                endTimestamp: 1080,
                transcript:
                  '[12:00] Ở phân đoạn cuối cùng, chúng ta kết hợp tín hiệu thị giác máy tính với hành vi tương tác video để tạo nên vector 12 đặc trưng đa phương thức (F1 đến F12). [13:20] Cụ thể: F1 đến F6 đo hành vi xem video gồm số lần tạm dừng (pause_count), thời lượng dừng trung bình, số lần dừng lâu trên 10 giây, tổng số lần tua lại (rewind_count), số lần tua đi tua lại cùng một chỗ sai số 10 giây (rewind_same_spot) và việc giảm tốc độ phát dưới 1.0x. [15:00] F7 đến F10 đo tỷ lệ thời gian bối rối, thất vọng, số lần chuyển trạng thái cảm xúc và chuỗi cảm xúc tiêu cực dài nhất. F11 và F12 lấy từ điểm và thời gian làm câu hỏi quiz phân đoạn. [16:30] Vector 12 chiều này được chuẩn hóa StandardScaler và đưa qua mạng MLP 3 lớp (64 -> 32 -> 16 -> 1). Khi xác suất ML đạt từ 0.60 hoặc điểm luật đạt từ 35 (với cửa sổ trượt 3 và cooldown 5 phút), hệ thống lập tức dừng video và kích hoạt Trợ lý Ảo RAG 3 tầng để giải thích ngay lập tức!',
                summary:
                  'Hợp nhất 6 đặc trưng hành vi video (F1–F6), 4 đặc trưng cảm xúc camera (F7–F10) và 2 đặc trưng quiz (F11–F12) qua mạng MLP (64,32,16) kết hợp cơ chế can thiệp chủ động 3-Tier RAG.',
                keyFormulas: [
                  'z = (x - mu) / sigma,  p_ML = Sigmoid(W_4 * ReLU(W_3 * ReLU(W_2 * ReLU(W_1 * z))))',
                  'Trigger = (p_ML >= 0.60) OR (RuleScore >= 35)  [Cooldown = 5 min]',
                ],
                codeSnippet: `// Hybrid Decision Rule + 3-Layer MLP (64 -> 32 -> 16 -> 1)
if (mlProbability >= 0.60 || ruleScore >= 35) {
  pauseVideoAndTriggerProactiveRAG(lessonId, currentTimestamp);
}`,
                confusionHotspotRate: 41,
                rewindCount: 47,
                pauseCount: 52,
                topStudentQuestions: [
                  'Tại sao đặc trưng F5 (rewind_same_spot) lại có trọng số quan trọng bậc nhất trong mô hình đa phương thức?',
                  'Khi học sinh tắt camera, mô hình kết hợp Hybrid vẫn phát hiện được bối rối nhờ những đặc trưng nào?',
                ],
                quizQuestion: {
                  question:
                    'Trong bộ 12 đặc trưng đa phương thức (F1–F12), nhóm đặc trưng nào giúp hệ thống vẫn phát hiện chính xác sự bối rối ngay cả khi học sinh tắt camera?',
                  options: [
                    'Nhóm 6 đặc trưng hành vi video (F1–F6: pause, long pause, rewind cùng một vị trí, giảm tốc độ) kết hợp kết quả Quiz (F11–F12)',
                    'Chỉ dựa vào đặc trưng F7 (confused_ratio)',
                    'Chỉ dựa vào độ sáng màn hình của học sinh',
                    'Hệ thống hoàn toàn ngừng hoạt động khi tắt camera',
                  ],
                  correctIndex: 0,
                  explanation:
                    'Nhờ thiết kế đa phương thức kết hợp F1–F6 (hành vi tua/dừng video) và F11–F12 (quiz), hệ thống vẫn đạt độ chính xác cao ngay cả khi thiếu kênh thị giác.',
                },
              },
            ],
          },
          {
            id: 102,
            moduleId: 11,
            courseId: 1,
            title: 'Bài 1.2: Định danh Sinh trắc học Khuôn mặt 3 Tư thế với MobileFaceNet 192-d',
            type: 'video',
            durationMinutes: 12,
            durationSeconds: 720,
            isFreePreview: false,
            orderIndex: 2,
            transcriptStatus: 'ready',
            videoUrl: '/demo-lecture.mp4',
            completed: true,
            summary: 'Cơ chế trích xuất vector 192 chiều chuẩn hóa L2 từ 3 góc mặt (Thẳng, Trái, Phải) và kiểm tra chống học hộ mỗi 5 giây.',
            attachments: [
              { id: 4, name: 'MobileFaceNet_ArcFace_Loss_Notes.pdf', type: 'PDF', size: '2.8 MB' },
            ],
            segments: [
              {
                id: 1004,
                lessonId: 102,
                segmentIndex: 1,
                title: 'Phân đoạn 1 (00:00 – 06:00): Chuẩn hóa L2 Vector 192 Chiều & Tương đồng Cosine Đa Tư thế',
                startTimestamp: 0,
                endTimestamp: 360,
                transcript:
                  '[00:00] Trong bài 1.2, chúng ta nghiên cứu cách trích xuất vector sinh trắc học 192 chiều từ 3 góc quay đầu: chính diện (Yaw trong [-12°, +12°]), nghiêng trái (Yaw < -18°) và nghiêng phải (Yaw > +18°). [03:10] Sau khi chuẩn hóa L2 để độ dài vector bằng 1.0, tích vô hướng giữa vector hiện tại và vector đã đăng ký chính là độ tương đồng Cosine.',
                summary: 'Trích xuất vector 192 chiều chuẩn hóa L2 từ 3 góc mặt và đối sánh Cosine >= 0.60.',
                keyFormulas: [
                  'v_norm = v / ||v||_2,   CosineSim(u, v) = sum_{i=1..192} (u_i * v_i)',
                  'Verified = max_{pose in {front,left,right}} CosineSim(v_live, v_pose) >= 0.60',
                ],
                codeSnippet: `function cosineSimilarity192(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < 192; i++) dot += a[i] * b[i];
  return dot; // L2-normalized vectors
}`,
                confusionHotspotRate: 18,
                rewindCount: 12,
                pauseCount: 15,
                quizQuestion: {
                  question: 'Khi hai vector 192 chiều u và v đã được chuẩn hóa L2 (||u||₂ = ||v||₂ = 1), độ tương đồng Cosine được tính bằng phép toán nào?',
                  options: [
                    'Tích vô hướng (Dot Product) trực tiếp giữa hai vector u · v',
                    'Khoảng cách Manhattan tổng trị tuyệt đối',
                    'Tích có hướng trong không gian 3 chiều',
                    'Trung bình cộng các phần tử',
                  ],
                  correctIndex: 0,
                  explanation: 'Khi ||u||₂ = 1 và ||v||₂ = 1, công thức cos(θ) = (u · v) / (||u||₂ ||v||₂) rút gọn thành tích vô hướng u · v.',
                },
              },
              {
                id: 1005,
                lessonId: 102,
                segmentIndex: 2,
                title: 'Phân đoạn 2 (06:00 – 12:00): Cơ chế Chống Học hộ Chu kỳ 5 Giây (FaceVerificationGuard)',
                startTimestamp: 360,
                endTimestamp: 720,
                transcript:
                  '[06:00] Hệ thống kiểm tra định kỳ mỗi 5 giây: nếu 6 lần liên tiếp không phát hiện khuôn mặt (30 giây), trình phát tự động dừng video và mở hộp thoại FaceAbsenceOverlay. Nếu 3 lần liên tiếp phát hiện khuôn mặt lạ có Cosine < 0.58 (15 giây), hệ thống kích hoạt cảnh báo IdentityMismatchOverlay.',
                summary: 'Quy tắc 6 lần vắng mặt (30s) và 3 lần sai khuôn mặt (15s) trong Điểm danh AI.',
                keyFormulas: [
                  '6 checks * 5s = 30s No-Face => Pause Video + FaceAbsenceOverlay',
                  '3 checks * 5s = 15s Cosine < 0.58 => IdentityMismatchOverlay',
                ],
                confusionHotspotRate: 15,
                quizQuestion: {
                  question: 'FaceVerificationGuard kiểm tra sinh trắc mỗi 5 giây sẽ kích hoạt cảnh báo người lạ (IdentityMismatchOverlay) sau bao nhiêu lần kiểm tra không khớp liên tiếp?',
                  options: [
                    '3 lần kiểm tra liên tiếp (tương đương 15 giây)',
                    '1 lần kiểm tra (5 giây)',
                    '60 lần kiểm tra (5 phút)',
                    'Không bao giờ kiểm tra khi đang phát video',
                  ],
                  correctIndex: 0,
                  explanation: '3 chu kỳ x 5 giây = 15 giây liên tiếp có độ tương đồng Cosine thấp sẽ bật cảnh báo không khớp danh tính.',
                },
              },
            ],
          },
          {
            id: 104,
            moduleId: 11,
            courseId: 1,
            title: 'Bài 1.3 [Bài đọc]: Cơ sở Toán học Chuẩn hóa 478 Landmarks 3D, Chỉ số EAR & Hệ số Eye-Lock',
            type: 'reading',
            durationMinutes: 10,
            durationSeconds: 600,
            isFreePreview: true,
            orderIndex: 3,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: false,
            summary: 'Tài liệu đọc chuyên sâu (10 phút đọc) hệ thống hóa toàn bộ công thức chuẩn hóa hình học 478 điểm mốc, Action Units (AU4, AU7) và điều kiện Eye-Lock.',
            attachments: [
              { id: 14, name: 'Chuan_Hoa_Hinh_Hoc_478_Landmarks_CheatSheet.pdf', type: 'PDF', size: '1.9 MB' },
            ],
            segments: [],
            readingContent: {
              estimatedMinutes: 10,
              sections: [
                {
                  heading: '1. Chuẩn hóa Hình học Bất biến Vị tự (Nose-Centered & IOD Normalization)',
                  body: 'Khi học sinh ngồi gần hoặc xa webcam, kích thước khuôn mặt trên khung hình thay đổi đáng kể. Để mạng Spatial MLP không bị phụ thuộc vào khoảng cách hay vị trí đầu, mọi điểm mốc 3D p_i = (x_i, y_i, z_i) trong 478 điểm của MediaPipe đều được dịch gốc tọa độ về đỉnh mũi (p_1) và chia cho khoảng cách giữa hai góc mắt ngoài d_IOD = ||p_33 - p_263||.',
                  formula: "p'_i = (p_i - p_1) / max(||p_33 - p_263||_2, 1e-6),   i = 1..478",
                  codeSnippet: `function normalizeLandmarks478(pts: {x: number; y: number; z: number}[]) {
  const nose = pts[1];
  const iod = Math.hypot(pts[33].x - pts[263].x, pts[33].y - pts[263].y) || 1e-6;
  return pts.map(p => ({ x: (p.x - nose.x) / iod, y: (p.y - nose.y) / iod, z: (p.z - nose.z) / iod }));
}`,
                },
                {
                  heading: '2. Định lượng Độ mở mắt EAR & Hiện tượng Đờ mắt (Cognitive Eye-Lock)',
                  body: 'Chỉ số Eye Aspect Ratio (EAR) được tính từ 6 điểm mốc quanh viền mí mắt trái [33, 160, 158, 133, 153, 144] và mắt phải [362, 385, 387, 263, 373, 380]. Trong tâm lý học nhận thức, khi người học đối mặt với một công thức phức tạp gây quá tải nhận thức (Cognitive Overload), tần suất chớp mắt tự nhiên giảm đột ngột: mắt mở to (EAR > 0.22), phương sai EAR trong 10 khung hình cực nhỏ (Var(EAR) < 0.002) và đỉnh mũi hầu như đứng yên (Nose Drift < 3.5px).',
                  formula: 'EAR = (||p_2 - p_6|| + ||p_3 - p_5||) / (2 * ||p_1 - p_4||)',
                },
                {
                  heading: '3. Kết hợp Facial Action Coding System (AU4 Brow Furrow & AU7 Lid Tightener)',
                  body: 'Từ 52 hệ số Blendshapes của MediaPipe Face Landmarker, hệ thống tổng hợp điểm nhíu mày AU4 = mean(browDownLeft, browDownRight, browInnerUp) và điểm nheo mắt AU7 = mean(eyeSquintLeft, eyeSquintRight). Khi AU4 >= 0.45 kết hợp với trạng thái Eye-Lock, bộ phân loại lập tức nhận diện trạng thái Confused với độ tin cậy cao.',
                  formula: 'Score_Confused = 0.45 * AU4_BrowFurrow + 0.35 * AU7_EyeSquint + 0.20 * I(EyeLocked)',
                },
              ],
              keyTakeaways: [
                'Lấy đỉnh mũi (landmark #1) làm gốc tọa độ và chia cho khoảng cách hai mắt (#33, #263) giúp bất biến với khoảng cách ngồi.',
                'Trạng thái đờ mắt Eye-Lock (EAR > 0.22, Var < 0.002, Drift < 3.5px) phân biệt rõ ràng sự bối rối khi đọc công thức khó với trạng thái buồn ngủ (EAR < 0.18).',
                'Toàn bộ quá trình tính toán chạy 100% trên trình duyệt qua WebGL/Canvas, đảm bảo 0 byte hình ảnh gửi về máy chủ.',
              ],
            },
          },
          {
            id: 105,
            moduleId: 11,
            courseId: 1,
            title: 'Bài 1.4 [Coding Lab]: Cài đặt Thuật toán Tính EAR, Eye-Lock & Phân loại Bối rối Đa phương thức',
            type: 'coding',
            durationMinutes: 25,
            durationSeconds: 1500,
            isFreePreview: false,
            orderIndex: 4,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: false,
            codingChallengeId: 1,
            summary: 'Thực hành viết code trực tiếp trên trình duyệt và chạy bộ 4 Test Cases tự động kiểm tra thuật toán tính EAR, Eye-Lock Boost và điểm bối rối đa phương thức.',
            attachments: [],
            segments: [],
          },
        ],
      },
      {
        id: 12,
        courseId: 1,
        title: 'Chương 2: Hệ thống Trợ lý Ảo Đa phương thức (Vision RAG + pgvector + 3 Personas)',
        description: 'Xây dựng pipeline FFmpeg Whisper STT, phân đoạn tự động 5–7 phút, tìm kiếm tương đồng Cosine trên pgvector và thiết kế 3 phong cách sư phạm.',
        orderIndex: 2,
        dueDate: '2026-10-30 23:59',
        isOverdue: false,
        lessons: [
          {
            id: 103,
            moduleId: 12,
            courseId: 1,
            title: 'Bài 2.1: Truy hồi Ngữ cảnh 3 Tầng (3-Tier Fallback RAG) & GPT-4o Vision Giải thích Slide/Code',
            type: 'video',
            durationMinutes: 14,
            durationSeconds: 840,
            isFreePreview: false,
            orderIndex: 1,
            transcriptStatus: 'ready',
            videoUrl: '/demo-lecture.mp4',
            completed: false,
            summary: 'Thiết kế kiến trúc truy hồi ngữ cảnh 3 tầng kết hợp chụp khung hình bài giảng trực tiếp từ thẻ video.',
            attachments: [],
            segments: [
              {
                id: 1006,
                lessonId: 103,
                segmentIndex: 1,
                title: 'Phân đoạn 1 (00:00 – 07:00): Kiến trúc Truy hồi 3 Tầng (pgvector -> VideoSegment -> Transcript Slice)',
                startTimestamp: 0,
                endTimestamp: 420,
                transcript:
                  '[00:00] Khi học sinh bị bối rối tại giây thứ T, Trợ lý AI cần biết chính xác bài giảng đang nói gì ở giây đó. [02:15] Tầng 1 truy vấn tương đồng Cosine trên bảng transcript_chunks (1536 chiều pgvector). [04:30] Nếu video mới tải lên chưa tạo xong vector, Tầng 2 tự động khớp bảng video_segments theo điều kiện start_timestamp <= T <= end_timestamp, và Tầng 3 cắt trực tiếp cửa sổ phụ đề [T - 120s, T + 30s].',
                summary: 'Đảm bảo 100% không bao giờ thiếu ngữ cảnh bài giảng nhờ cơ chế Fallback 3 tầng.',
                keyFormulas: [
                  'Tier 1: ORDER BY embedding <=> query_vec LIMIT 5',
                  'Tier 2: WHERE start_timestamp <= T AND end_timestamp >= T',
                ],
                confusionHotspotRate: 31,
                quizQuestion: {
                  question: 'Tại sao hệ thống RAG trong LMS cần tới 3 tầng truy hồi dự phòng (3-Tier Fallback) thay vì chỉ dùng duy nhất tìm kiếm vector?',
                  options: [
                    'Để đảm bảo AI Tutor vẫn giải thích chính xác ngay cả khi video vừa mới upload đang chờ worker tạo embedding hoặc khi câu hỏi chỉ gắn với mốc giây hiện tại',
                    'Để tăng dung lượng cơ sở dữ liệu gấp 3 lần',
                    'Vì PostgreSQL không hỗ trợ lưu trữ văn bản',
                    'Để buộc học sinh phải nhập câu hỏi bằng tiếng Anh',
                  ],
                  correctIndex: 0,
                  explanation: '3-Tier Fallback giúp hệ thống hoạt động tức thì ở mọi trạng thái dữ liệu mà không bao giờ trả về rỗng.',
                },
              },
              {
                id: 1007,
                lessonId: 103,
                segmentIndex: 2,
                title: 'Phân đoạn 2 (07:00 – 14:00): Đa phương thức GPT-4o Vision & 3 Phong cách Sư phạm Cá nhân hóa',
                startTimestamp: 420,
                endTimestamp: 840,
                transcript:
                  '[07:00] Nhiều khi nội dung làm học sinh bối rối nằm ở sơ đồ kiến trúc hoặc công thức toán vẽ trên slide mà lời giảng âm thanh không đọc chi tiết từng ký hiệu. [09:20] Do đó, nút chụp khung hình bài giảng sẽ trích xuất ảnh Base64 từ thẻ canvas/video để gửi kèm ngữ cảnh văn bản lên mô hình Vision LLM theo 3 nhân cách: Socrates, Coach hoặc Expert.',
                summary: 'Kết hợp ảnh chụp khung hình slide hiện tại với 3 nhân cách sư phạm theo ngành học của sinh viên.',
                keyFormulas: [
                  'Prompt = System(Persona, Major, Year) + Context(3-Tier RAG) + Image(VideoFrame_t)',
                ],
                confusionHotspotRate: 22,
                quizQuestion: {
                  question: 'Phong cách sư phạm nào của AI Tutor sẽ đặt 2 câu hỏi gợi mở tư duy thay vì đưa ngay lời giải hoàn chỉnh?',
                  options: [
                    'Gợi mở Socrates (Socratic Method)',
                    'Chuyên gia Học thuật (Deep Academic Expert)',
                    'Huấn luyện viên Đồng hành (Step-by-Step Coach)',
                    'Chế độ Tắt AI',
                  ],
                  correctIndex: 0,
                  explanation: 'Phương pháp Socrates giúp sinh viên tự suy luận ra bản chất qua chuỗi câu hỏi định hướng.',
                },
              },
            ],
          },
          {
            id: 106,
            moduleId: 12,
            courseId: 1,
            title: 'Bài 2.2 [Bài đọc]: Tối ưu Chỉ mục HNSW trên PostgreSQL pgvector & Thiết kế Prompt 3 Nhân cách',
            type: 'reading',
            durationMinutes: 12,
            durationSeconds: 720,
            isFreePreview: false,
            orderIndex: 2,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: false,
            summary: 'Phân tích cấu trúc đồ thị phân tầng HNSW cho vector 1536 chiều và mẫu System Prompt cá nhân hóa theo ngành học.',
            attachments: [],
            segments: [],
            readingContent: {
              estimatedMinutes: 12,
              sections: [
                {
                  heading: '1. Cấu trúc Chỉ mục HNSW (Hierarchical Navigable Small World) trên pgvector',
                  body: 'Khi số lượng phân đoạn bài giảng lên tới hàng trăm nghìn chunks, tìm kiếm vét cạn KNN có độ phức tạp O(N*D) gây trễ phản hồi. Chỉ mục HNSW xây dựng đồ thị nhiều tầng với độ phức tạp truy vấn O(log N), giúp tìm 5 đoạn bài giảng sát nghĩa nhất trong dưới 8ms.',
                  formula: 'CREATE INDEX ON transcript_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);',
                },
                {
                  heading: '2. Cá nhân hóa Lời giải thích theo Hồ sơ Học thuật (Academic Profile Injection)',
                  body: 'Mỗi sinh viên có chuyên ngành (Major), năm học (Academic Year) và trình độ (Level) khác nhau. Khi giải thích cùng một khái niệm, hệ thống tự động chọn phép ẩn dụ quen thuộc với chuyên ngành đó (ví dụ: liên hệ với Cấu trúc dữ liệu & Hệ phân tán cho sinh viên KHMT).',
                },
              ],
              keyTakeaways: [
                'Sử dụng toán tử <=> (Cosine distance) trên pgvector kết hợp chỉ mục HNSW để đạt độ trễ truy hồi < 10ms.',
                'Luôn đính kèm mốc thời gian [MM:SS] trong câu trả lời của AI để học sinh bấm tua lại kiểm chứng ngay.',
              ],
            },
          },
          {
            id: 107,
            moduleId: 12,
            courseId: 1,
            title: 'Bài 2.3 [Kiểm tra Trọng số]: Đánh giá Tổng kết Chương 2 — Đa phương thức & Vision RAG',
            type: 'quiz',
            durationMinutes: 15,
            durationSeconds: 900,
            isFreePreview: false,
            orderIndex: 3,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: false,
            quizId: 301,
            summary: 'Bài kiểm tra tính điểm trọng số (30% tổng điểm học phần) yêu cầu xác nhận Cam kết Danh dự Học thuật (Coursera Honor Code).',
            attachments: [],
            segments: [],
          },
        ],
      },
    ],
    reviews: [
      {
        id: 1,
        courseId: 1,
        userName: 'Lê Hoàng Nam',
        studentMajor: 'Khoa học Máy tính · Năm 3',
        rating: 5,
        comment:
          'Tính năng tự động dừng video và giải thích ngay khi mình nhíu mày hoặc tua lại ở phần công thức Temporal Attention thực sự ấn tượng. Không cần gõ câu hỏi mà AI đã tóm tắt đúng chỗ mình đang vướng!',
        createdAt: '2026-10-18',
        helpfulCount: 34,
        teacherResponse:
          'Cảm ơn Nam! Nhóm nghiên cứu đã tinh chỉnh ngưỡng Hybrid (ML >= 0.60 | Rule >= 35) và RAG 3 tầng để hỗ trợ các em đúng thời điểm nhất.',
        responseDate: '2026-10-19',
      },
      {
        id: 2,
        courseId: 1,
        userName: 'Phạm Thu Hà',
        studentMajor: 'Kỹ thuật Máy tính · Năm 3',
        rating: 5,
        comment:
          'Chế độ Gợi mở Socrates và chức năng chụp màn hình slide gửi cho AI Tutor giúp mình tự hiểu sâu bản chất đoạn code PyTorch thay vì chỉ chép đáp án.',
        createdAt: '2026-10-15',
        helpfulCount: 21,
      },
    ],
  },
  {
    id: 2,
    title: 'Cấu trúc Dữ liệu & Giải thuật Nâng cao (Đồ thị DAG, Quy hoạch Động & Cây Phân đoạn)',
    slug: 'advanced-data-structures-and-algorithms',
    code: 'IT3011',
    credits: 4,
    description:
      'Làm chủ các thuật toán đồ thị có hướng không chu trình (DAG), Sắp xếp Tô-pô, Cây bình luận Materialized Path, Quy hoạch động trạng thái và tối ưu hóa độ phức tạp.',
    category: 'Khoa học Dữ liệu & Kỹ thuật Phần mềm',
    department: 'Khoa Khoa học Máy tính',
    major: 'Khoa học Máy tính & AI',
    level: 'intermediate',
    durationMinutes: 540,
    lessonsCount: 4,
    studentsCount: 512,
    rating: 4.8,
    reviewsCount: 124,
    progressPercent: 85,
    lastLessonId: 201,
    aiMatchScore: 94,
    aiMatchReason: 'Môn học tiên quyết cốt lõi giúp củng cố tư duy thuật toán và cấu trúc đồ thị lộ trình học tập',
    deadlineStatus: 'on_track',
    nextDeadlineDate: '2026-10-28 23:59',
    specializationId: 1,
    tags: ['DAG Graph', 'Dynamic Programming', 'Materialized Path', 'Algorithms'],
    instructor: {
      id: 502,
      name: 'TS. Vũ Đình Khoa',
      title: 'Giảng viên Chính · Huấn luyện viên Đội tuyển Olympic Tin học ICPC',
      department: 'Khoa Khoa học Máy tính',
      verified: true,
    },
    modules: [
      {
        id: 21,
        courseId: 2,
        title: 'Chương 1: Đồ thị Có hướng Không Chu trình (DAG) & Sắp xếp Tô-pô (Topological Sort)',
        description: 'Ứng dụng thuật toán Kahn (BFS bán bậc vào) và DFS 3 màu để kiểm tra chu trình và xây dựng lộ trình học tập.',
        orderIndex: 1,
        dueDate: '2026-10-28 23:59',
        isOverdue: false,
        lessons: [
          {
            id: 201,
            moduleId: 21,
            courseId: 2,
            title: 'Bài 1.1: Thuật toán Kahn & DFS Phát hiện Chu trình trên Đồ thị Lộ trình Học tập DAG',
            type: 'video',
            durationMinutes: 14,
            durationSeconds: 840,
            isFreePreview: true,
            orderIndex: 1,
            transcriptStatus: 'ready',
            videoUrl: '/demo-lecture.mp4',
            completed: true,
            summary: 'Phân tích thuật toán Kahn dựa trên bán bậc vào (in-degree) và ứng dụng kiểm tra điều kiện tiên quyết giữa các môn học.',
            attachments: [
              { id: 201, name: 'Slide_DAG_Topological_Sort_ICPC.pdf', type: 'PDF', size: '3.1 MB' },
            ],
            segments: [
              {
                id: 2001,
                lessonId: 201,
                segmentIndex: 1,
                title: 'Phân đoạn 1 (00:00 – 07:00): Bán bậc vào (In-Degree) & Hàng đợi Thuật toán Kahn O(V + E)',
                startTimestamp: 0,
                endTimestamp: 420,
                transcript:
                  '[00:00] Chào các em! Khi xây dựng lộ trình học tập cá nhân hóa, mỗi môn học là một đỉnh u và điều kiện tiên quyết u -> v là một cạnh có hướng. [02:40] Để tồn tại thứ tự học hợp lệ, đồ thị bắt buộc không được có chu trình có hướng (DAG). Thuật toán Kahn khởi tạo hàng đợi chứa mọi đỉnh có in_degree[u] == 0 và lần lượt gỡ các cạnh đi ra.',
                summary: 'Khử dần các đỉnh có bán bậc vào bằng 0 để tìm thứ tự Tô-pô trong thời gian tuyến tính O(V + E).',
                keyFormulas: [
                  'in_degree[v] = sum_{u in V} I((u, v) in E)',
                  'VisitedCount < |V|  <=>  Đồ thị tồn tại chu trình (Cycle Detected)',
                ],
                codeSnippet: `def kahn_topological_sort(n, edges):
    indeg = [0] * n
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v); indeg[v] += 1`,
                confusionHotspotRate: 29,
                quizQuestion: {
                  question: 'Trong thuật toán Kahn trên đồ thị G = (V, E), dấu hiệu nào cho biết đồ thị chứa ít nhất một chu trình có hướng?',
                  options: [
                    'Khi hàng đợi rỗng nhưng số đỉnh đã được đưa vào thứ tự Tô-pô nhỏ hơn tổng số đỉnh |V|',
                    'Khi tồn tại hai đỉnh có cùng bán bậc vào bằng 0',
                    'Khi số cạnh |E| nhỏ hơn |V|',
                    'Khi tất cả các đỉnh đều được thăm đúng 1 lần',
                  ],
                  correctIndex: 0,
                  explanation: 'Các đỉnh nằm trong chu trình luôn có bán bậc vào >= 1 nên không bao giờ được đẩy vào hàng đợi Kahn.',
                },
              },
              {
                id: 2002,
                lessonId: 201,
                segmentIndex: 2,
                title: 'Phân đoạn 2 (07:00 – 14:00): Quy hoạch Động Đường đi Tới hạn (Critical Path) trên DAG',
                startTimestamp: 420,
                endTimestamp: 840,
                transcript:
                  '[07:00] Sau khi có thứ tự Tô-pô u_1, u_2, ..., u_n, ta dễ dàng tính thời gian hoàn thành sớm nhất của từng học phần bằng công thức quy hoạch động dp[v] = max(dp[v], dp[u] + weight(u, v)) theo đúng thứ tự Tô-pô.',
                summary: 'Tính đường đi dài nhất (Critical Path) trên DAG trong O(V + E) nhờ thứ tự Tô-pô.',
                keyFormulas: [
                  'dp[v] = max_{(u, v) in E} (dp[u] + w(u, v))',
                ],
                confusionHotspotRate: 36,
                quizQuestion: {
                  question: 'Bài toán tìm đường đi dài nhất (Longest Path / Critical Path) vốn là NP-Hard trên đồ thị tổng quát nhưng giải được với độ phức tạp bao nhiêu trên đồ thị DAG?',
                  options: [
                    'Tuyến tính O(V + E) bằng Quy hoạch động theo thứ tự Sắp xếp Tô-pô',
                    'O(V!) bằng duyệt toàn bộ hoán vị',
                    'O(V^3) bắt buộc dùng Floyd-Warshall',
                    'Không giải được trên DAG',
                  ],
                  correctIndex: 0,
                  explanation: 'Nhờ không có chu trình, ta xét các đỉnh theo thứ tự Tô-pô và cập nhật dp[v] trong O(V + E).',
                },
              },
            ],
          },
          {
            id: 202,
            moduleId: 21,
            courseId: 2,
            title: 'Bài 1.2 [Bài đọc]: Biểu diễn Cây Phân cấp bằng Materialized Path & Tối ưu Truy vấn Thảo luận',
            type: 'reading',
            durationMinutes: 10,
            durationSeconds: 600,
            isFreePreview: true,
            orderIndex: 2,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: true,
            summary: 'Cách lưu trữ đường dẫn phân cấp dạng chuỗi "1/4/9" giúp truy vấn toàn bộ cây con thảo luận chỉ bằng 1 câu lệnh SQL mà không cần đệ quy CTE.',
            attachments: [],
            segments: [],
            readingContent: {
              estimatedMinutes: 10,
              sections: [
                {
                  heading: '1. So sánh Adjacency List, Nested Sets và Materialized Path',
                  body: 'Trong hệ thống diễn đàn hỏi đáp gắn mốc thời gian video, mỗi câu hỏi gốc có thể có nhiều tầng phản hồi từ bạn học và giảng viên. Thay vì dùng đệ quy WITH RECURSIVE tốn kém, kỹ thuật Materialized Path lưu chuỗi đường dẫn từ gốc tới nút hiện tại (ví dụ: path = "0001/0003/0008").',
                  formula: "SELECT * FROM discussion_comments WHERE lesson_id = 101 AND path LIKE '0001/%' ORDER BY path ASC;",
                },
                {
                  heading: '2. Tính Độ sâu (Depth) và Sắp xếp Tuyến tính O(N log N)',
                  body: 'Độ sâu của một bình luận chính bằng số dấu phân cách "/" trong chuỗi path. Khi sắp xếp từ điển theo cột path (kết hợp lpad ID), toàn bộ cây thảo luận tự động hiển thị đúng thứ tự duyệt tiền thứ tự (Pre-order Traversal).',
                },
              ],
              keyTakeaways: [
                'Materialized Path cho phép đọc toàn bộ nhánh con bằng toán tử tiền tố B-Tree index cực nhanh.',
                'Độ sâu depth được suy ra trực tiếp trong O(1) mà không cần JOIN nhiều bảng.',
              ],
            },
          },
          {
            id: 203,
            moduleId: 21,
            courseId: 2,
            title: 'Bài 1.3 [Coding Lab]: Cài đặt Sắp xếp Tô-pô & Kiểm tra Tiên quyết Môn học trên DAG',
            type: 'coding',
            durationMinutes: 25,
            durationSeconds: 1500,
            isFreePreview: false,
            orderIndex: 3,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: false,
            codingChallengeId: 2,
            summary: 'Viết hàm kiểm tra đồ thị tiên quyết có chu trình hay không và trả về thứ tự học hợp lệ.',
            attachments: [],
            segments: [],
          },
        ],
      },
      {
        id: 22,
        courseId: 2,
        title: 'Chương 2: Quy hoạch Động Trạng thái & Cây Phân đoạn (Segment Tree)',
        description: 'Tối ưu hóa truy vấn khoảng thời gian video và thống kê mật độ bối rối bằng Segment Tree.',
        orderIndex: 2,
        dueDate: '2026-11-04 23:59',
        isOverdue: false,
        lessons: [
          {
            id: 204,
            moduleId: 22,
            courseId: 2,
            title: 'Bài 2.1: Cây Phân đoạn (Segment Tree) Truy vấn Điểm nóng Bối rối trên Dòng Thời gian Video',
            type: 'video',
            durationMinutes: 12,
            durationSeconds: 720,
            isFreePreview: false,
            orderIndex: 1,
            transcriptStatus: 'ready',
            videoUrl: '/demo-lecture.mp4',
            completed: false,
            summary: 'Sử dụng Segment Tree có Lazy Propagation để cập nhật và truy vấn đoạn video có số lượt tua lại/bối rối cao nhất trong O(log N).',
            attachments: [],
            segments: [
              {
                id: 2003,
                lessonId: 204,
                segmentIndex: 1,
                title: 'Phân đoạn 1 (00:00 – 12:00): Cập nhật Đoạn Tua lại [L, R] bằng Lazy Propagation O(log N)',
                startTimestamp: 0,
                endTimestamp: 720,
                transcript:
                  '[00:00] Khi học sinh tua ngược video từ giây R về giây L, toàn bộ đoạn [L, R] được cộng thêm 1 đơn vị mật độ xem lại. Với Cây Phân đoạn kèm Lazy Propagation, cả thao tác cộng đoạn [L, R] và tìm đỉnh nóng nhất (Range Maximum Query) đều chỉ tốn O(log N).',
                summary: 'Ứng dụng Range Add + Range Max Segment Tree để vẽ biểu đồ Confusion Heatmap thời gian thực.',
                keyFormulas: [
                  'tree[node] = max(tree[2*node], tree[2*node + 1]) + lazy[node]',
                ],
                confusionHotspotRate: 33,
                quizQuestion: {
                  question: 'Độ phức tạp của thao tác cập nhật cộng thêm +1 vào toàn bộ đoạn thời gian [L, R] trên Cây Phân đoạn có Lazy Propagation là bao nhiêu?',
                  options: [
                    'O(log N)',
                    'O(N^2)',
                    'O(N)',
                    'O(2^N)',
                  ],
                  correctIndex: 0,
                  explanation: 'Lazy Propagation trì hoãn việc đẩy giá trị xuống các nút con, giữ độ phức tạp O(log N) cho cả cập nhật và truy vấn đoạn.',
                },
              },
            ],
          },
        ],
      },
    ],
    reviews: [],
  },
  {
    id: 3,
    title: 'Kiến trúc Backend Hiệu năng Cao với Go, GoFrame v2, PostgreSQL pgvector & Redis',
    slug: 'high-performance-backend-goframe-pgvector',
    code: 'IT4593',
    credits: 3,
    description:
      'Xây dựng hệ thống phân tán chuẩn doanh nghiệp với Go 1.25, GoFrame v2, GORM, hàng đợi bất đồng bộ pgqueue (FOR UPDATE SKIP LOCKED), WebSocket thời gian thực và tìm kiếm ngữ nghĩa pgvector.',
    category: 'Khoa học Dữ liệu & Kỹ thuật Phần mềm',
    department: 'Khoa Kỹ thuật Phần mềm',
    major: 'Kỹ thuật Phần mềm',
    level: 'advanced',
    durationMinutes: 480,
    lessonsCount: 3,
    studentsCount: 276,
    rating: 4.9,
    reviewsCount: 64,
    progressPercent: 42,
    lastLessonId: 301,
    aiMatchScore: 91,
    aiMatchReason: 'Phù hợp để xây dựng hạ tầng Backend phục vụ mô hình AI thời gian thực và tìm kiếm lai pgvector',
    deadlineStatus: 'overdue',
    nextDeadlineDate: '2026-10-22 23:59',
    specializationId: 1,
    tags: ['GoFrame v2', 'PostgreSQL pgvector', 'pgqueue', 'WebSocket', 'Clean Architecture'],
    instructor: {
      id: 503,
      name: 'ThS. Đỗ Hoàng Long',
      title: 'Kiến trúc sư Hệ thống Phân tán & Cloud Native',
      department: 'Khoa Kỹ thuật Phần mềm',
      verified: true,
    },
    modules: [
      {
        id: 31,
        courseId: 3,
        title: 'Chương 1: Kiến trúc Clean Architecture với GoFrame v2 & Hàng đợi Bất đồng bộ pgqueue',
        description: 'Thiết kế worker xử lý video FFmpeg, Whisper STT và nhúng vector bất đồng bộ đảm bảo At-Least-Once Delivery.',
        orderIndex: 1,
        dueDate: '2026-10-22 23:59',
        isOverdue: true,
        lessons: [
          {
            id: 301,
            moduleId: 31,
            courseId: 3,
            title: 'Bài 1.1: Thiết kế Hàng đợi Công việc Bất đồng bộ với PostgreSQL FOR UPDATE SKIP LOCKED',
            type: 'video',
            durationMinutes: 12,
            durationSeconds: 720,
            isFreePreview: true,
            orderIndex: 1,
            transcriptStatus: 'ready',
            videoUrl: '/demo-lecture.mp4',
            completed: true,
            summary: 'Cơ chế khóa hàng không chặn (SKIP LOCKED) giúp hàng chục Goroutine worker cùng lấy job xử lý video mà không xung đột.',
            attachments: [],
            segments: [
              {
                id: 3001,
                lessonId: 301,
                segmentIndex: 1,
                title: 'Phân đoạn 1 (00:00 – 12:00): Cơ chế FOR UPDATE SKIP LOCKED & Exponential Backoff trong Go',
                startTimestamp: 0,
                endTimestamp: 720,
                transcript:
                  '[00:00] Trong hệ thống LMS, khi giảng viên tải lên video bài giảng dài 60 phút, tác vụ tách âm thanh FFmpeg, gọi Whisper STT và sinh vector 1536 chiều không thể chạy đồng bộ trong HTTP request. [04:15] Chúng ta dùng bảng queue_jobs kết hợp mệnh đề FOR UPDATE SKIP LOCKED trong PostgreSQL để các Goroutine worker nhận job an toàn tuyệt đối.',
                summary: 'Đảm bảo mỗi job chỉ được 1 worker xử lý tại một thời điểm và tự động thử lại khi lỗi mạng.',
                keyFormulas: [
                  'SELECT * FROM queue_jobs WHERE status = "pending" ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED',
                ],
                confusionHotspotRate: 27,
                quizQuestion: {
                  question: 'Mệnh đề FOR UPDATE SKIP LOCKED trong PostgreSQL mang lại lợi ích gì cho hệ thống hàng đợi nhiều Goroutine worker?',
                  options: [
                    'Các worker bỏ qua ngay các dòng đang bị worker khác khóa thay vì phải đứng chờ, loại bỏ hoàn toàn nghẽn cổ chai (lock contention)',
                    'Tự động xóa toàn bộ bảng sau mỗi giây',
                    'Tắt tính năng giao dịch ACID của PostgreSQL',
                    'Chỉ cho phép tối đa 1 kết nối tới cơ sở dữ liệu',
                  ],
                  correctIndex: 0,
                  explanation: 'SKIP LOCKED giúp nhiều worker lấy các job khác nhau song song với thông lượng rất cao.',
                },
              },
            ],
          },
          {
            id: 302,
            moduleId: 31,
            courseId: 3,
            title: 'Bài 1.2 [Bài đọc]: Tối ưu hóa Truy vấn Hybrid Search (Từ khóa + Vector 1536-d) trong Go & GORM',
            type: 'reading',
            durationMinutes: 15,
            durationSeconds: 900,
            isFreePreview: false,
            orderIndex: 2,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: false,
            summary: 'Kết hợp điểm khớp từ khóa chính xác (cho tên hàm/mã môn) với điểm tương đồng ngữ nghĩa Cosine trên pgvector.',
            attachments: [],
            segments: [],
            readingContent: {
              estimatedMinutes: 15,
              sections: [
                {
                  heading: '1. Tại sao cần Kết hợp Tìm kiếm Từ khóa và Vector (Hybrid Retrieval)?',
                  body: 'Tìm kiếm vector hiểu rất tốt ngữ nghĩa khái niệm nhưng đôi khi kém chính xác với các mã học phần cụ thể như "IT4409" hoặc tên biến "rewind_same_spot". Kết hợp Reciprocal Rank Fusion (RRF) giữa Full-Text Search và pgvector mang lại độ chính xác cao nhất.',
                  formula: 'Score_Hybrid(d) = 0.65 * CosineSim(q_vec, d_vec) + 0.35 * BM25_Norm(q_text, d_text)',
                },
              ],
              keyTakeaways: [
                'Sử dụng connection pool hợp lý và chuẩn hóa vector trước khi lưu vào cột vector(1536).',
              ],
            },
          },
          {
            id: 303,
            moduleId: 31,
            courseId: 3,
            title: 'Bài 1.3 [Coding Lab]: Xây dựng Bộ Kiểm tra Tương đồng Mã nguồn & Chuẩn hóa Vector L2',
            type: 'coding',
            durationMinutes: 25,
            durationSeconds: 1500,
            isFreePreview: false,
            orderIndex: 3,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: false,
            codingChallengeId: 3,
            summary: 'Thực hành cài đặt hàm chuẩn hóa vector L2 và tính độ tương đồng Cosine phục vụ kiểm tra đạo văn & RAG.',
            attachments: [],
            segments: [],
          },
        ],
      },
    ],
    reviews: [],
  },
  {
    id: 4,
    title: 'Xử lý Ngôn ngữ Tự nhiên, Whisper Speech-to-Text & Hệ thống Đa phương thức (LLM RAG)',
    slug: 'nlp-whisper-multimodal-rag-systems',
    code: 'IT4772',
    credits: 3,
    description:
      'Từ Transformer, cơ chế Self-Attention, nhận dạng tiếng nói tự động với Whisper đến kỹ thuật Prompt Engineering, Chunking TTS độ trễ thấp và đánh giá tự động theo Rubric.',
    category: 'Học sâu & Xử lý Ngôn ngữ Tự nhiên',
    department: 'Khoa Khoa học Máy tính',
    major: 'Khoa học Máy tính & AI',
    level: 'advanced',
    durationMinutes: 390,
    lessonsCount: 2,
    studentsCount: 290,
    rating: 4.9,
    reviewsCount: 73,
    progressPercent: 25,
    lastLessonId: 401,
    aiMatchScore: 95,
    aiMatchReason: 'Bổ trợ trực tiếp cho nhánh Trợ lý Ảo Đa phương thức (Whisper STT + TTS-1 Chunking + 3-Tier RAG)',
    deadlineStatus: 'on_track',
    nextDeadlineDate: '2026-11-02 23:59',
    specializationId: 1,
    tags: ['LLM & RAG', 'Whisper STT', 'Voice Streaming', 'Prompt Engineering'],
    instructor: {
      id: 501,
      name: 'PGS.TS. Trần Quang Minh',
      title: 'Trưởng nhóm Nghiên cứu Thị giác Máy tính & Học sâu',
      department: 'Khoa Khoa học Máy tính',
      verified: true,
    },
    modules: [
      {
        id: 41,
        courseId: 4,
        title: 'Chương 1: Nhận dạng Tiếng nói Whisper STT & Phân đoạn Ngữ nghĩa 5–7 Phút',
        description: 'Tự động tách phụ đề bài giảng kèm mốc thời gian và tổng hợp câu hỏi kiểm tra mỗi chặng.',
        orderIndex: 1,
        dueDate: '2026-11-02 23:59',
        isOverdue: false,
        lessons: [
          {
            id: 401,
            moduleId: 41,
            courseId: 4,
            title: 'Bài 1.1: Pipeline FFmpeg + OpenAI Whisper STT & Phân đoạn Ngữ nghĩa Tự động 5–7 Phút',
            type: 'video',
            durationMinutes: 12,
            durationSeconds: 720,
            isFreePreview: true,
            orderIndex: 1,
            transcriptStatus: 'ready',
            videoUrl: '/demo-lecture.mp4',
            completed: false,
            summary: 'Quy trình chuyển đổi âm thanh bài giảng thành các đoạn văn bản 500 ký tự (overlap 100) và gom thành các phân đoạn 5–7 phút.',
            attachments: [],
            segments: [
              {
                id: 4001,
                lessonId: 401,
                segmentIndex: 1,
                title: 'Phân đoạn 1 (00:00 – 12:00): Chunking Phụ đề 500 Ký tự (Overlap 100) & Sinh Quiz Tự động',
                startTimestamp: 0,
                endTimestamp: 720,
                transcript:
                  '[00:00] Để không làm đứt gãy công thức hoặc câu giải thích của giảng viên ở ranh giới giữa hai đoạn, thuật toán Chunking sử dụng cửa sổ 500 ký tự kèm phần gối đầu (overlap) 100 ký tự trước khi gọi mô hình text-embedding-3-small.',
                summary: 'Cơ chế Sliding Window Chunking với overlap 100 ký tự giữ nguyên ngữ cảnh câu giảng.',
                keyFormulas: [
                  'Chunk_k = Transcript[k * (500 - 100) : k * 400 + 500]',
                ],
                confusionHotspotRate: 21,
                quizQuestion: {
                  question: 'Mục đích của việc thiết lập khoảng gối đầu (Overlap = 100 ký tự) khi chia nhỏ phụ đề bài giảng thành các đoạn 500 ký tự là gì?',
                  options: [
                    'Tránh làm đứt gãy ý nghĩa của câu giảng hoặc công thức nằm ngay tại ranh giới giữa hai đoạn liên tiếp',
                    'Để xóa bỏ các từ quan trọng',
                    'Để giảm số chiều vector từ 1536 xuống 100',
                    'Không có tác dụng gì trong truy hồi RAG',
                  ],
                  correctIndex: 0,
                  explanation: 'Overlap 100 ký tự bảo toàn ngữ cảnh liền mạch khi một ý tưởng kéo dài qua ranh giới hai chunk.',
                },
              },
            ],
          },
          {
            id: 402,
            moduleId: 41,
            courseId: 4,
            title: 'Bài 1.2 [Bài đọc]: Kỹ thuật Chấm điểm Tự động theo Structured JSON Rubric & Kiểm tra Đạo văn',
            type: 'reading',
            durationMinutes: 10,
            durationSeconds: 600,
            isFreePreview: false,
            orderIndex: 2,
            transcriptStatus: 'ready',
            videoUrl: '',
            completed: false,
            summary: 'Thiết kế bộ tiêu chí Rubric có cấu trúc JSON, tính điểm độ tự tin (Confidence) và kiểm tra độ trùng lặp mã nguồn (AST/Token Similarity).',
            attachments: [],
            segments: [],
            readingContent: {
              estimatedMinutes: 10,
              sections: [
                {
                  heading: '1. Chấm điểm Tự động Đa tiêu chí (Structured JSON Rubric Evaluation)',
                  body: 'Thay vì chấm một con điểm cảm tính duy nhất, AI Auto-Grader phân tích bài nộp theo từng tiêu chí trong Rubric, xuất điểm từng phần kèm nhận xét chi tiết và hệ số tự tin auto_grade_confidence.',
                },
                {
                  heading: '2. Kiểm tra Độ Trùng lặp & Cam kết Danh dự Học thuật (Coursera Honor Code)',
                  body: 'Mọi bài nộp đều được đối sánh dấu vân tay cú pháp (Token Shingling & Cosine Embedding) với kho bài nộp trước đó. Nếu tỷ lệ trùng lặp <= 25%, hệ thống gắn nhãn Hợp lệ; nếu > 25%, hệ thống cảnh báo giảng viên kiểm tra thủ công.',
                },
              ],
              keyTakeaways: [
                'Kết hợp AI Auto-Grader với bước giảng viên duyệt cuối cùng (Human-in-the-Loop) đảm bảo công bằng tuyệt đối.',
              ],
            },
          },
        ],
      },
    ],
    reviews: [],
  },
];

export const MOCK_SCHEDULES: ScheduleItem[] = [
  {
    id: 1,
    subjectCode: 'IT4409',
    subjectName: 'Học sâu & Thị giác Máy tính Thời gian thực',
    classCode: '148901',
    room: 'B1-302 (Kết hợp Online AI Player)',
    dayOfWeek: 2,
    startTime: '07:30',
    endTime: '10:00',
    type: 'classSession',
    format: 'online',
    credits: 3,
    currentAbsences: 1,
    maxAbsences: 6,
    midtermScore: 8.5,
    finalScore: 9.0,
    examScore: 8.8,
    targetScore: 8.5,
    instructorName: 'PGS.TS. Trần Quang Minh',
  },
  {
    id: 2,
    subjectCode: 'IT3011',
    subjectName: 'Cấu trúc Dữ liệu & Giải thuật Nâng cao',
    classCode: '148905',
    room: 'D9-401',
    dayOfWeek: 3,
    startTime: '09:20',
    endTime: '11:45',
    type: 'classSession',
    format: 'offline',
    credits: 4,
    currentAbsences: 0,
    maxAbsences: 6,
    midtermScore: 8.0,
    finalScore: 8.5,
    examScore: null,
    targetScore: 8.5,
    instructorName: 'TS. Vũ Đình Khoa',
  },
  {
    id: 3,
    subjectCode: 'IT4593',
    subjectName: 'Kiến trúc Backend Hiệu năng Cao (Go & pgvector)',
    classCode: '148912',
    room: 'Trực tuyến (Smart Learning Player)',
    dayOfWeek: 4,
    startTime: '13:00',
    endTime: '15:30',
    type: 'classSession',
    format: 'online',
    credits: 3,
    currentAbsences: 2,
    maxAbsences: 6,
    midtermScore: 7.5,
    finalScore: 8.0,
    examScore: null,
    targetScore: 8.0,
    instructorName: 'ThS. Đỗ Hoàng Long',
  },
  {
    id: 4,
    subjectCode: 'IT4772',
    subjectName: 'Xử lý Ngôn ngữ Tự nhiên & Hệ thống RAG Đa phương thức',
    classCode: '148918',
    room: 'B1-204',
    dayOfWeek: 6,
    startTime: '14:00',
    endTime: '16:30',
    type: 'exam',
    format: 'offline',
    credits: 3,
    currentAbsences: 0,
    maxAbsences: 6,
    midtermScore: 9.0,
    finalScore: 9.2,
    examScore: null,
    targetScore: 9.0,
    instructorName: 'PGS.TS. Trần Quang Minh',
  },
];

export const MOCK_DAILY_ATTENDANCE: DailyAttendanceStatus[] = [
  {
    date: '2026-10-23',
    scheduleId: 1,
    subjectName: 'Học sâu & Thị giác Máy tính Thời gian thực (IT4409)',
    classCode: '148901',
    totalWatchSeconds: 918,
    requiredWatchSeconds: 1080,
    watchPercentage: 85,
    quizCompleted: true,
    quizScore: 100,
    faceVerified: true,
    status: 'present',
    finalizedAt: 'Đạt chuẩn (>= 80% video + vượt qua Segment Quiz + Đã xác thực khuôn mặt)',
  },
  {
    date: '2026-10-22',
    scheduleId: 3,
    subjectName: 'Kiến trúc Backend Hiệu năng Cao (IT4593)',
    classCode: '148912',
    totalWatchSeconds: 640,
    requiredWatchSeconds: 900,
    watchPercentage: 71,
    quizCompleted: false,
    quizScore: 0,
    faceVerified: true,
    status: 'pending',
    absenceReason: 'Cần xem thêm 9% thời lượng video và hoàn thành Quiz phân đoạn trước 23:59 tối nay',
    finalizedAt: 'Chốt sổ tự động lúc 23:59 (AttendanceEngine Cron)',
  },
];

export const MOCK_TASKS: TaskItem[] = [
  {
    id: 1,
    title: 'Hoàn thành Bài tập Lớn: Huấn luyện BiLSTM + Temporal Attention trên tập DAiSEE',
    description: 'Nộp file trọng số confusion_bilstm.onnx và báo cáo kết quả Ablation Study 5 biến thể.',
    courseTag: 'IT4409 · Thị giác Máy tính',
    dueDate: '2026-10-25',
    status: 'in_progress',
    priority: 'high',
  },
  {
    id: 2,
    title: 'Xem đủ >= 80% video Bài 2.1 (3-Tier RAG) và vượt qua 3 câu hỏi Segment Quiz',
    description: 'Điều kiện bắt buộc để AttendanceEngine ghi nhận Có mặt (Present) trước 23:59.',
    courseTag: 'IT4409 · Điểm danh AI',
    dueDate: '2026-10-23',
    status: 'todo',
    priority: 'high',
  },
  {
    id: 3,
    title: 'Cài đặt thuật toán Sắp xếp Tô-pô (Topological Sort) cho đồ thị lộ trình học tập DAG',
    description: 'Kiểm tra chu trình và tìm đường đi критический (Critical Path) trên đồ thị môn học.',
    courseTag: 'IT3011 · Giải thuật',
    dueDate: '2026-10-27',
    status: 'todo',
    priority: 'medium',
  },
  {
    id: 4,
    title: 'Đăng ký Sinh trắc học Khuôn mặt 3 góc (Thẳng, Nghiêng trái, Nghiêng phải)',
    description: 'Trích xuất 3 vector 192 chiều MobileFaceNet trên trình duyệt.',
    courseTag: 'Hồ sơ Sinh trắc học',
    dueDate: '2026-10-20',
    status: 'done',
    priority: 'low',
  },
];

export const MOCK_ASSIGNMENTS: AssignmentItem[] = [
  {
    id: 501,
    courseId: 1,
    classCode: 'IT4409 - Lớp 148901',
    title: 'Bài tập thực hành số 2: Xây dựng Mô hình Dự đoán Bối rối Đa phương thức 12 Đặc trưng & Attention',
    description:
      'Cài đặt tầng Temporal Attention Pooling cho mạng BiLSTM 2 lớp và bộ phân loại MLP (64, 32, 16) trên 12 đặc trưng hành vi + cảm xúc + quiz.',
    dueDate: '2026-10-25 23:59',
    rewardPoints: 150,
    rubric: [
      {
        id: 'r1',
        criterion: '1. Chuẩn hóa dữ liệu & Trích xuất 12 đặc trưng (F1–F12)',
        maxPoints: 30,
        description: 'Tính đúng các đặc trưng hành vi (rewind_same_spot, long_pause) và chuẩn hóa StandardScaler.',
      },
      {
        id: 'r2',
        criterion: '2. Kiến trúc BiLSTM 2 lớp & Temporal Attention Pooling',
        maxPoints: 40,
        description: 'Cài đặt đúng công thức alpha_t = softmax(v^T tanh(W_h h_t)) và Focal Loss.',
      },
      {
        id: 'r3',
        criterion: '3. Thực nghiệm Đối chứng (Ablation Study) & Đánh giá F1-Score / AUC',
        maxPoints: 30,
        description: 'So sánh đầy đủ giữa Visual-Only, Behavior-Only và Full Multimodal.',
      },
    ],
    submissions: [
      {
        id: 9001,
        assignmentId: 501,
        studentId: 101,
        studentName: 'Nguyễn Minh Hiếu',
        studentCode: '20215401',
        version: 2,
        submittedAt: '2026-10-23 09:45',
        isLate: false,
        status: 'graded',
        fileName: 'hieu_20215401_multimodal_bilstm_v2.py',
        codeContent: `import torch
import torch.nn as nn

class TemporalAttentionClassifier(nn.Module):
    def __init__(self, input_dim=1434, hidden_dim=128):
        super().__init__()
        self.spatial_mlp = nn.Sequential(nn.Linear(input_dim, 256), nn.ReLU(), nn.Dropout(0.3))
        self.bilstm = nn.LSTM(256, hidden_dim, num_layers=2, batch_first=True, bidirectional=True)
        self.attn_w = nn.Linear(hidden_dim * 2, 64)
        self.attn_v = nn.Linear(64, 1, bias=False)
        self.classifier = nn.Linear(hidden_dim * 2, 1)

    def forward(self, x):
        feat = self.spatial_mlp(x)
        h, _ = self.bilstm(feat)
        scores = self.attn_v(torch.tanh(self.attn_w(h)))
        weights = torch.softmax(scores, dim=1)
        context = torch.sum(weights * h, dim=1)
        return torch.sigmoid(self.classifier(context)), weights`,
        grade: 94,
        maxGrade: 100,
        feedback: 'Cài đặt kiến trúc BiLSTM + Temporal Attention rất sạch sẽ, báo cáo Ablation rõ ràng.',
        autoGrade: 94,
        autoGradeConfidence: 0.93,
        similarityScore: 4.2,
        honorCodeAccepted: true,
        rubricEvaluation: [
          {
            criterionId: 'r1',
            criterionName: '1. Chuẩn hóa dữ liệu & Trích xuất 12 đặc trưng (F1–F12)',
            score: 29,
            maxPoints: 30,
            comment: 'Đã chuẩn hóa Nose-Centered cho 478 landmarks và StandardScaler cho 12 đặc trưng.',
          },
          {
            criterionId: 'r2',
            criterionName: '2. Kiến trúc BiLSTM 2 lớp & Temporal Attention Pooling',
            score: 38,
            maxPoints: 40,
            comment: 'Cài đặt chính xác cơ chế Bahdanau/Additive Temporal Attention với shape [B, T, 1].',
          },
          {
            criterionId: 'r3',
            criterionName: '3. Thực nghiệm Đối chứng (Ablation Study) & Đánh giá F1-Score / AUC',
            score: 27,
            maxPoints: 30,
            comment: 'Có bảng so sánh LR, RF, GBDT và 3-Layer MLP rõ ràng; có thể bổ sung thêm đường cong ROC.',
          },
        ],
      },
      {
        id: 9002,
        assignmentId: 501,
        studentId: 102,
        studentName: 'Trần Bảo Ngọc',
        studentCode: '20215418',
        version: 1,
        submittedAt: '2026-10-23 10:15',
        isLate: false,
        status: 'submitted',
        fileName: 'ngoc_20215418_confusion_mlp.py',
        codeContent: `import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

def train_multimodal_mlp(X_train, y_train):
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_train)
    clf = MLPClassifier(hidden_layer_sizes=(64, 32, 16), activation='relu', max_iter=300)
    clf.fit(X_scaled, y_train)
    return scaler, clf`,
        maxGrade: 100,
        autoGrade: 78,
        autoGradeConfidence: 0.87,
        similarityScore: 28.6,
        honorCodeAccepted: true,
      },
    ],
  },
];

export const MOCK_QUIZZES: QuizItem[] = [
  {
    id: 301,
    title: 'Đề kiểm tra Thích ứng: Mô hình Phát hiện Bối rối Đa phương thức & Thị giác Máy tính',
    topic: 'Computer Vision & Multimodal Confusion Detection',
    subjectContext: 'IT4409 - Học sâu & Thị giác Máy tính',
    difficulty: 'medium',
    questionCount: 4,
    timeLimitSeconds: 300,
    questions: [
      {
        id: 1,
        questionType: 'multiple_choice',
        question:
          'Khi chuẩn hóa 478 điểm mốc khuôn mặt 3D của MediaPipe để đưa vào mạng Spatial MLP, điểm mốc nào được chọn làm gốc tọa độ (0, 0, 0) nhằm bất biến với khoảng cách ngồi của học sinh?',
        options: [
          'Đỉnh mũi (Nose Tip — Landmark index 1)',
          'Góc ngoài mắt trái (Landmark index 33)',
          'Đỉnh trán (Landmark index 10)',
          'Khóe miệng phải (Landmark index 291)',
        ],
        correctIndex: 0,
        explanation:
          'Đỉnh mũi (landmark 1) nằm ở tâm hình học ổn định nhất của khuôn mặt khi học sinh nghiêng đầu nhẹ hoặc thay đổi khoảng cách tới webcam.',
      },
      {
        id: 2,
        questionType: 'multiple_choice',
        question:
          'Trong cơ chế Định danh Khuôn mặt Liên tục (FaceVerificationGuard) chạy mỗi 5 giây bằng MobileFaceNet 192 chiều, chuyện gì xảy ra khi phát hiện 6 lần liên tiếp không có khuôn mặt (30 giây)?',
        options: [
          'Tự động tạm dừng video ngay lập tức, hiển thị hộp thoại FaceAbsenceOverlay và ghi log vi phạm',
          'Tự động nộp bài kiểm tra với điểm 0',
          'Giảm độ phân giải video xuống 240p',
          'Chỉ ghi log ngầm mà không dừng video',
        ],
        correctIndex: 0,
        explanation:
          'Sau 6 lần kiểm tra x 5 giây = 30 giây vắng mặt, trình phát tự động tạm dừng để đảm bảo tính trung thực của Điểm danh AI tự động.',
      },
      {
        id: 3,
        questionType: 'multiple_choice',
        question:
          'Chiến lược Truy hồi Ngữ cảnh 3 Tầng (3-Tier Retrieval Fallback) của Trợ lý Ảo khi tự động can thiệp tại giây thứ T hoạt động theo thứ tự ưu tiên nào?',
        options: [
          'Tầng 1: pgvector Cosine Similarity -> Tầng 2: Khớp mốc thời gian VideoSegment [start <= T <= end] -> Tầng 3: Cắt trực tiếp Transcript quanh [T - 120s, T + 30s]',
          'Tầng 1: Tìm kiếm Google -> Tầng 2: Hỏi giảng viên -> Tầng 3: Bỏ qua',
          'Chỉ dùng tìm kiếm từ khóa SQL LIKE đơn thuần',
          'Gửi toàn bộ video 2GB lên LLM trong mỗi câu hỏi',
        ],
        correctIndex: 0,
        explanation:
          'Kiến trúc 3 tầng đảm bảo AI luôn có ngữ cảnh bài giảng chính xác tại đúng giây học sinh bị bối rối ngay cả khi video mới tải lên chưa kịp tạo xong vector.',
      },
      {
        id: 4,
        questionType: 'multiple_choice',
        question:
          'Nếu học sinh trả lời sai câu hỏi kiểm tra cuối phân đoạn (SegmentQuizOverlay) 3 lần liên tiếp, trình phát thông minh sẽ xử lý như thế nào?',
        options: [
          'Tự động reset số lần thử và bắt buộc tua ngược video về đầu phân đoạn 5–7 phút đó (segment.startTimestamp) để học sinh xem lại',
          'Khóa tài khoản của học sinh trong 24 giờ',
          'Cho phép bỏ qua để xem tiếp phân đoạn sau',
          'Tự động hiện đáp án đúng và cộng đủ điểm',
        ],
        correctIndex: 0,
        explanation:
          'Quy tắc nắm vững kiến thức (Mastery Learning): sai 3 lần liên tiếp chứng tỏ học sinh chưa nắm được phân đoạn đó nên cần xem lại từ đầu phân đoạn.',
      },
    ],
  },
];

export const MOCK_TOPIC_SKILLS: TopicSkillStat[] = [
  {
    topic: 'MediaPipe 478 Landmarks & Gaze/EAR Tracking',
    totalAttempts: 12,
    averageScore: 88,
    skillLevel: 0.82,
    recommendedDifficulty: 'hard',
  },
  {
    topic: 'Mạng chuỗi thời gian BiLSTM & Temporal Attention',
    totalAttempts: 8,
    averageScore: 61,
    skillLevel: 0.54,
    recommendedDifficulty: 'medium',
  },
  {
    topic: 'Truy hồi Ngữ cảnh Đa phương thức pgvector RAG',
    totalAttempts: 9,
    averageScore: 79,
    skillLevel: 0.74,
    recommendedDifficulty: 'hard',
  },
  {
    topic: 'Tối ưu hóa Huấn luyện Focal Loss & Knowledge Distillation',
    totalAttempts: 5,
    averageScore: 34,
    skillLevel: 0.31,
    recommendedDifficulty: 'easy',
  },
];

export const MOCK_COMMENTS: DiscussionComment[] = [
  {
    id: 1,
    lessonId: 101,
    userId: 501,
    userName: 'PGS.TS. Trần Quang Minh',
    userRole: 'teacher',
    content:
      '[Thông báo Ghim] Các em chú ý ở phút [08:45] khi cài đặt tầng Temporal Attention: nhớ áp dụng mặt nạ (masking) cho các khung hình bị khuyết trước khi qua hàm Softmax để tổng trọng số alpha_t luôn bằng 1.0 nhé!',
    parentId: null,
    path: '1',
    depth: 0,
    upvotes: 42,
    downvotes: 0,
    isPinned: true,
    isAnswered: true,
    isTeacherResponse: true,
    videoTimestampSec: 525,
    createdAt: '2 ngày trước',
  },
  {
    id: 2,
    lessonId: 101,
    userId: 105,
    userName: 'Đặng Quốc Khánh',
    userRole: 'student',
    userMajor: 'KHMT-02-K66',
    content:
      'Thầy và các bạn cho mình hỏi: ở phút [03:45], tại sao ngưỡng phương sai độ mở mắt Var(EAR) < 0.002 lại giúp phân biệt được trạng thái nhìn đờ mắt do bối rối với trạng thái buồn ngủ (drowsiness) ạ?',
    parentId: null,
    path: '2',
    depth: 0,
    upvotes: 18,
    downvotes: 0,
    isPinned: false,
    isAnswered: true,
    isTeacherResponse: false,
    videoTimestampSec: 225,
    createdAt: '5 giờ trước',
  },
  {
    id: 3,
    lessonId: 101,
    userId: 501,
    userName: 'PGS.TS. Trần Quang Minh',
    userRole: 'teacher',
    content:
      '@Đặng Quốc Khánh Câu hỏi rất hay! Khi buồn ngủ, mắt nhắm dần nên trung bình EAR giảm thấp (< 0.18). Ngược lại, khi gặp công thức toán hoặc code phức tạp gây bối rối (Cognitive Load cao), mắt học sinh mở to (EAR > 0.22) nhưng phản xạ chớp mắt tự nhiên bị ức chế khiến phương sai Var(EAR) cực nhỏ (< 0.002) kèm theo đầu đứng yên (Gaze Stillness < 3.5px).',
    parentId: 2,
    path: '2/3',
    depth: 1,
    upvotes: 29,
    downvotes: 0,
    isPinned: false,
    isAnswered: true,
    isTeacherResponse: true,
    videoTimestampSec: 225,
    createdAt: '4 giờ trước',
  },
  {
    id: 4,
    lessonId: 101,
    userId: 101,
    userName: 'Nguyễn Minh Hiếu',
    userRole: 'student',
    userMajor: 'KHMT-01-K66',
    content:
      'Dạ em cảm ơn thầy @PGS.TS. Trần Quang Minh! Em vừa thử bấm nút chụp màn hình đoạn code ở phút [10:30] gửi sang AI Tutor chế độ Socrates, trợ lý cũng gợi mở đúng ý này luôn ạ.',
    parentId: 3,
    path: '2/3/4',
    depth: 2,
    upvotes: 11,
    downvotes: 0,
    isPinned: false,
    isAnswered: true,
    isTeacherResponse: false,
    videoTimestampSec: 630,
    createdAt: '2 giờ trước',
  },
];

export const MOCK_ROADMAP_NODES: RoadmapNodeItem[] = [
  {
    id: 'n1',
    title: 'Nền tảng Đại số Tuyến tính & Xác suất Thống kê cho AI',
    description: 'Không gian vector, trị riêng, chuẩn L2, khoảng cách Cosine và phân phối xác suất.',
    nodeType: 'milestone',
    status: 'completed',
    semester: 1,
    credits: 3,
    courseType: 'required',
  },
  {
    id: 'n2',
    title: 'Cấu trúc Dữ liệu & Giải thuật Nâng cao (IT3011)',
    description: 'Đồ thị có hướng không chu trình (DAG), Quy hoạch động, Cây tìm kiếm và Tối ưu hóa.',
    nodeType: 'lesson',
    status: 'completed',
    lessonId: 201,
    semester: 2,
    credits: 4,
    courseType: 'required',
  },
  {
    id: 'n3',
    title: 'Học sâu & Thị giác Máy tính Thời gian thực (IT4409)',
    description: 'MediaPipe 478 Landmarks, MobileFaceNet 192-d, BiLSTM-Attention & ONNX Runtime Web.',
    nodeType: 'lesson',
    status: 'in_progress',
    lessonId: 101,
    semester: 3,
    credits: 3,
    courseType: 'required',
  },
  {
    id: 'n4',
    title: 'Xử lý Ngôn ngữ Tự nhiên & Hệ thống Đa phương thức RAG (IT4772)',
    description: 'Whisper Speech-to-Text, Vector Database pgvector, 3-Tier Retrieval & Multi-Modal Vision LLM.',
    nodeType: 'checkpoint',
    status: 'in_progress',
    lessonId: 103,
    semester: 3,
    credits: 3,
    courseType: 'elective',
    aiRecommended: true,
    aiReason: 'Gợi ý hàng đầu bởi AI: Kết hợp trực tiếp với IT4409 để hoàn thiện hệ thống Gia sư Ảo Đa phương thức.',
  },
  {
    id: 'n5',
    title: 'Kiến trúc Hệ thống Phân tán với GoFrame v2 & pgqueue (IT4593)',
    description: 'Xây dựng API hiệu năng cao, WebSocket thời gian thực và hàng đợi xử lý video FFmpeg.',
    nodeType: 'lesson',
    status: 'in_progress',
    lessonId: 301,
    semester: 4,
    credits: 3,
    courseType: 'elective',
    aiRecommended: true,
    aiReason: 'Giúp triển khai mô hình ML/ONNX và dịch vụ RAG chịu tải hàng nghìn kết nối đồng thời.',
  },
  {
    id: 'n6',
    title: 'Đồ án Tốt nghiệp / NCKH: Hệ thống LMS Phát hiện Bối rối & Gia sư AI Thông minh',
    description: 'Tích hợp toàn diện Computer Vision + Multimodal 12-Feature Predictor + Proactive AI Tutor.',
    nodeType: 'milestone',
    status: 'locked',
    semester: 4,
    credits: 6,
    courseType: 'required',
  },
];

export const MOCK_ROADMAP_EDGES: RoadmapEdgeItem[] = [
  { from: 'n1', to: 'n2', type: 'required' },
  { from: 'n1', to: 'n3', type: 'required' },
  { from: 'n2', to: 'n3', type: 'required' },
  { from: 'n3', to: 'n4', type: 'required' },
  { from: 'n2', to: 'n5', type: 'optional' },
  { from: 'n3', to: 'n6', type: 'required' },
  { from: 'n4', to: 'n6', type: 'required' },
  { from: 'n5', to: 'n6', type: 'optional' },
];

export const MOCK_AT_RISK_STUDENTS: AtRiskStudentItem[] = [
  {
    studentId: 204,
    fullName: 'Trần Quốc Tuấn',
    studentCode: '20215489',
    studentClass: 'KHMT-02-K66',
    courseTitle: 'Học sâu & Thị giác Máy tính Thời gian thực (IT4409)',
    progressPercent: 32,
    confusionEpisodesCount: 11,
    unresolvedConfusionCount: 6,
    avgQuizScore: 45,
    daysInactive: 5,
    riskLevel: 'high',
    riskReason: 'Kích hoạt 11 đợt bối rối ở Phân đoạn 2 (Temporal Attention), tua lại 14 lần và nghỉ học 5 ngày.',
  },
  {
    studentId: 209,
    fullName: 'Phạm Hoàng Yến',
    studentCode: '20215512',
    studentClass: 'KHMT-01-K66',
    courseTitle: 'Học sâu & Thị giác Máy tính Thời gian thực (IT4409)',
    progressPercent: 48,
    confusionEpisodesCount: 7,
    unresolvedConfusionCount: 3,
    avgQuizScore: 55,
    daysInactive: 3,
    riskLevel: 'medium',
    riskReason: 'Thời lượng xem video buổi gần nhất chỉ đạt 62% (< 80% chuẩn Điểm danh AI), sai Quiz phân đoạn 3 lần.',
  },
  {
    studentId: 215,
    fullName: 'Ngô Đức Anh',
    studentCode: '20215377',
    studentClass: 'KTPM-01-K66',
    courseTitle: 'Kiến trúc Backend Hiệu năng Cao với Go & pgvector (IT4593)',
    progressPercent: 28,
    confusionEpisodesCount: 8,
    unresolvedConfusionCount: 4,
    avgQuizScore: 50,
    daysInactive: 6,
    riskLevel: 'high',
    riskReason: 'Vắng mặt trên camera > 30s hai lần liên tiếp và chưa nộp Bài tập thực hành số 2.',
  },
];

export const MOCK_DISCUSSIONS = MOCK_COMMENTS;
export const MOCK_SCHEDULE = MOCK_SCHEDULES;

export interface DirectMessageThread {
  id: number;
  partnerName: string;
  partnerRole: string;
  unread: number;
  lastMessage: string;
  messages: { id: number; sender: 'me' | 'partner'; text: string; time: string }[];
}

export const MOCK_DIRECT_MESSAGES: DirectMessageThread[] = [
  {
    id: 1,
    partnerName: 'PGS.TS. Trần Quang Minh',
    partnerRole: 'Giảng viên phụ trách IT4409 · Khoa KHMT',
    unread: 1,
    lastMessage:
      'Thầy thấy hệ thống ghi nhận em vượt qua rất tốt phân đoạn Temporal Attention và đạt 94/100 điểm AI Rubric bài thực hành số 2!',
    messages: [
      {
        id: 101,
        sender: 'partner',
        text: 'Chào Hiếu, tuần này ở Phân đoạn 2 (mốc 09:10) nhiều bạn trong lớp gặp khó khăn với công thức Softmax Attention. Em có câu hỏi nào cần thầy giải đáp thêm không?',
        time: 'Hôm qua · 16:20',
      },
      {
        id: 102,
        sender: 'me',
        text: 'Dạ em chào thầy ạ! Lúc xem đến mốc 09:10 hệ thống nhận diện bối rối và tự động bật AI Tutor giải thích kèm ví dụ PyTorch rất trực quan nên em đã nắm vững cách tính trọng số alpha_t rồi ạ.',
        time: 'Hôm qua · 16:45',
      },
      {
        id: 103,
        sender: 'partner',
        text: 'Thầy thấy hệ thống ghi nhận em vượt qua rất tốt phân đoạn Temporal Attention và đạt 94/100 điểm AI Rubric bài thực hành số 2!',
        time: 'Hôm nay · 09:15',
      },
    ],
  },
  {
    id: 2,
    partnerName: 'TS. Nguyễn Thu Trang',
    partnerRole: 'Giảng viên hướng dẫn Xử lý Ngôn ngữ Tự nhiên & RAG',
    unread: 0,
    lastMessage: 'Em nhớ kiểm tra kỹ chiều vector 1536-d khi truy vấn HNSW trên pgvector nhé.',
    messages: [
      {
        id: 201,
        sender: 'partner',
        text: 'Em nhớ kiểm tra kỹ chiều vector 1536-d khi truy vấn HNSW trên pgvector nhé.',
        time: '2 ngày trước',
      },
    ],
  },
];

export const MOCK_SPECIALIZATIONS: SpecializationItem[] = [
  {
    id: 1,
    title: 'Chuyên ngành AI & Thị giác Máy tính Toàn diện (Computer Vision, DAG & Multi-Modal RAG Specialization)',
    slug: 'ai-computer-vision-multimodal-rag-specialization',
    subtitle: 'Chuỗi 3 học phần liên thông tích hợp Đồ án Tổng hợp Capstone (10 tín chỉ)',
    description:
      'Lộ trình chuyên ngành chuẩn Coursera dẫn dắt sinh viên từ nền tảng Thị giác Máy tính 478 điểm mốc 3D (Khóa 1), Giải thuật Đồ thị Lộ trình Học tập DAG (Khóa 2) đến Kiến trúc Backend & Hệ thống Gia sư Ảo Đa phương thức RAG (Khóa 3 Capstone).',
    level: 'advanced',
    totalCredits: 10,
    estimatedMonths: 4,
    enrolledCount: 284,
    isEnrolled: true,
    overallProgressPercent: 65,
    courseIds: [1, 2, 3],
    capstoneProject: {
      title: 'Đồ án Tổng hợp Capstone: Xây dựng Hệ thống Phát hiện Bối rối Đa phương thức & Trợ lý AI RAG Thời gian thực',
      description:
        'Kết hợp mô hình MediaPipe 478 Landmarks + BiLSTM Attention trên trình duyệt với dịch vụ truy hồi 3 tầng pgvector và đánh giá thực nghiệm Ablation Study.',
      deliverables: [
        '1. Pipeline suy luận thời gian thực trên trình duyệt (Real Luminance + 478 Landmarks + 192-d Cosine)',
        '2. Dịch vụ Backend GoFrame v2 + PostgreSQL pgvector 1536 chiều & Hàng đợi pgqueue',
        '3. Báo cáo Thực nghiệm Đối chứng 5 biến thể mô hình trên tập dữ liệu DAiSEE',
      ],
      status: 'in_progress',
    },
  },
];

export const MOCK_COURSE_GRADEBOOKS: Record<number, CourseGradebook> = {
  1: {
    courseId: 1,
    passingThreshold: 75,
    overallWeightedScore: 88.4,
    categoryWeights: {
      segment_quiz: 20,
      module_quiz: 30,
      coding_lab: 25,
      final_assignment: 25,
    },
    items: [
      {
        id: 'gb-1-1',
        title: 'In-Video Segment Quizzes: Chương 1 & Chương 2 (7 phân đoạn 5–7 phút)',
        category: 'segment_quiz',
        categoryLabel: 'In-Video Segment Quizzes (20%)',
        weightPercent: 20,
        score: 92,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-24 23:59',
        lessonId: 101,
        honorCodeAccepted: true,
      },
      {
        id: 'gb-1-2',
        title: 'Adaptive Module Quiz: Mô hình Đa phương thức 12 Đặc trưng & Vision RAG',
        category: 'module_quiz',
        categoryLabel: 'Adaptive Module Quizzes (30%)',
        weightPercent: 30,
        score: 85,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-26 23:59',
        lessonId: 107,
        similarityScore: 2.1,
        honorCodeAccepted: true,
      },
      {
        id: 'gb-1-3',
        title: 'Coding Lab #1: Cài đặt Thuật toán Tính EAR, Eye-Lock & Phân loại Bối rối',
        category: 'coding_lab',
        categoryLabel: 'Coding Labs (25%)',
        weightPercent: 25,
        score: 84,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-27 23:59',
        lessonId: 105,
        similarityScore: 3.8,
        honorCodeAccepted: true,
      },
      {
        id: 'gb-1-4',
        title: 'Final Rubric Assignment: Huấn luyện BiLSTM + Temporal Attention & Ablation Study',
        category: 'final_assignment',
        categoryLabel: 'Final Rubric Assignment (25%)',
        weightPercent: 25,
        score: 94,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-25 23:59',
        lessonId: 101,
        similarityScore: 4.2,
        honorCodeAccepted: true,
      },
    ],
  },
  2: {
    courseId: 2,
    passingThreshold: 75,
    overallWeightedScore: 86.5,
    categoryWeights: {
      segment_quiz: 20,
      module_quiz: 30,
      coding_lab: 25,
      final_assignment: 25,
    },
    items: [
      {
        id: 'gb-2-1',
        title: 'In-Video Segment Quizzes: Đồ thị DAG, Kahn & Segment Tree',
        category: 'segment_quiz',
        categoryLabel: 'In-Video Segment Quizzes (20%)',
        weightPercent: 20,
        score: 95,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-26 23:59',
        lessonId: 201,
        honorCodeAccepted: true,
      },
      {
        id: 'gb-2-2',
        title: 'Adaptive Module Quiz: Độ phức tạp Thuật toán & Quy hoạch Động trên DAG',
        category: 'module_quiz',
        categoryLabel: 'Adaptive Module Quizzes (30%)',
        weightPercent: 30,
        score: 88,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-28 23:59',
        lessonId: 201,
        similarityScore: 1.9,
        honorCodeAccepted: true,
      },
      {
        id: 'gb-2-3',
        title: 'Coding Lab #2: Cài đặt Sắp xếp Tô-pô & Phát hiện Chu trình Tiên quyết',
        category: 'coding_lab',
        categoryLabel: 'Coding Labs (25%)',
        weightPercent: 25,
        score: 80,
        maxScore: 100,
        status: 'in_progress',
        dueDate: '2026-10-29 23:59',
        lessonId: 203,
        similarityScore: 5.1,
        honorCodeAccepted: true,
      },
      {
        id: 'gb-2-4',
        title: 'Final Rubric Assignment: Tối ưu Truy vấn Cây Thảo luận Materialized Path',
        category: 'final_assignment',
        categoryLabel: 'Final Rubric Assignment (25%)',
        weightPercent: 25,
        score: 84,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-30 23:59',
        lessonId: 202,
        similarityScore: 3.4,
        honorCodeAccepted: true,
      },
    ],
  },
  3: {
    courseId: 3,
    passingThreshold: 75,
    overallWeightedScore: 68.0,
    categoryWeights: {
      segment_quiz: 20,
      module_quiz: 30,
      coding_lab: 25,
      final_assignment: 25,
    },
    items: [
      {
        id: 'gb-3-1',
        title: 'In-Video Segment Quizzes: Hàng đợi Bất đồng bộ FOR UPDATE SKIP LOCKED',
        category: 'segment_quiz',
        categoryLabel: 'In-Video Segment Quizzes (20%)',
        weightPercent: 20,
        score: 85,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-22 23:59',
        lessonId: 301,
        honorCodeAccepted: true,
      },
      {
        id: 'gb-3-2',
        title: 'Adaptive Module Quiz: Kiến trúc Clean Architecture GoFrame v2 & pgvector',
        category: 'module_quiz',
        categoryLabel: 'Adaptive Module Quizzes (30%)',
        weightPercent: 30,
        score: 75,
        maxScore: 100,
        status: 'passed',
        dueDate: '2026-10-24 23:59',
        lessonId: 301,
        similarityScore: 3.0,
        honorCodeAccepted: true,
      },
      {
        id: 'gb-3-3',
        title: 'Coding Lab #3: Chuẩn hóa Vector L2 & Tính Điểm Tương đồng Cosine',
        category: 'coding_lab',
        categoryLabel: 'Coding Labs (25%)',
        weightPercent: 25,
        score: null,
        maxScore: 100,
        status: 'overdue',
        dueDate: '2026-10-22 23:59',
        lessonId: 303,
      },
      {
        id: 'gb-3-4',
        title: 'Final Rubric Assignment: Thiết kế Worker Xử lý Video FFmpeg & Whisper STT',
        category: 'final_assignment',
        categoryLabel: 'Final Rubric Assignment (25%)',
        weightPercent: 25,
        score: 70,
        maxScore: 100,
        status: 'in_progress',
        dueDate: '2026-10-28 23:59',
        lessonId: 302,
        similarityScore: 6.4,
        honorCodeAccepted: true,
      },
    ],
  },
};

export const MOCK_CODING_CHALLENGES: CodingChallengeItem[] = [
  {
    id: 1,
    courseId: 1,
    lessonId: 105,
    title: 'Lab 1: Tính Tỷ lệ Mở mắt EAR, Hệ số Eye-Lock & Phân loại Bối rối Đa phương thức',
    difficulty: 'medium',
    problemStatement:
      'Cho độ mở mắt trung bình earAvg, phương sai độ mở mắt earVar trong 10 khung hình, độ dịch chuyển đỉnh mũi noseDriftPx và điểm nhíu mày au4BrowFurrow. Hãy tính hệ số khuếch đại ánh nhìn gazeBoost (bằng 1.6 nếu earAvg > 0.22, earVar < 0.002 và noseDriftPx < 3.5; bằng 1.3 nếu chỉ thỏa mãn noseDriftPx < 3.5; ngược lại bằng 1.0) và xác định trạng thái bối rối isConfused (true nếu au4BrowFurrow * gazeBoost >= 0.65).',
    constraints: [
      '0.05 <= earAvg <= 0.45 (Số thực làm tròn 2 chữ số thập phân)',
      '0.0001 <= earVar <= 0.0500, 0.0 <= noseDriftPx <= 50.0',
      'Thời gian thực thi mỗi Test Case <= 50ms, độ phức tạp O(1)',
    ],
    keyFormula:
      'eyeLocked = (earAvg > 0.22) && (earVar < 0.002) && (noseDriftPx < 3.5) => gazeBoost = 1.6; confusedScore = au4BrowFurrow * gazeBoost',
    starterCode: {
      python: `def evaluate_eye_lock_confusion(ear_avg: float, ear_var: float, nose_drift_px: float, au4_brow: float) -> dict:
    # 1. Kiểm tra điều kiện Gaze Stillness và Eye-Lock
    gaze_still = nose_drift_px < 3.5
    eye_locked = gaze_still and (ear_avg > 0.22) and (ear_var < 0.002)
    
    # 2. Tính hệ số khuếch đại gaze_boost
    gaze_boost = 1.6 if eye_locked else (1.3 if gaze_still else 1.0)
    
    # 3. Tính điểm bối rối có trọng số ánh nhìn
    weighted_score = round(au4_brow * gaze_boost, 3)
    return {
        "gazeBoost": gaze_boost,
        "eyeLocked": eye_locked,
        "isConfused": weighted_score >= 0.65
    }`,
      typescript: `export function evaluateEyeLockConfusion(
  earAvg: number,
  earVar: number,
  noseDriftPx: number,
  au4Brow: number
) {
  const gazeStill = noseDriftPx < 3.5;
  const eyeLocked = gazeStill && earAvg > 0.22 && earVar < 0.002;
  const gazeBoost = eyeLocked ? 1.6 : gazeStill ? 1.3 : 1.0;
  const weightedScore = Number((au4Brow * gazeBoost).toFixed(3));
  return {
    gazeBoost,
    eyeLocked,
    isConfused: weightedScore >= 0.65,
  };
}`,
      go: `package cv

func EvaluateEyeLockConfusion(earAvg, earVar, noseDriftPx, au4Brow float64) (float64, bool, bool) {
	gazeStill := noseDriftPx < 3.5
	eyeLocked := gazeStill && earAvg > 0.22 && earVar < 0.002
	gazeBoost := 1.0
	if eyeLocked {
		gazeBoost = 1.6
	} else if gazeStill {
		gazeBoost = 1.3
	}
	isConfused := (au4Brow * gazeBoost) >= 0.65
	return gazeBoost, eyeLocked, isConfused
}`,
    },
    testCases: [
      {
        id: 1,
        name: 'Test Case #1: Học sinh đờ mắt nhìn công thức khó (Eye-Lock + AU4 cao)',
        input: 'earAvg=0.25, earVar=0.0012, noseDriftPx=1.9, au4Brow=0.48',
        expectedOutput: '{ gazeBoost: 1.6, eyeLocked: true, isConfused: true }',
        isPublic: true,
      },
      {
        id: 2,
        name: 'Test Case #2: Học sinh tập trung bình thường (Chớp mắt tự nhiên)',
        input: 'earAvg=0.27, earVar=0.0045, noseDriftPx=6.2, au4Brow=0.18',
        expectedOutput: '{ gazeBoost: 1.0, eyeLocked: false, isConfused: false }',
        isPublic: true,
      },
      {
        id: 3,
        name: 'Test Case #3: Đầu giữ yên nhưng mắt chớp bình thường (Gaze Still only)',
        input: 'earAvg=0.26, earVar=0.0038, noseDriftPx=2.4, au4Brow=0.52',
        expectedOutput: '{ gazeBoost: 1.3, eyeLocked: false, isConfused: true }',
        isPublic: true,
      },
      {
        id: 4,
        name: 'Test Case #4 (Hidden Edge Case): Mắt nhắm do buồn ngủ (EAR < 0.22)',
        input: 'earAvg=0.16, earVar=0.0011, noseDriftPx=1.5, au4Brow=0.30',
        expectedOutput: '{ gazeBoost: 1.3, eyeLocked: false, isConfused: false }',
        isPublic: false,
      },
    ],
    aiHint:
      'Gợi ý từ AI Tutor: Hãy kiểm tra kỹ thứ tự ưu tiên giữa `eye_locked` (cần đồng thời cả 3 điều kiện: `nose_drift_px < 3.5`, `ear_avg > 0.22` và `ear_var < 0.002`) trước khi xét trường hợp chỉ có `gaze_still` (`nose_drift_px < 3.5`). Nhớ nhân `au4_brow * gaze_boost` trước khi so sánh với ngưỡng `0.65`!',
  },
  {
    id: 2,
    courseId: 2,
    lessonId: 203,
    title: 'Lab 2: Thuật toán Kahn Sắp xếp Tô-pô & Phát hiện Chu trình Tiên quyết trên Đồ thị DAG',
    difficulty: 'medium',
    problemStatement:
      'Cho đồ thị có hướng gồm n môn học (đánh số 0..n-1) và danh sách các cạnh điều kiện tiên quyết [u, v] (môn u phải học trước môn v). Hãy cài đặt thuật toán Kahn sử dụng hàng đợi các đỉnh có bán bậc vào bằng 0 để trả về thứ tự học hợp lệ, hoặc trả về mảng rỗng [] nếu đồ thị chứa chu trình.',
    constraints: [
      '1 <= n <= 10^4, 0 <= edges.length <= 5 * 10^4',
      'Độ phức tạp thời gian: O(V + E), không gian: O(V + E)',
    ],
    keyFormula: 'inDegree[v] == 0 => push(queue, v); isDAG = (topoOrder.length === n)',
    starterCode: {
      python: `from collections import deque

def topological_sort_kahn(n: int, edges: list[tuple[int, int]]) -> list[int]:
    indeg = [0] * n
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        indeg[v] += 1
    q = deque([i for i in range(n) if indeg[i] == 0])
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for nxt in adj[u]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                q.append(nxt)
    return order if len(order) == n else []`,
      typescript: `export function topologicalSortKahn(n: number, edges: [number, number][]): number[] {
  const indeg = new Array(n).fill(0);
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    indeg[v]++;
  }
  const queue: number[] = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i);
  const order: number[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);
    for (const nxt of adj[u]) {
      if (--indeg[nxt] === 0) queue.push(nxt);
    }
  }
  return order.length === n ? order : [];
}`,
      go: `package dag

func TopologicalSortKahn(n int, edges [][2]int) []int {
	indeg := make([]int, n)
	adj := make([][]int, n)
	for _, e := range edges {
		adj[e[0]] = append(adj[e[0]], e[1])
		indeg[e[1]]++
	}
	q := []int{}
	for i := 0; i < n; i++ {
		if indeg[i] == 0 {
			q = append(q, i)
		}
	}
	order := []int{}
	for len(q) > 0 {
		u := q[0]
		q = q[1:]
		order = append(order, u)
		for _, nxt := range adj[u] {
			indeg[nxt]--
			if indeg[nxt] == 0 {
				q = append(q, nxt)
			}
		}
	}
	if len(order) != n {
		return []int{}
	}
	return order
}`,
    },
    testCases: [
      {
        id: 1,
        name: 'Test Case #1: Đồ thị lộ trình 4 môn chuẩn DAG',
        input: 'n=4, edges=[[0,1],[0,2],[1,3],[2,3]]',
        expectedOutput: '[0, 1, 2, 3]',
        isPublic: true,
      },
      {
        id: 2,
        name: 'Test Case #2: Đồ thị có chu trình phụ thuộc vòng tròn (0 -> 1 -> 2 -> 0)',
        input: 'n=3, edges=[[0,1],[1,2],[2,0]]',
        expectedOutput: '[] (Phát hiện chu trình)',
        isPublic: true,
      },
      {
        id: 3,
        name: 'Test Case #3: Các môn học độc lập không có cạnh phụ thuộc',
        input: 'n=3, edges=[]',
        expectedOutput: '[0, 1, 2]',
        isPublic: true,
      },
      {
        id: 4,
        name: 'Test Case #4 (Hidden): Chuỗi phụ thuộc tuyến tính 5 học phần',
        input: 'n=5, edges=[[0,1],[1,2],[2,3],[3,4]]',
        expectedOutput: '[0, 1, 2, 3, 4]',
        isPublic: false,
      },
    ],
    aiHint:
      'Gợi ý từ AI Tutor: Đừng quên kiểm tra điều kiện `len(order) == n` ở cuối hàm! Nếu đồ thị chứa một chu trình con tách biệt, vòng lặp `while` sẽ kết thúc sớm khi hàng đợi rỗng nhưng số đỉnh lấy ra nhỏ hơn `n`.',
  },
  {
    id: 3,
    courseId: 3,
    lessonId: 303,
    title: 'Lab 3: Chuẩn hóa Vector L2 & Tính Tương đồng Cosine cho pgvector / Sinh trắc học',
    difficulty: 'easy',
    problemStatement:
      'Cho hai vector thực u và v cùng số chiều d. Hãy chuẩn hóa L2 cả hai vector về độ dài đơn vị ||u||_2 = 1 và tính độ tương đồng Cosine giữa chúng, đồng thời kiểm tra xem có đạt ngưỡng xác thực >= 0.60 hay không.',
    constraints: [
      '1 <= d <= 1536, tổng bình phương các phần tử > 0',
      'Làm tròn độ tương đồng Cosine đến 4 chữ số thập phân',
    ],
    keyFormula: 'cos(u, v) = (u · v) / (||u||_2 * ||v||_2)',
    starterCode: {
      python: `import math

def verify_cosine_similarity(u: list[float], v: list[float], threshold: float = 0.60) -> dict:
    dot = sum(a * b for a, b in zip(u, v))
    norm_u = math.sqrt(sum(a * a for a in u)) or 1e-9
    norm_v = math.sqrt(sum(b * b for b in v)) or 1e-9
    sim = round(dot / (norm_u * norm_v), 4)
    return {"similarity": sim, "verified": sim >= threshold}`,
      typescript: `export function verifyCosineSimilarity(u: number[], v: number[], threshold = 0.6) {
  let dot = 0, normU = 0, normV = 0;
  for (let i = 0; i < u.length; i++) {
    dot += u[i] * v[i];
    normU += u[i] * u[i];
    normV += v[i] * v[i];
  }
  const sim = Number((dot / (Math.sqrt(normU || 1e-9) * Math.sqrt(normV || 1e-9))).toFixed(4));
  return { similarity: sim, verified: sim >= threshold };
}`,
      go: `package vector

import "math"

func VerifyCosineSimilarity(u, v []float64, threshold float64) (float64, bool) {
	var dot, normU, normV float64
	for i := range u {
		dot += u[i] * v[i]
		normU += u[i] * u[i]
		normV += v[i] * v[i]
	}
	sim := dot / (math.Sqrt(normU) * math.Sqrt(normV))
	return sim, sim >= threshold
}`,
    },
    testCases: [
      {
        id: 1,
        name: 'Test Case #1: Hai vector khuôn mặt cùng một sinh viên (Góc thẳng & nghiêng nhẹ)',
        input: 'u=[0.8, 0.6, 0.0], v=[0.75, 0.65, 0.1]',
        expectedOutput: '{ similarity: 0.9923, verified: true }',
        isPublic: true,
      },
      {
        id: 2,
        name: 'Test Case #2: Hai vector trực giao (Người lạ khác biệt hoàn toàn)',
        input: 'u=[1.0, 0.0, 0.0], v=[0.0, 1.0, 0.0]',
        expectedOutput: '{ similarity: 0.0000, verified: false }',
        isPublic: true,
      },
      {
        id: 3,
        name: 'Test Case #3: Vector phóng đại tỷ lệ (Kiểm tra tính bất biến chuẩn hóa L2)',
        input: 'u=[1.0, 2.0, 2.0], v=[5.0, 10.0, 10.0]',
        expectedOutput: '{ similarity: 1.0000, verified: true }',
        isPublic: true,
      },
      {
        id: 4,
        name: 'Test Case #4 (Hidden): Ngưỡng biên xác thực 0.60',
        input: 'u=[0.6, 0.8, 0.0], v=[1.0, 0.0, 0.0]',
        expectedOutput: '{ similarity: 0.6000, verified: true }',
        isPublic: false,
      },
    ],
    aiHint:
      'Gợi ý từ AI Tutor: Nhớ chia tích vô hướng `dot` cho tích độ dài Euclid `sqrt(normU) * sqrt(normV)` để kết quả bất biến với độ lớn của vector!',
  },
];


