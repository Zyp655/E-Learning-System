import api from '../../utils/api';
import confusionApi from '../confusion';

jest.mock('../../utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

// lms-api GET/PUT /v1/admin/confusion/settings data (FEAT-003 contract, api/admin/v1 GetConfusionSettingsRes).
const backendSettings = (overrides = {}) => ({
  settings: {
    mlThreshold: 0.6,
    ruleThreshold: 35,
    slidingWindowSize: 3,
    cooldownSeconds: 300,
    faceSimilarityThreshold: 0.55,
    maxAbsentChecks: 6,
    thetaOn: 0.4,
    thetaOff: 0.25,
    minHoldSec: 10,
    wFace: 0.7,
    wBeh: 0,
    wQuiz: 1,
    hmmKeepConfused: 0.6,
    ...overrides,
  },
  spBefDefaults: { thetaOn: 0.4, thetaOff: 0.25, minHoldSec: 10, wFace: 0.7, wBeh: 0, wQuiz: 1, hmmKeepConfused: 0.6 },
  spBefOverrides: Object.fromEntries(
    Object.entries(overrides).filter(([k]) =>
      ['thetaOn', 'thetaOff', 'minHoldSec', 'wFace', 'wBeh', 'wQuiz', 'hmmKeepConfused'].includes(k)
    )
  ),
  legacyFields: ['mlThreshold', 'slidingWindowSize', 'cooldownSeconds', 'faceSimilarityThreshold', 'maxAbsentChecks'],
  modelVersion: '2.1.0-sp-bef',
});

const httpError = (status, msg) => ({ status, data: { code: 40001, message: msg } });

describe('AI settings use the lms-api SP-BEF contract (QA 5.3 High)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads effective SP-BEF values, defaults, overrides and legacy labels from GET', async () => {
    api.get.mockResolvedValue({ data: { code: 0, data: backendSettings({ thetaOn: 0.7 }) } });
    const s = await confusionApi.getSettings();
    expect(api.get).toHaveBeenCalledWith('/v1/admin/confusion/settings');
    expect(s).toMatchObject({
      theta_on: 0.7,
      theta_off: 0.25,
      min_hold_sec: 10,
      w_face: 0.7,
      w_beh: 0,
      w_quiz: 1,
      hmm_keep_confused: 0.6,
      ml_threshold: 0.6,
      cooldown_seconds: 300,
      source: 'api',
      modelVersion: '2.1.0-sp-bef',
    });
    expect(s.spBefOverrides).toEqual({ thetaOn: 0.7 });
    expect(s.legacyFields).toContain('mlThreshold');
  });

  // Regression: the page sent snake_case SP-BEF keys and ml_threshold = theta_on, and kept the values only in
  // mockStore; it never read them back from the server.
  it('PUT sends the camelCase names UpdateConfusionSettingsReq binds, and returns the saved values', async () => {
    const saved = backendSettings({ thetaOn: 0.7, thetaOff: 0.5, minHoldSec: 5, wFace: 0.5, wBeh: 0.2, wQuiz: 0.8, hmmKeepConfused: 0.7 });
    api.put.mockResolvedValue({ data: { code: 0, data: saved } });
    const out = await confusionApi.updateSettings({
      theta_on: 0.7,
      theta_off: 0.5,
      min_hold_sec: 5,
      w_face: 0.5,
      w_beh: 0.2,
      w_quiz: 0.8,
      hmm_keep_confused: 0.7,
      cooldown_seconds: 300,
      face_similarity_threshold: 0.55,
      max_absent_checks: 6,
    });
    const [path, body] = api.put.mock.calls[0];
    expect(path).toBe('/v1/admin/confusion/settings');
    expect(body).toEqual({
      thetaOn: 0.7,
      thetaOff: 0.5,
      minHoldSec: 5,
      wFace: 0.5,
      wBeh: 0.2,
      wQuiz: 0.8,
      hmmKeepConfused: 0.7,
      cooldownSeconds: 300,
      faceSimilarityThreshold: 0.55,
      maxAbsentChecks: 6,
    });
    expect(body).not.toHaveProperty('mlThreshold');
    expect(Object.keys(body).some((k) => k.includes('_'))).toBe(false);
    expect(out).toMatchObject({ theta_on: 0.7, theta_off: 0.5, w_beh: 0.2, hmm_keep_confused: 0.7, source: 'api' });
  });

  it('keeps a weight of 0 (disables a branch) instead of dropping it', async () => {
    api.put.mockResolvedValue({ data: { code: 0, data: backendSettings({ wBeh: 0 }) } });
    await confusionApi.updateSettings({ w_beh: 0 });
    expect(api.put.mock.calls[0][1]).toEqual({ wBeh: 0 });
  });

  it('surfaces backend validation errors (40001) and does not fall back to mock data', async () => {
    api.put.mockRejectedValue(httpError(400, 'thetaOff must be < thetaOn'));
    await expect(confusionApi.updateSettings({ theta_on: 0.3, theta_off: 0.5 })).rejects.toMatchObject({
      status: 400,
      data: { message: 'thetaOff must be < thetaOn' },
    });
  });

  it('surfaces GET HTTP errors', async () => {
    api.get.mockRejectedValue(httpError(403, 'forbidden'));
    await expect(confusionApi.getSettings()).rejects.toMatchObject({ status: 403 });
  });

  it('falls back to the labelled demo store only without an HTTP response', async () => {
    api.get.mockRejectedValue(new Error('Network Error'));
    const s = await confusionApi.getSettings();
    expect(s.source).toBe('demo');
    expect(s.theta_on).toBe(0.4);

    api.put.mockRejectedValue(new Error('Network Error'));
    const saved = await confusionApi.updateSettings({ theta_on: 0.55 });
    expect(saved.source).toBe('demo');
    expect(saved.theta_on).toBe(0.55);
  });

  it('seed-data and generate-embeddings errors are not reported as success', async () => {
    api.post.mockRejectedValue({ status: 403, data: { code: 40300, message: 'seed disabled' } });
    await expect(confusionApi.seedDemoData()).rejects.toMatchObject({ status: 403 });
    await expect(confusionApi.generateEmbeddings()).rejects.toMatchObject({ status: 403 });
  });
});
