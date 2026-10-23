import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
} from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import ActionBar from '../../components/ActionBar';
import academicApi from '../../api/academic';

const { confirm } = Modal;

export default function Departments() {
  const [activeTab, setActiveTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, majs, sems] = await Promise.all([
        academicApi.getDepartments(),
        academicApi.getMajors(),
        academicApi.getSemesters(),
      ]);
      setDepartments(depts || []);
      setMajors(majs || []);
      setSemesters(sems || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openModal = (item = null) => {
    setEditingItem(item);
    form.resetFields();
    if (item) {
      form.setFieldsValue(item);
    } else if (activeTab === 'majors') {
      form.setFieldsValue({ department_id: departments[0]?.id || 1 });
    } else if (activeTab === 'semesters') {
      form.setFieldsValue({
        year: 2026,
        term: 2,
        start_date: '2027-01-18',
        end_date: '2027-06-10',
        is_active: false,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (activeTab === 'departments') {
        if (editingItem) {
          await academicApi.updateDepartment(editingItem.id, values);
          message.success('Đã cập nhật Khoa');
        } else {
          await academicApi.createDepartment(values);
          message.success('Đã thêm Khoa mới');
        }
      } else if (activeTab === 'majors') {
        if (editingItem) {
          await academicApi.updateMajor(editingItem.id, values);
          message.success('Đã cập nhật Chuyên ngành');
        } else {
          await academicApi.createMajor(values);
          message.success('Đã thêm Chuyên ngành mới');
        }
      } else if (activeTab === 'semesters') {
        if (editingItem) {
          await academicApi.updateSemester(editingItem.id, values);
          message.success('Đã cập nhật Học kỳ');
        } else {
          await academicApi.createSemester(values);
          message.success('Đã thêm Học kỳ mới');
        }
      }
      setModalOpen(false);
      fetchAll();
    } catch (e) {}
  };

  const handleDelete = (record, type) => {
    confirm({
      title: `Xác nhận xóa "${record.name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        if (type === 'departments') await academicApi.deleteDepartment(record.id);
        if (type === 'majors') await academicApi.deleteMajor(record.id);
        if (type === 'semesters') await academicApi.deleteSemester(record.id);
        message.success('Đã xóa thành công');
        fetchAll();
      },
    });
  };

  const deptColumns = [
    {
      title: 'Mã Khoa',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Tên Khoa (`departments.name`)',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <strong style={{ color: '#0A3150' }}>{name}</strong>,
    },
    {
      title: 'Mô tả chức năng đào tạo',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Quy mô',
      key: 'scale',
      width: 170,
      render: (_, r) => (
        <span>
          {r.majors_count || 2} ngành · <strong>{r.students_count || 0}</strong> SV
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record, 'departments')}
          />
        </Space>
      ),
    },
  ];

  const majorColumns = [
    {
      title: 'Mã Ngành',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code) => <Tag color="geekblue">{code}</Tag>,
    },
    {
      title: 'Tên Chuyên ngành (`majors.name`)',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <strong style={{ color: '#0A3150' }}>{name}</strong>,
    },
    {
      title: 'Thuộc Khoa',
      dataIndex: 'department_name',
      key: 'department_name',
    },
    {
      title: 'Định hướng Chuyên sâu (Hyper-Personalization Context)',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record, 'majors')}
          />
        </Space>
      ),
    },
  ];

  const semesterColumns = [
    {
      title: 'Tên Học kỳ (`semesters.name`)',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <strong style={{ color: '#0A3150' }}>{name}</strong>,
    },
    {
      title: 'Năm học / Kỳ',
      key: 'term',
      width: 160,
      render: (_, r) => (
        <span>
          Năm {r.year} · Học kỳ {r.term === 3 ? 'Hè (3)' : r.term}
        </span>
      ),
    },
    {
      title: 'Thời gian Bắt đầu – Kết thúc',
      key: 'dates',
      width: 240,
      render: (_, r) => (
        <span>
          {r.start_date} &rarr; {r.end_date}
        </span>
      ),
    },
    {
      title: 'Trạng thái Học kỳ',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 170,
      render: (active) =>
        active ? (
          <Tag color="success">Học kỳ Hiện tại (Active)</Tag>
        ) : (
          <Tag>Đã đóng / Lưu trữ</Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record, 'semesters')}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Quản lý Cấu trúc Đào tạo Đại học (Khoa · Chuyên ngành · Học kỳ)"
        subtitle="Thiết lập danh mục Khoa (departments), Chuyên ngành (majors) phục vụ AI Hyper-Personalization và Học kỳ (semesters)"
        routes={[
          { path: '/app/home', breadcrumbName: 'Trang chủ' },
          { breadcrumbName: 'Khoa · Ngành · Học kỳ' },
        ]}
      />

      <div className="admin-page-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'departments',
              label: `Danh sách Khoa (${departments.length})`,
              children: (
                <>
                  <ActionBar
                    addButtonText="Thêm Khoa mới"
                    onAdd={() => openModal(null)}
                    onRefresh={fetchAll}
                  />
                  <Table
                    dataSource={departments}
                    columns={deptColumns}
                    rowKey="id"
                    loading={loading}
                  />
                </>
              ),
            },
            {
              key: 'majors',
              label: `Chuyên ngành Đào tạo (${majors.length})`,
              children: (
                <>
                  <ActionBar
                    addButtonText="Thêm Chuyên ngành"
                    onAdd={() => openModal(null)}
                    onRefresh={fetchAll}
                  />
                  <Table
                    dataSource={majors}
                    columns={majorColumns}
                    rowKey="id"
                    loading={loading}
                  />
                </>
              ),
            },
            {
              key: 'semesters',
              label: `Học kỳ Năm học (${semesters.length})`,
              children: (
                <>
                  <ActionBar
                    addButtonText="Mở Học kỳ mới"
                    onAdd={() => openModal(null)}
                    onRefresh={fetchAll}
                  />
                  <Table
                    dataSource={semesters}
                    columns={semesterColumns}
                    rowKey="id"
                    loading={loading}
                  />
                </>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={
          activeTab === 'departments'
            ? editingItem
              ? 'Chỉnh sửa Khoa'
              : 'Thêm Khoa mới'
            : activeTab === 'majors'
            ? editingItem
              ? 'Chỉnh sửa Chuyên ngành'
              : 'Thêm Chuyên ngành mới'
            : editingItem
            ? 'Chỉnh sửa Học kỳ'
            : 'Mở Học kỳ mới'
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="Lưu thông tin"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          {activeTab === 'departments' && (
            <>
              <Form.Item
                name="code"
                label="Mã Khoa (Unique Code)"
                rules={[{ required: true, message: 'Nhập mã khoa (VD: FIT)' }]}
              >
                <Input placeholder="FIT" />
              </Form.Item>
              <Form.Item
                name="name"
                label="Tên Khoa"
                rules={[{ required: true, message: 'Nhập tên khoa' }]}
              >
                <Input placeholder="Khoa Công nghệ Thông tin & Trí tuệ Nhân tạo" />
              </Form.Item>
              <Form.Item name="description" label="Mô tả">
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          )}

          {activeTab === 'majors' && (
            <>
              <Form.Item
                name="department_id"
                label="Thuộc Khoa"
                rules={[{ required: true }]}
              >
                <Select
                  options={departments.map((d) => ({
                    value: d.id,
                    label: `[${d.code}] ${d.name}`,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="code"
                label="Mã Chuyên ngành"
                rules={[{ required: true, message: 'Nhập mã chuyên ngành' }]}
              >
                <Input placeholder="AI / SE / DS" />
              </Form.Item>
              <Form.Item
                name="name"
                label="Tên Chuyên ngành"
                rules={[{ required: true, message: 'Nhập tên chuyên ngành' }]}
              >
                <Input placeholder="Trí tuệ Nhân tạo & Thị giác Máy tính" />
              </Form.Item>
              <Form.Item name="description" label="Mô tả định hướng kiến thức">
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          )}

          {activeTab === 'semesters' && (
            <>
              <Form.Item
                name="name"
                label="Tên Học kỳ"
                rules={[{ required: true, message: 'Nhập tên học kỳ' }]}
              >
                <Input placeholder="Học kỳ 2 Năm học 2026 - 2027" />
              </Form.Item>
              <Space size={12} style={{ display: 'flex' }}>
                <Form.Item name="year" label="Năm học" rules={[{ required: true }]}>
                  <InputNumber min={2020} max={2035} />
                </Form.Item>
                <Form.Item name="term" label="Kỳ (1, 2, 3=Hè)" rules={[{ required: true }]}>
                  <Select
                    style={{ width: 150 }}
                    options={[
                      { value: 1, label: 'Học kỳ 1' },
                      { value: 2, label: 'Học kỳ 2' },
                      { value: 3, label: 'Học kỳ Hè (3)' },
                    ]}
                  />
                </Form.Item>
              </Space>
              <Space size={12} style={{ display: 'flex' }}>
                <Form.Item name="start_date" label="Ngày bắt đầu (YYYY-MM-DD)">
                  <Input placeholder="2027-01-18" />
                </Form.Item>
                <Form.Item name="end_date" label="Ngày kết thúc (YYYY-MM-DD)">
                  <Input placeholder="2027-06-10" />
                </Form.Item>
              </Space>
              <Form.Item
                name="is_active"
                label="Đặt làm Học kỳ hiện hành (Active)"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
