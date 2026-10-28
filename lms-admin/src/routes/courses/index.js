import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  Table,
  Tag,
  Switch,
  Button,
  Space,
  Rate,
  Modal,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Card,
  Collapse,
  Badge,
  Descriptions,
  Divider,
  Tooltip,
  Empty,
  Alert,
  Row,
  Col,
  message,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  PlusOutlined,
  EditOutlined,
  ApartmentOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  CodeOutlined,
  QuestionCircleOutlined,
  ClockCircleOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import FilterBar from '../../components/FilterBar';
import coursesApi from '../../api/courses';
import academicApi from '../../api/academic';
import { showApiError } from '../../utils/api';

const { confirm } = Modal;
const { Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;

const formatTimestamp = (sec = 0) => {
  const s = Math.max(0, Number(sec) || 0);
  const mins = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

const LESSON_TYPE_META = {
  video: { color: 'blue', label: 'VIDEO BÀI GIẢNG', icon: <PlayCircleOutlined /> },
  reading: { color: 'cyan', label: 'TÀI LIỆU ĐỌC (MARKDOWN)', icon: <ReadOutlined /> },
  coding: { color: 'purple', label: 'THỰC HÀNH CODE LAB', icon: <CodeOutlined /> },
  quiz: { color: 'orange', label: 'TRẮC NGHIỆM ĐÁNH GIÁ', icon: <QuestionCircleOutlined /> },
};

const LEVEL_META = {
  beginner: { color: 'green', label: 'BEGINNER (CƠ BẢN)' },
  intermediate: { color: 'blue', label: 'INTERMEDIATE (TRUNG CẤP)' },
  advanced: { color: 'volcano', label: 'ADVANCED (CHUYÊN SÂU)' },
};

export default function Courses() {
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    keyword: '',
    is_published: undefined,
    level: undefined,
  });

  // Course Modal state
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm] = Form.useForm();

  // Curriculum Drawer state
  const [curriculumCourseId, setCurriculumCourseId] = useState(null);

  // Module Modal state
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleForm] = Form.useForm();

  // Lesson Modal state
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [targetModuleForLesson, setTargetModuleForLesson] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonForm] = Form.useForm();

  // VideoSegment Modal state
  const [segmentModalOpen, setSegmentModalOpen] = useState(false);
  const [targetModuleForSegment, setTargetModuleForSegment] = useState(null);
  const [targetLessonForSegment, setTargetLessonForSegment] = useState(null);
  const [editingSegment, setEditingSegment] = useState(null);
  const [segmentForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cList, rList, dList] = await Promise.all([
        coursesApi.getAllCourses(filters),
        coursesApi.getReviews(),
        academicApi.getDepartments(),
      ]);
      setCourses(cList || []);
      setReviews(rList || []);
      setDepartments(dList || []);
    } catch (error) {
      showApiError(error, 'Không tải được dữ liệu khóa học / đánh giá từ lms-api');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeCurriculumCourse = courses.find(
    (c) => Number(c.id) === Number(curriculumCourseId)
  );

  // --- COURSE HANDLERS ---
  const openCreateCourseModal = () => {
    setEditingCourse(null);
    courseForm.resetFields();
    courseForm.setFieldsValue({
      category: 'Trí tuệ Nhân tạo & Thị giác Máy tính',
      department_name:
        departments[0]?.name || 'Khoa Công nghệ Thông tin & Trí tuệ Nhân tạo',
      instructor_name: 'PGS.TS. Đỗ Đức Hùng',
      level: 'intermediate',
      duration_minutes: 960,
      thumbnail_url:
        'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&auto=format&fit=crop&q=80',
      is_published: true,
    });
    setCourseModalOpen(true);
  };

  const openEditCourseModal = (record) => {
    setEditingCourse(record);
    courseForm.setFieldsValue({
      title: record.title,
      slug: record.slug,
      category: record.category || 'Trí tuệ Nhân tạo & Thị giác Máy tính',
      department_name: record.department_name,
      instructor_name: record.instructor_name,
      level: record.level || 'intermediate',
      duration_minutes: record.duration_minutes || 900,
      description: record.description || '',
      thumbnail_url: record.thumbnail_url || '',
      is_published: Boolean(record.is_published),
    });
    setCourseModalOpen(true);
  };

  const handleSaveCourse = async () => {
    try {
      const values = await courseForm.validateFields();
      if (editingCourse) {
        await coursesApi.updateCourse(editingCourse.id, values);
        message.success(`Đã cập nhật khóa học "${values.title}"`);
      } else {
        await coursesApi.createCourse(values);
        message.success(`Đã tạo khóa học mới "${values.title}"`);
      }
      setCourseModalOpen(false);
      fetchData();
    } catch (e) {}
  };

  const handleDeleteCourse = (record) => {
    confirm({
      title: `Xóa khóa học "${record.title}"?`,
      content:
        'Toàn bộ chương (modules), bài học (lessons) và phân đoạn video RAG (video_segments) thuộc khóa học này sẽ bị xóa.',
      okText: 'Xóa khóa học',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        await coursesApi.deleteCourse(record.id);
        if (Number(curriculumCourseId) === Number(record.id)) {
          setCurriculumCourseId(null);
        }
        message.success(`Đã xóa khóa học "${record.title}"`);
        fetchData();
      },
    });
  };

  const handleTogglePublish = async (record, checked) => {
    await coursesApi.toggleCoursePublish(record.id, checked);
    message.success(
      checked
        ? `Đã phê duyệt xuất bản khóa học "${record.title}"`
        : `Đã gỡ xuất bản khóa học "${record.title}"`
    );
    fetchData();
  };

  // --- MODULE HANDLERS ---
  const openCreateModuleModal = () => {
    if (!activeCurriculumCourse) return;
    setEditingModule(null);
    moduleForm.resetFields();
    moduleForm.setFieldsValue({
      order_index: (activeCurriculumCourse.modules?.length || 0) + 1,
    });
    setModuleModalOpen(true);
  };

  const openEditModuleModal = (mod) => {
    setEditingModule(mod);
    moduleForm.setFieldsValue({
      title: mod.title,
      description: mod.description || '',
      order_index: mod.order_index || 1,
    });
    setModuleModalOpen(true);
  };

  const handleSaveModule = async () => {
    if (!activeCurriculumCourse) return;
    try {
      const values = await moduleForm.validateFields();
      if (editingModule) {
        await coursesApi.updateModule(
          activeCurriculumCourse.id,
          editingModule.id,
          values
        );
        message.success(`Đã cập nhật chương "${values.title}"`);
      } else {
        await coursesApi.createModule(activeCurriculumCourse.id, values);
        message.success(`Đã thêm chương mới "${values.title}"`);
      }
      setModuleModalOpen(false);
      fetchData();
    } catch (e) {}
  };

  const handleDeleteModule = (mod) => {
    if (!activeCurriculumCourse) return;
    confirm({
      title: `Xóa chương "${mod.title}"?`,
      content: 'Tất cả các bài học và phân đoạn video trong chương này cũng sẽ bị xóa.',
      okText: 'Xóa chương',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        await coursesApi.deleteModule(activeCurriculumCourse.id, mod.id);
        message.success('Đã xóa chương học');
        fetchData();
      },
    });
  };

  // --- LESSON HANDLERS ---
  const openCreateLessonModal = (mod) => {
    setTargetModuleForLesson(mod);
    setEditingLesson(null);
    lessonForm.resetFields();
    lessonForm.setFieldsValue({
      lesson_type: 'video',
      order_index: (mod.lessons?.length || 0) + 1,
      video_duration: 900,
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      allow_skip: false,
      text_content:
        '### Tóm tắt Lý thuyết & Công thức Trọng tâm\nNội dung bài học hỗ trợ Markdown và công thức toán học LaTeX.',
      cached_transcript:
        'Phụ đề bài giảng phục vụ lập chỉ mục Vector RAG 1536 chiều cho AI Tutor...',
    });
    setLessonModalOpen(true);
  };

  const openEditLessonModal = (mod, lesson) => {
    setTargetModuleForLesson(mod);
    setEditingLesson(lesson);
    lessonForm.setFieldsValue({
      title: lesson.title,
      lesson_type: lesson.lesson_type || 'video',
      order_index: lesson.order_index || 1,
      video_duration: lesson.video_duration || 600,
      video_url: lesson.video_url || '',
      text_content: lesson.text_content || '',
      cached_transcript: lesson.cached_transcript || '',
      allow_skip: Boolean(lesson.allow_skip),
    });
    setLessonModalOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!activeCurriculumCourse || !targetModuleForLesson) return;
    try {
      const values = await lessonForm.validateFields();
      if (editingLesson) {
        await coursesApi.updateLesson(
          activeCurriculumCourse.id,
          targetModuleForLesson.id,
          editingLesson.id,
          values
        );
        message.success(`Đã cập nhật bài học "${values.title}"`);
      } else {
        await coursesApi.createLesson(
          activeCurriculumCourse.id,
          targetModuleForLesson.id,
          values
        );
        message.success(`Đã thêm bài học "${values.title}"`);
      }
      setLessonModalOpen(false);
      fetchData();
    } catch (e) {}
  };

  const handleDeleteLesson = (mod, lesson) => {
    if (!activeCurriculumCourse) return;
    confirm({
      title: `Xóa bài học "${lesson.title}"?`,
      okText: 'Xóa bài học',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        await coursesApi.deleteLesson(
          activeCurriculumCourse.id,
          mod.id,
          lesson.id
        );
        message.success('Đã xóa bài học');
        fetchData();
      },
    });
  };

  // --- VIDEO SEGMENT HANDLERS ---
  const openCreateSegmentModal = (mod, lesson) => {
    setTargetModuleForSegment(mod);
    setTargetLessonForSegment(lesson);
    setEditingSegment(null);
    const existingCount = lesson.segments?.length || 0;
    const prevEnd =
      existingCount > 0
        ? Number(lesson.segments[existingCount - 1].end_timestamp || 360)
        : 0;
    segmentForm.resetFields();
    segmentForm.setFieldsValue({
      segment_order: existingCount + 1,
      start_timestamp: prevEnd,
      end_timestamp: prevEnd + 360,
      title: `Phân đoạn ${existingCount + 1}: Khái niệm cốt lõi & Ví dụ minh họa`,
      summary: 'Tóm tắt ngữ nghĩa phân đoạn 6 phút phục vụ 3-Tier RAG.',
      transcript:
        'Nội dung phụ đề chi tiết của phân đoạn video từ phút thứ ' +
        Math.floor(prevEnd / 60) +
        ' đến phút thứ ' +
        Math.floor((prevEnd + 360) / 60) +
        '...',
      quiz_question: 'Câu hỏi kiểm tra nhanh (In-Video Quiz) khi kết thúc phân đoạn này là gì?',
      option_a: 'A. Đáp án đúng chuẩn xác theo công thức bài giảng',
      option_b: 'B. Phương án nhiễu thứ nhất',
      option_c: 'C. Phương án nhiễu thứ hai',
      option_d: 'D. Phương án nhiễu thứ ba',
      correct_answer: 'A',
      explanation: 'Giải thích chi tiết vì sao đáp án A là chính xác để củng cố kiến thức cho sinh viên.',
    });
    setSegmentModalOpen(true);
  };

  const openEditSegmentModal = (mod, lesson, seg) => {
    setTargetModuleForSegment(mod);
    setTargetLessonForSegment(lesson);
    setEditingSegment(seg);
    const opts = Array.isArray(seg.quiz_options) ? seg.quiz_options : [];
    segmentForm.setFieldsValue({
      segment_order: seg.segment_order || 1,
      start_timestamp: seg.start_timestamp ?? 0,
      end_timestamp: seg.end_timestamp ?? 360,
      title: seg.title,
      summary: seg.summary || '',
      transcript: seg.transcript || '',
      quiz_question: seg.quiz_question || '',
      option_a: opts[0] || 'A. ',
      option_b: opts[1] || 'B. ',
      option_c: opts[2] || 'C. ',
      option_d: opts[3] || 'D. ',
      correct_answer: seg.correct_answer || 'A',
      explanation: seg.explanation || '',
    });
    setSegmentModalOpen(true);
  };

  const handleSaveSegment = async () => {
    if (!activeCurriculumCourse || !targetModuleForSegment || !targetLessonForSegment) {
      return;
    }
    try {
      const values = await segmentForm.validateFields();
      if (editingSegment) {
        await coursesApi.updateSegment(
          activeCurriculumCourse.id,
          targetModuleForSegment.id,
          targetLessonForSegment.id,
          editingSegment.id,
          values
        );
        message.success(`Đã cập nhật phân đoạn "${values.title}"`);
      } else {
        await coursesApi.createSegment(
          activeCurriculumCourse.id,
          targetModuleForSegment.id,
          targetLessonForSegment.id,
          values
        );
        message.success(`Đã thêm phân đoạn 5-7 phút & In-Video Quiz "${values.title}"`);
      }
      setSegmentModalOpen(false);
      fetchData();
    } catch (e) {}
  };

  const handleDeleteSegment = (mod, lesson, seg) => {
    if (!activeCurriculumCourse) return;
    confirm({
      title: `Xóa phân đoạn "${seg.title}"?`,
      okText: 'Xóa phân đoạn',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        await coursesApi.deleteSegment(
          activeCurriculumCourse.id,
          mod.id,
          lesson.id,
          seg.id
        );
        message.success('Đã xóa phân đoạn video');
        fetchData();
      },
    });
  };

  // --- REVIEW HANDLERS ---
  const handleApproveReview = async (record) => {
    try {
      await coursesApi.moderateReview(record.id, 'approved');
    } catch (error) {
      showApiError(error, 'Không duyệt được đánh giá');
      return;
    }
    message.success('Đã duyệt hiển thị đánh giá');
    fetchData();
  };

  const handleDeleteReview = (record) => {
    confirm({
      title: 'Xóa đánh giá vi phạm quy chuẩn cộng đồng?',
      okText: 'Xóa đánh giá',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await coursesApi.deleteReview(record.id);
        } catch (error) {
          showApiError(error, 'lms-api từ chối xóa đánh giá');
          return;
        }
        message.success('Đã xóa đánh giá');
        fetchData();
      },
    });
  };

  const courseColumns = [
    {
      title: 'Khóa học Trực tuyến (`courses`)',
      key: 'title',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {r.thumbnail_url && (
            <img
              src={r.thumbnail_url}
              alt={r.title}
              style={{
                width: 68,
                height: 46,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600, color: '#0A3150', fontSize: 14 }}>
              {r.title}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Slug: <code>/{r.slug}</code> · Khoa: {r.department_name}
            </Text>
            {r.category && (
              <div style={{ marginTop: 2 }}>
                <Tag color="cyan" style={{ fontSize: 11 }}>
                  {r.category}
                </Tag>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Giảng viên Biên soạn',
      dataIndex: 'instructor_name',
      key: 'instructor_name',
      width: 175,
      render: (name) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: 'Cấu trúc Giáo trình & RAG',
      key: 'structure',
      width: 215,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {r.modules_count} chương · {r.lessons_count} bài ·{' '}
            <strong style={{ color: '#0A3150' }}>{r.video_segments_count}</strong> segments
          </div>
          <Tag color="geekblue" icon={<DatabaseOutlined />} style={{ marginTop: 4 }}>
            pgvector 1536-d Ready
          </Tag>
        </div>
      ),
    },
    {
      title: 'Trình độ & Thời lượng',
      key: 'level',
      width: 155,
      render: (_, r) => {
        const meta = LEVEL_META[r.level] || {
          color: 'blue',
          label: (r.level || 'INTERMEDIATE').toUpperCase(),
        };
        return (
          <div>
            <Tag color={meta.color}>{meta.label}</Tag>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              <ClockCircleOutlined /> {r.duration_minutes || 900} phút
            </div>
          </div>
        );
      },
    },
    {
      title: 'Học viên & Đánh giá',
      key: 'stats',
      width: 140,
      render: (_, r) => (
        <div>
          <div>
            <strong>{r.enrolled_students}</strong> học viên
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ★ {r.avg_rating} / 5.0
          </Text>
        </div>
      ),
    },
    {
      title: 'Xuất bản',
      dataIndex: 'is_published',
      key: 'is_published',
      width: 150,
      render: (pub, record) => (
        <Space direction="vertical" size={2}>
          <Switch
            size="small"
            checked={Boolean(pub)}
            onChange={(checked) => handleTogglePublish(record, checked)}
          />
          {pub ? (
            <Tag color="success">Đã xuất bản</Tag>
          ) : (
            <Tag color="warning">Chờ duyệt</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Quản trị Khóa học & Giáo trình',
      key: 'actions',
      width: 270,
      render: (_, record) => (
        <Space size={6} wrap>
          <Button
            type="primary"
            size="small"
            icon={<ApartmentOutlined />}
            onClick={() => setCurriculumCourseId(record.id)}
          >
            Quản lý Chương & Bài học
          </Button>
          <Tooltip title="Chỉnh sửa thông tin khóa học">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditCourseModal(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa khóa học">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteCourse(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const reviewColumns = [
    {
      title: 'Khóa học',
      dataIndex: 'course_title',
      key: 'course_title',
      width: 220,
      render: (t) => <strong style={{ color: '#0A3150' }}>{t}</strong>,
    },
    {
      title: 'Sinh viên Đánh giá',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 190,
    },
    {
      title: 'Số sao',
      dataIndex: 'rating',
      key: 'rating',
      width: 150,
      render: (r) => <Rate disabled value={Number(r || 5)} style={{ fontSize: 14 }} />,
    },
    {
      title: 'Nội dung Nhận xét & Phản hồi Giảng viên',
      key: 'comment',
      render: (_, r) => (
        <div>
          <div>{r.comment}</div>
          {r.teacher_response && (
            <div style={{ fontSize: 12, color: '#1c906c', marginTop: 4 }}>
              ↳ Phản hồi GV: {r.teacher_response}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (st) =>
        st === 'approved' ? (
          <Tag color="success">Hợp lệ</Tag>
        ) : (
          <Tag color="error">Cần kiểm duyệt</Tag>
        ),
    },
    {
      title: 'Kiểm duyệt',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          {record.status !== 'approved' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApproveReview(record)}
            >
              Duyệt
            </Button>
          )}
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteReview(record)}
          >
            Xóa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Quản trị Khóa học, Giáo trình Đa tầng & Kiểm duyệt Đánh giá (`courses`, `modules`, `lessons`, `video_segments`)"
        subtitle="Thiết kế cấu trúc Chương -> Bài học -> Phân đoạn Video 5–7 phút kèm In-Video Quiz & Vector RAG 1536 chiều"
        routes={[
          { path: '/app/home', breadcrumbName: 'Trang chủ' },
          { breadcrumbName: 'Quản trị Khóa học & Giáo trình' },
        ]}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateCourseModal}
            >
              Tạo Khóa học mới
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Làm mới
            </Button>
          </Space>
        }
      />

      <FilterBar
        searchPlaceholder="Tìm khóa học theo tiêu đề, tên giảng viên hoặc khoa..."
        onFilter={(val, name) => setFilters((prev) => ({ ...prev, [name]: val }))}
        filters={[
          {
            name: 'is_published',
            placeholder: 'Trạng thái xuất bản',
            value: filters.is_published,
            options: [
              { value: 'true', label: 'Đã xuất bản (Published)' },
              { value: 'false', label: 'Đang chờ duyệt (Pending)' },
            ],
          },
          {
            name: 'level',
            placeholder: 'Trình độ khóa học',
            value: filters.level,
            options: [
              { value: 'beginner', label: 'Cơ bản (Beginner)' },
              { value: 'intermediate', label: 'Trung cấp (Intermediate)' },
              { value: 'advanced', label: 'Chuyên sâu (Advanced)' },
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
              key: 'courses',
              label: `Danh mục Khóa học & Giáo trình (${courses.length})`,
              children: (
                <Table
                  dataSource={courses}
                  columns={courseColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 8, showSizeChanger: true }}
                />
              ),
            },
            {
              key: 'reviews',
              label: `Kiểm duyệt Đánh giá Học viên (${reviews.length})`,
              children: (
                <Table
                  dataSource={reviews}
                  columns={reviewColumns}
                  rowKey="id"
                  loading={loading}
                />
              ),
            },
          ]}
        />
      </div>

      {/* 1. CREATE / EDIT COURSE MODAL */}
      <Modal
        title={
          editingCourse
            ? `Chỉnh sửa Khóa học: ${editingCourse.title}`
            : 'Tạo Khóa học Trực tuyến mới (`courses`)'
        }
        open={courseModalOpen}
        onCancel={() => setCourseModalOpen(false)}
        onOk={handleSaveCourse}
        okText={editingCourse ? 'Lưu cập nhật' : 'Tạo khóa học'}
        cancelText="Hủy"
        width={720}
      >
        <Form form={courseForm} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="title"
                label="Tiêu đề Khóa học"
                rules={[{ required: true, message: 'Vui lòng nhập tiêu đề khóa học' }]}
              >
                <Input placeholder="VD: Học sâu và Thị giác Máy tính (Deep Learning & CV)" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="slug" label="Đường dẫn tĩnh (Slug)">
                <Input placeholder="Tự động sinh nếu để trống" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="department_name"
                label="Khoa Quản lý Chuyên môn"
                rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
              >
                <Select
                  options={
                    departments.length > 0
                      ? departments.map((d) => ({
                          value: d.name,
                          label: `[${d.code}] ${d.name}`,
                        }))
                      : [
                          {
                            value: 'Khoa Công nghệ Thông tin & Trí tuệ Nhân tạo',
                            label: '[FIT] Khoa Công nghệ Thông tin & Trí tuệ Nhân tạo',
                          },
                          {
                            value: 'Khoa Khoa học Dữ liệu & Toán Tin',
                            label: '[FDS] Khoa Khoa học Dữ liệu & Toán Tin',
                          },
                        ]
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Chuyên mục Đào tạo (Category)"
                rules={[{ required: true, message: 'Vui lòng nhập chuyên mục' }]}
              >
                <Input placeholder="VD: Trí tuệ Nhân tạo & Thị giác Máy tính" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item
                name="instructor_name"
                label="Giảng viên Phụ trách"
                rules={[{ required: true, message: 'Vui lòng nhập tên giảng viên' }]}
              >
                <Input placeholder="VD: PGS.TS. Đỗ Đức Hùng" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="level" label="Trình độ (Level)">
                <Select
                  options={[
                    { value: 'beginner', label: 'Beginner (Cơ bản)' },
                    { value: 'intermediate', label: 'Intermediate (Trung cấp)' },
                    { value: 'advanced', label: 'Advanced (Chuyên sâu)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="duration_minutes" label="Tổng thời lượng (Phút)">
                <InputNumber min={30} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="thumbnail_url" label="Ảnh bìa Khóa học (Thumbnail URL)">
            <Input placeholder="https://images.unsplash.com/..." />
          </Form.Item>

          <Form.Item name="description" label="Mô tả Đề cương Khóa học">
            <TextArea
              rows={3}
              placeholder="Mô tả mục tiêu đầu ra, công nghệ cốt lõi và tích hợp AI Tutor..."
            />
          </Form.Item>

          <Form.Item
            name="is_published"
            label="Trạng thái Xuất bản lên Danh mục Công khai"
            valuePropName="checked"
          >
            <Switch checkedChildren="Đã xuất bản" unCheckedChildren="Chờ duyệt" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 2. DEEP CURRICULUM MANAGEMENT DRAWER (Course -> Modules -> Lessons -> VideoSegments) */}
      <Drawer
        title={
          activeCurriculumCourse ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0A3150' }}>
                  Quản lý Chương & Bài học: {activeCurriculumCourse.title}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
                  Giảng viên: <strong>{activeCurriculumCourse.instructor_name}</strong> ·{' '}
                  {activeCurriculumCourse.modules?.length || 0} Chương ·{' '}
                  {activeCurriculumCourse.lessons_count || 0} Bài học ·{' '}
                  {activeCurriculumCourse.video_segments_count || 0} Phân đoạn Video (5–7 phút)
                </div>
              </div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModuleModal}
              >
                Thêm Chương mới (Module)
              </Button>
            </div>
          ) : (
            'Quản lý Giáo trình Khóa học'
          )
        }
        width={980}
        open={Boolean(activeCurriculumCourse)}
        onClose={() => setCurriculumCourseId(null)}
        destroyOnClose={false}
      >
        {activeCurriculumCourse && (
          <div>
            <Alert
              type="info"
              showIcon
              icon={<DatabaseOutlined />}
              style={{ marginBottom: 16 }}
              message="Cấu trúc Giáo trình 4 Tầng (Course → Modules → Lessons → VideoSegments 5–7 phút)"
              description="Mỗi bài giảng video được chia thành các phân đoạn 5–7 phút kèm câu hỏi trắc nghiệm In-Video Quiz và phụ đề (Transcript) để lập chỉ mục Vector 1536 chiều trong PostgreSQL pgvector phục vụ 3-Tier Multimodal RAG AI Tutor."
            />

            {(!activeCurriculumCourse.modules ||
              activeCurriculumCourse.modules.length === 0) ? (
              <Empty
                description="Khóa học này chưa có chương nào"
                style={{ margin: '40px 0' }}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateModuleModal}
                >
                  Tạo Chương đầu tiên
                </Button>
              </Empty>
            ) : (
              <Collapse
                defaultActiveKey={activeCurriculumCourse.modules.map((m) => String(m.id))}
                style={{ background: '#f8fafc' }}
              >
                {activeCurriculumCourse.modules.map((mod) => (
                  <Panel
                    key={String(mod.id)}
                    header={
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          paddingRight: 8,
                        }}
                      >
                        <div>
                          <Tag color="geekblue">Chương #{mod.order_index}</Tag>
                          <strong style={{ fontSize: 15, color: '#0A3150' }}>
                            {mod.title}
                          </strong>
                          {mod.description && (
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                              {mod.description}
                            </div>
                          )}
                        </div>
                        <Space
                          onClick={(e) => e.stopPropagation()}
                          size={6}
                        >
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<PlusOutlined />}
                            onClick={() => openCreateLessonModal(mod)}
                          >
                            Thêm Bài học
                          </Button>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEditModuleModal(mod)}
                          >
                            Sửa Chương
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteModule(mod)}
                          />
                        </Space>
                      </div>
                    }
                  >
                    {(!mod.lessons || mod.lessons.length === 0) ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Chưa có bài học trong chương này"
                      >
                        <Button
                          size="small"
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => openCreateLessonModal(mod)}
                        >
                          Thêm bài học đầu tiên
                        </Button>
                      </Empty>
                    ) : (
                      <Space direction="vertical" style={{ width: '100%' }} size={14}>
                        {mod.lessons.map((lesson) => {
                          const typeMeta =
                            LESSON_TYPE_META[lesson.lesson_type] ||
                            LESSON_TYPE_META.video;
                          return (
                            <Card
                              key={lesson.id}
                              size="small"
                              style={{
                                borderLeft: '4px solid #0A3150',
                                borderRadius: 6,
                              }}
                              title={
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                  }}
                                >
                                  <Space wrap>
                                    <Tag color={typeMeta.color} icon={typeMeta.icon}>
                                      {typeMeta.label}
                                    </Tag>
                                    <strong style={{ color: '#0A3150', fontSize: 14 }}>
                                      {lesson.title}
                                    </strong>
                                    <Tag icon={<ClockCircleOutlined />}>
                                      {formatTimestamp(lesson.video_duration)} (
                                      {Math.round((lesson.video_duration || 600) / 60)} phút)
                                    </Tag>
                                    {lesson.allow_skip ? (
                                      <Tag color="default">Cho phép tua</Tag>
                                    ) : (
                                      <Tag color="volcano">Chống tua (Strict Anti-Skip)</Tag>
                                    )}
                                  </Space>
                                  <Space size={6}>
                                    <Button
                                      size="small"
                                      type="primary"
                                      icon={<PlusOutlined />}
                                      onClick={() => openCreateSegmentModal(mod, lesson)}
                                    >
                                      + Phân đoạn 5-7p & Quiz
                                    </Button>
                                    <Button
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={() => openEditLessonModal(mod, lesson)}
                                    >
                                      Sửa Bài
                                    </Button>
                                    <Button
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={() => handleDeleteLesson(mod, lesson)}
                                    />
                                  </Space>
                                </div>
                              }
                            >
                              <Descriptions size="small" column={2} bordered>
                                <Descriptions.Item label="Nguồn Video (video_url)">
                                  {lesson.video_url ? (
                                    <Text code copyable style={{ fontSize: 12 }}>
                                      {lesson.video_url}
                                    </Text>
                                  ) : (
                                    <Text type="secondary">Không đính kèm video</Text>
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Phụ đề RAG (cached_transcript)">
                                  {lesson.cached_transcript ? (
                                    <Badge
                                      status="processing"
                                      text={
                                        <span style={{ fontSize: 12 }}>
                                          {lesson.cached_transcript.slice(0, 75)}...
                                        </span>
                                      }
                                    />
                                  ) : (
                                    <Text type="secondary">Chưa có transcript</Text>
                                  )}
                                </Descriptions.Item>
                                {lesson.text_content && (
                                  <Descriptions.Item
                                    label="Nội dung Đọc / Markdown (text_content)"
                                    span={2}
                                  >
                                    <Paragraph
                                      ellipsis={{ rows: 2, expandable: true, symbol: 'Xem thêm' }}
                                      style={{ marginBottom: 0, fontSize: 12 }}
                                    >
                                      {lesson.text_content}
                                    </Paragraph>
                                  </Descriptions.Item>
                                )}
                              </Descriptions>

                              <Divider
                                orientation="left"
                                style={{ margin: '12px 0 8px', fontSize: 12 }}
                              >
                                <VideoCameraOutlined /> Phân đoạn Video 5–7 phút & In-Video Quiz (
                                {lesson.segments?.length || 0} segments)
                              </Divider>

                              {(!lesson.segments || lesson.segments.length === 0) ? (
                                <div
                                  style={{
                                    padding: '8px 12px',
                                    background: '#f9fafb',
                                    borderRadius: 4,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    Chưa có phân đoạn 5–7 phút nào cho bài học này.
                                  </Text>
                                  <Button
                                    size="small"
                                    type="link"
                                    icon={<PlusOutlined />}
                                    onClick={() => openCreateSegmentModal(mod, lesson)}
                                  >
                                    Thêm phân đoạn ngay
                                  </Button>
                                </div>
                              ) : (
                                <Space
                                  direction="vertical"
                                  style={{ width: '100%' }}
                                  size={8}
                                >
                                  {lesson.segments.map((seg) => (
                                    <div
                                      key={seg.id}
                                      style={{
                                        padding: '10px 12px',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 6,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'flex-start',
                                        }}
                                      >
                                        <div>
                                          <Tag color="blue">
                                            Segment #{seg.segment_order} [
                                            {formatTimestamp(seg.start_timestamp)} -{' '}
                                            {formatTimestamp(seg.end_timestamp)}]
                                          </Tag>
                                          <strong style={{ color: '#0A3150' }}>
                                            {seg.title}
                                          </strong>
                                          {seg.summary && (
                                            <div
                                              style={{
                                                fontSize: 12,
                                                color: '#475569',
                                                marginTop: 4,
                                              }}
                                            >
                                              <strong>Tóm tắt RAG:</strong> {seg.summary}
                                            </div>
                                          )}
                                          {seg.transcript && (
                                            <div
                                              style={{
                                                fontSize: 12,
                                                color: '#64748b',
                                                marginTop: 2,
                                              }}
                                            >
                                              <strong>Transcript:</strong> {seg.transcript}
                                            </div>
                                          )}
                                        </div>
                                        <Space size={4}>
                                          <Button
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={() =>
                                              openEditSegmentModal(mod, lesson, seg)
                                            }
                                          >
                                            Sửa
                                          </Button>
                                          <Button
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() =>
                                              handleDeleteSegment(mod, lesson, seg)
                                            }
                                          />
                                        </Space>
                                      </div>

                                      {seg.quiz_question && (
                                        <div
                                          style={{
                                            marginTop: 8,
                                            padding: '8px 10px',
                                            background: '#ffffff',
                                            borderLeft: '3px solid #10b981',
                                            borderRadius: 4,
                                            fontSize: 12,
                                          }}
                                        >
                                          <div style={{ fontWeight: 600, color: '#065f46' }}>
                                            <QuestionCircleOutlined /> In-Video Quiz tại mốc [
                                            {formatTimestamp(seg.end_timestamp)}]:{' '}
                                            {seg.quiz_question}
                                          </div>
                                          <Row gutter={[8, 4]} style={{ marginTop: 4 }}>
                                            {(seg.quiz_options || []).map((opt, idx) => {
                                              const letter = ['A', 'B', 'C', 'D'][idx] || 'A';
                                              const isCorrect =
                                                String(seg.correct_answer || 'A')
                                                  .toUpperCase()
                                                  .startsWith(letter);
                                              return (
                                                <Col span={12} key={idx}>
                                                  <Tag
                                                    color={isCorrect ? 'success' : 'default'}
                                                    style={{
                                                      width: '100%',
                                                      whiteSpace: 'normal',
                                                      marginBottom: 2,
                                                    }}
                                                  >
                                                    {opt} {isCorrect ? '✓ (Đáp án đúng)' : ''}
                                                  </Tag>
                                                </Col>
                                              );
                                            })}
                                          </Row>
                                          {seg.explanation && (
                                            <div
                                              style={{
                                                color: '#047857',
                                                marginTop: 4,
                                                fontStyle: 'italic',
                                              }}
                                            >
                                              💡 Giải thích: {seg.explanation}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </Space>
                              )}
                            </Card>
                          );
                        })}
                      </Space>
                    )}
                  </Panel>
                ))}
              </Collapse>
            )}
          </div>
        )}
      </Drawer>

      {/* 3. MODULE MODAL */}
      <Modal
        title={
          editingModule
            ? `Chỉnh sửa Chương: ${editingModule.title}`
            : 'Thêm Chương mới (`modules`)'
        }
        open={moduleModalOpen}
        onCancel={() => setModuleModalOpen(false)}
        onOk={handleSaveModule}
        okText="Lưu Chương"
        cancelText="Hủy"
      >
        <Form form={moduleForm} layout="vertical">
          <Form.Item
            name="title"
            label="Tên Chương (Module Title)"
            rules={[{ required: true, message: 'Vui lòng nhập tên chương' }]}
          >
            <Input placeholder="VD: Chương 3: Kiến trúc Vision Transformer & Multimodal RAG" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả tóm tắt nội dung chương">
            <TextArea rows={2} placeholder="Mục tiêu kiến thức của chương..." />
          </Form.Item>
          <Form.Item name="order_index" label="Thứ tự hiển thị (order_index)">
            <InputNumber min={1} max={50} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 4. LESSON MODAL */}
      <Modal
        title={
          editingLesson
            ? `Chỉnh sửa Bài học: ${editingLesson.title}`
            : `Thêm Bài học mới vào "${targetModuleForLesson?.title || ''}"`
        }
        open={lessonModalOpen}
        onCancel={() => setLessonModalOpen(false)}
        onOk={handleSaveLesson}
        okText="Lưu Bài học"
        cancelText="Hủy"
        width={680}
      >
        <Form form={lessonForm} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="title"
                label="Tiêu đề Bài học"
                rules={[{ required: true, message: 'Vui lòng nhập tiêu đề bài học' }]}
              >
                <Input placeholder="VD: Bài 3.1: Huấn luyện BiLSTM dự đoán chuỗi bối rối" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lesson_type" label="Loại Bài học (`lesson_type`)">
                <Select
                  options={[
                    { value: 'video', label: 'Video bài giảng (video)' },
                    { value: 'reading', label: 'Tài liệu đọc Markdown (reading)' },
                    { value: 'coding', label: 'Thực hành Lập trình (coding)' },
                    { value: 'quiz', label: 'Trắc nghiệm Đánh giá (quiz)' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="order_index" label="Thứ tự bài học">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="video_duration" label="Thời lượng (Giây)">
                <InputNumber min={60} max={14400} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="allow_skip"
                label="Cho phép tua nhanh (`allow_skip`)"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="Cho phép tua"
                  unCheckedChildren="Chống tua (Strict)"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="video_url" label="Đường dẫn Video MP4 / HLS (`video_url`)">
            <Input placeholder="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" />
          </Form.Item>

          <Form.Item
            name="text_content"
            label="Nội dung Bài đọc / Hướng dẫn Thực hành Markdown (`text_content`)"
          >
            <TextArea rows={3} placeholder="Hỗ trợ Markdown và công thức LaTeX..." />
          </Form.Item>

          <Form.Item
            name="cached_transcript"
            label="Phụ đề Toàn bài phục vụ RAG (`cached_transcript`)"
          >
            <TextArea
              rows={2}
              placeholder="Nội dung lời giảng dùng để băm vector embedding 1536 chiều..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 5. VIDEO SEGMENT & IN-VIDEO QUIZ MODAL */}
      <Modal
        title={
          editingSegment
            ? `Chỉnh sửa Phân đoạn Video & Quiz: ${editingSegment.title}`
            : `Thêm Phân đoạn 5–7 phút & In-Video Quiz (${targetLessonForSegment?.title || ''})`
        }
        open={segmentModalOpen}
        onCancel={() => setSegmentModalOpen(false)}
        onOk={handleSaveSegment}
        okText="Lưu Phân đoạn & Quiz"
        cancelText="Hủy"
        width={740}
      >
        <Form form={segmentForm} layout="vertical">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="segment_order" label="Thứ tự Segment">
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item
                name="start_timestamp"
                label="Mốc Bắt đầu (Giây)"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} max={14400} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item
                name="end_timestamp"
                label="Mốc Kết thúc (Giây — Chuẩn 5-7p)"
                rules={[{ required: true }]}
              >
                <InputNumber min={30} max={14400} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="Tiêu đề Phân đoạn (`video_segments.title`)"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề phân đoạn' }]}
          >
            <Input placeholder="VD: Phân đoạn 2: Quy tắc Đạo hàm chuỗi & Ma trận Jacobian" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="summary" label="Tóm tắt Ngữ nghĩa (Tier-2 RAG Summary)">
                <TextArea rows={2} placeholder="Tóm tắt ngắn gọn ý chính của phân đoạn..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="transcript"
                label="Lời giảng Phân đoạn (Tier-1/Tier-3 pgvector Transcript)"
              >
                <TextArea rows={2} placeholder="Lời thoại chi tiết trong 5-7 phút này..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
            Câu hỏi Trắc nghiệm Nhúng Cuối Phân đoạn (In-Video Quiz)
          </Divider>

          <Form.Item
            name="quiz_question"
            label="Câu hỏi Kiểm tra Độ hiểu bài tại điểm kết thúc phân đoạn"
          >
            <Input placeholder="Nhập câu hỏi trắc nghiệm 4 lựa chọn..." />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="option_a" label="Lựa chọn A">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="option_b" label="Lựa chọn B">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="option_c" label="Lựa chọn C">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="option_d" label="Lựa chọn D">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="correct_answer" label="Đáp án Đúng">
                <Select
                  options={[
                    { value: 'A', label: 'Đáp án A' },
                    { value: 'B', label: 'Đáp án B' },
                    { value: 'C', label: 'Đáp án C' },
                    { value: 'D', label: 'Đáp án D' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item name="explanation" label="Giải thích Đáp án cho Sinh viên">
                <Input placeholder="Giải thích ngắn gọn lý do đáp án đúng..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
