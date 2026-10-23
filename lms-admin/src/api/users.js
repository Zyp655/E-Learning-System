import api from '../utils/api';
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

export const normalizeProctoringViolation = (v = {}) => {
  const studentName = v.student_name || v.studentName || v.full_name || v.fullName || 'Sinh viên';
  const studentCode = v.student_code || v.studentCode || 'SV20220000';
  const courseTitle = v.course_title || v.courseTitle || 'Học sâu và Thị giác Máy tính';
  const lessonTitle = v.lesson_title || v.lessonTitle || 'Bài giảng Video';
  const videoTimestampSec = Number(v.video_timestamp_sec ?? v.videoTimestampSec ?? 0);
  const violationType = v.violation_type || v.violationType || 'face_absent_30s';
  const cosineSimilarity = Number(v.cosine_similarity ?? v.cosineSimilarity ?? 0);
  const thresholdRequired = Number(v.threshold_required ?? v.thresholdRequired ?? 0.55);
  const absentDurationSec = Number(v.absent_duration_sec ?? v.absentDurationSec ?? 30);
  const consecutiveFails = Number(v.consecutive_fails ?? v.consecutiveFails ?? 6);
  const createdAt = v.created_at || v.createdAt || '2026-10-23 09:00:00';

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

export const normalizeIntegrityAlert = (a = {}) => {
  const studentName = a.student_name || a.studentName || 'Sinh viên';
  const studentCode = a.student_code || a.studentCode || 'SV20220000';
  const courseTitle = a.course_title || a.courseTitle || 'Khóa học';
  const assignmentTitle = a.assignment_title || a.assignmentTitle || 'Bài tập';
  const honorCodeAccepted = Boolean(a.honor_code_accepted ?? a.honorCodeAccepted ?? true);
  const similarityScore = Number(a.similarity_score ?? a.similarityScore ?? 0);
  const matchedSource = a.matched_source || a.matchedSource || '';
  const aiGradeScore = Number(a.ai_grade_score ?? a.aiGradeScore ?? 0);
  const aiGradeConfidence = Number(a.ai_grade_confidence ?? a.aiGradeConfidence ?? 0.9);
  const submittedAt = a.submitted_at || a.submittedAt || '2026-10-22 20:00:00';

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
    status: a.status || 'pending_review',
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

  resetFaceEmbedding = async (userId) => {
    try {
      await Promise.allSettled([
        api.delete(`/v1/admin/users/${userId}/face`),
        api.delete('/v1/student/face', {
          data: { user_id: userId, userId },
          params: { user_id: userId, userId },
        }),
      ]);
    } catch (error) {}

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
    try {
      const res = await api.get('/v1/admin/proctoring/violations', { params });
      const items = res?.data?.data?.items || res?.data?.data || res?.data;
      if (Array.isArray(items) && items.length > 0) {
        return items.map(normalizeProctoringViolation);
      }
    } catch (error) {}

    let list = (mockStore.proctoringViolations || []).map(normalizeProctoringViolation);
    if (params.violation_type) {
      list = list.filter((v) => v.violation_type === params.violation_type);
    }
    if (params.status) {
      list = list.filter((v) => v.status === params.status);
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
      await api.put(`/v1/admin/proctoring/violations/${violationId}`, {
        status,
        admin_note: adminNote,
        adminNote,
      });
    } catch (error) {}

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

  getSubmissionIntegrityAlerts = async (params = {}) => {
    try {
      const res = await api.get('/v1/admin/proctoring/submissions', { params });
      const items = res?.data?.data?.items || res?.data?.data || res?.data;
      if (Array.isArray(items) && items.length > 0) {
        return items.map(normalizeIntegrityAlert);
      }
    } catch (error) {}

    let list = (mockStore.submissionIntegrityAlerts || []).map(normalizeIntegrityAlert);
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

  updateSubmissionIntegrityStatus = async (alertId, status) => {
    try {
      await api.put(`/v1/admin/proctoring/submissions/${alertId}`, { status });
    } catch (error) {}

    mockStore.submissionIntegrityAlerts = (mockStore.submissionIntegrityAlerts || []).map((a) =>
      a.id === alertId ? normalizeIntegrityAlert({ ...a, status }) : a
    );
    return mockStore.submissionIntegrityAlerts.find((a) => a.id === alertId);
  };
}

const usersApi = new UsersApi();
export default usersApi;
