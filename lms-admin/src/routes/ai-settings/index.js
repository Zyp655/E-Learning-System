import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Form,
  InputNumber,
  Slider,
  Select,
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
import confusionApi from '../../api/confusion';

const { Title, Text } = Typography;

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

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await confusionApi.getSettings();
      setSettingsMeta(data);
      form.setFieldsValue({
        theta_on: data.theta_on ?? data.ml_threshold ?? 0.62,
        theta_off: data.theta_off ?? 0.42,
        min_hold_sec: data.min_hold_sec ?? 10,
        cooldown_seconds: data.cooldown_seconds ?? 180,
        w_face: data.w_face ?? 0.65,
        w_beh: data.w_beh ?? 0.85,
        w_quiz: data.w_quiz ?? 0.90,
        hmm_keep_confused: data.hmm_keep_confused ?? 0.78,
        face_similarity_threshold: data.face_similarity_threshold ?? 0.55,
        max_absent_checks: data.max_absent_checks ?? 6,
        active_predictor: data.active_predictor || 'sp_bef_v2_bayesian_hmm',
        llm_vision_model: data.llm_vision_model || 'gpt-4o-mini',
      });
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        ml_threshold: values.theta_on,
      };
      const updated = await confusionApi.updateSettings(payload);
      setSettingsMeta(updated);
      message.success(
        'Đã lưu cấu hình SP-BEF (θ_on, θ_off, w_m, Cooldown) và đồng bộ tới Redis / Go Backend!'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerGenerateEmbeddings = async () => {
    setEmbeddingLoading(true);
    try {
      const res = await confusionApi.generateEmbeddings();
      setLastOperationResult({
        type: 'embeddings',
        title: 'Đồng bộ Vector Nhúng pgvector (POST /v1/admin/generate-embeddings) Thành công',
        details: `Model: ${res.model} · Đã lập chỉ mục ${res.courses_indexed} khóa học, ${res.lessons_indexed} bài giảng và ${res.video_segments_indexed} phân đoạn VideoSegments trong ${res.elapsed_ms}ms.`,
      });
      message.success('Đã tạo lại toàn bộ vector nhúng pgvector 1536 chiều!');
    } finally {
      setEmbeddingLoading(false);
    }
  };

  const handleTriggerSeedData = async () => {
    setSeedLoading(true);
    try {
      const res = await confusionApi.seedDemoData();
      setLastOperationResult({
        type: 'seed',
        title: 'Khởi tạo Dữ liệu Mẫu Toàn Hệ thống (POST /v1/admin/seed-data) Thành công',
        details: `Đã nạp dữ liệu chuẩn cho ${res.tables_populated} bảng PostgreSQL (${res.departments} khoa, ${res.users} người dùng, ${res.courses} khóa học, ${res.confusion_episodes} phiên bối rối).`,
      });
      message.success('Đã nạp dữ liệu mẫu chuẩn cho toàn bộ hệ thống!');
    } finally {
      setSeedLoading(false);
    }
  };

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

      {lastOperationResult && (
        <Alert
          type="success"
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

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={{
                theta_on: 0.62,
                theta_off: 0.42,
                min_hold_sec: 10,
                cooldown_seconds: 180,
                w_face: 0.65,
                w_beh: 0.85,
                w_quiz: 0.90,
                hmm_keep_confused: 0.78,
                face_similarity_threshold: 0.55,
                max_absent_checks: 6,
                active_predictor: 'sp_bef_v2_bayesian_hmm',
                llm_vision_model: 'gpt-4o-mini',
              }}
            >
              <Row gutter={16}>
                <Col md={8} xs={24}>
                  <Form.Item
                    name="theta_on"
                    label="Ngưỡng Bật Can thiệp (θ_on — Mặc định: 0.62)"
                    extra="Bật trạng thái bối rối khi P(t) ≥ θ_on liên tục trong ≥ T giây."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0.45} max={0.90} step={0.02} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={8} xs={24}>
                  <Form.Item
                    name="theta_off"
                    label="Ngưỡng Tắt Hysteresis (θ_off — Mặc định: 0.42)"
                    extra="Hạ cờ bối rối khi P(t) < θ_off (θ_off < θ_on chống dao động)."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0.20} max={0.60} step={0.02} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={8} xs={24}>
                  <Form.Item
                    name="min_hold_sec"
                    label="Thời gian Duy trì Tối thiểu (T giây — Mặc định: 10s)"
                    extra="Số giây P(t) ≥ θ_on trước khi kích hoạt AI Tutor."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={5} max={30} step={5} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col md={8} xs={24}>
                  <Form.Item
                    name="w_face"
                    label="Trọng số Nhánh Face (w_face — Mặc định: 0.65)"
                    extra="Nhân với r_face(t) · LLR_face(t) (DAiSEE + Personal Baseline C2)."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0.1} max={1.5} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={8} xs={24}>
                  <Form.Item
                    name="w_beh"
                    label="Trọng số Nhánh Behavior (w_beh — Mặc định: 0.85)"
                    extra="Nhân với r_beh(t) · LLR_beh(t) (MOOCCubeX 300s window)."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0.1} max={1.5} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={8} xs={24}>
                  <Form.Item
                    name="w_quiz"
                    label="Trọng số Nhánh Quiz (w_quiz — Mặc định: 0.90)"
                    extra="Nhân với r_quiz(t) · LLR_quiz(t) (ASSISTments In-Video Quiz)."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0.1} max={1.5} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col md={12} xs={24}>
                  <Form.Item
                    name="hmm_keep_confused"
                    label="Quán tính Trạng thái Ẩn HMM (a = P(C_t | C_{t-1}) — Mặc định: 0.78)"
                    extra="Dự đoán trước: P⁻(t) = a·P(t-1) + β(π_s)·(1 - P(t-1))."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0.40} max={0.95} step={0.02} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={12} xs={24}>
                  <Form.Item
                    name="cooldown_seconds"
                    label="Thời gian Nghỉ Giữa 2 Lần Can thiệp (`cooldown_seconds` — Mặc định: 180s)"
                    extra="Tối ưu theo chi phí làm phiền C_FP vs bỏ sót C_FN."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={60} max={1800} step={30} style={{ width: '100%' }} />
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
                    label="Ngưỡng Khớp Khuôn mặt (`face_similarity_threshold` — Mặc định: 0.55)"
                    extra="Cosine Similarity tối thiểu giữa vector 192-d hiện tại và 3 góc mặt đã đăng ký."
                    rules={[{ required: true }]}
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
                    label="Số lần Kiểm tra Vắng mặt Tối đa (`max_absent_checks` — Mặc định: 6)"
                    extra="Kiểm tra mỗi 5 giây: 6 lần liên tiếp (30 giây) không thấy mặt -> Tạm dừng video."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={2} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col md={12} xs={24}>
                  <Form.Item name="active_predictor" label="Cơ chế Hợp nhất trên Go Backend & Web Worker">
                    <Select
                      options={[
                        {
                          value: 'sp_bef_v2_bayesian_hmm',
                          label: 'SP-BEF V2 (Calibrated LLR + Segment Prior π_s + 2-State HMM) — Khuyên dùng',
                        },
                        {
                          value: 'mlp_3layer_64_32_16',
                          label: 'Legacy 3-Layer MLP (64, 32, 16) — mlp_weights.json',
                        },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col md={12} xs={24}>
                  <Form.Item name="llm_vision_model" label="Mô hình Multi-Modal Vision RAG">
                    <Select
                      options={[
                        { value: 'gpt-4o-mini', label: 'OpenAI gpt-4o-mini Vision (Độ trễ thấp)' },
                        { value: 'gpt-4o', label: 'OpenAI gpt-4o Vision (Chuyên sâu)' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

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
                2-State HMM + Hysteresis (0.62 / 0.42)
              </Descriptions.Item>
              <Descriptions.Item label="RAG Strategy">
                3-Tier (`pgvector` &rarr; `Segment` &rarr; `Slice`)
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật lần cuối">
                {settingsMeta?.updated_at || '2026-10-26 10:00:00'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Col>
      </Row>
    </div>
  );
}
