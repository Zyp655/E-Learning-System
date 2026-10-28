import api from '../utils/api';
import { isHttpError } from '../utils/httpError';
import { mockStore } from '../utils/mockData';

const ROLE_LABELS = {
  0: 'Student',
  1: 'Teacher',
  2: 'Admin',
};

export const normalizeUser = (u = {}) => {
  const roleNum = Number(u.role ?? 0);
  const deptId = Number(u.department_id ?? u.departmentId ?? 1);
  const deptObj = mockStore.departments.find((d) => d.id === deptId);
  const fullName = u.full_name || u.fullName || u.name || 'Người dùng LMS';
  const studentCode =
    u.student_code ||
    u.studentCode ||
    u.code ||
    (roleNum === 1 ? `GV-00${u.id || 1}` : roleNum === 2 ? `ADM-00${u.id || 1}` : `SV20260${u.id || 1}`);
  const departmentName =
    u.department_name ||
    u.departmentName ||
    deptObj?.name ||
    'Khoa Công nghệ Thông tin & Trí tuệ Nhân tạo';
  const isBanned = Boolean(u.is_banned ?? u.isBanned ?? false);
  const hasFaceEmbedding = Boolean(
    u.has_face_embedding ?? u.hasFaceEmbedding ?? u.face_registered ?? u.faceRegistered ?? false
  );
  const facePosesCount = Number(
    u.face_poses_count ?? u.facePosesCount ?? (hasFaceEmbedding ? 3 : 0)
  );
  const faceUpdatedAt = u.face_updated_at || u.faceUpdatedAt || null;
  const proctoringViolations = Number(
    u.proctoring_violations ?? u.proctoringViolations ?? 0
  );
  const academicYear = u.academic_year ?? u.academicYear ?? (roleNum === 0 ? 3 : null);
  const studentClass = u.student_class || u.studentClass || (roleNum === 0 ? 'CNTT-AI-K67' : null);
  const createdAt = u.created_at || u.createdAt || '2025-09-01';

  return {
    ...u,
    id: u.id,
    email: u.email || '',
    role: roleNum,
    role_label: u.role_label || u.roleLabel || ROLE_LABELS[roleNum] || 'Student',
    roleLabel: u.role_label || u.roleLabel || ROLE_LABELS[roleNum] || 'Student',
    full_name: fullName,
    fullName,
    student_code: studentCode,
    studentCode,
    department_id: deptId,
    departmentId: deptId,
    department_name: departmentName,
    departmentName,
    major: u.major || 'Trí tuệ Nhân tạo & Thị giác Máy tính',
    academic_year: academicYear,
    academicYear,
    student_class: studentClass,
    studentClass,
    is_banned: isBanned,
    isBanned,
    has_face_embedding: hasFaceEmbedding,
    hasFaceEmbedding,
    face_poses_count: facePosesCount,
    facePosesCount,
    face_updated_at: faceUpdatedAt,
    faceUpdatedAt,
    proctoring_violations: proctoringViolations,
    proctoringViolations,
    created_at: createdAt,
    createdAt,
  };
};

