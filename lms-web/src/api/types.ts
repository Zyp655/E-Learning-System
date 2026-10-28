export type UserRole = 'student' | 'teacher' | 'admin';
export type EmotionLabel = 'focused' | 'confused' | 'frustrated' | 'bored' | 'happy' | 'neutral' | 'no_face';
export type TutorPersona = 'socrates' | 'coach' | 'expert';

export interface StudentAcademicProfile {
  userId: number;
  fullName: string;
  email: string;
  studentCode: string;
  departmentId: number;
  departmentName: string;
  major: string;
  studentClass: string;
  academicYear: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  avatarUrl?: string;
  faceRegistered: boolean;
  cameraConsentGranted: boolean;
}

export interface VideoSegmentQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface VideoSegment {
  id: number;
  lessonId: number;
  segmentIndex: number;
  title: string;
  startTimestamp: number;
  endTimestamp: number;
  transcript: string;
  summary: string;
  keyFormulas?: string[];
  codeSnippet?: string;
  quizQuestion: VideoSegmentQuiz;
  confusionHotspotRate?: number;
  rewindCount?: number;
  pauseCount?: number;
  topStudentQuestions?: string[];
}

export interface ReadingLessonContent {
  estimatedMinutes: number;
  sections: {
    heading: string;
    body: string;
    formula?: string;
    codeSnippet?: string;
    /**
     * Designed reading stimulus (gaze calibration lesson only), as in Zhuang et al. 2025: a coherent control
     * paragraph, a factual-confusion paragraph (shuffled phrases / false facts) or a contextual-confusion one
     * (dense domain jargon). The gaze sample of the paragraph is labelled from this, not from the reader.
     */
    stimulus?: 'control' | 'factual' | 'contextual';
  }[];
  keyTakeaways: string[];
}

export interface LessonItem {
  id: number;
  moduleId: number;
  courseId: number;
  title: string;
  type: 'video' | 'reading' | 'coding' | 'quiz' | 'text' | 'assignment';
  durationMinutes: number;
  durationSeconds: number;
  isFreePreview: boolean;
  orderIndex: number;
  transcriptStatus: 'none' | 'processing' | 'ready' | 'failed';
  videoUrl: string;
  /** WebVTT captions of the lecture video. */
  captionsUrl?: string;
  summary: string;
  attachments: { id: number; name: string; type: string; size: string }[];
  segments: VideoSegment[];
  readingContent?: ReadingLessonContent;
  codingChallengeId?: number;
  quizId?: number;
  completed?: boolean;
}

export interface ModuleItem {
  id: number;
  courseId: number;
  title: string;
  description: string;
  orderIndex: number;
  unlockDate?: string;
  dueDate?: string;
  isOverdue?: boolean;
  lessons: LessonItem[];
}

export interface CourseReviewItem {
  id: number;
  courseId: number;
  userName: string;
  studentMajor: string;
  rating: number;
  comment: string;
  createdAt: string;
  helpfulCount: number;
  teacherResponse?: string;
  responseDate?: string;
}

export interface GradebookItem {
  id: string;
  title: string;
  category: 'segment_quiz' | 'module_quiz' | 'coding_lab' | 'final_assignment';
  categoryLabel: string;
  weightPercent: number;
  score: number | null;
  maxScore: number;
  status: 'passed' | 'in_progress' | 'overdue';
  dueDate: string;
  lessonId?: number;
  similarityScore?: number;
  honorCodeAccepted?: boolean;
}

export interface CourseGradebook {
  courseId: number;
  passingThreshold: number; // 75%
  overallWeightedScore: number;
  categoryWeights: {
    segment_quiz: number; // 20%
    module_quiz: number; // 30%
    coding_lab: number; // 25%
    final_assignment: number; // 25%
  };
  items: GradebookItem[];
}

export interface SpecializationItem {
  id: number;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  level: 'intermediate' | 'advanced';
  totalCredits: number;
  estimatedMonths: number;
  enrolledCount: number;
  isEnrolled: boolean;
  overallProgressPercent: number;
  courseIds: number[];
  capstoneProject: {
    title: string;
    description: string;
    deliverables: string[];
    status: 'locked' | 'in_progress' | 'completed';
  };
}

export interface CodingTestCase {
  id: number;
  name: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
}

export interface CodingTestCaseResult {
  id: number;
  name: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  runtimeMs: number;
  passed: boolean;
}

export type CodingLanguage = 'python' | 'typescript' | 'go';

export interface CodingChallengeItem {
  id: number;
  courseId: number;
  lessonId: number;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  problemStatement: string;
  constraints: string[];
  keyFormula: string;
  /** Python is always present; challenges graded by lms-api only ship the backend problem's language. */
  starterCode: {
    python: string;
    typescript?: string;
    go?: string;
  };
  testCases: CodingTestCase[];
  aiHint: string;
}

export interface CourseItem {
  id: number;
  title: string;
  slug: string;
  code: string;
  credits: number;
  description: string;
  category: string;
  department: string;
  major: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  durationMinutes: number;
  lessonsCount: number;
  studentsCount: number;
  rating: number;
  reviewsCount: number;
  progressPercent?: number;
  lastLessonId?: number;
  aiMatchScore?: number;
  aiMatchReason?: string;
  deadlineStatus?: 'on_track' | 'approaching' | 'overdue';
  nextDeadlineDate?: string;
  specializationId?: number;
  tags: string[];
  instructor: {
    id: number;
    name: string;
    title: string;
    department: string;
    verified: boolean;
  };
  modules: ModuleItem[];
  reviews: CourseReviewItem[];
}

