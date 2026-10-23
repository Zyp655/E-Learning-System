import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Row, Col } from 'antd';

export default function UserForm({
  visible,
  item,
  departments = [],
  onCancel,
  onSubmit,
  loading = false,
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      if (item) {
        form.setFieldsValue({
          ...item,
          role: Number(item.role ?? 0),
          department_id: Number(item.department_id ?? 1),
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          role: 0,
          department_id: departments[0]?.id || 1,
          academic_year: 1,
        });
      }
    }
  }, [visible, item, departments, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (e) {}
  };

  return (
    <Modal
      title={item ? `Chỉnh sửa Tài khoản: ${item.full_name}` : 'Tạo mới Tài khoản Người dùng'}
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      okText={item ? 'Lưu thay đổi' : 'Tạo tài khoản'}
      cancelText="Hủy"
      width={620}
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="full_name"
              label="Họ và tên"
              rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
            >
              <Input placeholder="Nguyễn Minh Quân" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label="Email Học thuật / Công vụ"
              rules={[
                { required: true, message: 'Vui lòng nhập email' },
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input placeholder="quan.nm@sis.lms.edu.vn" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item
              name="student_code"
              label="Mã SV / Mã CBGV"
              rules={[{ required: true, message: 'Vui lòng nhập mã định danh' }]}
            >
              <Input placeholder="SV20220145 / GV-FIT-01" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="role"
              label="Vai trò Hệ thống (RBAC)"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: 0, label: 'Sinh viên (Student)' },
                  { value: 1, label: 'Giảng viên (Teacher)' },
                  { value: 2, label: 'Quản trị viên (Admin)' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="academic_year" label="Khóa / Năm học">
              <InputNumber min={1} max={6} style={{ width: '100%' }} placeholder="1..4" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="department_id"
              label="Khoa Quản lý (`departments`)"
              rules={[{ required: true, message: 'Vui lòng chọn Khoa' }]}
            >
              <Select
                options={departments.map((d) => ({
                  value: d.id,
                  label: `[${d.code}] ${d.name}`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="major" label="Chuyên ngành (`student_profiles.major`)">
              <Input placeholder="Trí tuệ Nhân tạo & Thị giác Máy tính" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="student_class" label="Lớp hành chính">
              <Input placeholder="CNTT-AI-K67" />
            </Form.Item>
          </Col>
          {!item && (
            <Col span={12}>
              <Form.Item
                name="password"
                label="Mật khẩu khởi tạo"
                initialValue="LmsStudent@2026"
                rules={[{ required: true, message: 'Nhập mật khẩu khởi tạo' }]}
              >
                <Input.Password />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </Modal>
  );
}