// First present value as a number, or null when lms-api did not send the field (rendered as '-', never as
// an invented number).
const firstNumber = (...values) => {
  const v = values.find((x) => x !== undefined && x !== null && x !== '');
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const firstText = (...values) => values.find((x) => typeof x === 'string' && x.trim() !== '') || '';

export const normalizeProctoringViolation = (v = {}) => {
  // Accepts both the mock shape and lms-api AdminProctoringViolationView (userName/user_name,
  // videoTimestamp/video_timestamp, similarityScore/similarity_score, durationSeconds/duration_seconds).
  // lms-api never sends threshold_required / consecutive_fails, and may send empty student code, course or
  // lesson titles: those stay null / '' so the page shows '-'.
  const studentName = firstText(
    v.student_name,
    v.studentName,
    v.user_name,
    v.userName,
    v.full_name,
    v.fullName,
    v.user?.fullName
  );
  const studentCode = firstText(v.student_code, v.studentCode, v.user?.studentCode);
  const courseTitle = firstText(v.course_title, v.courseTitle);
  const lessonTitle = firstText(v.lesson_title, v.lessonTitle);
  const videoTimestampSec = firstNumber(
    v.video_timestamp_sec,
    v.videoTimestampSec,
    v.video_timestamp,
    v.videoTimestamp
  );
  const violationType = v.violation_type || v.violationType || '';
  const cosineSimilarity = firstNumber(
    v.cosine_similarity,
    v.cosineSimilarity,
    v.similarity_score,
    v.similarityScore
  );
  const thresholdRequired = firstNumber(v.threshold_required, v.thresholdRequired);
  const absentDurationSec = firstNumber(
    v.absent_duration_sec,
    v.absentDurationSec,
    v.duration_seconds,
    v.durationSeconds
  );
  const consecutiveFails = firstNumber(v.consecutive_fails, v.consecutiveFails);
  const createdAt = v.created_at || v.createdAt || null;

  return {
    ...v,
    id: v.id,
    user_id: v.user_id ?? v.userId,
    userId: v.user_id ?? v.userId,
    student_name: studentName,
    studentName,
    student_code: studentCode,
    studentCode,
    course_title: courseTitle,
    courseTitle,
    lesson_title: lessonTitle,
    lessonTitle,
    video_timestamp_sec: videoTimestampSec,
    videoTimestampSec,
    violation_type: violationType,
    violationType,
    cosine_similarity: cosineSimilarity,
    cosineSimilarity,
    threshold_required: thresholdRequired,
    thresholdRequired,
    absent_duration_sec: absentDurationSec,
    absentDurationSec,
    consecutive_fails: consecutiveFails,
    consecutiveFails,
    status: v.status || 'pending',
    admin_note: v.admin_note || v.adminNote || '',
    adminNote: v.admin_note || v.adminNote || '',
    created_at: createdAt,
    createdAt,
  };
};

// lms-api AdminSubmissionIntegrityView.integrityStatus (from the stored similarity report) -> page status.
const INTEGRITY_STATUS_FROM_BACKEND = { flagged: 'flagged', warning: 'pending_review', clean: 'clean' };

export const normalizeIntegrityAlert = (a = {}) => {
  // Accepts the mock shape and lms-api AdminSubmissionIntegrityView (studentName, assignmentTitle,
  // similarityScore %, integrityStatus, analysisSummary, aiGradeScore/aiGradeConfidence null until graded).
  const fromBackend = a.integrityStatus !== undefined || a.submissionStatus !== undefined;
  const studentName = firstText(a.student_name, a.studentName);
  const studentCode = firstText(a.student_code, a.studentCode);
  const courseTitle = firstText(a.course_title, a.courseTitle);
  const assignmentTitle = firstText(a.assignment_title, a.assignmentTitle);
  const honorCodeAccepted = Boolean(a.honor_code_accepted ?? a.honorCodeAccepted ?? false);
  const similarityScore = firstNumber(a.similarity_score, a.similarityScore);
  const matchedSource = firstText(a.matched_source, a.matchedSource, a.analysisSummary);
  const aiGradeScore = firstNumber(a.ai_grade_score, a.aiGradeScore);
  const aiGradeConfidence = firstNumber(a.ai_grade_confidence, a.aiGradeConfidence);
  const submittedAt = a.submitted_at || a.submittedAt || null;
  const status = fromBackend
    ? INTEGRITY_STATUS_FROM_BACKEND[a.integrityStatus] || 'unchecked'
    : a.status || 'pending_review';

  return {
    ...a,
    id: a.id,
    user_id: a.user_id ?? a.userId,
    userId: a.user_id ?? a.userId,
    student_name: studentName,
    studentName,
    student_code: studentCode,
    studentCode,
    course_title: courseTitle,
    courseTitle,
    assignment_title: assignmentTitle,
    assignmentTitle,
    honor_code_accepted: honorCodeAccepted,
    honorCodeAccepted,
    similarity_score: similarityScore,
    similarityScore,
    matched_source: matchedSource,
    matchedSource,
    ai_grade_score: aiGradeScore,
    aiGradeScore,
    ai_grade_confidence: aiGradeConfidence,
    aiGradeConfidence,
    status,
    // lms-api stores no integrity review decision, so verify/reject is only available for demo data.
    review_supported: !fromBackend,
    submitted_at: submittedAt,
    submittedAt,
  };
};

class UsersApi {
  getAll = async (params = {}) => {
    try {
      const res = await api.get('/v1/admin/users', { params });
      const items = res?.data?.data?.items || res?.data?.data || res?.data;
      if (Array.isArray(items) && items.length > 0) {
        const normalized = items.map(normalizeUser);
        return { data: normalized, total: normalized.length };
      }
    } catch (error) {
      // Fallback to stateful mockStore
    }

    let list = mockStore.users.map(normalizeUser);
    if (params.keyword) {
      const kw = String(params.keyword).toLowerCase();
      list = list.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(kw) ||
          u.email?.toLowerCase().includes(kw) ||
          u.student_code?.toLowerCase().includes(kw)
      );
    }
    if (params.role !== undefined && params.role !== '' && params.role !== null) {
      list = list.filter((u) => Number(u.role) === Number(params.role));
    }
    if (params.department_id) {
      list = list.filter((u) => Number(u.department_id) === Number(params.department_id));
    }
    if (params.status !== undefined && params.status !== '' && params.status !== null) {
      const isBanned = params.status === 'banned';
      list = list.filter((u) => Boolean(u.is_banned) === isBanned);
    }
    return { data: list, total: list.length };
  };

  create = async (data) => {
    const payload = {
      ...data,
      fullName: data.full_name || data.fullName,
      studentCode: data.student_code || data.studentCode,
      departmentId: data.department_id || data.departmentId,
      academicYear: data.academic_year || data.academicYear,
      studentClass: data.student_class || data.studentClass,
    };
    try {
      const res = await api.post('/v1/admin/users', payload);
      const raw = res?.data?.data || res?.data;
      if (raw && raw.id) {
        const norm = normalizeUser(raw);
        mockStore.users = [norm, ...mockStore.users.filter((u) => u.id !== norm.id)];
        return norm;
      }
    } catch (error) {}

    const dept = mockStore.departments.find((d) => d.id === Number(data.department_id));
    const newUser = normalizeUser({
      id: Date.now(),
      email: data.email,
      full_name: data.full_name || data.fullName,
      student_code:
        data.student_code ||
        data.studentCode ||
        `SV2026${Math.floor(1000 + Math.random() * 9000)}`,
      role: Number(data.role ?? 0),
      role_label: ROLE_LABELS[Number(data.role ?? 0)] || 'Student',
      department_id: Number(data.department_id || 1),
      department_name: dept?.name || 'Khoa Công nghệ Thông tin & Trí tuệ Nhân tạo',
      major: data.major || 'Trí tuệ Nhân tạo & Thị giác Máy tính',
      academic_year: data.academic_year || 1,
      student_class: data.student_class || 'CNTT-AI-K69',
      is_banned: false,
      has_face_embedding: false,
      face_poses_count: 0,
      face_updated_at: null,
      proctoring_violations: 0,
      created_at: new Date().toISOString().slice(0, 10),
    });
    mockStore.users = [newUser, ...mockStore.users];
    return newUser;
  };

  update = async (id, data) => {
    const payload = {
      ...data,
      fullName: data.full_name || data.fullName,
      studentCode: data.student_code || data.studentCode,
      departmentId: data.department_id || data.departmentId,
    };
    try {
      await api.put(`/v1/admin/users/${id}`, payload);
    } catch (error) {}

    const dept = mockStore.departments.find((d) => d.id === Number(data.department_id));
    mockStore.users = mockStore.users.map((u) =>
      u.id === id
        ? normalizeUser({
            ...u,
            ...data,
            role: Number(data.role ?? u.role),
            role_label: ROLE_LABELS[Number(data.role ?? u.role)],
            department_name: dept?.name || u.department_name,
          })
        : u
    );
    return mockStore.users.find((u) => u.id === id);
  };

  toggleBan = async (id, isBanned) => {
    try {
      await api.post(`/v1/admin/users/${id}/ban`, {
        is_banned: isBanned,
        isBanned,
      });
    } catch (error) {}
    mockStore.users = mockStore.users.map((u) =>
      u.id === id ? normalizeUser({ ...u, is_banned: isBanned, isBanned }) : u
    );
    return { id, is_banned: isBanned, isBanned };
  };

  // lms-api DELETE /v1/admin/users/:id/face. (DELETE /v1/student/face must NOT be called here: it deletes
  // the face data of the caller, i.e. the admin's own embeddings, and ignores any user id.)
  resetFaceEmbedding = async (userId) => {
    try {
      await api.delete(`/v1/admin/users/${userId}/face`);
      return { user_id: userId, userId, reset: true };
    } catch (error) {
      if (isHttpError(error)) throw error;
    }

    // Offline demo mode only.
    mockStore.users = mockStore.users.map((u) =>
      u.id === userId
        ? normalizeUser({
            ...u,
            has_face_embedding: false,
            hasFaceEmbedding: false,
            face_poses_count: 0,
            facePosesCount: 0,
            face_updated_at: null,
            faceUpdatedAt: null,
          })
        : u
    );
    return { user_id: userId, userId, reset: true };
  };

  delete = async (id) => {
    try {
      await api.delete(`/v1/admin/users/${id}`);
    } catch (error) {}
    mockStore.users = mockStore.users.filter((u) => u.id !== id);
    return { id };
  };

  getProctoringViolations = async (params = {}) => {
    let list;
    try {
      // Must match lms-api ListAdminProctoringViolationsReq (path:"/admin/proctoring-violations"), which
      // reads the type filter from ?violationType=.
      const query = {};
      if (params.status) query.status = params.status;
      if (params.violation_type) query.violationType = params.violation_type;
      const res = await api.get('/v1/admin/proctoring-violations', { params: query });
      const body = res?.data?.data ?? res?.data;
      // lms-api serializes an empty result as items: null; that means "no violations", not "use mock data".
      const items = Array.isArray(body) ? body : body?.items ?? body?.violations ?? [];
      list = (Array.isArray(items) ? items : []).map(normalizeProctoringViolation);
    } catch (error) {
      // Only fall back to demo data when lms-api is unreachable (no HTTP response). HTTP errors such as
      // 401/403/500 are real failures and must surface to the page instead of showing invented violations.
      if (isHttpError(error)) throw error;
      list = (mockStore.proctoringViolations || []).map(normalizeProctoringViolation);
      if (params.violation_type) {
        list = list.filter((v) => v.violation_type === params.violation_type);
      }
      if (params.status) {
        list = list.filter((v) => v.status === params.status);
      }
    }

    if (params.keyword) {
      const kw = String(params.keyword).toLowerCase();
      list = list.filter(
        (v) =>
          v.student_name.toLowerCase().includes(kw) ||
          v.student_code.toLowerCase().includes(kw) ||
          v.course_title.toLowerCase().includes(kw)
      );
    }
    return list;
  };

  resolveProctoringViolation = async (violationId, { status, adminNote }) => {
    try {
      const res = await api.put(`/v1/admin/proctoring-violations/${violationId}`, {
        status,
        admin_note: adminNote,
        adminNote,
      });
      const updated = res?.data?.data?.violation;
      if (updated && updated.id !== undefined) {
        return normalizeProctoringViolation(updated);
      }
    } catch (error) {
      // A rejection from lms-api (e.g. 401/403/404) means the violation was NOT updated; do not report
      // success. Only the offline demo mode (no HTTP response) updates the local mock store.
      if (isHttpError(error)) throw error;
    }

    mockStore.proctoringViolations = (mockStore.proctoringViolations || []).map((v) =>
      v.id === violationId
        ? normalizeProctoringViolation({
            ...v,
            status,
            admin_note: adminNote ?? v.admin_note,
          })
        : v
    );
    return mockStore.proctoringViolations.find((v) => v.id === violationId);
  };

  // lms-api GET /v1/admin/proctoring/submissions -> { items: AdminSubmissionIntegrityView[], total }:
  // submissions with similarity >= 25 % or without an accepted honor code. Read-only on the backend.
  getSubmissionIntegrityAlerts = async (params = {}) => {
    let list;
    try {
      const res = await api.get('/v1/admin/proctoring/submissions');
      const body = res?.data?.data ?? res?.data;
      const items = Array.isArray(body) ? body : body?.items ?? [];
      list = (Array.isArray(items) ? items : []).map(normalizeIntegrityAlert);
    } catch (error) {
      if (isHttpError(error)) throw error;
      // Offline demo mode only.
      list = (mockStore.submissionIntegrityAlerts || []).map(normalizeIntegrityAlert);
    }

    if (params.status) {
      list = list.filter((a) => a.status === params.status);
    }
    if (params.keyword) {
      const kw = String(params.keyword).toLowerCase();
      list = list.filter(
        (a) =>
          a.student_name.toLowerCase().includes(kw) ||
          a.student_code.toLowerCase().includes(kw) ||
          a.assignment_title.toLowerCase().includes(kw)
      );
    }
    return list;
  };

  // lms-api has no endpoint to store an integrity review decision (no integrity status column on
  // submissions), so this only works for the offline demo data and never calls the backend.
  updateSubmissionIntegrityStatus = async (alertId, status) => {
    const exists = (mockStore.submissionIntegrityAlerts || []).some((a) => a.id === alertId);
    if (!exists) {
      throw new Error('lms-api chưa hỗ trợ lưu kết luận hậu kiểm bài nộp');
    }
    mockStore.submissionIntegrityAlerts = (mockStore.submissionIntegrityAlerts || []).map((a) =>
      a.id === alertId ? normalizeIntegrityAlert({ ...a, status }) : a
    );
    return mockStore.submissionIntegrityAlerts.find((a) => a.id === alertId);
  };
}

const usersApi = new UsersApi();
export default usersApi;
