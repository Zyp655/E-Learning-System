import api from '../utils/api';
import { isHttpError } from '../utils/httpError';
import { mockStore } from '../utils/mockData';

// Form field (snake_case, used by routes/ai-settings) -> lms-api JSON name (camelCase), as declared in
// lms-api api/admin/v1 ConfusionSettingsView / UpdateConfusionSettingsReq.
export const SP_BEF_FIELDS = {
  theta_on: 'thetaOn',
  theta_off: 'thetaOff',
  min_hold_sec: 'minHoldSec',
  w_face: 'wFace',
  w_beh: 'wBeh',
  w_quiz: 'wQuiz',
  hmm_keep_confused: 'hmmKeepConfused',
};

export const LEGACY_FIELDS = {
  ml_threshold: 'mlThreshold',
  rule_threshold: 'ruleThreshold',
  sliding_window_size: 'slidingWindowSize',
  cooldown_seconds: 'cooldownSeconds',
  face_similarity_threshold: 'faceSimilarityThreshold',
  max_absent_checks: 'maxAbsentChecks',
};

const ALL_FIELDS = { ...SP_BEF_FIELDS, ...LEGACY_FIELDS };

// Shipped SP-BEF fusion values (lms-api sp_bef_params.json), used only by the offline demo store.
const DEMO_SP_BEF_DEFAULTS = {
  thetaOn: 0.4,
  thetaOff: 0.25,
  minHoldSec: 10,
  wFace: 0.7,
  wBeh: 0,
  wQuiz: 1,
  hmmKeepConfused: 0.6,
};
const DEMO_LEGACY_FIELDS = [
  'mlThreshold',
  'slidingWindowSize',
  'cooldownSeconds',
  'faceSimilarityThreshold',
  'maxAbsentChecks',
];

const toCamelKeys = (snake = {}) => {
  const out = {};
  Object.entries(ALL_FIELDS).forEach(([s, c]) => {
    const v = snake[s] ?? snake[c];
    if (v !== undefined && v !== null && v !== '') out[c] = Number(v);
  });
  return out;
};

// Maps the GET/PUT response data { settings, spBefDefaults, spBefOverrides, legacyFields, modelVersion } to the
// snake_case form values used by the page.
export const normalizeSettingsResponse = (data = {}, source = 'api') => {
  const s = data.settings || {};
  const values = {};
  Object.entries(ALL_FIELDS).forEach(([snake, camel]) => {
    values[snake] = s[camel] === undefined || s[camel] === null ? null : Number(s[camel]);
  });
  return {
    ...values,
    spBefDefaults: data.spBefDefaults || {},
    spBefOverrides: data.spBefOverrides || {},
    legacyFields: Array.isArray(data.legacyFields) ? data.legacyFields : [],
    modelVersion: data.modelVersion || '',
    source,
  };
};

const demoResponse = () => {
  const m = mockStore.confusionSettings || {};
  const overrides = m.spBefOverrides || {};
  return {
    settings: {
      ...toCamelKeys(m),
      ...DEMO_SP_BEF_DEFAULTS,
      ...overrides,
    },
    spBefDefaults: DEMO_SP_BEF_DEFAULTS,
    spBefOverrides: overrides,
    legacyFields: DEMO_LEGACY_FIELDS,
    modelVersion: 'demo-offline',
  };
};

class ConfusionApi {
  getSettings = async () => {
    try {
      const res = await api.get('/v1/admin/confusion/settings');
      const data = res?.data?.data;
      if (!data || !data.settings) {
        throw Object.assign(new Error('Phản hồi cấu hình từ lms-api không hợp lệ'), {
          status: res?.status ?? 200,
          data: { message: 'Phản hồi cấu hình từ lms-api không hợp lệ (thiếu settings)' },
        });
      }
      return normalizeSettingsResponse(data, 'api');
    } catch (error) {
      // Only an unreachable lms-api (no HTTP response) falls back to the offline demo store.
      if (isHttpError(error)) throw error;
      return normalizeSettingsResponse(demoResponse(), 'demo');
    }
  };

  // Accepts snake_case form values; sends the camelCase body lms-api binds (UpdateConfusionSettingsReq).
  // Returns the saved settings as reported by lms-api; validation errors (400, code 40001, message naming
  // the field) are rethrown so the page can show them.
  updateSettings = async (values = {}) => {
    const body = toCamelKeys(values);
    if (values.reset_sp_bef_overrides || values.resetSpBefOverrides) body.resetSpBefOverrides = true;
    try {
      const res = await api.put('/v1/admin/confusion/settings', body);
      const data = res?.data?.data;
      if (data && data.settings) return normalizeSettingsResponse(data, 'api');
      // PUT succeeded without a body: read back what the server now uses.
      return this.getSettings();
    } catch (error) {
      if (isHttpError(error)) throw error;
    }

    // Offline demo mode only.
    const spBef = {};
    Object.values(SP_BEF_FIELDS).forEach((c) => {
      if (body[c] !== undefined) spBef[c] = body[c];
    });
    const legacy = {};
    Object.entries(LEGACY_FIELDS).forEach(([s, c]) => {
      if (body[c] !== undefined) legacy[s] = body[c];
    });
    mockStore.confusionSettings = {
      ...mockStore.confusionSettings,
      ...legacy,
      spBefOverrides: body.resetSpBefOverrides
        ? spBef
        : { ...(mockStore.confusionSettings?.spBefOverrides || {}), ...spBef },
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    return normalizeSettingsResponse(demoResponse(), 'demo');
  };

  // lms-api GenerateEmbeddingsRes: { updatedCount, message }.
  generateEmbeddings = async () => {
    try {
      const res = await api.post('/v1/admin/generate-embeddings');
      return { ...(res?.data?.data || {}), source: 'api' };
    } catch (error) {
      if (isHttpError(error)) throw error;
    }
    return {
      source: 'demo',
      updatedCount: 0,
      message: 'Chế độ demo ngoại tuyến: không kết nối được lms-api, chưa tạo vector nhúng nào.',
    };
  };

  // lms-api SeedDataRes: { success, message }. lms-api refuses seeding outside APP_ENV dev/test.
  seedDemoData = async () => {
    try {
      const res = await api.post('/v1/admin/seed-data');
      return { ...(res?.data?.data || {}), source: 'api' };
    } catch (error) {
      if (isHttpError(error)) throw error;
    }
    return {
      source: 'demo',
      success: false,
      message: 'Chế độ demo ngoại tuyến: không kết nối được lms-api, chưa nạp dữ liệu.',
    };
  };
}

const confusionApi = new ConfusionApi();
export default confusionApi;
