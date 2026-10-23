import api from '../utils/api';
import { mockStore } from '../utils/mockData';

const normalizeSettings = (s = {}) => {
  const mlThreshold = Number(s.ml_threshold ?? s.mlThreshold ?? 0.60);
  const ruleThreshold = Number(s.rule_threshold ?? s.ruleThreshold ?? 35);
  const slidingWindowSize = Number(s.sliding_window_size ?? s.slidingWindowSize ?? 3);
  const cooldownSeconds = Number(s.cooldown_seconds ?? s.cooldownSeconds ?? 300);
  const faceSimilarityThreshold = Number(
    s.face_similarity_threshold ?? s.faceSimilarityThreshold ?? 0.55
  );
  const maxAbsentChecks = Number(s.max_absent_checks ?? s.maxAbsentChecks ?? 6);
  const activePredictor =
    s.active_predictor || s.activePredictor || 'mlp_3layer_64_32_16';
  const llmVisionModel = s.llm_vision_model || s.llmVisionModel || 'gpt-4o-mini';
  const embeddingModel =
    s.embedding_model || s.embeddingModel || 'text-embedding-3-small';
  const ttsVoice = s.tts_voice || s.ttsVoice || 'nova';
  const updatedBy = s.updated_by || s.updatedBy || 'TS. Nguyễn Quản Trị';
  const updatedAt = s.updated_at || s.updatedAt || '2026-10-23 09:00:00';

  return {
    ...s,
    id: s.id || 1,
    ml_threshold: mlThreshold,
    mlThreshold,
    rule_threshold: ruleThreshold,
    ruleThreshold,
    sliding_window_size: slidingWindowSize,
    slidingWindowSize,
    cooldown_seconds: cooldownSeconds,
    cooldownSeconds,
    face_similarity_threshold: faceSimilarityThreshold,
    faceSimilarityThreshold,
    max_absent_checks: maxAbsentChecks,
    maxAbsentChecks,
    active_predictor: activePredictor,
    activePredictor,
    llm_vision_model: llmVisionModel,
    llmVisionModel,
    embedding_model: embeddingModel,
    embeddingModel,
    tts_voice: ttsVoice,
    ttsVoice,
    updated_by: updatedBy,
    updatedBy,
    updated_at: updatedAt,
    updatedAt,
  };
};

class ConfusionApi {
  getSettings = async () => {
    try {
      const res = await api.get('/v1/admin/confusion/settings');
      const raw = res?.data?.data || res?.data;
      if (raw && (raw.ml_threshold !== undefined || raw.mlThreshold !== undefined)) {
        return normalizeSettings(raw);
      }
    } catch (e) {}
    return normalizeSettings(mockStore.confusionSettings);
  };

  updateSettings = async (settings) => {
    const normalizedInput = normalizeSettings({
      ...mockStore.confusionSettings,
      ...settings,
    });
    try {
      const res = await api.put('/v1/admin/confusion/settings', normalizedInput);
      if (res?.data?.data) return normalizeSettings(res.data.data);
    } catch (e) {}
    mockStore.confusionSettings = normalizeSettings({
      ...mockStore.confusionSettings,
      ...settings,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    return { ...mockStore.confusionSettings };
  };

  generateEmbeddings = async () => {
    try {
      const res = await api.post('/v1/admin/generate-embeddings');
      if (res?.data?.data) return res.data.data;
    } catch (e) {}
    mockStore.stats.pgvectorIndexedSegments += 24;
    return {
      status: 'completed',
      model: 'text-embedding-3-small (1536-d)',
      courses_indexed: mockStore.courses.length,
      lessons_indexed: 110,
      video_segments_indexed: mockStore.stats.pgvectorIndexedSegments,
      elapsed_ms: 1420,
    };
  };

  seedDemoData = async () => {
    try {
      const res = await api.post('/v1/admin/seed-data');
      if (res?.data?.data) return res.data.data;
    } catch (e) {}
    return {
      status: 'seeded',
      tables_populated: 58,
      departments: mockStore.departments.length,
      users: mockStore.users.length,
      courses: mockStore.courses.length,
      confusion_episodes: mockStore.stats.dailyConfusionEpisodes,
    };
  };
}

const confusionApi = new ConfusionApi();
export default confusionApi;
