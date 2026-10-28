import { apiFetch, isApiError } from './client';
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
  CodingLanguage,
  CodingTestCaseResult,
  ConfusionExplanationResult,
  CourseGradebook,
  CourseItem,
  LessonItem,
  MultimodalFeatures12,
  SpecializationItem,
} from './types';

export { ApiError, describeApiError, isApiError } from './client';
export { authApi, accountModeForRole, type AuthTokenBundle, type AuthUser } from './auth';
export { streamTutorChat, type TutorStreamRequest } from './tutorStream';

/** One test case of service.CodingExecutionResult.testResults. */
interface BackendCodingTestResult {
  name: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  isHidden: boolean;
  runtimeMs: number;
}

/** service.CodingExecutionResult (POST /v1/student/coding/run and /submit). */
interface BackendCodingExecutionResult {
  passedCount: number;
  totalCount: number;
  score: number;
  status: string;
  testResults: BackendCodingTestResult[] | null;
  aiTutorHint: string;
}

export interface CodingRunResult {
  results: CodingTestCaseResult[];
  passedCount: number;
  totalCount: number;
  aiFeedback: string;
}

export interface CodingSubmitResult extends CodingRunResult {
  score: number;
  /** lms-api does not compute AST/token similarity yet; null means "not checked". */
  similarityScore: number | null;
  honorCodeAccepted: boolean;
}

const toCodingRunResult = (res: BackendCodingExecutionResult): CodingRunResult => {
  const results: CodingTestCaseResult[] = (res.testResults || []).map((tr, idx) => ({
    id: idx + 1,
    name: tr.name,
    input: tr.input,
    expectedOutput: tr.expected,
    actualOutput: tr.actual,
    runtimeMs: tr.runtimeMs,
    passed: tr.passed,
  }));
  return {
    results,
    passedCount: res.passedCount,
    totalCount: res.totalCount,
    aiFeedback: res.aiTutorHint || '',
  };
};

/** service.ExplainConfusionOutput (POST /v1/student/confusion/explain). */
interface BackendExplainConfusionOutput {
  episodeId: number;
  summary: string;
  explanation: string;
  contentPoints: string[] | null;
  timestamp: number;
  timeStr: string;
  lessonTitle: string;
  ragSource: string;
}

const RETRIEVAL_TIERS: ConfusionExplanationResult['retrievalTier'][] = [
  'vector_semantic',
  'timestamp_match',
  'transcript_slice',
];

const toExplanationResult = (lessonId: number, res: BackendExplainConfusionOutput): ConfusionExplanationResult => ({
  episodeId: res.episodeId,
  lessonId,
  timestampSec: res.timestamp,
  retrievalTier: RETRIEVAL_TIERS.find((t) => t === res.ragSource) || 'timestamp_match',
  segmentTitle: res.lessonTitle,
  summary: res.summary,
  analogy: res.explanation,
  contentPoints: res.contentPoints || [],
  relatedTimestamps: res.timeStr ? [{ label: res.timeStr, sec: res.timestamp }] : [],
});

/** service.ResetCourseDeadlinesResult. */
interface BackendResetDeadlinesResult {
  moduleDeadlines: { dueDate: string; dueDateFormatted: string }[] | null;
  updatedTasksCount: number;
  message: string;
}

/** Local challenge content: lms-api has no GET endpoint for coding challenges (see getCodingChallenge). */
const findLocalCodingChallenge = (challengeId: number): CodingChallengeItem =>
  MOCK_CODING_CHALLENGES.find((c) => c.id === challengeId) || MOCK_CODING_CHALLENGES[0];

/**
 * Local Coding Lab challenge id -> lms-api CodingProblem (seed.go cp1..cp3, created in this order on a fresh
 * database). Each local challenge shows the same function, statement and tests as its problem (checked against
 * seed.go by codingParity.test.ts). Challenges without an entry have no grader on the backend: run/submit refuse
 * them locally instead of letting lms-api grade the code against an unrelated problem. lms-api answers 404 for an
 * unknown problemId and 400 for a language other than the problem's.
 */
export const BACKEND_CODING_PROBLEMS: Readonly<
  Record<number, { problemId: number; language: CodingLanguage; functionName: string }>
> = {
  1: { problemId: 1, language: 'python', functionName: 'detect_eye_lock' },
  2: { problemId: 2, language: 'python', functionName: 'topological_sort_dag' },
  3: { problemId: 3, language: 'python', functionName: 'rank_rag_segments' },
};

export const BACKEND_CODING_PROBLEM_IDS: Readonly<Record<number, number>> = Object.fromEntries(
  Object.entries(BACKEND_CODING_PROBLEMS).map(([challengeId, p]) => [challengeId, p.problemId]),
);

