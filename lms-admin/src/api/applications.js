import api from '../utils/api';
import { isHttpError } from '../utils/httpError';
import { mockStore } from '../utils/mockData';

// The admin UI uses numeric statuses (0 pending, 1 approved, 2 rejected); lms-api entity.TeacherApplication
// and ReviewTeacherApplicationReq use the strings pending | approved | rejected.
export const STATUS_TO_BACKEND = { 0: 'pending', 1: 'approved', 2: 'rejected' };
const STATUS_FROM_BACKEND = { pending: 0, approved: 1, rejected: 2 };

const toUiStatus = (status) => {
  if (typeof status === 'string' && STATUS_FROM_BACKEND[status] !== undefined) {
    return STATUS_FROM_BACKEND[status];
  }
  const n = Number(status ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const normalizeApplication = (app = {}) => {
  const userId = app.user_id ?? app.userId ?? null;
  const fullName = app.full_name || app.fullName || app.name || app.user?.fullName || '';
  const email = app.email || app.user?.email || '';
  const adminNote = app.admin_note ?? app.adminNote ?? app.reviewNote ?? '';
  const createdAt = app.created_at || app.createdAt || null;
  const reviewedAt = app.reviewed_at || app.reviewedAt || null;
  const years = app.yearsOfExperience;
  const experience =
    app.experience || (years !== undefined && years !== null && years !== 0 ? `${years} năm` : '');

  return {
    ...app,
    id: app.id,
    user_id: userId,
    userId,
    full_name: fullName,
    fullName,
    email,
    expertise: app.expertise || app.specialization || '',
    experience,
    qualifications: app.qualifications || app.degree || '',
    reason: app.reason || app.bio || '',
    status: toUiStatus(app.status),
    admin_note: adminNote,
    adminNote,
    created_at: createdAt,
    createdAt,
    reviewed_at: reviewedAt,
    reviewedAt,
  };
};

const filterByKeyword = (list, keyword) => {
  if (!keyword) return list;
  const kw = String(keyword).toLowerCase();
  return list.filter(
    (a) =>
      a.full_name?.toLowerCase().includes(kw) ||
      a.email?.toLowerCase().includes(kw) ||
      a.expertise?.toLowerCase().includes(kw)
  );
};

const hasStatusFilter = (status) => status !== undefined && status !== '' && status !== null;

class ApplicationsApi {
  getAll = async (params = {}) => {
    let list;
    try {
      // ListTeacherApplicationsReq reads ?status= as a string.
      const query = {};
      if (hasStatusFilter(params.status)) query.status = STATUS_TO_BACKEND[Number(params.status)];
      const res = await api.get('/v1/admin/teacher-applications', { params: query });
      const body = res?.data?.data ?? res?.data;
      const items = Array.isArray(body) ? body : body?.items ?? [];
      list = (Array.isArray(items) ? items : []).map(normalizeApplication);
    } catch (error) {
      // Offline demo mode only: HTTP errors must surface instead of showing invented applications.
      if (isHttpError(error)) throw error;
      list = mockStore.teacherApplications.map(normalizeApplication);
      if (hasStatusFilter(params.status)) {
        list = list.filter((a) => Number(a.status) === Number(params.status));
      }
    }
    list = filterByKeyword(list, params.keyword);
    return { data: list, total: list.length };
  };

  // status: numeric UI status (1 approve, 2 reject) or the backend string.
  review = async (id, { status, adminNote }) => {
    const backendStatus =
      typeof status === 'string' ? status : STATUS_TO_BACKEND[Number(status)];
    if (backendStatus !== 'approved' && backendStatus !== 'rejected') {
      throw new Error(`Trạng thái duyệt không hợp lệ: ${status}`);
    }
    try {
      const res = await api.put(`/v1/admin/teacher-applications/${id}/review`, {
        status: backendStatus,
        reviewNote: adminNote,
      });
      const updated = res?.data?.data?.application;
      if (updated && updated.id !== undefined) return normalizeApplication(updated);
      return normalizeApplication({ id, status: backendStatus, reviewNote: adminNote });
    } catch (error) {
      if (isHttpError(error)) throw error;
    }

    // Offline demo mode only.
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    mockStore.teacherApplications = mockStore.teacherApplications.map((app) =>
      app.id === id
        ? normalizeApplication({
            ...app,
            status: STATUS_FROM_BACKEND[backendStatus],
            admin_note: adminNote,
            reviewed_at: now,
          })
        : app
    );
    return mockStore.teacherApplications.find((a) => a.id === id);
  };
}

const applicationsApi = new ApplicationsApi();
export default applicationsApi;
