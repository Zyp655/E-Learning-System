import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  InputNumber,
  Progress,
  message,
  Typography,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  UserSwitchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import ActionBar from '../../components/ActionBar';
import academicApi from '../../api/academic';
import usersApi from '../../api/users';

const { confirm } = Modal;
const { Text } = Typography;

export default function AcademicCourses() {
  const [activeTab, setActiveTab] = useState('courses');
  const [academicCourses, setAcademicCourses] = useState([]);
  const [courseClasses, setCourseClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [assignTeacherClass, setAssignTeacherClass] = useState(null);
  const [enrolledDrawerClass, setEnrolledDrawerClass] = useState(null);

  const [courseForm] = Form.useForm();
  const [classForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [acList, ccList, deptList, semList, userRes] = await Promise.all([
        academicApi.getAcademicCourses(),
        academicApi.getCourseClasses(),
        academicApi.getDepartments(),
        academicApi.getSemesters(),
        usersApi.getAll({ role: 1 }),
      ]);
      setAcademicCourses(acList || []);
      setCourseClasses(ccList || []);
      setDepartments(deptList || []);
      setSemesters(semList || []);
      setTeachers(userRes?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOpenCourseModal = (record = null) => {
    setEditingCourse(record);
    courseForm.resetFields();
    if (record) {
      courseForm.setFieldsValue(record);
    } else {
      courseForm.setFieldsValue({
        credits: 3,
        department_id: departments[0]?.id || 1,
        course_type: 'required',
      });
    }
    setCourseModalOpen(true);
  };

  const handleSaveCourse = async () => {
    try {
      const values = await courseForm.validateFields();
      if (editingCourse) {
        await academicApi.updateAcademicCourse(editingCourse.id, values);
        message.success('Đã cập nhật Học phần chuẩn');
      } else {
        await academicApi.createAcademicCourse(values);
        message.success('Đã tạo Học phần chuẩn mới');
      }
      setCourseModalOpen(false);
      fetchAll();
    } catch (e) {}
  };

  const handleOpenClassModal = (record = null) => {
    setEditingClass(record);
    classForm.resetFields();
    if (record) {
      classForm.setFieldsValue(record);
    } else {
      classForm.setFieldsValue({
        academic_course_id: academicCourses[0]?.id || 1,
        semester_id: semesters.find((s) => s.is_active)?.id || semesters[0]?.id || 3,
        teacher_id: teachers[0]?.id || 201,
        max_students: 50,
        room: 'B1-302',
        schedule: 'Thứ 2 (07:30 - 10:00)',
      });
    }
    setClassModalOpen(true);
  };

  const handleSaveClass = async () => {
    try {
      const values = await classForm.validateFields();
      if (editingClass) {
        await academicApi.updateCourseClass(editingClass.id, values);
        message.success('Đã cập nhật Lớp học phần');
      } else {
        await academicApi.createCourseClass(values);
        message.success('Đã mở Lớp học phần mới');
      }
      setClassModalOpen(false);
      fetchAll();
    } catch (e) {}
  };

  const handleAssignTeacherSubmit = async () => {
    try {
      const values = await assignForm.validateFields();
      await academicApi.updateCourseClass(assignTeacherClass.id, {
        ...assignTeacherClass,
        teacher_id: values.teacher_id,
      });
      message.success(`Đã phân công giảng viên cho lớp ${assignTeacherClass.class_code}`);
      setAssignTeacherClass(null);
      fetchAll();
    } catch (e) {}
  };

  const courseColumns = [
    {
      title: 'Mã Học phần',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Tên Học phần Chuẩn (`academic_courses`)',
      key: 'name',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>{r.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.description}
          </Text>
        </div>
      ),
    },
    {
      title: 'Tín chỉ',
      dataIndex: 'credits',
      key: 'credits',
      width: 90,
      render: (c) => <strong>{c} TC</strong>,
    },
    {
      title: 'Loại Học phần',
      dataIndex: 'course_type',
      key: 'course_type',
      width: 145,
      render: (type) =>
        type === 'required' ? (
          <Tag color="volcano">Bắt buộc (Required)</Tag>
        ) : (
          <Tag color="cyan">Tự chọn (Elective)</Tag>
        ),
    },
    {
      title: 'Khoa Quản lý',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 240,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenCourseModal(record)}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              confirm({
                title: `Xóa học phần ${record.code}?`,
                onOk: async () => {
                  await academicApi.deleteAcademicCourse(record.id);
                  message.success('Đã xóa học phần');
                  fetchAll();
                },
              })
            }
          />
        </Space>
      ),
    },
  ];

  const classColumns = [
    {
      title: 'Mã Lớp Học phần',
      dataIndex: 'class_code',
      key: 'class_code',
      width: 160,
      render: (code) => <Tag color="geekblue">{code}</Tag>,
    },
    {
      title: 'Học phần & Học kỳ',
      key: 'course',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0A3150' }}>
            [{r.academic_course_code}] {r.academic_course_name}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.semester_name}
          </Text>
        </div>
      ),
    },
    {
      title: 'Giảng viên Phụ trách',
      key: 'teacher',
      width: 220,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 500 }}>{r.teacher_name}</span>
          <Button
            type="link"
            size="small"
            icon={<UserSwitchOutlined />}
            style={{ padding: 0, fontSize: 12 }}
            onClick={() => {
              setAssignTeacherClass(r);
              assignForm.setFieldsValue({ teacher_id: r.teacher_id });
            }}
          >
            Phân công / Đổi GV
          </Button>
        </Space>
      ),
    },
    {
      title: 'Phòng & Lịch học',
      key: 'schedule',
      width: 200,
      render: (_, r) => (
        <div>
          <div>Phòng: {r.room}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.schedule}
          </Text>
        </div>
      ),
    },
    {
      title: 'Sĩ số Ghi danh',
      key: 'enrolled',
      width: 170,
      render: (_, r) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <span>
            <strong>{r.enrolled_count || 0}</strong> / {r.max_students} SV
          </span>
          <Button
            size="small"
            icon={<TeamOutlined />}
            onClick={() => setEnrolledDrawerClass(r)}
          >
            Xem DSSV ({r.enrolled_students?.length || 0})
          </Button>
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenClassModal(record)}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              confirm({
                title: `Xóa lớp học phần ${record.class_code}?`,
                onOk: async () => {
                  await academicApi.deleteCourseClass(record.id);
                  message.success('Đã xóa lớp học phần');
                  fetchAll();
                },
              })
            }
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Quản lý Học phần Chuẩn & Lớp Học phần theo Kỳ"
        subtitle="Thiết lập danh mục Học phần đào tạo (academic_courses), Mở lớp học phần (course_classes), Phân công Giảng viên & Xem danh sách sinh viên"
        routes={[
          { path: '/app/home', breadcrumbName: 'Trang chủ' },
          { breadcrumbName: 'Học phần & Lớp học phần' },
        ]}
      />

      <div className="admin-page-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'courses',
              label: `Học phần Chuẩn (${academicCourses.length})`,
              children: (
                <>
                  <ActionBar
                    addButtonText="Thêm Học phần Chuẩn"
                    onAdd={() => handleOpenCourseModal(null)}
                    onRefresh={fetchAll}
                  />
                  <Table
                    dataSource={academicCourses}
                    columns={courseColumns}
                    rowKey="id"
                    loading={loading}
                  />
                </>
              ),
            },
            {
              key: 'classes',
              label: `Lớp Học phần theo Học kỳ (${courseClasses.length})`,
              children: (
                <>
                  <ActionBar
                    addButtonText="Mở Lớp Học phần mới"
                    onAdd={() => handleOpenClassModal(null)}
                    onRefresh={fetchAll}
                  />
                  <Table
                    dataSource={courseClasses}
                    columns={classColumns}
                    rowKey="id"
                    loading={loading}
                  />
                </>
              ),
            },
          ]}
        />
      </div>

      {/* Modal CRUD Academic Course */}
      <Modal
        title={editingCourse ? 'Chỉnh sửa Học phần Chuẩn' : 'Thêm Học phần Chuẩn mới'}
        open={courseModalOpen}
        onCancel={() => setCourseModalOpen(false)}
        onOk={handleSaveCourse}
        okText="Lưu Học phần"
        cancelText="Hủy"
      >
        <Form form={courseForm} layout="vertical">
          <Form.Item
            name="code"
            label="Mã Học phần (VD: IT4080)"
            rules={[{ required: true, message: 'Vui lòng nhập mã học phần' }]}
          >
            <Input placeholder="IT4080" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên Học phần"
            rules={[{ required: true, message: 'Vui lòng nhập tên học phần' }]}
          >
            <Input placeholder="Học sâu và Thị giác Máy tính" />
          </Form.Item>
          <Space size={12} style={{ display: 'flex' }}>
            <Form.Item name="credits" label="Số tín chỉ" rules={[{ required: true }]}>
              <InputNumber min={1} max={10} />
            </Form.Item>
            <Form.Item name="course_type" label="Loại học phần" rules={[{ required: true }]}>
              <Select
                style={{ width: 220 }}
                options={[
                  { value: 'required', label: 'Bắt buộc (Required)' },
                  { value: 'elective', label: 'Tự chọn (Elective — AI Suggest)' },
                ]}
              />
            </Form.Item>
          </Space>
          <Form.Item name="department_id" label="Khoa Quản lý" rules={[{ required: true }]}>
            <Select
              options={departments.map((d) => ({
                value: d.id,
                label: `[${d.code}] ${d.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Mô tả đề cương tóm tắt">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal CRUD Course Class */}
      <Modal
        title={editingClass ? 'Chỉnh sửa Lớp Học phần' : 'Mở Lớp Học phần mới'}
        open={classModalOpen}
        onCancel={() => setClassModalOpen(false)}
        onOk={handleSaveClass}
        okText="Lưu Lớp học phần"
        cancelText="Hủy"
      >
        <Form form={classForm} layout="vertical">
          <Form.Item
            name="class_code"
            label="Mã Lớp Học phần (Unique)"
            rules={[{ required: true, message: 'Nhập mã lớp (VD: IT4080-20261-02)' }]}
          >
            <Input placeholder="IT4080-20261-02" />
          </Form.Item>
          <Form.Item
            name="academic_course_id"
            label="Thuộc Học phần Chuẩn"
            rules={[{ required: true }]}
          >
            <Select
              options={academicCourses.map((c) => ({
                value: c.id,
                label: `[${c.code}] ${c.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="semester_id" label="Học kỳ" rules={[{ required: true }]}>
            <Select
              options={semesters.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="teacher_id"
            label="Giảng viên Phụ trách"
            rules={[{ required: true }]}
          >
            <Select
              options={teachers.map((t) => ({
                value: t.id,
                label: `${t.full_name} (${t.email})`,
              }))}
            />
          </Form.Item>
          <Space size={12} style={{ display: 'flex' }}>
            <Form.Item name="room" label="Phòng học">
              <Input placeholder="B1-302" />
            </Form.Item>
            <Form.Item name="schedule" label="Ca học trong tuần">
              <Input placeholder="Thứ 2 (07:30 - 10:00)" />
            </Form.Item>
            <Form.Item name="max_students" label="Sĩ số tối đa">
              <InputNumber min={10} max={200} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Modal Assign Teacher */}
      <Modal
        title={`Phân công Giảng viên — Lớp ${assignTeacherClass?.class_code || ''}`}
        open={Boolean(assignTeacherClass)}
        onCancel={() => setAssignTeacherClass(null)}
        onOk={handleAssignTeacherSubmit}
        okText="Xác nhận Phân công"
        cancelText="Hủy"
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            name="teacher_id"
            label="Chọn Giảng viên Phụ trách Lớp học phần"
            rules={[{ required: true }]}
          >
            <Select
              options={teachers.map((t) => ({
                value: t.id,
                label: `${t.full_name} — ${t.department_name}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer View Enrolled Students */}
      <Drawer
        title={`Danh sách Sinh viên Ghi danh — Lớp ${enrolledDrawerClass?.class_code || ''}`}
        placement="right"
        width={620}
        onClose={() => setEnrolledDrawerClass(null)}
        open={Boolean(enrolledDrawerClass)}
      >
        {enrolledDrawerClass && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>
                [{enrolledDrawerClass.academic_course_code}]{' '}
                {enrolledDrawerClass.academic_course_name}
              </Text>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Giảng viên: {enrolledDrawerClass.teacher_name} · Lịch học:{' '}
                {enrolledDrawerClass.schedule}
              </div>
            </div>
            <Table
              size="small"
              rowKey="id"
              dataSource={enrolledDrawerClass.enrolled_students || []}
              columns={[
                { title: 'MSSV', dataIndex: 'student_code', key: 'student_code' },
                { title: 'Họ tên Sinh viên', dataIndex: 'full_name', key: 'full_name' },
                {
                  title: 'Tiến độ Học tập',
                  dataIndex: 'progress_percent',
                  key: 'progress_percent',
                  render: (pct) => <Progress percent={pct} size="small" />,
                },
                {
                  title: 'Nguồn Ghi danh',
                  dataIndex: 'source',
                  key: 'source',
                  render: (s) => (
                    <Tag color={s === 'import' ? 'blue' : 'green'}>
                      {s === 'import' ? 'Excel Import' : 'Thủ công'}
                    </Tag>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
