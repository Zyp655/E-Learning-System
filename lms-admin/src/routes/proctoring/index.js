import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Progress,
  Modal,
  Input,
  Card,
  Row,
  Col,
  Statistic,
  Alert,
  Badge,
  Tooltip,
  message,
  Typography,
} from 'antd';
import {
  SafetyCertificateOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ScanOutlined,
  ReloadOutlined,
  FileSearchOutlined,
  UserSwitchOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import FilterBar from '../../components/FilterBar';
import usersApi from '../../api/users';

const { confirm } = Modal;
const { Text } = Typography;
const { TextArea } = Input;

const formatTimestamp = (sec = 0) => {
  const s = Math.max(0, Number(sec) || 0);
  const mins = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

const VIOLATION_STATUS_MAP = {
  pending: { color: 'warning', label: 'Chờ xử lý (pending)' },
  reviewed: { color: 'processing', label: 'Đã xem xét (reviewed)' },
  excused: { color: 'success', label: 'Đã miễn trừ (excused)' },
  penalized: { color: 'error', label: 'Đã xác nhận vi phạm (penalized)' },
};

const SUBMISSION_STATUS_MAP = {
  flagged: { color: 'error', label: 'Nghi vấn đạo văn cao (flagged)' },
  pending_review: { color: 'warning', label: 'Chờ hậu kiểm (pending_review)' },
  verified: { color: 'success', label: 'Hợp lệ / Chính chủ (verified)' },
  rejected: { color: 'volcano', label: 'Hủy kết quả bài nộp (rejected)' },
};

export default function ProctoringMonitor({ embedded = false }) {
  const [activeTab, setActiveTab] = useState('biometric');
  const [violations, setViolations] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    keyword: '',
    violation_type: undefined,
    status: undefined,
  });

  const [reviewModal, setReviewModal] = useState({
    open: false,
    record: null,
    targetStatus: 'penalized',
    adminNote: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vList, sList] = await Promise.all([
        usersApi.getProctoringViolations(filters),
        usersApi.getSubmissionIntegrityAlerts({ keyword: filters.keyword }),
      ]);
      setViolations(vList || []);
      setSubmissions(sList || []);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openResolutionModal = (record, targetStatus) => {
    const defaultNote =
      targetStatus === 'penalized'
        ? 'Xác nhận vi phạm quy chế giám sát sinh trắc học trong giờ học trực tuyến.'
        : 'Chấp thuận giải trình hợp lệ của sinh viên, miễn trừ cảnh báo.';
    setReviewModal({
      open: true,
      record,
      targetStatus,
      adminNote: record.admin_note || defaultNote,
    });
  };

  const handleConfirmResolution = async () => {
    const { record, targetStatus, adminNote } = reviewModal;
    if (!record) return;
    await usersApi.resolveProctoringViolation(record.id, {
      status: targetStatus,
      adminNote,
    });
    message.success(
      targetStatus === 'penalized'
        ? `Đã xác nhận vi phạm đối với sinh viên ${record.student_name}`
        : `Đã miễn trừ cảnh báo cho sinh viên ${record.student_name}`
    );
    setReviewModal({ open: false, record: null, targetStatus: 'penalized', adminNote: '' });
    fetchData();
  };

  const handleForceReRegisterFace = (record) => {
    confirm({
      title: `Yêu cầu "${record.student_name}" đăng ký lại khuôn mặt 3 góc?`,
      content:
        'Hệ thống sẽ gọi đồng thời DELETE /v1/admin/users/:id/face và DELETE /v1/student/face để xóa vector MobileFaceNet 192 chiều hiện tại và đánh dấu hồ sơ cần đăng ký lại trước khi vào bài giảng tiếp theo.',
      okText: 'Xóa Face Vector & Yêu cầu Đăng ký lại',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        await usersApi.resetFaceEmbedding(record.user_id || record.id);
        await usersApi.resolveProctoringViolation(record.id, {
          status: 'reviewed',
          adminNote: 'Đã xóa FaceEmbeddings cũ và yêu cầu sinh viên đăng ký lại khuôn mặt 3 góc.',
        });
        message.success(
          `Đã xóa vector khuôn mặt và gửi yêu cầu đăng ký lại cho ${record.student_name}`
        );
        fetchData();
      },
    });
  };

  const handleSubmissionAction = async (record, nextStatus) => {
    await usersApi.updateSubmissionIntegrityStatus(record.id, nextStatus);
    message.success(
      nextStatus === 'verified'
        ? `Đã xác nhận bài nộp của ${record.student_name} đạt chuẩn liêm chính học thuật`
        : `Đã đánh dấu vi phạm đạo văn bài nộp của ${record.student_name}`
    );
    fetchData();
  };

  const pendingViolationsCount = violations.filter((v) => v.status === 'pending').length;
  const identityMismatchCount = violations.filter(
    (v) => v.violation_type === 'identity_mismatch'
  ).length;
  const highSimilarityCount = submissions.filter(
    (s) => Number(s.similarity_score) >= 40
  ).length;

  const violationColumns = [
    {
      title: 'Sinh viên & Mã số',
      key: 'student',
      width: 195,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>{r.student_name}</div>
          <Tag color="geekblue" style={{ marginTop: 2 }}>
            {r.student_code}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Khóa học & Bài giảng Video',
      key: 'course_lesson',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150', fontSize: 13 }}>
            {r.course_title}
          </div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>{r.lesson_title}</div>
          {r.details && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              ↳ {r.details}
            </div>
          )}
          {r.admin_note && (
            <div style={{ fontSize: 12, color: '#047857', marginTop: 3 }}>
              ✓ Ghi chú xử lý: {r.admin_note}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Mốc Video',
      dataIndex: 'video_timestamp_sec',
      key: 'video_timestamp_sec',
      width: 110,
      render: (sec) => (
        <Tag color="blue" icon={<ClockCircleOutlined />}>
          [{formatTimestamp(sec)}]
        </Tag>
      ),
    },
    {
      title: 'Loại Vi phạm (`violation_type`)',
      dataIndex: 'violation_type',
      key: 'violation_type',
      width: 225,
      render: (type, r) =>
        type === 'identity_mismatch' ? (
          <div>
            <Tag color="error" icon={<UserSwitchOutlined />}>
              Không khớp khuôn mặt chủ TK
            </Tag>
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
              <code>identity_mismatch</code> ({r.consecutive_fails || 3} chu kỳ liên tiếp)
            </div>
          </div>
        ) : (
          <div>
            <Tag color="volcano" icon={<WarningOutlined />}>
              Vắng mặt quá 30s ({r.absent_duration_sec || 30}s)
            </Tag>
            <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>
              <code>face_absent_30s</code> ({r.consecutive_fails || 6} lần quét x 5s)
            </div>
          </div>
        ),
    },
    {
      title: 'Cosine Similarity %',
      key: 'cosine_similarity',
      width: 175,
      render: (_, r) => {
        const pct = Math.round((Number(r.cosine_similarity) || 0) * 1000) / 10;
        const thresholdPct = Math.round((Number(r.threshold_required) || 0.55) * 100);
        return (
          <div>
            <Progress
              percent={pct}
              size="small"
              status={pct < thresholdPct ? 'exception' : 'success'}
              format={() => `${pct}%`}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Ngưỡng chuẩn: &ge; {thresholdPct}%
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 165,
      render: (st) => {
        const meta = VIOLATION_STATUS_MAP[st] || VIOLATION_STATUS_MAP.pending;
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Thao tác Xử lý Vi phạm',
      key: 'actions',
      width: 265,
      render: (_, record) => (
        <Space size={6} wrap>
          <Button
            size="small"
            danger
            type="primary"
            icon={<CloseCircleOutlined />}
            onClick={() => openResolutionModal(record, 'penalized')}
          >
            Xác nhận vi phạm
          </Button>
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => openResolutionModal(record, 'excused')}
          >
            Miễn trừ
          </Button>
          <Tooltip title="Xóa Face Vector cũ & bắt buộc sinh viên đăng ký lại 3 góc mặt">
            <Button
              size="small"
              type="dashed"
              danger
              icon={<ScanOutlined />}
              onClick={() => handleForceReRegisterFace(record)}
            >
              Yêu cầu đăng ký lại khuôn mặt
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const submissionColumns = [
    {
      title: 'Sinh viên Nộp bài',
      key: 'student',
      width: 195,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>{r.student_name}</div>
          <Tag color="geekblue" style={{ marginTop: 2 }}>
            {r.student_code}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Học phần & Bài tập Đánh giá',
      key: 'assignment',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>{r.assignment_title}</div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>{r.course_title}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
            🔍 Đối sánh AST/Embedding: {r.matched_source}
          </div>
        </div>
      ),
    },
    {
      title: 'Cam kết Honor Code',
      dataIndex: 'honor_code_accepted',
      key: 'honor_code_accepted',
      width: 165,
      render: (accepted) =>
        accepted ? (
          <Badge
            status="success"
            text={
              <Tag color="cyan" icon={<SafetyCertificateOutlined />}>
                HonorCodeAccepted ✓
              </Tag>
            }
          />
        ) : (
          <Tag color="error">Chưa ký cam kết</Tag>
        ),
    },
    {
      title: 'Độ tương đồng Đạo văn (`SimilarityScore %`)',
      dataIndex: 'similarity_score',
      key: 'similarity_score',
      width: 210,
      render: (score) => {
        const val = Number(score || 0);
        const strokeColor =
          val >= 60 ? '#dc2626' : val >= 30 ? '#d97706' : '#10b981';
        return (
          <div>
            <Progress
              percent={val}
              size="small"
              strokeColor={strokeColor}
              status={val >= 60 ? 'exception' : 'normal'}
              format={(p) => `${p}%`}
            />
            <span style={{ fontSize: 11, color: strokeColor, fontWeight: 500 }}>
              {val >= 60
                ? 'Cảnh báo trùng lặp nghiêm trọng (>= 60%)'
                : val >= 30
                ? 'Trùng lặp trung bình (Cần kiểm tra)'
                : 'Độc lập / An toàn (< 30%)'}
            </span>
          </div>
        );
      },
    },
    {
      title: 'AI Auto-Grade & Độ tin cậy',
      key: 'ai_grade',
      width: 170,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>
            Điểm gợi ý: {r.ai_grade_score} / 10
          </div>
          <Tag color="purple" style={{ marginTop: 2 }}>
            Confidence: {Math.round((Number(r.ai_grade_confidence) || 0.9) * 100)}%
          </Tag>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (st) => {
        const meta = SUBMISSION_STATUS_MAP[st] || SUBMISSION_STATUS_MAP.pending_review;
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Hậu kiểm Học thuật',
      key: 'actions',
      width: 210,
      render: (_, record) => (
        <Space size={6} wrap>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => handleSubmissionAction(record, 'verified')}
          >
            Công nhận hợp lệ
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleSubmissionAction(record, 'rejected')}
          >
            Kết luận đạo văn
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {!embedded && (
        <PageTitle
          title="Giám sát Sinh trắc học Khuôn mặt & Liêm chính Học thuật (`proctoring_violations`, `similarity_check`)"
          subtitle="Theo dõi cảnh báo vắng mặt quá 30s, sai lệch danh tính khuôn mặt (MobileFaceNet Cosine < 0.55) và kiểm tra tỷ lệ đạo văn bài nộp"
          routes={[
            { path: '/app/home', breadcrumbName: 'Trang chủ' },
            { breadcrumbName: 'Giám sát Sinh trắc & Đạo văn' },
          ]}
          extra={
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Làm mới
            </Button>
          }
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Vi phạm Sinh trắc Chờ xử lý"
              value={pendingViolationsCount}
              suffix={`/ ${violations.length} ca`}
              valueStyle={{ color: pendingViolationsCount > 0 ? '#dc2626' : '#10b981' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Cảnh báo Sai lệch Khuôn mặt (Identity Mismatch)"
              value={identityMismatchCount}
              suffix="trường hợp"
              valueStyle={{ color: '#0A3150' }}
              prefix={<UserSwitchOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Bài nộp Nghi vấn Trùng lặp Mã nguồn (>= 40%)"
              value={highSimilarityCount}
              suffix={`/ ${submissions.length} bài`}
              valueStyle={{ color: '#d97706' }}
              prefix={<FileSearchOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <FilterBar
        searchPlaceholder="Tìm theo tên sinh viên, MSSV hoặc tên môn học..."
        onFilter={(val, name) => setFilters((prev) => ({ ...prev, [name]: val }))}
        filters={[
          {
            name: 'violation_type',
            placeholder: 'Loại vi phạm sinh trắc',
            value: filters.violation_type,
            options: [
              {
                value: 'face_absent_30s',
                label: 'Vắng mặt quá 30s (face_absent_30s)',
              },
              {
                value: 'identity_mismatch',
                label: 'Không khớp khuôn mặt (identity_mismatch)',
              },
            ],
          },
          {
            name: 'status',
            placeholder: 'Trạng thái xử lý',
            value: filters.status,
            options: [
              { value: 'pending', label: 'Chờ xử lý (pending)' },
              { value: 'reviewed', label: 'Đã xem xét (reviewed)' },
              { value: 'excused', label: 'Đã miễn trừ (excused)' },
              { value: 'penalized', label: 'Đã xác nhận vi phạm (penalized)' },
            ],
          },
        ]}
      />

      <div className="admin-page-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'biometric',
              label: `Vi phạm Xác thực Khuôn mặt Sinh trắc (${violations.length})`,
              children: (
                <div>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 14 }}
                    message="Cơ chế Giám sát Sinh trắc học Thời gian thực (5s Interval trên Web Worker)"
                    description="Mỗi 5 giây khi video bài giảng đang phát, trình duyệt trích xuất vector MobileFaceNet 192 chiều và đối sánh Cosine Similarity với 3 góc mặt mẫu của chủ tài khoản. Nếu vắng mặt liên tục 6 chu kỳ (30 giây) hoặc Cosine Similarity < 55%, bài giảng sẽ tự động dừng và ghi nhận bản ghi vào bảng proctoring_violations."
                  />
                  <Table
                    dataSource={violations}
                    columns={violationColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                  />
                </div>
              ),
            },
            {
              key: 'similarity',
              label: `Cam kết Honor Code & Kiểm tra Đạo văn (${submissions.length})`,
              children: (
                <div>
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 14 }}
                    message="Kiểm tra Cam kết Liêm chính Học thuật (Honor Code) & Đối sánh Tương đồng Bài nộp"
                    description="Mọi bài nộp lập trình và báo cáo thực nghiệm đều yêu cầu ký xác nhận HonorCodeAccepted kèm kiểm tra độ tương đồng AST / Embedding (SimilarityScore %) và chấm điểm gợi ý bằng AI Auto-Grader."
                  />
                  <Table
                    dataSource={submissions}
                    columns={submissionColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={
          reviewModal.targetStatus === 'penalized'
            ? `Xác nhận Vi phạm Sinh trắc học: ${reviewModal.record?.student_name || ''}`
            : `Miễn trừ Cảnh báo Sinh trắc học: ${reviewModal.record?.student_name || ''}`
        }
        open={reviewModal.open}
        onCancel={() =>
          setReviewModal({ open: false, record: null, targetStatus: 'penalized', adminNote: '' })
        }
        onOk={handleConfirmResolution}
        okText={
          reviewModal.targetStatus === 'penalized'
            ? 'Xác nhận Vi phạm'
            : 'Xác nhận Miễn trừ'
        }
        okButtonProps={{ danger: reviewModal.targetStatus === 'penalized' }}
        cancelText="Hủy"
      >
        <div style={{ marginBottom: 12 }}>
          <div>
            Sinh viên: <strong>{reviewModal.record?.student_name}</strong> (
            {reviewModal.record?.student_code})
          </div>
          <div>Môn học: {reviewModal.record?.course_title}</div>
          <div style={{ marginTop: 8, fontWeight: 500 }}>Ghi chú quyết định của Quản trị viên:</div>
        </div>
        <TextArea
          rows={3}
          value={reviewModal.adminNote}
          onChange={(e) =>
            setReviewModal((prev) => ({ ...prev, adminNote: e.target.value }))
          }
          placeholder="Nhập lý do xác nhận vi phạm hoặc miễn trừ..."
        />
      </Modal>
    </div>
  );
}