export const backendCodingProblemId = (challengeId: number): number | null =>
  BACKEND_CODING_PROBLEMS[challengeId]?.problemId ?? null;

const ALL_CODING_LANGUAGES: readonly CodingLanguage[] = ['python', 'typescript', 'go'];

/**
 * Languages the Coding Lab offers for a challenge: only the backend problem's language for a graded challenge
 * (the grader checks that language only), otherwise every language that has starter code.
 */
export const codingLanguagesFor = (challenge: CodingChallengeItem): CodingLanguage[] => {
  const backend = BACKEND_CODING_PROBLEMS[challenge.id];
  if (backend) return [backend.language];
  return ALL_CODING_LANGUAGES.filter((lang) => typeof challenge.starterCode[lang] === 'string');
};

export const CODING_LAB_NOT_GRADABLE_MESSAGE =
  'Bài lab này chưa có bộ chấm trên máy chủ LMS nên chưa thể chạy hoặc nộp bài để chấm điểm.';

export const codingLanguageNotGradableMessage = (language: string): string =>
  `Bộ chấm của bài lab này chỉ hỗ trợ ${language === 'python' ? 'Python' : language}.`;

/** Body of /v1/student/coding/run and /submit. lms-api completes the problem's own lesson, so no lessonId is sent. */
const codingRequestBody = (payload: { challengeId: number; language: string; code: string }): string => {
  const backend = BACKEND_CODING_PROBLEMS[payload.challengeId];
  if (!backend) throw new Error(CODING_LAB_NOT_GRADABLE_MESSAGE);
  if (payload.language !== backend.language) throw new Error(codingLanguageNotGradableMessage(backend.language));
  return JSON.stringify({ problemId: backend.problemId, language: payload.language, code: payload.code });
};

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
  llrGaze?: number;
  rGaze?: number;
  contribGaze?: number;
  segmentPrior?: number;
}

export interface ReadingGazeSamplePayload {
  lessonId: number;
  paragraphIndex: number;
  /** designed_stimulus: label from the calibration lesson design; self_report: answer to the random prompt. */
  labelSource: 'designed_stimulus' | 'self_report';
  stimulusType: '' | 'control' | 'factual' | 'contextual';
  /** 1 clear, 2 slightly unclear, 3 confused, 4 very confused; 0 for designed stimuli. */
  selfReportLevel: 0 | 1 | 2 | 3 | 4;
  /** Probability with which this paragraph was prompted (independent of the model's output). */
  promptProbability: number;
  dwellRatio: number;
  rereadCount: number;
  paraRegressionRate: number;
  sweepRatio: number;
  gazeTransitionEntropy: number;
  saccadeRate: number;
  rGaze: number;
  llrGaze: number;
  calibrationErrorNorm: number;
  textDifficulty: number;
  wordCount: number;
  readingWpm: number;
  posteriorProb: number;
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

  /**
   * POST /v1/student/face replaces every stored pose, so the three poses are registered together once
   * all of them have been captured (per-pose captures stay on the device until then).
   */
  registerFaceEmbeddings: (payload: { front: number[]; left: number[]; right: number[] }) =>
    apiFetch<{ success: boolean; embeddings: unknown[] }>('/v1/student/face', {
      method: 'POST',
      body: JSON.stringify({
        poses: (['front', 'left', 'right'] as const).map((pose) => ({ pose, embedding: payload[pose] })),
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
      }),
    }),

