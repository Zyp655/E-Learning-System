import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Form,
  InputNumber,
  Slider,
  Button,
  Alert,
  Space,
  Tag,
  Divider,
  Descriptions,
  Progress,
  Table,
  message,
  Typography,
} from 'antd';
import {
  SaveOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ReloadOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import confusionApi, { SP_BEF_FIELDS, LEGACY_FIELDS } from '../../api/confusion';
import { showApiError } from '../../utils/api';

const { Title, Text } = Typography;

// Editable fields; names map to lms-api camelCase via SP_BEF_FIELDS / LEGACY_FIELDS (api/confusion.js).
const FORM_FIELDS = [
  'theta_on',
  'theta_off',
  'min_hold_sec',
  'w_face',
  'w_beh',
  'w_quiz',
  'hmm_keep_confused',
  'cooldown_seconds',
  'face_similarity_threshold',
  'max_absent_checks',
];
const FIELD_CAMEL = { ...SP_BEF_FIELDS, ...LEGACY_FIELDS };

const LLR_DISTRIBUTION_DATA = [
  {
    key: 'face',
    branch: '1. Face Branch (DAiSEE video 10 fps · Browser LR)',
    dataset: 'DAiSEE (5,411 train / 1,703 test clips · 111 subjects)',
    baseRate: '0.3230',
    auroc: '0.6207',
    auprc: '0.4185',
    ece: '0.0346',
    meanNegLLR: +0.06,
    meanPosLLR: +0.23,
    weightKey: 'w_face = 0.70',
  },
  {
    key: 'beh',
    branch: '2. Behavior (tắt: CI test của AUROC chứa 0.5)',
    dataset: 'MOOCCubeX (2,482 train / 748 test sessions · 537 users)',
    baseRate: '0.1644',
    auroc: '0.5088',
    auprc: '0.1736',
    ece: '0.0518',
    meanNegLLR: -0.03,
    meanPosLLR: +0.03,
    weightKey: 'w_beh = 0.00',
  },
  {
    key: 'quiz',
    branch: '3. Quiz Branch (In-Video Segment Quiz)',
    dataset: 'ASSISTments 2017 (652,620 train / 156,451 test · 1,709 students)',
    baseRate: '0.1831',
    auroc: '0.7846',
    auprc: '0.4476',
    ece: '0.0222',
    meanNegLLR: -0.71,
    meanPosLLR: +0.55,
    weightKey: 'w_quiz = 1.00',
  },
];

export default function AiSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [lastOperationResult, setLastOperationResult] = useState(null);
  const [settingsMeta, setSettingsMeta] = useState(null);

  const applySettingsToForm = useCallback(
    (data) => {
      setSettingsMeta(data);
      const values = {};
      FORM_FIELDS.forEach((name) => {
        values[name] = data[name] ?? undefined;
      });
      form.setFieldsValue(values);
    },
    [form]
  );

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      applySettingsToForm(await confusionApi.getSettings());
    } catch (error) {
      showApiError(error, 'Không tải được cấu hình SP-BEF từ lms-api');
    } finally {
      setLoading(false);
    }
  }, [applySettingsToForm]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async (values) => {
    setSaving(true);
    try {
      // Only fields lms-api accepts (UpdateConfusionSettingsReq); mlThreshold is legacy and not sent.
      const payload = {};
      FORM_FIELDS.forEach((name) => {
        payload[name] = values[name];
      });
      const updated = await confusionApi.updateSettings(payload);
      applySettingsToForm(updated);
      if (updated.source === 'demo') {
        message.warning('Chế độ demo ngoại tuyến: cấu hình chỉ lưu trong trình duyệt, chưa gửi tới lms-api.');
      } else {
        message.success('Đã lưu cấu hình SP-BEF vào lms-api (confusion_settings) và áp dụng cho bộ dự đoán.');
      }
    } catch (error) {
      // 400 / code 40001: the message names the invalid field (e.g. thetaOff must be < thetaOn).
      showApiError(error, 'lms-api từ chối cấu hình, chưa lưu thay đổi');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerGenerateEmbeddings = async () => {
    setEmbeddingLoading(true);
    try {
      const res = await confusionApi.generateEmbeddings();
      setLastOperationResult({
        type: res.source === 'demo' ? 'warning' : 'success',
        title: 'POST /v1/admin/generate-embeddings',
        details: `${res.message || ''}${
          res.updatedCount !== undefined ? ` (cập nhật ${res.updatedCount} bản ghi)` : ''
        }`,
      });
    } catch (error) {
      showApiError(error, 'Không tạo được vector nhúng');
    } finally {
      setEmbeddingLoading(false);
    }
  };

  const handleTriggerSeedData = async () => {
    setSeedLoading(true);
    try {
      const res = await confusionApi.seedDemoData();
      setLastOperationResult({
        type: res.source === 'demo' || res.success === false ? 'warning' : 'success',
        title: 'POST /v1/admin/seed-data',
        details: res.message || '',
      });
    } catch (error) {
      // lms-api returns 403 outside APP_ENV dev/test.
      showApiError(error, 'lms-api từ chối nạp dữ liệu mẫu');
    } finally {
      setSeedLoading(false);
    }
  };

  const legacyFields = settingsMeta?.legacyFields || [];
  const spBefDefaults = settingsMeta?.spBefDefaults || {};
  const isLegacy = (snakeName) => legacyFields.includes(FIELD_CAMEL[snakeName]);
  const defaultHint = (snakeName) => {
    const v = spBefDefaults[FIELD_CAMEL[snakeName]];
    return v === undefined ? '' : ` Mặc định (sp_bef_params.json): ${v}.`;
  };
  const isOverridden = (snakeName) =>
    settingsMeta?.spBefOverrides?.[FIELD_CAMEL[snakeName]] !== undefined;
  const legacyTag = (snakeName) =>
    isLegacy(snakeName) ? (
      <Tag color="default" style={{ marginLeft: 6 }}>
        legacy: lms-api lưu nhưng không dùng
      </Tag>
    ) : null;
  const overrideTag = (snakeName) =>
    isOverridden(snakeName) ? (
      <Tag color="orange" style={{ marginLeft: 6 }}>
        đã ghi đè
      </Tag>
    ) : null;
  const fmt = (v) => (v === undefined || v === null ? '-' : v);

  const llrColumns = [
    {
      title: 'Nhánh Bằng chứng (SP-BEF Branch)',
      dataIndex: 'branch',
      key: 'branch',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>{val}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{row.dataset}</div>
        </div>
      ),
    },
    {
      title: 'Base Rate (b_m)',
      dataIndex: 'baseRate',
      key: 'baseRate',
      width: 110,
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Test AUROC / AUPRC / ECE',
      key: 'metrics',
      width: 210,
      render: (_, row) => (
        <Space size={4} wrap>
          <Tag color="geekblue">AUC: {row.auroc}</Tag>
          <Tag color="cyan">PR: {row.auprc}</Tag>
          <Tag color="green">ECE: {row.ece}</Tag>
        </Space>
      ),
    },
    {
      title: 'Phân bố LLR_m ∈ [-4, +4] (Không bối rối vs Bối rối)',
      key: 'llrDist',
      render: (_, row) => (
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#16a34a' }}>E[LLR | y=0]: {row.meanNegLLR}</span>
            <span style={{ fontWeight: 600, color: '#0A3150' }}>{row.weightKey}</span>
            <span style={{ color: '#dc2626' }}>E[LLR | y=1]: +{row.meanPosLLR}</span>
          </div>
          <Progress
            percent={Math.round(((row.meanPosLLR - row.meanNegLLR) / 4.0) * 100)}
            strokeColor="#0A3150"
            size="small"
            showInfo={false}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Cấu hình SP-BEF (Segment-Prior Bayesian Evidence Fusion) & Trợ lý Ảo AI"
        subtitle="Điều chỉnh ngưỡng trễ Hysteresis (θ_on / θ_off), hệ số co từng nhánh (w_face, w_beh, w_quiz), bộ lọc HMM 2 trạng thái và xem phân bố Log-Likelihood Ratio (LLR)"
        routes={[
          { path: '/app/home', breadcrumbName: 'Trang chủ' },
          { breadcrumbName: 'Cấu hình SP-BEF & AI Tutor' },
        ]}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchSettings} loading={loading}>
            Tải lại cấu hình
          </Button>
        }
      />

      {settingsMeta?.source === 'demo' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Chế độ demo ngoại tuyến: không kết nối được lms-api"
          description="Giá trị bên dưới là dữ liệu mẫu trong trình duyệt; thay đổi sẽ không được gửi tới máy chủ."
        />
      )}

      {lastOperationResult && (
        <Alert
          type={lastOperationResult.type === 'warning' ? 'warning' : 'success'}
          showIcon
          closable
          onClose={() => setLastOperationResult(null)}
          style={{ marginBottom: 16 }}
          message={lastOperationResult.title}
          description={lastOperationResult.details}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col lg={15} xs={24}>
          <div className="admin-page-card" style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginTop: 0, color: '#0A3150' }}>
              <RobotOutlined style={{ marginRight: 8 }} />
              Siêu tham số Hợp nhất Bằng chứng Bayes (SP-BEF) &amp; Bộ lọc HMM 2 Trạng thái
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
              Công thức hậu nghiệm: <code>logit P(t) = logit P⁻(t) + Σ r_m(t) · w_m · LLR_m(t)</code> với{' '}
              <code>LLR_m = clip(logit(Calib(p_m)) - logit(b_m), -4, 4)</code>
            </Text>

            <Form form={form} layout="vertical" onFinish={handleSaveSettings}>
              <Row gutter={16}>
                <Col md={8} xs={24}>
                  <Form.Item
                    name="theta_on"
                    label={<span>Ngưỡng Bật Can thiệp (θ_on → thetaOn){overrideTag('theta_on')}</span>}
                    extra={`Bật trạng thái bối rối khi P(t) ≥ θ_on liên tục trong ≥ T giây. Khoảng hợp lệ: θ_off < θ_on < 1.${defaultHint('theta_on')}`}
                    rules={[{ required: true, message: 'Nhập θ_on' }]}
                  >
                    <InputNumber min={0.01} max={0.99} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={8} xs={24}>
                  <Form.Item
                    name="theta_off"
                    label={<span>Ngưỡng Tắt Hysteresis (θ_off → thetaOff){overrideTag('theta_off')}</span>}
                    extra={`Hạ cờ bối rối khi P(t) < θ_off (0 < θ_off < θ_on).${defaultHint('theta_off')}`}
                    dependencies={['theta_on']}
                    rules={[
                      { required: true, message: 'Nhập θ_off' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          const on = getFieldValue('theta_on');
                          if (value === undefined || value === null || on === undefined || on === null || value < on) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('θ_off phải nhỏ hơn θ_on'));
                        },
                      }),
                    ]}
                  >
                    <InputNumber min={0.01} max={0.99} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={8} xs={24}>
                  <Form.Item
                    name="min_hold_sec"
                    label={<span>Thời gian Duy trì Tối thiểu (T giây → minHoldSec){overrideTag('min_hold_sec')}</span>}
                    extra={`Số giây P(t) ≥ θ_on trước khi kích hoạt AI Tutor (> 0).${defaultHint('min_hold_sec')}`}
                    rules={[{ required: true, message: 'Nhập T' }]}
                  >
                    <InputNumber min={0.5} max={600} step={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col md={8} xs={24}>
                  <Form.Item
                    name="w_face"
                    label={<span>Trọng số Nhánh Face (w_face → wFace){overrideTag('w_face')}</span>}
                    extra={`Nhân với r_face(t) · LLR_face(t). 0 = tắt nhánh.${defaultHint('w_face')}`}
                    rules={[{ required: true, message: 'Nhập w_face' }]}
                  >
                    <InputNumber min={0} max={3} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={8} xs={24}>
                  <Form.Item
                    name="w_beh"
                    label={<span>Trọng số Nhánh Behavior (w_beh → wBeh){overrideTag('w_beh')}</span>}
                    extra={`Nhân với r_beh(t) · LLR_beh(t). 0 = tắt nhánh.${defaultHint('w_beh')}`}
                    rules={[{ required: true, message: 'Nhập w_beh' }]}
                  >
                    <InputNumber min={0} max={3} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={8} xs={24}>
                  <Form.Item
                    name="w_quiz"
                    label={<span>Trọng số Nhánh Quiz (w_quiz → wQuiz){overrideTag('w_quiz')}</span>}
                    extra={`Nhân với r_quiz(t) · LLR_quiz(t). Không được tắt cả 3 nhánh.${defaultHint('w_quiz')}`}
                    rules={[{ required: true, message: 'Nhập w_quiz' }]}
                  >
                    <InputNumber min={0} max={3} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col md={12} xs={24}>
                  <Form.Item
                    name="hmm_keep_confused"
                    label={<span>Quán tính HMM (a = P(C_t | C_t-1) → hmmKeepConfused){overrideTag('hmm_keep_confused')}</span>}
                    extra={`Dự đoán trước: P⁻(t) = a·P(t-1) + β(π_s)·(1 - P(t-1)). Khoảng 0 < a < 1.${defaultHint('hmm_keep_confused')}`}
                    rules={[{ required: true, message: 'Nhập a' }]}
                  >
                    <InputNumber min={0.01} max={0.99} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={12} xs={24}>
                  <Form.Item
                    name="cooldown_seconds"
                    label={<span>Thời gian nghỉ giữa 2 lần can thiệp (cooldownSeconds){legacyTag('cooldown_seconds')}</span>}
                    extra="SP-BEF dùng cooldown_sec trong sp_bef_params.json; giá trị này chỉ được lưu lại."
                  >
                    <InputNumber min={0} max={3600} step={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={5} style={{ color: '#0A3150' }}>
                <SafetyCertificateOutlined style={{ marginRight: 8 }} />
                Cấu hình Xác thực Khuôn mặt Chống Học hộ (`FaceVerificationGuard`)
              </Title>

              <Row gutter={16}>
                <Col md={12} xs={24}>
                  <Form.Item
                    name="face_similarity_threshold"
                    label={<span>Ngưỡng khớp khuôn mặt (faceSimilarityThreshold){legacyTag('face_similarity_threshold')}</span>}
                    extra="Cosine Similarity tối thiểu giữa vector hiện tại và 3 góc mặt đã đăng ký."
                  >
                    <Slider
                      min={0.35}
                      max={0.85}
                      step={0.05}
                      marks={{ 0.45: '0.45', 0.55: '0.55', 0.70: '0.70' }}
                    />
                  </Form.Item>
                </Col>

                <Col md={12} xs={24}>
                  <Form.Item
                    name="max_absent_checks"
                    label={<span>Số lần kiểm tra vắng mặt tối đa (maxAbsentChecks){legacyTag('max_absent_checks')}</span>}
                    extra="Kiểm tra mỗi 5 giây; vượt ngưỡng thì tạm dừng video."
                  >
                    <InputNumber min={0} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Phiên bản mô hình (modelVersion)">
                  {settingsMeta?.modelVersion || '-'}
                </Descriptions.Item>
                <Descriptions.Item
                  label={<span>mlThreshold{legacyTag('ml_threshold')}</span>}
                >
                  {fmt(settingsMeta?.ml_threshold)} (chỉ hiển thị; SP-BEF quyết định theo θ_on)
                </Descriptions.Item>
              </Descriptions>

              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<SaveOutlined />}
                loading={saving}
              >
                Lưu Cấu hình SP-BEF (`PUT /v1/admin/confusion/settings`)
              </Button>
            </Form>
          </div>

          <div className="admin-page-card">
            <Title level={5} style={{ marginTop: 0, color: '#0A3150' }}>
              <BarChartOutlined style={{ marginRight: 8 }} />
              Phân bố Tỷ số Hợp lý Hiệu chỉnh (`LLR_m`) &amp; Chỉ số Thực nghiệm Từng Nhánh
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
              Kết quả đánh giá trên tập Test độc lập chủ thể (`train ∩ val ∩ test = ∅`). Hợp nhất SP-BEF trên Virtual Learner đạt{' '}
              <strong>AUROC = 0.6761, AUPRC = 0.4027, ECE = 0.0228</strong> (chi tiết: <code>ml/REPORT_V2.md</code>).
            </Text>
            <Table
              dataSource={LLR_DISTRIBUTION_DATA}
              columns={llrColumns}
              pagination={false}
              size="small"
              bordered
            />
          </div>
        </Col>

        <Col lg={9} xs={24}>
          <div className="admin-page-card">
            <Title level={5} style={{ marginTop: 0, color: '#0A3150' }}>
              Công cụ Vận hành Vector DB (`pgvector`) &amp; Dữ liệu Hệ thống
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
              Thực thi tác vụ quản trị trực tiếp tới Backend Go (`lms-api`)
            </Text>

            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <div
                style={{
                  padding: 16,
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  borderRadius: 2,
                }}
              >
                <div style={{ fontWeight: 600, color: '#0A3150', marginBottom: 4 }}>
                  1. Đồng bộ &amp; Tạo lại Vector Nhúng `pgvector` (1536-d)
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                  Quét toàn bộ bảng `courses`, `lessons`, và `video_segments` chưa có vector nhúng để gọi `text-embedding-3-small` phục vụ 3-Tier RAG.
                </Text>
                <Button
                  type="primary"
                  block
                  icon={<DatabaseOutlined />}
                  loading={embeddingLoading}
                  onClick={handleTriggerGenerateEmbeddings}
                >
                  Chạy POST /v1/admin/generate-embeddings
                </Button>
              </div>

              <div
                style={{
                  padding: 16,
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  borderRadius: 2,
                }}
              >
                <div style={{ fontWeight: 600, color: '#0A3150', marginBottom: 4 }}>
                  2. Khởi tạo Dữ liệu Mẫu Chuẩn (`seed-data`)
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                  Tạo dữ liệu mẫu đầy đủ cho Khoa, Ngành, Học kỳ, 3 Khóa học, Phân đoạn VideoSegments, Coding Labs và Lịch sử Bối rối.
                </Text>
                <Button
                  block
                  icon={<ThunderboltOutlined />}
                  loading={seedLoading}
                  onClick={handleTriggerSeedData}
                  style={{ borderColor: '#0A3150', color: '#0A3150', fontWeight: 500 }}
                >
                  Chạy POST /v1/admin/seed-data
                </Button>
              </div>
            </Space>

            <Divider />

            <Descriptions title="Thông số Kiến trúc SP-BEF V2 Hiện hành" column={1} size="small" bordered>
              <Descriptions.Item label="On-Device Face ONNX">
                <Tag color="green">sp_bef_face.onnx (864B · &lt;0.1ms)</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Personal Baseline (C2)">
                Rolling 60–90s Z-Score trên trình duyệt
              </Descriptions.Item>
              <Descriptions.Item label="Dynamic Reliability (C4)">
                <code>r_face(t)</code> (Luminance · Pose · Presence)
              </Descriptions.Item>
              <Descriptions.Item label="Segment Prior (C3)">
                <code>π_s</code> từ mật độ tua lại MOOCCubeX
              </Descriptions.Item>
              <Descriptions.Item label="Temporal Filter (C5)">
                2-State HMM + Hysteresis ({fmt(settingsMeta?.theta_on)} / {fmt(settingsMeta?.theta_off)})
              </Descriptions.Item>
              <Descriptions.Item label="RAG Strategy">
                3-Tier (`pgvector` &rarr; `Segment` &rarr; `Slice`)
              </Descriptions.Item>
              <Descriptions.Item label="Nguồn cấu hình">
                {settingsMeta?.source === 'demo' ? 'Dữ liệu demo ngoại tuyến' : settingsMeta ? 'lms-api' : '-'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Col>
      </Row>
    </div>
  );
}
