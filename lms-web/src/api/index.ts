import { apiFetch } from './client';
import {
  MOCK_ASSIGNMENTS,
  MOCK_AT_RISK_STUDENTS,
  MOCK_CODING_CHALLENGES,
  MOCK_COMMENTS,
  MOCK_COURSE_GRADEBOOKS,
  MOCK_COURSES,
  MOCK_DAILY_ATTENDANCE,
  MOCK_QUIZZES,
  MOCK_ROADMAP_EDGES,
  MOCK_ROADMAP_NODES,
  MOCK_SCHEDULES,
  MOCK_SPECIALIZATIONS,
  MOCK_STUDENT_PROFILE,
  MOCK_TASKS,
  MOCK_TOPIC_SKILLS,
} from './mockData';
import type {
  CodingChallengeItem,
  CodingTestCaseResult,
  ConfusionExplanationResult,
  CourseGradebook,
  CourseItem,
  LessonItem,
  MultimodalFeatures12,
  SpecializationItem,
  TutorPersona,
} from './types';

export interface ConfusionPredictResult {
  status: 'ok' | 'indeterminate';
  level: 'none' | 'mild' | 'moderate' | 'high' | 'unknown';
  triggerSource: 'sp_bef' | 'indeterminate' | string;
  isConfused: boolean;
  shouldIntervene: boolean;
  probability: number | null;
  posteriorProb?: number | null;
  priorProb?: number | null;
  llrFace?: number;
  llrBeh?: number;
  llrQuiz?: number;
  rFace?: number;
  rBeh?: number;
  rQuiz?: number;
  contribFace?: number;
  contribBeh?: number;
  contribQuiz?: number;
  segmentPrior?: number;
}

export const INDETERMINATE_PREDICTION_STATE: ConfusionPredictResult = {
  status: 'indeterminate',
  level: 'unknown',
  triggerSource: 'indeterminate',
  isConfused: false,
  shouldIntervene: false,
  probability: null,
  posteriorProb: null,
  priorProb: null,
};

