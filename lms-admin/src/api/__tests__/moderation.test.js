import api from '../../utils/api';
import coursesApi from '../courses';
import usersApi from '../users';
import { mockStore } from '../../utils/mockData';

jest.mock('../../utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

const httpError = (status) => ({ status, data: { code: status * 100, message: 'denied' } });

describe('course reviews use GET/DELETE /v1/admin/reviews (added to lms-api)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists AdminReviewView items', async () => {
    api.get.mockResolvedValue({
      data: {
        code: 0,
        data: {
          items: [
            { id: 3, courseId: 1, courseTitle: 'Học sâu', userName: 'SV A', rating: 4, comment: 'hay', teacherResponse: '', helpfulCount: 0, createdAt: '2026-10-20T00:00:00Z' },
          ],
          total: 1,
        },
      },
    });
    const list = await coursesApi.getReviews();
    expect(api.get).toHaveBeenCalledWith('/v1/admin/reviews', { params: {} });
    expect(list[0]).toMatchObject({ id: 3, course_title: 'Học sâu', user_name: 'SV A', status: 'approved' });
  });

  it('surfaces HTTP errors instead of mock reviews', async () => {
    api.get.mockRejectedValue(httpError(403));
    await expect(coursesApi.getReviews()).rejects.toMatchObject({ status: 403 });
  });

  it('deletes through DELETE /v1/admin/reviews/:id and propagates failures', async () => {
    api.delete.mockResolvedValue({ data: { code: 0, data: { id: 3, success: true } } });
    await coursesApi.deleteReview(3);
    expect(api.delete).toHaveBeenCalledWith('/v1/admin/reviews/3');

    api.delete.mockRejectedValue(httpError(404));
    await expect(coursesApi.deleteReview(3)).rejects.toMatchObject({ status: 404 });
  });

  it('approving a backend review is reported as unsupported and makes no request', async () => {
    await expect(coursesApi.moderateReview(987654, 'approved')).rejects.toThrow('không hỗ trợ');
    expect(api.put).not.toHaveBeenCalled();
  });
});

describe('getCourseById uses the registered GET /v1/admin/courses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('picks the course from the admin tree list', async () => {
    api.get.mockResolvedValue({
      data: { code: 0, data: { items: [{ id: 1, title: 'A' }, { id: 2, title: 'B', modules: [] }], total: 2 } },
    });
    const c = await coursesApi.getCourseById(2);
    expect(api.get).toHaveBeenCalledWith('/v1/admin/courses');
    expect(c).toMatchObject({ id: 2, title: 'B' });
  });

  it('returns null when the course does not exist', async () => {
    api.get.mockResolvedValue({ data: { code: 0, data: { items: [] } } });
    await expect(coursesApi.getCourseById(99)).resolves.toBeNull();
  });
});

describe('submission integrity uses GET /v1/admin/proctoring/submissions (added to lms-api)', () => {
  beforeEach(() => jest.clearAllMocks());

  const backendItem = {
    id: 11,
    assignmentId: 5,
    assignmentTitle: 'Lab 1',
    courseId: 1,
    courseTitle: 'Học sâu',
    userId: 104,
    studentName: 'SV B',
    studentCode: '',
    honorCodeAccepted: false,
    similarityScore: 3,
    integrityStatus: '',
    matchedSourcesCount: 0,
    analysisSummary: '',
    submissionStatus: 'submitted',
    aiGradeScore: null,
    aiGradeConfidence: null,
    submittedAt: '2026-10-22T20:00:00Z',
  };

  it('maps AdminSubmissionIntegrityView without fabricated values', async () => {
    api.get.mockResolvedValue({ data: { code: 0, data: { items: [backendItem], total: 1 } } });
    const [a] = await usersApi.getSubmissionIntegrityAlerts({});
    expect(api.get).toHaveBeenCalledWith('/v1/admin/proctoring/submissions');
    expect(a).toMatchObject({
      id: 11,
      student_name: 'SV B',
      student_code: '',
      honor_code_accepted: false,
      similarity_score: 3,
      ai_grade_score: null,
      ai_grade_confidence: null,
      status: 'unchecked',
      review_supported: false,
    });
  });

  it('maps the similarity report status', async () => {
    api.get.mockResolvedValue({
      data: { code: 0, data: { items: [{ ...backendItem, integrityStatus: 'flagged', aiGradeScore: 6.5, aiGradeConfidence: 0.8 }] } },
    });
    const [a] = await usersApi.getSubmissionIntegrityAlerts({});
    expect(a).toMatchObject({ status: 'flagged', ai_grade_score: 6.5, ai_grade_confidence: 0.8 });
  });

  it('surfaces HTTP errors', async () => {
    api.get.mockRejectedValue(httpError(500));
    await expect(usersApi.getSubmissionIntegrityAlerts({})).rejects.toMatchObject({ status: 500 });
  });

  it('verify/reject of a backend submission is unsupported and makes no request', async () => {
    await expect(usersApi.updateSubmissionIntegrityStatus(987654, 'verified')).rejects.toThrow('chưa hỗ trợ');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('demo submissions keep their review actions offline', async () => {
    api.get.mockRejectedValue(new Error('Network Error'));
    const list = await usersApi.getSubmissionIntegrityAlerts({});
    expect(list.length).toBe((mockStore.submissionIntegrityAlerts || []).length);
    expect(list.every((a) => a.review_supported)).toBe(true);
  });
});

describe('proctoring normalizer shows no placeholder for fields lms-api does not send (review v2 Low)', () => {
  it('missing student code, titles, threshold and consecutive fails stay empty', async () => {
    api.get.mockResolvedValue({
      data: {
        code: 0,
        data: {
          items: [
            {
              id: 5,
              userId: 9,
              violationType: 'face_absent_30s',
              videoTimestamp: 30,
              durationSeconds: 31,
              similarityScore: 0,
              status: 'pending',
              userName: 'SV C',
              user_name: 'SV C',
              studentCode: '',
              courseTitle: '',
              lessonTitle: '',
            },
          ],
        },
      },
    });
    const [v] = await usersApi.getProctoringViolations({});
    expect(v.student_code).toBe('');
    expect(v.course_title).toBe('');
    expect(v.lesson_title).toBe('');
    expect(v.threshold_required).toBeNull();
    expect(v.consecutive_fails).toBeNull();
    expect(v.absent_duration_sec).toBe(31);
    expect(v.video_timestamp_sec).toBe(30);
  });
});

describe('face reset only calls the admin endpoint', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses DELETE /v1/admin/users/:id/face and never DELETE /v1/student/face', async () => {
    api.delete.mockResolvedValue({ data: { code: 0, data: { success: true } } });
    await usersApi.resetFaceEmbedding(104);
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledWith('/v1/admin/users/104/face');
  });

  it('propagates HTTP errors', async () => {
    api.delete.mockRejectedValue(httpError(403));
    await expect(usersApi.resetFaceEmbedding(104)).rejects.toMatchObject({ status: 403 });
  });
});
