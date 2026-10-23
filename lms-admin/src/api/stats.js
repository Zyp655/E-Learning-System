import api from '../utils/api';
import { mockStore } from '../utils/mockData';

const normalizeEpisode = (ep = {}) => {
  const studentName = ep.student_name || ep.studentName || 'Sinh viên LMS';
  const studentCode = ep.student_code || ep.studentCode || 'SV20220145';
  const lessonTitle = ep.lesson_title || ep.lessonTitle || 'Bài giảng Video';
  const courseTitle = ep.course_title || ep.courseTitle || 'Khóa học AI';
  const videoTimestampSec = Number(ep.video_timestamp_sec ?? ep.videoTimestampSec ?? 600);
  const triggerSource = ep.trigger_source || ep.triggerSource || 'ml_model';
  const mlProbability = Number(ep.ml_probability ?? ep.mlProbability ?? 0.82);
  const ruleScore = Number(ep.rule_score ?? ep.ruleScore ?? 45);
  const dominantEmotion = ep.dominant_emotion || ep.dominantEmotion || 'confused';
  const userFeedback = ep.user_feedback || ep.userFeedback || 'helpful';
  const createdAt = ep.created_at || ep.createdAt || '15 phút trước';

  return {
    ...ep,
    id: ep.id,
    student_name: studentName,
    studentName,
    student_code: studentCode,
    studentCode,
    lesson_title: lessonTitle,
    lessonTitle,
    course_title: courseTitle,
    courseTitle,
    video_timestamp_sec: videoTimestampSec,
    videoTimestampSec,
    trigger_source: triggerSource,
    triggerSource,
    ml_probability: mlProbability,
    mlProbability,
    rule_score: ruleScore,
    ruleScore,
    dominant_emotion: dominantEmotion,
    dominantEmotion,
    resolved: Boolean(ep.resolved ?? true),
    user_feedback: userFeedback,
    userFeedback,
    created_at: createdAt,
    createdAt,
  };
};

const normalizeStats = (raw = {}) => {
  const base = mockStore.stats;
  const totalStudents = Number(
    raw.totalStudents ?? raw.total_students ?? base.totalStudents
  );
  const totalTeachers = Number(
    raw.totalTeachers ?? raw.total_teachers ?? base.totalTeachers
  );
  const totalCourses = Number(
    raw.totalCourses ?? raw.total_courses ?? base.totalCourses
  );
  const activeCourseClasses = Number(
    raw.activeCourseClasses ?? raw.active_course_classes ?? base.activeCourseClasses
  );
  const dailyConfusionEpisodes = Number(
    raw.dailyConfusionEpisodes ??
      raw.daily_confusion_episodes ??
      raw.totalConfusionLogs ??
      base.dailyConfusionEpisodes
  );
  const aiTutorResolutionRate = Number(
    raw.aiTutorResolutionRate ??
      raw.ai_tutor_resolution_rate ??
      base.aiTutorResolutionRate
  );
  const faceGuardVerifiedRate = Number(
    raw.faceGuardVerifiedRate ??
      raw.face_guard_verified_rate ??
      base.faceGuardVerifiedRate
  );
  const pgvectorIndexedSegments = Number(
    raw.pgvectorIndexedSegments ??
      raw.pgvector_indexed_segments ??
      base.pgvectorIndexedSegments
  );

  const recentRaw =
    Array.isArray(raw.recentConfusionEpisodes) && raw.recentConfusionEpisodes.length > 0
      ? raw.recentConfusionEpisodes
      : Array.isArray(raw.recent_confusion_episodes) &&
        raw.recent_confusion_episodes.length > 0
      ? raw.recent_confusion_episodes
      : base.recentConfusionEpisodes;

  return {
    ...base,
    ...raw,
    totalStudents,
    total_students: totalStudents,
    totalTeachers,
    total_teachers: totalTeachers,
    totalCourses,
    total_courses: totalCourses,
    activeCourseClasses,
    active_course_classes: activeCourseClasses,
    dailyConfusionEpisodes,
    daily_confusion_episodes: dailyConfusionEpisodes,
    aiTutorResolutionRate,
    ai_tutor_resolution_rate: aiTutorResolutionRate,
    faceGuardVerifiedRate,
    face_guard_verified_rate: faceGuardVerifiedRate,
    pgvectorIndexedSegments,
    pgvector_indexed_segments: pgvectorIndexedSegments,
    confusionTrend7Days:
      Array.isArray(raw.confusionTrend7Days) && raw.confusionTrend7Days.length > 0
        ? raw.confusionTrend7Days
        : base.confusionTrend7Days,
    departmentEnrollments:
      Array.isArray(raw.departmentEnrollments) && raw.departmentEnrollments.length > 0
        ? raw.departmentEnrollments
        : base.departmentEnrollments,
    recentConfusionEpisodes: recentRaw.map(normalizeEpisode),
  };
};

class StatsApi {
  getOverview = async () => {
    try {
      const res = await api.get('/v1/admin/stats');
      const data = res?.data?.data || res?.data;
      if (data) return normalizeStats(data);
    } catch (error) {}
    return normalizeStats(mockStore.stats);
  };
}

const statsApi = new StatsApi();
export default statsApi;
