import api from '../../utils/api';
import usersApi from '../users';
import { mockStore } from '../../utils/mockData';

jest.mock('../../utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

// JSON produced by lms-api toAdminProctoringViolationView (entity.ProctoringViolation embedded plus the
// snake_case/camelCase helper fields declared in api/admin/v1 AdminProctoringViolationView).
const backendViolation = {
  id: 42,
  createdAt: '2026-10-27T09:00:00+07:00',
  userId: 104,
  lessonId: 2003,
  courseId: 1,
  violationType: 'identity_mismatch',
  videoTimestamp: 645,
  durationSeconds: 12,
  similarityScore: 0.31,
  status: 'pending',
  severity: 'medium',
  adminNote: '',
  userName: 'Phạm Quốc Bảo',
  user_name: 'Phạm Quốc Bảo',
  userEmail: 'bao@example.edu',
  studentCode: 'SV20220519',
  student_code: 'SV20220519',
  courseTitle: 'Học sâu',
  course_title: 'Học sâu',
  lessonTitle: 'Bài 2.1',
  lesson_title: 'Bài 2.1',
  violation_type: 'identity_mismatch',
  video_timestamp: 645,
  duration_seconds: 12,
  similarity_score: 0.31,
  admin_note: '',
};

// HTTP error as rejected by utils/api (it rejects with error.response when the server answered).
const httpError = (status) => ({ status, data: { code: status * 100, message: 'denied' } });
// Network error: no HTTP response (lms-api unreachable, offline demo mode).
const networkError = () => new Error('Network Error');

describe('proctoring violations API matches lms-api', () => {
  beforeEach(() => jest.clearAllMocks());

  // Regression: the page called /v1/admin/proctoring/violations, which lms-api does not register.
  it('lists violations from GET /v1/admin/proctoring-violations with backend query names', async () => {
    api.get.mockResolvedValue({ data: { code: 0, data: { items: [backendViolation], total: 1 } } });
    const list = await usersApi.getProctoringViolations({
      status: 'pending',
      violation_type: 'identity_mismatch',
      keyword: '',
    });
    expect(api.get).toHaveBeenCalledWith('/v1/admin/proctoring-violations', {
      params: { status: 'pending', violationType: 'identity_mismatch' },
    });
    expect(list.map((v) => v.id)).toEqual([42]);
  });

  // Regression: the normalizer only knew mock field names, so real data showed a placeholder student name,
  // timestamp 0, similarity 0 and a 30 s absence for every violation.
  it('maps the real backend field names', async () => {
    api.get.mockResolvedValue({ data: { code: 0, data: { items: [backendViolation], total: 1 } } });
    const [v] = await usersApi.getProctoringViolations({});
    expect(v.student_name).toBe('Phạm Quốc Bảo');
    expect(v.student_code).toBe('SV20220519');
    expect(v.video_timestamp_sec).toBe(645);
    expect(v.cosine_similarity).toBeCloseTo(0.31);
    expect(v.absent_duration_sec).toBe(12);
    expect(v.user_id).toBe(104);
    expect(v.created_at).toBe('2026-10-27T09:00:00+07:00');
  });

  it('maps camelCase-only backend fields too', async () => {
    const camelOnly = { ...backendViolation };
    ['user_name', 'video_timestamp', 'similarity_score', 'duration_seconds'].forEach((k) => delete camelOnly[k]);
    api.get.mockResolvedValue({ data: { code: 0, data: { items: [camelOnly] } } });
    const [v] = await usersApi.getProctoringViolations({});
    expect(v.student_name).toBe('Phạm Quốc Bảo');
    expect(v.video_timestamp_sec).toBe(645);
    expect(v.cosine_similarity).toBeCloseTo(0.31);
    expect(v.absent_duration_sec).toBe(12);
  });

  // Regression: an empty backend result (items: null) fell back to invented mock violations.
  it('returns an empty list when lms-api has no violations', async () => {
    api.get.mockResolvedValue({ data: { code: 0, data: { items: null, violations: null, total: 0 } } });
    await expect(usersApi.getProctoringViolations({ status: 'pending' })).resolves.toEqual([]);
  });

  it('surfaces HTTP errors from the list endpoint instead of showing mock data', async () => {
    api.get.mockRejectedValue(httpError(403));
    await expect(usersApi.getProctoringViolations({})).rejects.toMatchObject({ status: 403 });
  });

  it('falls back to demo data only when lms-api is unreachable', async () => {
    api.get.mockRejectedValue(networkError());
    const list = await usersApi.getProctoringViolations({});
    expect(list.length).toBe((mockStore.proctoringViolations || []).length);
  });

  it('resolves a violation with PUT /v1/admin/proctoring-violations/:id and returns the backend view', async () => {
    api.put.mockResolvedValue({
      data: { code: 0, data: { violation: { ...backendViolation, status: 'resolved', adminNote: 'ok', admin_note: 'ok' } } },
    });
    const updated = await usersApi.resolveProctoringViolation(42, { status: 'resolved', adminNote: 'ok' });
    expect(api.put).toHaveBeenCalledWith(
      '/v1/admin/proctoring-violations/42',
      expect.objectContaining({ status: 'resolved', adminNote: 'ok' })
    );
    expect(updated).toMatchObject({ id: 42, status: 'resolved', admin_note: 'ok' });
  });

  // Regression: PUT errors were swallowed and the mock store updated, so the UI reported success even
  // when lms-api rejected the change.
  it('propagates a rejected PUT and leaves the local store untouched', async () => {
    const target = (mockStore.proctoringViolations || [])[0];
    const before = target.status;
    api.put.mockRejectedValue(httpError(401));
    await expect(
      usersApi.resolveProctoringViolation(target.id, { status: 'penalized', adminNote: 'x' })
    ).rejects.toMatchObject({ status: 401 });
    expect(mockStore.proctoringViolations.find((v) => v.id === target.id).status).toBe(before);
  });
});