export const lmsApi = {
  getProfile: () => apiFetch('/v1/user/profile', { method: 'GET' }, MOCK_STUDENT_PROFILE),

  saveFaceEmbedding: (payload: {
    pose: 'front' | 'left' | 'right';
    embedding: number[];
    headYawDeg: number;
    headPitchDeg?: number;
  }) =>
    apiFetch(
      '/v1/student/face-embedding',
      { method: 'POST', body: JSON.stringify(payload) },
      {
        saved: true,
        pose: payload.pose,
        dimensions: payload.embedding.length,
        l2Normalized: true,
        updatedAt: new Date().toISOString(),
      },
    ),

  registerFaceEmbeddings: (payload: {
    front: number[];
    left: number[];
    right: number[];
  }) =>
    apiFetch(
      '/v1/student/face-embedding',
      { method: 'POST', body: JSON.stringify(payload) },
      { registered: true, dimensions: 192, poses: ['front', 'left', 'right'], updatedAt: new Date().toISOString() },
    ),

  logFaceViolation: (payload: {
    lessonId: number;
    violationType: 'face_absent_30s' | 'identity_mismatch';
    videoTimestampSec: number;
    similarityScore: number;
  }) =>
    apiFetch(
      '/v1/student/face/violation',
      { method: 'POST', body: JSON.stringify(payload) },
      { logged: true, id: Date.now() },
    ),

  getCourses: () => apiFetch<CourseItem[]>('/v1/public/courses', { method: 'GET' }, MOCK_COURSES),

  getCourseById: (id: number) =>
    apiFetch<CourseItem>(
      `/v1/public/courses/${id}`,
      { method: 'GET' },
      () => MOCK_COURSES.find((c) => c.id === id) || MOCK_COURSES[0],
    ),

  getLessonById: (lessonId: number): Promise<LessonItem> =>
    apiFetch<LessonItem>(`/v1/student/lessons/${lessonId}`, { method: 'GET' }, () => {
      for (const c of MOCK_COURSES) {
        for (const m of c.modules) {
          const found = m.lessons.find((l) => l.id === lessonId);
          if (found) return found;
        }
      }
      return MOCK_COURSES[0].modules[0].lessons[0];
    }),

  markLessonCompleted: (lessonId: number) =>
    apiFetch(
      `/v1/student/lessons/${lessonId}/complete`,
      { method: 'POST', body: JSON.stringify({ lessonId, completedAt: new Date().toISOString() }) },
      { lessonId, completed: true, completedAt: new Date().toISOString() },
    ),

  getCourseGradebook: (courseId: number): Promise<CourseGradebook> =>
    apiFetch<CourseGradebook>(
      `/v1/student/courses/${courseId}/gradebook`,
      { method: 'GET' },
      () => MOCK_COURSE_GRADEBOOKS[courseId] || MOCK_COURSE_GRADEBOOKS[1],
    ),

  getSpecializations: (): Promise<SpecializationItem[]> =>
    apiFetch<SpecializationItem[]>('/v1/public/specializations', { method: 'GET' }, MOCK_SPECIALIZATIONS),

  enrollSpecialization: (specId: number) =>
    apiFetch(
      `/v1/student/specializations/${specId}/enroll`,
      { method: 'POST', body: JSON.stringify({ specializationId: specId }) },
      { enrolled: true, specializationId: specId, enrolledAt: new Date().toISOString() },
    ),

  resetCourseDeadlines: (courseId: number) =>
    apiFetch(
      `/v1/student/courses/${courseId}/reset-deadlines`,
      { method: 'POST', body: JSON.stringify({ courseId, shiftDays: 14 }) },
      () => {
        const nextDate = new Date(Date.now() + 14 * 86400 * 1000).toISOString().slice(0, 10) + ' 23:59';
        return {
          courseId,
          reset: true,
          newDeadlineDate: nextDate,
          message: `Đã tự động dời toàn bộ hạn nộp các chương và bài tập của học phần sang ${nextDate} (Không trừ điểm trễ hạn).`,
        };
      },
    ),

  getCodingChallenge: (challengeId: number): Promise<CodingChallengeItem> =>
    apiFetch<CodingChallengeItem>(
      `/v1/student/coding/${challengeId}`,
      { method: 'GET' },
      () => MOCK_CODING_CHALLENGES.find((c) => c.id === challengeId) || MOCK_CODING_CHALLENGES[0],
    ),

  runCodingPublicTests: (payload: {
    challengeId: number;
    language: 'python' | 'typescript' | 'go';
    code: string;
  }) =>
    apiFetch<{
      results: CodingTestCaseResult[];
      passedCount: number;
      totalCount: number;
      aiFeedback: string;
    }>(
      '/v1/student/coding/run',
      { method: 'POST', body: JSON.stringify(payload) },
      () => {
        const ch = MOCK_CODING_CHALLENGES.find((c) => c.id === payload.challengeId) || MOCK_CODING_CHALLENGES[0];
        const publicTests = ch.testCases.filter((tc) => tc.isPublic);
        const hasIntentionalBug = payload.code.includes('TODO_FAIL') || payload.code.trim().length < 25;
        const results: CodingTestCaseResult[] = publicTests.map((tc, idx) => {
          const passed = !hasIntentionalBug || idx === 0;
          return {
            id: tc.id,
            name: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: passed ? tc.expectedOutput : 'Output mismatch (Chưa xử lý điều kiện biên)',
            runtimeMs: 4 + idx * 3,
            passed,
          };
        });
        const passedCount = results.filter((r) => r.passed).length;
        return {
          results,
          passedCount,
          totalCount: results.length,
          aiFeedback:
            passedCount === results.length
              ? `Cả ${passedCount}/${results.length} Public Test Cases đều vượt qua xuất sắc với thời gian thực thi trung bình 6.5ms! Bạn có thể tích chọn Cam kết Danh dự Học thuật và bấm "Nộp bài chấm điểm" để chạy toàn bộ Hidden Test Cases.`
              : 'Một số Public Test Cases chưa khớp. Hãy kiểm tra lại điều kiện ngưỡng biên theo gợi ý của AI Tutor.',
        };
      },
    ),

  submitCodingAllTests: (payload: {
    challengeId: number;
    language: 'python' | 'typescript' | 'go';
    code: string;
    honorCodeAccepted: boolean;
  }) =>
    apiFetch<{
      results: CodingTestCaseResult[];
      passedCount: number;
      totalCount: number;
      score: number;
      similarityScore: number;
      honorCodeAccepted: boolean;
      aiFeedback: string;
    }>(
      '/v1/student/coding/submit',
      { method: 'POST', body: JSON.stringify(payload) },
      () => {
        const ch = MOCK_CODING_CHALLENGES.find((c) => c.id === payload.challengeId) || MOCK_CODING_CHALLENGES[0];
        const hasIntentionalBug = payload.code.includes('TODO_FAIL') || payload.code.trim().length < 25;
        const results: CodingTestCaseResult[] = ch.testCases.map((tc, idx) => {
          const passed = !hasIntentionalBug || idx < 2;
          return {
            id: tc.id,
            name: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: passed ? tc.expectedOutput : 'Failed on hidden edge case',
            runtimeMs: 5 + idx * 4,
            passed,
          };
        });
        const passedCount = results.filter((r) => r.passed).length;
        const score = Math.round((passedCount / Math.max(1, results.length)) * 100);
        return {
          results,
          passedCount,
          totalCount: results.length,
          score,
          similarityScore: 3.8,
          honorCodeAccepted: payload.honorCodeAccepted,
          aiFeedback:
            score === 100
              ? 'Chúc mừng! Bài nộp của bạn vượt qua 4/4 Test Cases (bao gồm cả Hidden Edge Case), đạt 100/100 điểm · Độ trùng lặp AST/Token: 3.8% (Hợp lệ). Điểm đã được đồng bộ vào Bảng điểm Trọng số!'
              : `Bạn đạt ${score}/100 điểm (${passedCount}/${results.length} Test Cases). Hãy xem chi tiết Test Case bị sai bên dưới.`,
        };
      },
    ),

  submitSegmentQuizAttempt: (payload: {
    lessonId: number;
    segmentId: number;
    selectedIndex: number;
    attemptCount: number;
    passed: boolean;
    startTimestamp: number;
  }) =>
    apiFetch(
      '/v1/student/lessons/segment-quiz-attempt',
      { method: 'POST', body: JSON.stringify(payload) },
      () => {
        const mustRewind = !payload.passed && payload.attemptCount >= 3;
        return {
          passed: payload.passed,
          attemptCount: mustRewind ? 0 : payload.attemptCount,
          mustRewind,
          rewindToTimestamp: payload.startTimestamp,
        };
      },
    ),

  predictConfusion: (
    payload: MultimodalFeatures12 | Record<string, unknown>,
  ): Promise<ConfusionPredictResult> =>
    apiFetch<ConfusionPredictResult>(
      '/v1/student/confusion/predict',
      {
        method: 'POST',
        body: JSON.stringify(
          'pause_count' in payload ? { features: payload, threshold: 0.62 } : payload,
        ),
      },
      () => ({ ...INDETERMINATE_PREDICTION_STATE }),
    ),

  explainConfusion: (payload: {
    lessonId: number;
    timestamp: number;
    totalDuration: number;
    confusionSignals: {
      pauseCount: number;
      rewindCount: number;
      emotion: string;
      mlProb: number;
      ruleScore: number;
    };
  }) =>
    apiFetch<ConfusionExplanationResult>(
      '/v1/student/confusion/explain',
      { method: 'POST', body: JSON.stringify(payload) },
      () => {
        const allLessons = MOCK_COURSES.flatMap((c) => c.modules.flatMap((m) => m.lessons));
        const lesson = allLessons.find((l) => l.id === payload.lessonId) || MOCK_COURSES[0].modules[0].lessons[0];
        const seg =
          lesson.segments.find(
            (s) => payload.timestamp >= s.startTimestamp && payload.timestamp <= s.endTimestamp,
          ) || lesson.segments[1] || lesson.segments[0];

        if (!seg || seg.segmentIndex === 1) {
          return {
            episodeId: Date.now(),
            lessonId: payload.lessonId,
            timestampSec: payload.timestamp,
            retrievalTier: 'vector_semantic',
            segmentTitle: seg?.title || lesson.title,
            summary:
              'Tại đoạn này, bài giảng giải thích cách phát hiện trạng thái "nhìn đờ mắt" (Eye-Lock) khi gặp kiến thức khó. Thay vì dùng ảnh thô, ta đo tỷ lệ mở mắt EAR > 0.22 kết hợp phương sai Var(EAR) < 0.002 (không chớp mắt) và đầu đứng yên (Nose Drift < 3.5px) để nhân hệ số khuếch đại bối rối gazeBoost = 1.6.',
            analogy:
              'Hãy hình dung khi bạn đang đọc một dòng thông báo lỗi phức tạp trong code C++: mắt bạn mở to nhìn chằm chằm vào đúng dòng đó mà quên cả chớp mắt, đầu giữ nguyên vị trí — đó chính là tổ hợp (EAR > 0.22 + Var(EAR) < 0.002 + Gaze Stillness).',
            contentPoints: [
              '1. Giải thích từng bước công thức hình học EAR = (||p2-p6|| + ||p3-p5||) / (2*||p1-p4||) tại [02:30]',
              '2. Tại sao phải lấy đỉnh mũi (landmark 1) làm gốc tọa độ (0,0,0) trước khi đưa vào mạng nơ-ron?',
              '3. Phân biệt giữa nhìn tập trung bình thường và trạng thái đờ mắt Eye-Lock tại [03:45]',
            ],
            relatedTimestamps: [
              { label: '02:30 · Chuẩn hóa 478 điểm mốc 3D', sec: 150 },
              { label: '03:45 · Công thức EAR & Gaze Stillness', sec: 225 },
            ],
          };
        }

        if (seg.segmentIndex === 2) {
          return {
            episodeId: Date.now(),
            lessonId: payload.lessonId,
            timestampSec: payload.timestamp,
            retrievalTier: 'vector_semantic',
            segmentTitle: seg.title,
            summary:
              'Bạn vừa dừng/tua lại ở phần công thức Temporal Attention của mạng BiLSTM. Hiểu đơn giản: thay vì coi mọi giây trong đoạn video có tầm quan trọng ngang nhau, tầng Attention tính điểm số alpha_t (tổng bằng 1) để "chú ý" mạnh nhất vào đúng khoảnh khắc học sinh nhíu mày sâu nhất.',
            analogy:
              'Giống như khi bạn đọc một hàm code dài 30 dòng để tìm bug: bạn lướt nhanh qua các dòng khai báo biến (trọng số alpha_t = 0.01) và dừng lại tập trung 80% sự chú ý vào đúng dòng điều kiện if bị sai (alpha_t = 0.80).',
            contentPoints: [
              '1. Minh họa bằng số cụ thể cho công thức alpha_t = softmax(v^T * tanh(W_h * h_t)) tại [09:10]',
              '2. Vai trò của khối Squeeze-and-Excitation (SE-Block) trước khi đưa chuỗi vào BiLSTM 2 lớp [07:40]',
              '3. Tại sao Focal Loss (gamma = 2.0) giúp mô hình không bị lệch về lớp Neutral trên tập DAiSEE [10:30]',
            ],
            relatedTimestamps: [
              { label: '07:40 · Khối SE-Block chọn lọc kênh đặc trưng', sec: 460 },
              { label: '09:10 · Công thức Temporal Attention Pooling', sec: 550 },
              { label: '10:30 · Hàm mất mát Focal Loss trên DAiSEE', sec: 630 },
            ],
          };
        }

        return {
          episodeId: Date.now(),
          lessonId: payload.lessonId,
          timestampSec: payload.timestamp,
          retrievalTier: 'vector_semantic',
          segmentTitle: seg.title,
          summary:
            'Phân đoạn này tổng hợp 12 đặc trưng đa phương thức (F1–F6 hành vi xem video + F7–F10 cảm xúc camera + F11–F12 kết quả quiz) qua mạng MLP 3 lớp (64 -> 32 -> 16 -> 1) kết hợp luật cửa sổ trượt để kích hoạt trợ lý ảo đúng lúc.',
          analogy:
            'Giống như một giảng viên giàu kinh nghiệm đứng cạnh bạn: thầy không chỉ nhìn nét mặt nhíu mày (F7–F10) mà còn để ý thấy bạn vừa tua lại cùng một đoạn 3 lần (F5) và dừng video 15 giây (F3) để biết chắc chắn bạn đang cần giải thích thêm.',
          contentPoints: [
            '1. Ý nghĩa của đặc trưng F5 (rewind_same_spot ±10s) và F3 (long_pause > 10s) tại [13:20]',
            '2. Cách chuẩn hóa StandardScaler và suy luận ma trận MLP (64, 32, 16) trong < 1ms tại [15:00]',
            '3. Cơ chế kết hợp Hybrid (mlProb >= 0.60 HOẶC ruleScore >= 35) khi học sinh tắt camera [16:30]',
          ],
          relatedTimestamps: [
            { label: '13:20 · Nhóm đặc trưng Hành vi F1–F6', sec: 800 },
            { label: '15:00 · Kiến trúc MLP 3 lớp (64, 32, 16)', sec: 900 },
          ],
        };
      },
    ),

  generateTutorResponse: (payload: {
    lessonId: number;
    question: string;
    persona: TutorPersona;
    timestampSec: number;
    hasFrameImage: boolean;
    studentProfile: { major: string; academicYear: number; level: string };
  }): {
    reply: string;
    citations: { timeLabel: string; seconds: number; snippet: string }[];
    retrievalTier: string;
  } => {
    const { question, persona, hasFrameImage, studentProfile } = payload;
    const visionNote = hasFrameImage
      ? `**[Đã phân tích Khung hình Slide/Code bài giảng tại [${Math.floor(payload.timestampSec / 60)
          .toString()
          .padStart(2, '0')}:${Math.floor(payload.timestampSec % 60)
          .toString()
          .padStart(2, '0')}] qua GPT-4o Vision]**\n\n`
      : '';

    if (persona === 'socrates') {
      return {
        reply: `${visionNote}Chào bạn (Sinh viên Năm ${studentProfile.academicYear} ngành **${studentProfile.major}**)! Câu hỏi của bạn về *"${question}"* chạm đúng điểm mấu chốt của bài giảng.\n\nTheo phương pháp **Gợi mở Socrates**, trước khi mình đưa ra công thức hoàn chỉnh, chúng ta cùng suy luận qua 2 câu hỏi nhỏ nhé:\n\n1. **Gợi mở 1 (Tại mốc [07:40]):** Nếu một đoạn video dài 10 giây chỉ có duy nhất 2 giây học sinh nhíu mày bối rối, điều gì sẽ xảy ra nếu ta chỉ lấy trung bình cộng (Mean Pooling) tất cả 30 khung hình?\n2. **Gợi mở 2 (Tại mốc [09:10]):** Trong lập trình hệ thống phân tán hoặc cơ sở dữ liệu mà ngành KHMT của bạn hay dùng, khi muốn ưu tiên các bản ghi quan trọng hơn, ta thường nhân thêm một hệ số trọng số $w_i$. Vậy ở tầng **Temporal Attention**, hàm toán học nào giúp biến các điểm số $e_t$ thành bộ trọng số $\\alpha_t \\in (0,1)$ có tổng bằng $1.0$?\n\nBạn thử trả lời 1 trong 2 ý trên theo cách hiểu của mình xem sao!`,
        citations: [
          { timeLabel: '07:40', seconds: 460, snippet: 'Hạn chế của Mean Pooling trên chuỗi biểu cảm khuôn mặt' },
          { timeLabel: '09:10', seconds: 550, snippet: 'Công thức trọng số chú ý alpha_t = softmax(v^T tanh(W_h h_t))' },
        ],
        retrievalTier: hasFrameImage ? 'vision_multimodal_rag' : 'vector_semantic',
      };
    }

    if (persona === 'coach') {
      return {
        reply: `${visionNote}Mình sẽ đồng hành cùng bạn (Năm ${studentProfile.academicYear} · **${studentProfile.major}**) bóc tách vấn đề *"${question}"* theo **từng bước thật rõ ràng** nhé:\n\n- **Bước 1 — Chuẩn hóa đầu vào ([02:30]):** Từ khung hình camera hoặc hành vi tua video, ta trích xuất các tín hiệu thô và chuẩn hóa về cùng một thang đo (Nose-Centered cho 478 điểm mốc 3D, hoặc StandardScaler z = (x - mu)/sigma cho 12 đặc trưng).\n- **Bước 2 — Nắm bắt diễn biến thời gian ([07:40]):** Đưa chuỗi qua mạng **BiLSTM 2 chiều** để mỗi trạng thái ẩn h_t vừa biết biểu cảm trước đó vừa biết biểu cảm ngay sau đó.\n- **Bước 3 — Tập trung vào điểm nóng bằng Attention ([09:10]):** Tính alpha_t = softmax(v^T tanh(W_h h_t)) rồi lấy tổng có trọng số c = sum(alpha_t * h_t).\n- **Bước 4 — Quyết định lai Hybrid ([15:00]):** Kết hợp xác suất mạng MLP (p_ML >= 0.70) hoặc điểm luật đa phương thức (RuleScore >= 60) để kích hoạt hỗ trợ.\n\n**Bài tập kiểm tra nhanh 30 giây cho bạn:** Nếu học sinh tua lại cùng một đoạn 2 lần (rewind_same_spot = 2, +40 điểm luật), hệ thống có kích hoạt giải thích ngay cả khi học sinh tắt camera không?`,
        citations: [
          { timeLabel: '02:30', seconds: 150, snippet: 'Chuẩn hóa tọa độ 3D và vector đặc trưng' },
          { timeLabel: '09:10', seconds: 550, snippet: 'Tầng gộp Temporal Attention Pooling' },
          { timeLabel: '15:00', seconds: 900, snippet: 'Bộ quyết định lai Hybrid ML + Rule-based' },
        ],
        retrievalTier: hasFrameImage ? 'vision_multimodal_rag' : 'vector_semantic',
      };
    }

    return {
      reply: `${visionNote}Dưới góc độ học thuật chuyên sâu dành cho sinh viên Năm ${studentProfile.academicYear} chuyên ngành **${studentProfile.major}**, về câu hỏi *"${question}"*, ta phân tích theo cấu trúc 6 phần:\n\n1. **Lý thuyết nền tảng ([02:30]):** Biểu diễn hình học khuôn mặt 478x3 được dịch chuyển gốc về đỉnh mũi l_1 và chuẩn hóa theo khoảng cách hai khóe mắt d_IOD nhằm đạt tính bất biến phép vị tự (Similitude Invariance).\n2. **Cơ chế hoạt động chi tiết ([09:10]):** Với chuỗi trạng thái ẩn hai chiều h_t từ BiLSTM, cơ chế Additive Attention tính năng lượng e_t = v^T tanh(W_h h_t + b_h) và chuẩn hóa alpha_t = softmax(e_t).\n3. **Tích hợp Đa phương thức 12 chiều ([13:20]):** Hợp nhất mức quyết định (Decision- & Feature-level Fusion) giữa đặc trưng hành vi xem video (6 chiều), cảm xúc (4 chiều) và kiểm tra nhận thức (2 chiều).\n4. **So sánh với phương pháp khác:** Trong thực nghiệm Ablation trên DAiSEE, việc loại bỏ Temporal Attention làm giảm 4.2% F1-score, và dùng đa phương thức 12 đặc trưng vượt trội hơn chỉ dùng đơn lẻ kênh hình ảnh.\n5. **Lỗi thường gặp (Pitfalls):** Quên đóng băng hoặc chuẩn hóa StandardScaler giữa lúc huấn luyện Python (ml/) và lúc suy luận thời gian thực trên Go/Web.\n6. **Từ khóa đọc thêm:** *Bahdanau Additive Attention, Squeeze-and-Excitation Networks (Hu et al.), DAiSEE Engagement Dataset, Focal Loss (Lin et al.).*`,
      citations: [
        { timeLabel: '02:30', seconds: 150, snippet: 'Chuẩn hóa hình học bất biến vị tự 478 Landmarks' },
        { timeLabel: '09:10', seconds: 550, snippet: 'Biểu diễn toán học Additive Temporal Attention' },
        { timeLabel: '13:20', seconds: 800, snippet: 'Không gian đặc trưng đa phương thức 12 chiều' },
      ],
      retrievalTier: hasFrameImage ? 'vision_multimodal_rag' : 'vector_semantic',
    };
  },

  getSchedules: () => apiFetch('/v1/student/schedule', { method: 'GET' }, MOCK_SCHEDULES),
  getDailyAttendance: () => apiFetch('/v1/student/daily-status', { method: 'GET' }, MOCK_DAILY_ATTENDANCE),
  getTasks: () => apiFetch('/v1/student/tasks', { method: 'GET' }, MOCK_TASKS),
  getAssignments: () => apiFetch('/v1/teacher/assignments', { method: 'GET' }, MOCK_ASSIGNMENTS),
  getQuizzes: () => apiFetch('/v1/student/quiz/list', { method: 'GET' }, MOCK_QUIZZES),
  getTopicSkills: () => apiFetch('/v1/student/quiz/statistics', { method: 'GET' }, MOCK_TOPIC_SKILLS),
  getLessonComments: (lessonId: number) =>
    apiFetch(`/v1/lessons/${lessonId}/discussions`, { method: 'GET' }, MOCK_COMMENTS),
  getRoadmap: () =>
    apiFetch(
      '/v1/courses/1/roadmap',
      { method: 'GET' },
      { nodes: MOCK_ROADMAP_NODES, edges: MOCK_ROADMAP_EDGES },
    ),
  getAtRiskStudents: () =>
    apiFetch('/v1/teacher/teaching/at-risk-students', { method: 'GET' }, MOCK_AT_RISK_STUDENTS),
};