export interface MultimodalFeatures12 {
  pause_count: number;
  avg_pause_duration: number;
  long_pause_count: number;
  rewind_count: number;
  rewind_same_spot: number;
  speed_decrease: number;
  confused_ratio: number;
  frustrated_ratio: number;
  emotion_transitions: number;
  neg_emotion_streak: number;
  quiz_score: number;
  quiz_time: number;
}

export interface ConfusionExplanationResult {
  episodeId: number;
  lessonId: number;
  timestampSec: number;
  retrievalTier: 'vector_semantic' | 'timestamp_match' | 'transcript_slice';
  segmentTitle: string;
  summary: string;
  analogy: string;
  contentPoints: string[];
  relatedTimestamps: { label: string; sec: number }[];
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  persona?: TutorPersona;
  videoTimestampSec?: number;
  attachedFrameBase64?: string;
  citations?: { timeLabel: string; seconds: number; snippet: string }[];
  retrievalTier?: string;
}

export interface ScheduleItem {
  id: number;
  subjectCode: string;
  subjectName: string;
  classCode: string;
  room: string;
  dayOfWeek: number; // 2..7 (Mon..Sat)
  startTime: string;
  endTime: string;
  type: 'classSession' | 'exam' | 'event';
  format: 'offline' | 'online';
  credits: number;
  currentAbsences: number;
  maxAbsences: number;
  midtermScore: number | null;
  finalScore: number | null;
  examScore: number | null;
  targetScore: number;
  instructorName: string;
}

export interface DailyAttendanceStatus {
  date: string;
  scheduleId: number;
  subjectName: string;
  classCode: string;
  totalWatchSeconds: number;
  requiredWatchSeconds: number;
  watchPercentage: number;
  quizCompleted: boolean;
  quizScore: number;
  faceVerified: boolean;
  status: 'pending' | 'present' | 'absent';
  absenceReason?: string;
  finalizedAt: string;
}

export interface AssignmentRubricCriterion {
  id: string;
  criterion: string;
  maxPoints: number;
  description: string;
}

export interface AssignmentSubmissionItem {
  id: number;
  assignmentId: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  version: number;
  submittedAt: string;
  isLate: boolean;
  status: 'submitted' | 'graded' | 'resubmitted';
  fileUrl?: string;
  fileName?: string;
  codeContent: string;
  grade?: number;
  maxGrade: number;
  feedback?: string;
  autoGrade?: number;
  autoGradeConfidence?: number;
  similarityScore?: number;
  honorCodeAccepted?: boolean;
  rubricEvaluation?: {
    criterionId: string;
    criterionName: string;
    score: number;
    maxPoints: number;
    comment: string;
  }[];
}

export interface AssignmentItem {
  id: number;
  courseId: number;
  classCode: string;
  title: string;
  description: string;
  dueDate: string;
  rewardPoints: number;
  rubric: AssignmentRubricCriterion[];
  submissions: AssignmentSubmissionItem[];
}

export interface TaskItem {
  id: number;
  title: string;
  description: string;
  courseTag: string;
  dueDate: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'high' | 'medium' | 'low';
}

export interface QuizQuestionItem {
  id: number;
  questionType: 'multiple_choice' | 'true_false' | 'fill_blank';
  question: string;
  options: string[];
  correctIndex: number;
  correctAnswer?: string;
  explanation: string;
}

export interface QuizItem {
  id: number;
  title: string;
  topic: string;
  subjectContext: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  timeLimitSeconds: number;
  questions: QuizQuestionItem[];
}

export interface TopicSkillStat {
  topic: string;
  totalAttempts: number;
  averageScore: number;
  skillLevel: number; // 0.0 - 1.0
  recommendedDifficulty: 'easy' | 'medium' | 'hard';
}

export interface DiscussionComment {
  id: number;
  lessonId: number;
  userId: number;
  userName: string;
  userRole: 'student' | 'teacher';
  userMajor?: string;
  content: string;
  parentId: number | null;
  path: string; // Materialized Path e.g. "1/4/9"
  depth: number;
  upvotes: number;
  downvotes: number;
  isPinned: boolean;
  isAnswered: boolean;
  isTeacherResponse: boolean;
  videoTimestampSec?: number;
  createdAt: string;
}

export interface RoadmapNodeItem {
  id: string;
  title: string;
  description: string;
  nodeType: 'lesson' | 'milestone' | 'checkpoint';
  status: 'completed' | 'in_progress' | 'locked';
  lessonId?: number;
  semester?: number;
  credits?: number;
  courseType?: 'required' | 'elective';
  aiRecommended?: boolean;
  aiReason?: string;
}

export interface RoadmapEdgeItem {
  from: string;
  to: string;
  type: 'required' | 'optional';
}

export interface AtRiskStudentItem {
  studentId: number;
  fullName: string;
  studentCode: string;
  studentClass: string;
  courseTitle: string;
  progressPercent: number;
  confusionEpisodesCount: number;
  unresolvedConfusionCount: number;
  avgQuizScore: number;
  daysInactive: number;
  riskLevel: 'high' | 'medium';
  riskReason: string;
  lastNudgedAt?: string;
}
