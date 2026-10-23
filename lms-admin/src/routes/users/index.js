import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Select,
  message,
  Tooltip,
  Descriptions,
  Badge,
  Alert,
} from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
  ScanOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import ActionBar from '../../components/ActionBar';
import FilterBar from '../../components/FilterBar';
import usersApi from '../../api/users';
import academicApi from '../../api/academic';
import UserForm from './UserForm';
import ProctoringMonitor from '../proctoring';

const { confirm } = Modal;

export default function Users() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    keyword: '',
    role: undefined,
    department_id: undefined,
    status: undefined,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [faceModalUser, setFaceModalUser] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, deptRes] = await Promise.all([
        usersApi.getAll(filters),
        academicApi.getDepartments(),
      ]);
      setUsers(userRes.data || []);
      setDepartments(deptRes || []);
    } catch (err) {
      message.error('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (val, name) => {
    setFilters((prev) => ({ ...prev, [name]: val }));
  };

  const handleCreateOrUpdate = async (values) => {
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, values);
        message.success(`Đã cập nhật thông tin cho ${values.full_name}`);
      } else {
        await usersApi.create(values);
        message.success(`Đã tạo tài khoản ${values.full_name}`);
      }
      setModalVisible(false);
      fetchData();
    } catch (e) {
      message.error('Lưu tài khoản thất bại');
    }
  };

  const handleToggleBan = (record) => {
    const nextBanned = !record.is_banned;
    confirm({
      title: nextBanned
        ? `Khóa tài khoản "${record.full_name}"?`
        : `Mở khóa tài khoản "${record.full_name}"?`,
      content: nextBanned
        ? 'Người dùng này sẽ bị thu hồi phiên đăng nhập (active_session_token) và không thể truy cập hệ thống.'
        : 'Khôi phục quyền truy cập học tập / giảng dạy bình thường.',
      okText: nextBanned ? 'Khóa tài khoản' : 'Mở khóa',
      okType: nextBanned ? 'danger' : 'primary',
      cancelText: 'Hủy',
      onOk: async () => {
        await usersApi.toggleBan(record.id, nextBanned);
        message.success(
          nextBanned
            ? `Đã khóa tài khoản ${record.full_name}`
            : `Đã mở khóa tài khoản ${record.full_name}`
        );
        fetchData();
      },
    });
  };

  const handleChangeRole = async (record, newRole) => {
    await usersApi.update(record.id, { ...record, role: newRole });
    message.success(`Đã đổi vai trò của ${record.full_name}`);
    fetchData();
  };

  const handleResetFaceEmbeddings = (record) => {
    confirm({
      title: `Reset Dữ liệu Khuôn mặt Sinh trắc học (${record.full_name})?`,
      content:
        'Hệ thống sẽ gọi đồng thời DELETE /v1/admin/users/:id/face và DELETE /v1/student/face để xóa 3 vector 192 chiều (Thẳng, Trái, Phải) trong bảng face_embeddings. Sinh viên sẽ được yêu cầu đăng ký lại khuôn mặt ở lần vào học kế tiếp.',
      okText: 'Xác nhận Reset Face Embeddings',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        await usersApi.resetFaceEmbedding(record.id);
        message.success(
          `Đã xóa dữ liệu sinh trắc học khuôn mặt của ${record.full_name}. Sinh viên có thể đăng ký lại tại /student/face-setup.`
        );
        if (faceModalUser?.id === record.id) {
          setFaceModalUser((prev) => ({
            ...prev,
            has_face_embedding: false,
            face_poses_count: 0,
            face_updated_at: null,
          }));
        }
        fetchData();
      },
    });
  };

  const handleDeleteUser = (record) => {
    confirm({
      title: `Xóa vĩnh viễn tài khoản ${record.full_name}?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        await usersApi.delete(record.id);
        message.success('Đã xóa tài khoản');
        fetchData();
      },
    });
  };

  const columns = [
    {
      title: 'Mã định danh',
      dataIndex: 'student_code',
      key: 'student_code',
      width: 130,
      render: (code) => <Tag color="geekblue">{code}</Tag>,
    },
    {
      title: 'Họ và tên / Email',
      key: 'user',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>{r.full_name}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.email}</div>
        </div>
      ),
    },
    {
      title: 'Vai trò (RBAC)',
      dataIndex: 'role',
      key: 'role',
      width: 165,
      render: (role, record) => (
        <Select
          size="small"
          value={Number(role)}
          style={{ width: 145 }}
          onChange={(val) => handleChangeRole(record, val)}
          options={[
            { value: 0, label: 'Sinh viên (Student)' },
            { value: 1, label: 'Giảng viên (Teacher)' },
            { value: 2, label: 'Quản trị (Admin)' },
          ]}
        />
      ),
    },
    {
      title: 'Khoa / Chuyên ngành',
      key: 'academic',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.department_name}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {r.major || '—'} {r.student_class ? `· Lớp: ${r.student_class}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Sinh trắc Khuôn mặt (FaceEmbeddings)',
      key: 'face',
      width: 245,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          {r.has_face_embedding ? (
            <Badge
              status="success"
              text={
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  Đã đăng ký ({r.face_poses_count}/3 góc · 192-d)
                </span>
              }
            />
          ) : (
            <Badge
              status="warning"
              text={<span style={{ fontSize: 12 }}>Chưa đăng ký khuôn mặt</span>}
            />
          )}
          <Space size={6}>
            <Button
              size="small"
              type="link"
              icon={<EyeOutlined />}
              style={{ padding: 0, fontSize: 12 }}
              onClick={() => setFaceModalUser(r)}
            >
              Chi tiết
            </Button>
            {r.has_face_embedding && (
              <Button
                size="small"
                type="link"
                danger
                icon={<ScanOutlined />}
                style={{ padding: 0, fontSize: 12 }}
                onClick={() => handleResetFaceEmbeddings(r)}
              >
                Reset Khuôn mặt
              </Button>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_banned',
      key: 'is_banned',
      width: 120,
      render: (isBanned) =>
        isBanned ? (
          <Tag color="error">Đang bị khóa</Tag>
        ) : (
          <Tag color="success">Hoạt động</Tag>
        ),
    },
    {
      title: 'Thao tác Quản trị',
      key: 'actions',
      width: 210,
      render: (_, record) => (
        <Space size={6} wrap>
          <Tooltip title="Chỉnh sửa hồ sơ">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingUser(record);
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Button
            size="small"
            danger={!record.is_banned}
            type={record.is_banned ? 'primary' : 'default'}
            icon={record.is_banned ? <UnlockOutlined /> : <LockOutlined />}
            onClick={() => handleToggleBan(record)}
          >
            {record.is_banned ? 'Mở khóa' : 'Khóa'}
          </Button>
          <Tooltip title="Xóa tài khoản">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteUser(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Quản lý Người dùng, Dữ liệu Sinh trắc học Khuôn mặt & Giám sát Vi phạm"
        subtitle="Quản trị tài khoản Sinh viên, Giảng viên, Quản trị viên · Khóa/Mở tài khoản · Reset Vector Khuôn mặt 3 góc (MobileFaceNet 192-d) & Giám sát Proctoring"
        routes={[
          { path: '/app/home', breadcrumbName: 'Trang chủ' },
          { breadcrumbName: 'Người dùng & Sinh trắc' },
        ]}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'users',
            label: `Danh sách Tài khoản & FaceEmbeddings (${users.length})`,
            children: (
              <div>
                <FilterBar
                  searchPlaceholder="Tìm theo Họ tên, Email, hoặc MSSV / Mã GV..."
                  onFilter={handleFilterChange}
                  filters={[
                    {
                      name: 'role',
                      placeholder: 'Lọc theo Vai trò',
                      value: filters.role,
                      options: [
                        { value: 0, label: 'Sinh viên (Student)' },
                        { value: 1, label: 'Giảng viên (Teacher)' },
                        { value: 2, label: 'Quản trị viên (Admin)' },
                      ],
                    },
                    {
                      name: 'department_id',
                      placeholder: 'Lọc theo Khoa',
                      value: filters.department_id,
                      options: departments.map((d) => ({
                        value: d.id,
                        label: `[${d.code}] ${d.name}`,
                      })),
                    },
                    {
                      name: 'status',
                      placeholder: 'Trạng thái tài khoản',
                      value: filters.status,
                      options: [
                        { value: 'active', label: 'Đang hoạt động' },
                        { value: 'banned', label: 'Đang bị khóa (Banned)' },
                      ],
                    },
                  ]}
                />

                <div className="admin-page-card">
                  <ActionBar
                    addButtonText="Tạo Người dùng mới"
                    onAdd={() => {
                      setEditingUser(null);
                      setModalVisible(true);
                    }}
                    onRefresh={fetchData}
                  />

                  <Table
                    dataSource={users}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'proctoring',
            label: (
              <span>
                <WarningOutlined style={{ color: '#dc2626' }} /> Giám sát Vi phạm Sinh trắc & Liêm chính Học thuật
              </span>
            ),
            children: <ProctoringMonitor embedded />,
          },
        ]}
      />

      <UserForm
        visible={modalVisible}
        item={editingUser}
        departments={departments}
        onCancel={() => setModalVisible(false)}
        onSubmit={handleCreateOrUpdate}
      />

      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#0A3150' }} />
            <span>Hồ sơ Sinh trắc học Khuôn mặt 3 Góc (`face_embeddings`)</span>
          </Space>
        }
        open={Boolean(faceModalUser)}
        onCancel={() => setFaceModalUser(null)}
        footer={[
          <Button key="close" onClick={() => setFaceModalUser(null)}>
            Đóng
          </Button>,
          faceModalUser?.has_face_embedding && (
            <Button
              key="reset"
              type="primary"
              danger
              icon={<ScanOutlined />}
              onClick={() => handleResetFaceEmbeddings(faceModalUser)}
            >
              Reset Khuôn mặt (DELETE /v1/admin/users/:id/face)
            </Button>
          ),
        ]}
        width={640}
      >
        {faceModalUser && (
          <div>
            <Alert
              type={faceModalUser.has_face_embedding ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 16 }}
              message={
                faceModalUser.has_face_embedding
                  ? 'Đã lưu trữ 3 Vector Sinh trắc MobileFaceNet 192 chiều (Chính diện · Nghiêng trái · Nghiêng phải)'
                  : 'Người dùng chưa có dữ liệu vector khuôn mặt trong bảng face_embeddings'
              }
              description="Hệ thống chỉ lưu vector đặc trưng 192 float để đối sánh Cosine Similarity >= 0.55 ngay trên Web Worker trình duyệt, tuyệt đối không lưu ảnh gốc của học sinh."
            />

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Họ tên & Mã số">
                <strong>{faceModalUser.full_name}</strong> ({faceModalUser.student_code})
              </Descriptions.Item>
              <Descriptions.Item label="Góc Chính diện (front_data)">
                {faceModalUser.has_face_embedding ? (
                  <Tag color="green">Vector float32[192] — L2 Normalized (Norm = 1.000)</Tag>
                ) : (
                  <Tag>Chưa đăng ký</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Góc Nghiêng Trái (left_data)">
                {faceModalUser.has_face_embedding ? (
                  <Tag color="green">Vector float32[192] — L2 Normalized (Norm = 1.000)</Tag>
                ) : (
                  <Tag>Chưa đăng ký</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Góc Nghiêng Phải (right_data)">
                {faceModalUser.has_face_embedding ? (
                  <Tag color="green">Vector float32[192] — L2 Normalized (Norm = 1.000)</Tag>
                ) : (
                  <Tag>Chưa đăng ký</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật lần cuối">
                {faceModalUser.face_updated_at || 'Chưa có'}
              </Descriptions.Item>
              <Descriptions.Item label="Số lần cảnh báo Proctoring (`proctoring_violations`)">
                <Tag color={faceModalUser.proctoring_violations > 0 ? 'volcano' : 'blue'}>
                  {faceModalUser.proctoring_violations || 0} lần vi phạm (Vắng mặt 30s / Sai khuôn mặt)
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
