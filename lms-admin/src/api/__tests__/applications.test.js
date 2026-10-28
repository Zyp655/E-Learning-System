import api from '../../utils/api';
import applicationsApi from '../applications';
import { mockStore } from '../../utils/mockData';

jest.mock('../../utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

// lms-api entity.TeacherApplication JSON.
const backendApp = {
  id: 7,
  userId: 310,
  user: { id: 310, fullName: 'Trần Thị Hoa', email: 'hoa@example.edu' },
  fullName: 'Trần Thị Hoa',
  email: 'hoa@example.edu',
  specialization: 'Thị giác máy tính',
  degree: 'Tiến sĩ',
  yearsOfExperience: 5,
  bio: 'Muốn giảng dạy',
  status: 'pending',
  reviewNote: '',
  createdAt: '2026-10-21T09:30:00Z',
};

describe('teacher applications match lms-api (QA 5.3 Medium)', () => {
  beforeEach(() => jest.clearAllMocks());

  // Regression: PUT /v1/admin/teacher-applications/:id (not registered) with numeric status 1/2.
  it.each([
    [1, 'approved'],
    [2, 'rejected'],
  ])('review(status %s) calls PUT /:id/review with status %s and reviewNote', async (ui, backend) => {
    api.put.mockResolvedValue({
      data: { code: 0, data: { application: { ...backendApp, status: backend, reviewNote: 'ok' } } },
    });
    const updated = await applicationsApi.review(7, { status: ui, adminNote: 'ok' });
    expect(api.put).toHaveBeenCalledWith('/v1/admin/teacher-applications/7/review', {
      status: backend,
      reviewNote: 'ok',
    });
    expect(updated).toMatchObject({ id: 7, status: ui, admin_note: 'ok' });
  });

  it('rejects an invalid status without calling the backend', async () => {
    await expect(applicationsApi.review(7, { status: 0, adminNote: '' })).rejects.toThrow();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('propagates a rejected review and leaves the demo store untouched', async () => {
    const before = JSON.stringify(mockStore.teacherApplications);
    api.put.mockRejectedValue({ status: 404, data: { code: 40400, message: 'not found' } });
    await expect(applicationsApi.review(mockStore.teacherApplications[0].id, { status: 1, adminNote: 'x' })).rejects.toMatchObject({ status: 404 });
    expect(JSON.stringify(mockStore.teacherApplications)).toBe(before);
  });

  it('lists with the string status filter and maps backend fields', async () => {
    api.get.mockResolvedValue({ data: { code: 0, data: { items: [backendApp] } } });
    const res = await applicationsApi.getAll({ status: 0 });
    expect(api.get).toHaveBeenCalledWith('/v1/admin/teacher-applications', { params: { status: 'pending' } });
    expect(res.data[0]).toMatchObject({
      id: 7,
      status: 0,
      full_name: 'Trần Thị Hoa',
      expertise: 'Thị giác máy tính',
      qualifications: 'Tiến sĩ',
      experience: '5 năm',
      reason: 'Muốn giảng dạy',
    });
  });

  it('an empty backend list is empty, not mock data', async () => {
    api.get.mockResolvedValue({ data: { code: 0, data: { items: null } } });
    await expect(applicationsApi.getAll({})).resolves.toEqual({ data: [], total: 0 });
  });
});
