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
} from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import confusionApi from '../../api/confusion';

const { Title, Text } = Typography;

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
        ml_threshold: data.ml_threshold ?? 0.60,
        rule_threshold: data.rule_threshold ?? 35,
        sliding_window_size: data.sliding_window_size ?? 3,
        cooldown_seconds: data.cooldown_seconds ?? 300,
        face_similarity_threshold: data.face_similarity_threshold ?? 0.55,
        max_absent_checks: data.max_absent_checks ?? 6,
        active_predictor: data.active_predictor || 'mlp_3layer_64_32_16',
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
      const updated = await confusionApi.updateSettings(values);
      setSettingsMeta(updated);
      message.success(
        'Đã lưu cấu hình Ngưỡng Phát hiện Bối rối (`confusion_settings`) và đồng bộ tới Redis!'
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
      message.success('Đã nạp dữ liệu mẫu chuẩn cho toàn bộ 58 bảng!');
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Cấu hình Mô hình Phát hiện Bối rối CV & Trợ lý Ảo AI (`confusion_settings`)"
        subtitle="Điều chỉnh siêu tham số quyết định can thiệp chủ động (Proactive Auto-Intervention), ngưỡng sinh trắc MobileFaceNet và công cụ vận hành pgvector"
        routes={[
          { path: '/app/home', breadcrumbName: 'Trang chủ' },
          { breadcrumbName: 'Cấu hình AI & Confusion CV' },
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
          <div className="admin-page-card">
            <Title level={5} style={{ marginTop: 0, color: '#0A3150' }}>
              <RobotOutlined style={{ marginRight: 8 }} />
              Siêu tham số Mô hình Bối rối Đa phương thức &amp; Biometric Guard
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
              Áp dụng tức thì cho `ConfusionPredictor` trên Go Backend và Web Worker trên trình duyệt học sinh
            </Text>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={{
                ml_threshold: 0.60,
                rule_threshold: 35,
                sliding_window_size: 3,
                cooldown_seconds: 300,
                face_similarity_threshold: 0.55,
                max_absent_checks: 6,
                active_predictor: 'mlp_3layer_64_32_16',
                llm_vision_model: 'gpt-4o-mini',
              }}
            >
              <Row gutter={16}>
                <Col md={12} xs={24}>
                  <Form.Item
                    name="ml_threshold"
                    label="Ngưỡng Xác suất ML (`ml_threshold` — Mặc định: 0.60)"
                    extra="Kích hoạt bối rối khi P(confused) từ MLP 12-Features / BiLSTM ONNX >= ngưỡng này."
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      min={0.30}
                      max={0.95}
                      step={0.05}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                <Col md={12} xs={24}>
                  <Form.Item
                    name="rule_threshold"
                    label="Ngưỡng Điểm Luật Lai (`rule_threshold` — Mặc định: 35)"
                    extra="Điểm kết hợp hành vi tua lại, dừng lâu, Eye-Lock và tự báo cáo (0..100)."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={10} max={90} step={5} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col md={12} xs={24}>
                  <Form.Item
                    name="sliding_window_size"
                    label="Kích thước Cửa sổ Trượt (`sliding_window_size` — Mặc định: 3)"
                    extra="Số chu kỳ liên tiếp vượt ngưỡng trước khi tự động dừng video và mở giải thích AI."
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col md={12} xs={24}>
                  <Form.Item
                    name="cooldown_seconds"
                    label="Thời gian Nghỉ Giữa 2 Lần Can thiệp (`cooldown_seconds` — Mặc định: 300s)"
                    extra="Chống làm phiền học sinh liên tục (300 giây = 5 phút)."
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
                    <Slider min={0.35} max={0.85} step={0.05} marks={{ 0.45: '0.45', 0.55: '0.55', 0.70: '0.70' }} />
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
                  <Form.Item name="active_predictor" label="Bộ Dự đoán 12-Features trên Go Backend">
                    <Select
                      options={[
                        { value: 'mlp_3layer_64_32_16', label: '3-Layer MLP (64, 32, 16) — mlp_weights.json' },
                        { value: 'logistic_regression', label: 'Logistic Regression — lr_weights.json' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col md={12} xs={24}>
                  <Form.Item name="llm_vision_model" label="Mô hình Multi-Modal Vision RAG">
                    <Select
                      options={[
                        { value: 'gpt-4o-mini', label: 'OpenAI gpt-4o-mini Vision (Khuyên dùng — Độ trễ thấp)' },
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
                Lưu Cấu hình (`PUT /v1/admin/confusion/settings`)
              </Button>
            </Form>
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
                  Tạo dữ liệu mẫu đầy đủ cho Khoa, Ngành, Học kỳ, Khóa học, Phân đoạn VideoSegments, Đề thi thích ứng và Lịch sử Bối rối.
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

            <Descriptions title="Thông số Kiến trúc AI Hiện hành" column={1} size="small" bordered>
              <Descriptions.Item label="Client CV Worker">
                <Tag color="green">MediaPipe 478 3D + EAR/Gaze</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Temporal ONNX">
                <code>confusion_bilstm.onnx</code> (Seq=5)
              </Descriptions.Item>
              <Descriptions.Item label="Biometric Guard">
                <code>mobilefacenet.onnx</code> (192-d, 3 góc)
              </Descriptions.Item>
              <Descriptions.Item label="RAG Strategy">
                3-Tier (`pgvector` &rarr; `Segment` &rarr; `Slice`)
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật lần cuối">
                {settingsMeta?.updated_at || '2026-10-23 09:00:00'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Col>
      </Row>
    </div>
  );
}