  logFaceViolation: (payload: {
    lessonId: number;
    violationType: 'face_absent_30s' | 'identity_mismatch';
    videoTimestampSec: number;
    similarityScore: number;
  }) =>
    apiFetch<{ violation: unknown }>('/v1/student/face/violation', {
      method: 'POST',
      body: JSON.stringify({
        lessonId: payload.lessonId,
        // lms-api violation types: no_face_30s | identity_mismatch | multiple_faces
        violationType: payload.violationType === 'face_absent_30s' ? 'no_face_30s' : payload.violationType,
        videoTimestamp: Math.round(payload.videoTimestampSec),
        durationSeconds: payload.violationType === 'face_absent_30s' ? 30 : 0,
        similarityScore: payload.similarityScore,
      }),
    }),

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
    apiFetch<{ completedLessonId: number; nextLessonId: number; courseProgressPercent: number }>(
      `/v1/student/lessons/${lessonId}/complete-reading`,
      { method: 'POST' },
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
    apiFetch<{ message: string }>(`/v1/student/specializations/${specId}/enroll`, { method: 'POST' }),

  resetCourseDeadlines: async (courseId: number) => {
    const res = await apiFetch<BackendResetDeadlinesResult>(`/v1/student/courses/${courseId}/reset-deadlines`, {
      method: 'POST',
    });
    const deadlines = res.moduleDeadlines || [];
    const last = deadlines.reduce<(typeof deadlines)[number] | null>(
      (latest, d) => (!latest || d.dueDate > latest.dueDate ? d : latest),
      null,
    );
    return {
      courseId,
      reset: true,
      newDeadlineDate: last?.dueDateFormatted || '',
      message: res.message,
    };
  },

  /**
   * Local-only content: lms-api exposes no GET endpoint for a coding challenge (problems are resolved
   * server-side from problemId/lessonId by /v1/student/coding/run and /submit), so no network call is made.
   */
  getCodingChallenge: async (challengeId: number): Promise<CodingChallengeItem> =>
    findLocalCodingChallenge(challengeId),

  runCodingPublicTests: async (payload: {
    challengeId: number;
    language: CodingLanguage;
    code: string;
  }): Promise<CodingRunResult> => {
    const body = codingRequestBody(payload);
    const res = await apiFetch<BackendCodingExecutionResult>('/v1/student/coding/run', {
      method: 'POST',
      body,
    });
    return toCodingRunResult(res);
  },

  submitCodingAllTests: async (payload: {
    challengeId: number;
    language: CodingLanguage;
    code: string;
    honorCodeAccepted: boolean;
  }): Promise<CodingSubmitResult> => {
    const body = codingRequestBody(payload);
    const res = await apiFetch<BackendCodingExecutionResult>('/v1/student/coding/submit', {
      method: 'POST',
      body,
    });
    return {
      ...toCodingRunResult(res),
      score: Math.round(res.score),
      similarityScore: null,
      honorCodeAccepted: payload.honorCodeAccepted,
    };
  },

  submitSegmentQuizAttempt: async (payload: {
    lessonId: number;
    segmentId: number;
    selectedIndex: number;
  }) => {
    const res = await apiFetch<{
      isCorrect: boolean;
      attemptCount: number;
      mustRewind: boolean;
      rewindToTimestamp: number;
      explanation: string;
      message: string;
    }>('/v1/student/lessons/segment-quiz-attempt', {
      method: 'POST',
      body: JSON.stringify({
        lessonId: payload.lessonId,
        segmentId: payload.segmentId,
        selectedAnswer: payload.selectedIndex,
      }),
    });
    return { ...res, passed: res.isCorrect };
  },

  /**
   * The indeterminate state is an honest "no prediction" (the client then relies on its on-device SP-BEF
   * step), so it is used when the backend is offline or rejects the request; it never claims a result.
   */
  predictConfusion: (
    payload: MultimodalFeatures12 | Record<string, unknown>,
  ): Promise<ConfusionPredictResult> =>
    apiFetch<ConfusionPredictResult>(
      '/v1/student/confusion/predict',
      {
        method: 'POST',
        allowMockFallback: true,
        body: JSON.stringify(
          'pause_count' in payload ? { features: payload, threshold: 0.62 } : payload,
        ),
      },
      () => ({ ...INDETERMINATE_PREDICTION_STATE }),
    ).catch((err: unknown) => {
      if (isApiError(err)) return { ...INDETERMINATE_PREDICTION_STATE };
      throw err;
    }),

  // Labelled Reading View gaze window: the training data for ml/07_train_gaze_branch.py.
  // Fire-and-forget telemetry: { id: null } means "not stored" (offline or rejected), never a fake id.
  logReadingGazeSample: (payload: ReadingGazeSamplePayload) =>
    apiFetch<{ id: number | null }>(
      '/v1/student/confusion/reading-gaze',
      { method: 'POST', allowMockFallback: true, body: JSON.stringify(payload) },
      () => ({ id: null }),
    ).catch((err: unknown) => {
      if (isApiError(err)) return { id: null };
      throw err;
    }),

  explainConfusion: async (payload: {
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
  }): Promise<ConfusionExplanationResult> => {
    const res = await apiFetch<BackendExplainConfusionOutput>('/v1/student/confusion/explain', {
      method: 'POST',
      body: JSON.stringify({
        lessonId: payload.lessonId,
        timestamp: Math.round(payload.timestamp),
        totalDuration: Math.round(payload.totalDuration),
        pauseCount: payload.confusionSignals.pauseCount,
        rewindCount: payload.confusionSignals.rewindCount,
        dominantEmotion: payload.confusionSignals.emotion,
        mlProb: payload.confusionSignals.mlProb,
        ruleScore: payload.confusionSignals.ruleScore,
      }),
    });
    return toExplanationResult(payload.lessonId, res);
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
