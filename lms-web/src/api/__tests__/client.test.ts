import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { ACCESS_TOKEN_KEY, ApiError, REFRESH_TOKEN_KEY, apiFetch } from '../client';
import { accountModeForRole, authApi } from '../auth';
import { BACKEND_CODING_PROBLEM_IDS, CODING_LAB_NOT_GRADABLE_MESSAGE, backendCodingProblemId, lmsApi } from '..';
import { MOCK_CODING_CHALLENGES } from '../mockData';
import { installLocalStorage, jsonResponse, mockFetch, networkDown } from './testUtils';

afterEach(() => {
  vi.unstubAllGlobals();
});

const envelope = (data: unknown) => ({ code: 0, message: 'OK', data });

describe('apiFetch', () => {
  it('unwraps the {code, message, data} envelope and sends the bearer token', async () => {
    installLocalStorage({ [ACCESS_TOKEN_KEY]: 'jwt-1' });
    const calls = mockFetch(() => jsonResponse(200, envelope({ id: 7 })));

    await expect(apiFetch('/v1/user/profile', { method: 'GET' })).resolves.toEqual({ id: 7 });
    expect(calls[0].headers.Authorization).toBe('Bearer jwt-1');
    expect(calls[0].headers.Scope).toBe('lms-web');
  });

  it('uses the fallback for a GET only when there is no HTTP response', async () => {
    installLocalStorage();
    mockFetch(networkDown);
    await expect(apiFetch('/v1/public/courses', { method: 'GET' }, ['offline'])).resolves.toEqual(['offline']);
  });

  it('throws ApiError with status, code and message on HTTP errors for reads, ignoring the fallback', async () => {
    installLocalStorage();
    mockFetch(() => jsonResponse(404, { code: 40420, message: 'Course not found', data: null }));

    const err = await apiFetch('/v1/public/courses/9', { method: 'GET' }, { mock: true }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 40420, message: 'Course not found', isNetworkError: false });
  });

  it('throws on HTTP errors for writes', async () => {
    installLocalStorage();
    mockFetch(() => jsonResponse(500, { code: 50021, message: 'database failed', data: null }));

    const err = await apiFetch('/v1/student/coding/submit', { method: 'POST', body: '{}' }, { score: 100 }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 500, code: 50021 });
  });

  it('never uses the fallback for a POST, even when the backend is offline', async () => {
    installLocalStorage();
    mockFetch(networkDown);

    const err = await apiFetch('/v1/student/coding/submit', { method: 'POST', body: '{}' }, { score: 100 }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, isNetworkError: true });
  });

  it('allows an explicit allowMockFallback opt-in for non-reads on network errors only', async () => {
    installLocalStorage();
    mockFetch(networkDown);
    await expect(
      apiFetch('/v1/student/confusion/predict', { method: 'POST', allowMockFallback: true }, { status: 'x' }),
    ).resolves.toEqual({ status: 'x' });

    mockFetch(() => jsonResponse(400, { code: 40001, message: 'bad', data: null }));
    await expect(
      apiFetch('/v1/student/confusion/predict', { method: 'POST', allowMockFallback: true }, { status: 'x' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('throws when HTTP 200 carries an error envelope (code != 0)', async () => {
    installLocalStorage();
    mockFetch(() => jsonResponse(200, { code: 40303, message: 'permission denied', data: null }));
    await expect(apiFetch('/v1/user/profile', { method: 'GET' }, {})).rejects.toMatchObject({
      status: 200,
      code: 40303,
      message: 'permission denied',
    });
  });

  it('clears the stored tokens on 401', async () => {
    const store = installLocalStorage({ [ACCESS_TOKEN_KEY]: 'expired', [REFRESH_TOKEN_KEY]: 'r' });
    mockFetch(() => jsonResponse(401, { code: 40102, message: 'please provide authorization', data: null }));

    await expect(apiFetch('/v1/student/tasks', { method: 'GET' }, [])).rejects.toMatchObject({ status: 401 });
    expect(store.has(ACCESS_TOKEN_KEY)).toBe(false);
    expect(store.has(REFRESH_TOKEN_KEY)).toBe(false);
  });
});

describe('authApi.login', () => {
  const bundle = {
    accessToken: 'access-123',
    refreshToken: 'refresh-456',
    sessionToken: 's',
    expiresIn: 3600,
    user: { id: 3, email: 'student@lms.edu.vn', role: 'student' },
  };

  it('posts credentials to /v1/auth/login and stores lms_access_token', async () => {
    const store = installLocalStorage();
    const calls = mockFetch(() => jsonResponse(200, envelope(bundle)));

    const res = await authApi.login(' student@lms.edu.vn ', '123456');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/v1\/auth\/login$/);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({ email: 'student@lms.edu.vn', password: '123456', scope: 'lms-web' });
    expect(res.user.role).toBe('student');
    expect(store.get(ACCESS_TOKEN_KEY)).toBe('access-123');
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('refresh-456');
  });

  it('does not store a token when the credentials are rejected', async () => {
    const store = installLocalStorage();
    mockFetch(() => jsonResponse(401, { code: 40108, message: 'Email hoặc mật khẩu không đúng', data: null }));

    await expect(authApi.login('student@lms.edu.vn', 'wrong')).rejects.toMatchObject({
      status: 401,
      code: 40108,
      message: 'Email hoặc mật khẩu không đúng',
    });
    expect(store.has(ACCESS_TOKEN_KEY)).toBe(false);
  });

  it('rejects a response without accessToken', async () => {
    const store = installLocalStorage();
    mockFetch(() => jsonResponse(200, envelope({ user: bundle.user })));
    await expect(authApi.login('a@b.c', 'x')).rejects.toBeInstanceOf(ApiError);
    expect(store.has(ACCESS_TOKEN_KEY)).toBe(false);
  });

  it('maps the backend role to the lms-web workspace and logout clears the tokens', () => {
    expect(accountModeForRole('teacher')).toBe('teacher');
    expect(accountModeForRole('admin')).toBe('teacher');
    expect(accountModeForRole('student')).toBe('student');
    expect(accountModeForRole(undefined)).toBe('student');

    const store = installLocalStorage({ [ACCESS_TOKEN_KEY]: 'a', [REFRESH_TOKEN_KEY]: 'b' });
    authApi.logout();
    expect(store.size).toBe(0);
  });
});

describe('lmsApi writes never return mock success', () => {
  const codingPayload = { challengeId: 1, language: 'python' as const, code: 'def solve():\n    return 42\n' };

  // Regression (review round 1): local challenge ids were sent as the backend problemId, and lms-api fell back
  // to another problem, so e.g. challenge 11 was graded against the EAR eye-lock lab.
  it('run/submit refuse challenges without a backend CodingProblem and never call lms-api for them', async () => {
    installLocalStorage();
    const calls = mockFetch(() => jsonResponse(200, envelope({ score: 100, testResults: [] })));
    const local = MOCK_CODING_CHALLENGES.filter((c) => backendCodingProblemId(c.id) === null);
    expect(local.length).toBeGreaterThan(0);
    for (const ch of local) {
      const payload = { challengeId: ch.id, language: 'python' as const, code: 'x = 1' };
      await expect(lmsApi.runCodingPublicTests(payload)).rejects.toThrow(CODING_LAB_NOT_GRADABLE_MESSAGE);
      await expect(lmsApi.submitCodingAllTests({ ...payload, honorCodeAccepted: true })).rejects.toThrow(
        CODING_LAB_NOT_GRADABLE_MESSAGE,
      );
    }
    expect(calls).toHaveLength(0);

    // Mapped challenges send the backend id.
    for (const [challengeId, problemId] of Object.entries(BACKEND_CODING_PROBLEM_IDS)) {
      await lmsApi.runCodingPublicTests({ challengeId: Number(challengeId), language: 'python', code: 'x = 1' });
      expect(calls[calls.length - 1].body).toEqual({ problemId, language: 'python', code: 'x = 1' });
    }
  });

  it('submitCodingAllTests propagates offline and HTTP errors instead of a fake 100/100 score', async () => {
    installLocalStorage();
    mockFetch(networkDown);
    await expect(lmsApi.submitCodingAllTests({ ...codingPayload, honorCodeAccepted: true })).rejects.toMatchObject({
      isNetworkError: true,
    });

    mockFetch(() => jsonResponse(500, { code: 50021, message: 'grader failed', data: null }));
    await expect(lmsApi.submitCodingAllTests({ ...codingPayload, honorCodeAccepted: true })).rejects.toMatchObject({
      status: 500,
      message: 'grader failed',
    });
  });

  it('submitCodingAllTests maps service.CodingExecutionResult and reports no similarity score', async () => {
    installLocalStorage();
    const calls = mockFetch(() =>
      jsonResponse(
        200,
        envelope({
          passedCount: 1,
          totalCount: 2,
          score: 50,
          status: 'partial',
          aiTutorHint: 'check edge cases',
          testResults: [
            { name: 'a', input: '1', expected: '1', actual: '1', passed: true, isHidden: false, runtimeMs: 3 },
            { name: 'b', input: '2', expected: '4', actual: '3', passed: false, isHidden: true, runtimeMs: 4 },
          ],
        }),
      ),
    );

    const res = await lmsApi.submitCodingAllTests({ ...codingPayload, honorCodeAccepted: true });
    expect(calls[0].url).toMatch(/\/v1\/student\/coding\/submit$/);
    expect(calls[0].body).toMatchObject({ problemId: 1, language: 'python', code: codingPayload.code });
    // lms-api completes the problem's own lesson; the local mock lessonId (105) must not be sent.
    expect(calls[0].body).not.toHaveProperty('lessonId');
    expect(res.score).toBe(50);
    expect(res.similarityScore).toBeNull();
    expect(res.aiFeedback).toBe('check edge cases');
    expect(res.results[1]).toMatchObject({ name: 'b', expectedOutput: '4', actualOutput: '3', passed: false });
  });

  it('runCodingPublicTests, resetCourseDeadlines, markLessonCompleted, enrollSpecialization and face registration throw when offline', async () => {
    installLocalStorage();
    mockFetch(networkDown);
    const v = new Array(192).fill(0.1);
    await expect(lmsApi.runCodingPublicTests(codingPayload)).rejects.toBeInstanceOf(ApiError);
    await expect(lmsApi.resetCourseDeadlines(1)).rejects.toBeInstanceOf(ApiError);
    await expect(lmsApi.markLessonCompleted(101)).rejects.toBeInstanceOf(ApiError);
    await expect(lmsApi.enrollSpecialization(1)).rejects.toBeInstanceOf(ApiError);
    await expect(lmsApi.registerFaceEmbeddings({ front: v, left: v, right: v })).rejects.toBeInstanceOf(ApiError);
    await expect(
      lmsApi.logFaceViolation({ lessonId: 1, violationType: 'identity_mismatch', videoTimestampSec: 1, similarityScore: 0.2 }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      lmsApi.explainConfusion({
        lessonId: 101,
        timestamp: 30,
        totalDuration: 600,
        confusionSignals: { pauseCount: 1, rewindCount: 1, emotion: 'confused', mlProb: 0.7, ruleScore: 40 },
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('uses the backend routes and request bodies', async () => {
    installLocalStorage();
    const calls = mockFetch((call) => {
      if (call.url.endsWith('/reset-deadlines')) {
        return jsonResponse(
          200,
          envelope({
            message: 'Đã dời hạn',
            updatedTasksCount: 2,
            moduleDeadlines: [
              { dueDate: '2026-11-03T23:59:00Z', dueDateFormatted: '03/11/2026 23:59' },
              { dueDate: '2026-11-10T23:59:00Z', dueDateFormatted: '10/11/2026 23:59' },
            ],
          }),
        );
      }
      return jsonResponse(200, envelope({ success: true }));
    });
    const v = new Array(192).fill(0.1);

    await lmsApi.markLessonCompleted(101);
    await lmsApi.registerFaceEmbeddings({ front: v, left: v, right: v });
    await lmsApi.logFaceViolation({
      lessonId: 101,
      violationType: 'face_absent_30s',
      videoTimestampSec: 12.6,
      similarityScore: 0,
    });
    const reset = await lmsApi.resetCourseDeadlines(4);

    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      'POST /v1/student/lessons/101/complete-reading',
      'POST /v1/student/face',
      'POST /v1/student/face/violation',
      'POST /v1/student/courses/4/reset-deadlines',
    ]);
    const facePoses = (calls[1].body as { poses: { pose: string; embedding: number[] }[] }).poses;
    expect(facePoses.map((p) => p.pose)).toEqual(['front', 'left', 'right']);
    expect(facePoses[0].embedding).toHaveLength(192);
    expect(calls[2].body).toMatchObject({ lessonId: 101, violationType: 'no_face_30s', videoTimestamp: 13 });
    expect(reset).toMatchObject({ courseId: 4, message: 'Đã dời hạn', newDeadlineDate: '10/11/2026 23:59' });
  });

  it('getCodingChallenge is local content and makes no network call', async () => {
    installLocalStorage();
    const calls = mockFetch(() => jsonResponse(500, {}));
    const ch = await lmsApi.getCodingChallenge(1);
    expect(ch.id).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('predictConfusion returns the honest indeterminate state (not a prediction) when the backend rejects it', async () => {
    installLocalStorage();
    mockFetch(() => jsonResponse(401, { code: 40102, message: 'please provide authorization', data: null }));
    const res = await lmsApi.predictConfusion({ hasFace: false });
    expect(res).toMatchObject({ status: 'indeterminate', probability: null, shouldIntervene: false });
  });
});
