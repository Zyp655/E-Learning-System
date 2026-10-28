import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Input,
  Descriptions,
  message,
  Typography,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import FilterBar from '../../components/FilterBar';
import applicationsApi from '../../api/applications';
import { showApiError } from '../../utils/api';

const { TextArea } = Input;
const { Text } = Typography;

export default function TeacherApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ keyword: '', status: undefined });
  const [selectedApp, setSelectedApp] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await applicationsApi.getAll(filters);
      setApplications(res.data || []);
    } catch (e) {
      showApiError(e, 'Không thể tải danh sách hồ sơ giảng viên');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleOpenReviewModal = (record) => {
    setSelectedApp(record);
    setAdminNote(
      record.admin_note ||
        'Đã thẩm định văn bằng chuyên môn và kinh nghiệm giảng dạy. Đồng ý cấp quyền Giảng viên (Teacher Studio).'
    );
  };

  const handleReviewDecision = async (status) => {
    if (!selectedApp) return;
    if (!adminNote.trim()) {
      message.warning('Vui lòng nhập ghi chú thẩm định (adminNote)');
      return;
    }
    setSubmitting(true);
    try {
      await applicationsApi.review(selectedApp.id, {
        status,
        adminNote,
      });
      message.success(
        status === 1
          ? `Đã phê duyệt hồ sơ Giảng viên của ${selectedApp.full_name}`
          : `Đã từ chối hồ sơ của ${selectedApp.full_name}`
      );
      setSelectedApp(null);
      fetchApplications();
    } catch (e) {
      showApiError(e, 'lms-api từ chối cập nhật hồ sơ, trạng thái chưa thay đổi');
    } finally {
      setSubmitting(false);
    }
  };

  const statusTag = (status) => {
    if (Number(status) === 1) return <Tag color="success">Đã phê duyệt (Approved)</Tag>;
    if (Number(status) === 2) return <Tag color="error">Đã từ chối (Rejected)</Tag>;
    return <Tag color="warning">Chờ thẩm định (Pending)</Tag>;
  };

  const columns = [
    {
      title: 'Ứng viên Giảng viên',
      key: 'applicant',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>{r.full_name}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.email}</div>
        </div>
      ),
    },
    {
      title: 'Lĩnh vực Chuyên môn (`expertise`)',
      dataIndex: 'expertise',
      key: 'expertise',
      width: 260,
    },
    {
      title: 'Bằng cấp & Chứng chỉ (`qualifications`)',
      dataIndex: 'qualifications',
      key: 'qualifications',
      width: 260,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (status) => statusTag(status),
    },
    {
      title: 'Ghi chú Quản trị (`admin_note`)',
      dataIndex: 'admin_note',
      key: 'admin_note',
      render: (note) =>
        note ? (
          <Text style={{ fontSize: 12 }}>{note}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Chưa có ghi chú
          </Text>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Button
          type={record.status === 0 ? 'primary' : 'default'}
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleOpenReviewModal(record)}
        >
          {record.status === 0 ? 'Thẩm định & Duyệt' : 'Xem hồ sơ'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Duyệt Hồ sơ Đăng ký Giảng viên (`teacher_applications`)"
        subtitle="Thẩm định trình độ học vấn, kinh nghiệm giảng dạy và phê duyệt nâng cấp vai trò Teacher cho tài khoản"
        routes={[
          { path: '/app/home', breadcrumbName: 'Trang chủ' },
          { breadcrumbName: 'Duyệt Hồ sơ Giảng viên' },
        ]}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchApplications} loading={loading}>
            Làm mới
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Tìm theo họ tên ứng viên, email, chuyên môn..."
        onFilter={(val, name) => setFilters((prev) => ({ ...prev, [name]: val }))}
        filters={[
          {
            name: 'status',
            placeholder: 'Trạng thái hồ sơ',
            value: filters.status,
            options: [
              { value: 0, label: 'Chờ thẩm định (Pending)' },
              { value: 1, label: 'Đã phê duyệt (Approved)' },
              { value: 2, label: 'Đã từ chối (Rejected)' },
            ],
          },
        ]}
      />

      <div className="admin-page-card">
        <Table
          dataSource={applications}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <Modal
        title={`Thẩm định Hồ sơ Giảng viên: ${selectedApp?.full_name || ''}`}
        open={Boolean(selectedApp)}
        onCancel={() => setSelectedApp(null)}
        width={680}
        footer={
          selectedApp
            ? [
                <Button key="cancel" onClick={() => setSelectedApp(null)}>
                  Đóng
                </Button>,
                <Button
                  key="reject"
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={submitting}
                  onClick={() => handleReviewDecision(2)}
                >
                  Từ chối Hồ sơ
                </Button>,
                <Button
                  key="approve"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  style={{ backgroundColor: '#1c906c', borderColor: '#1c906c' }}
                  loading={submitting}
                  onClick={() => handleReviewDecision(1)}
                >
                  Phê duyệt &amp; Cấp quyền Giảng viên
                </Button>,
              ]
            : null
        }
      >
        {selectedApp && (
          <div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Khi phê duyệt, lms-api đổi users.role thành 'teacher' và mở khóa Teacher Studio cho ứng viên."
            />

            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Họ và tên">{selectedApp.full_name}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedApp.email}</Descriptions.Item>
              <Descriptions.Item label="Chuyên môn (expertise)">
                {selectedApp.expertise}
              </Descriptions.Item>
              <Descriptions.Item label="Bằng cấp & Chứng chỉ (qualifications)">
                {selectedApp.qualifications}
              </Descriptions.Item>
              <Descriptions.Item label="Kinh nghiệm giảng dạy (experience)">
                {selectedApp.experience}
              </Descriptions.Item>
              <Descriptions.Item label="Lý do ứng tuyển (reason)">
                {selectedApp.reason}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái hiện tại">
                {statusTag(selectedApp.status)}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Ghi chú Thẩm định của Quản trị viên (`adminNote`):
              </Text>
              <TextArea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Nhập nhận xét phê duyệt hoặc lý do từ chối..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
