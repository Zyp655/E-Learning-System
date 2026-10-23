import api from '../utils/api';
import { mockStore } from '../utils/mockData';

const normalizeApplication = (app = {}) => {
  const userId = app.user_id ?? app.userId ?? 310;
  const fullName = app.full_name || app.fullName || app.name || 'Ứng viên Giảng viên';
  const adminNote = app.admin_note ?? app.adminNote ?? '';
  const createdAt = app.created_at || app.createdAt || '2026-10-21 09:30';
  const reviewedAt = app.reviewed_at || app.reviewedAt || null;

  return {
    ...app,
    id: app.id,
    user_id: userId,
    userId,
    full_name: fullName,
    fullName,
    email: app.email || '',
    expertise: app.expertise || '',
    experience: app.experience || '',
    qualifications: app.qualifications || '',
    reason: app.reason || '',
    status: Number(app.status ?? 0),
    admin_note: adminNote,
    adminNote,
    created_at: createdAt,
    createdAt,
    reviewed_at: reviewedAt,
    reviewedAt,
  };
};

class ApplicationsApi {
  getAll = async (params = {}) => {
    try {
      const res = await api.get('/v1/admin/teacher-applications', { params });
      const items = res?.data?.data?.items || res?.data?.data || res?.data;
      if (Array.isArray(items) && items.length > 0) {
        const normalized = items.map(normalizeApplication);
        return { data: normalized, total: normalized.length };
      }
    } catch (error) {
      // Fallback
    }

    let list = mockStore.teacherApplications.map(normalizeApplication);
    if (params.status !== undefined && params.status !== '' && params.status !== null) {
      list = list.filter((a) => Number(a.status) === Number(params.status));
    }
    if (params.keyword) {
      const kw = String(params.keyword).toLowerCase();
      list = list.filter(
        (a) =>
          a.full_name?.toLowerCase().includes(kw) ||
          a.email?.toLowerCase().includes(kw) ||
          a.expertise?.toLowerCase().includes(kw)
      );
    }
    return { data: list, total: list.length };
  };

  review = async (id, { status, adminNote }) => {
    try {
      await api.put(`/v1/admin/teacher-applications/${id}`, {
        status,
        admin_note: adminNote,
        adminNote,
      });
    } catch (error) {}

    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    mockStore.teacherApplications = mockStore.teacherApplications.map((app) =>
      app.id === id
        ? normalizeApplication({
            ...app,
            status: Number(status),
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
