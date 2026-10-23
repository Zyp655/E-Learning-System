import React, { useEffect, useState } from 'react';
import {
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Progress,
  Space,
  Button,
  Typography,
  Badge,
  Divider,
} from 'antd';
import {
  TeamOutlined,
  UserSwitchOutlined,
  ReadOutlined,
  BankOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useHistory } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import statsApi from '../../api/stats';

const { Title, Text } = Typography;

function ConfusionTrendChart({ data = [] }) {
  const maxVal = Math.max(...data.map((d) => d.episodes), 220);
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: 210,
          padding: '16px 12px 8px',
          background: '#f8fafc',
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          gap: 12,
        }}
      >
        {data.map((item) => {
          const totalHeight = Math.round((item.episodes / maxVal) * 150);
          const resolvedHeight = Math.round((item.resolved / maxVal) * 150);
          return (
            <div
              key={item.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#0A3150' }}>
                {item.episodes}
              </Text>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 4,
                  height: 155,
                }}
              >
                <div
                  title={`Phát hiện bối rối: ${item.episodes}`}
                  style={{
                    width: 18,
                    height: totalHeight,
                    background: '#0A3150',
                    borderRadius: '2px 2px 0 0',
                  }}
                />
                <div
                  title={`AI Tutor giải quyết thành công: ${item.resolved}`}
                  style={{
                    width: 18,
                    height: resolvedHeight,
                    background: '#0caf60',
                    borderRadius: '2px 2px 0 0',
                  }}
                />
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.date}
              </Text>
            </div>
          );
        })}
      </div>
      <Space size={20} style={{ marginTop: 10 }}>
        <Badge color="#0A3150" text="Tổng lượt phát hiện bối rối (ML + Hybrid + Self-Report)" />
        <Badge color="#0caf60" text="AI Tutor can thiệp & sinh viên xác nhận Đã hiểu" />
      </Space>
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await statsApi.getOverview();
      setStats(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const kpiCards = [
    {
      title: 'Tổng số Sinh viên',
      value: stats?.totalStudents || 2840,
      suffix: 'SV',
      icon: <TeamOutlined style={{ fontSize: 22, color: '#0A3150' }} />,
      sub: '97.8% đã đăng ký sinh trắc 3 góc mặt',
    },
    {
      title: 'Đội ngũ Giảng viên',
      value: stats?.totalTeachers || 86,
      suffix: 'GV',
      icon: <UserSwitchOutlined style={{ fontSize: 22, color: '#1c906c' }} />,
      sub: '2 hồ sơ ứng tuyển đang chờ duyệt',
    },
    {
      title: 'Khóa học & Lớp học phần',
      value: `${stats?.totalCourses || 64} / ${stats?.activeCourseClasses || 118}`,
      suffix: 'Lớp',
      icon: <ReadOutlined style={{ fontSize: 22, color: '#0866ff' }} />,
      sub: `${stats?.pgvectorIndexedSegments || 1420} phân đoạn video pgvector (1536-d)`,
    },
    {
      title: 'Đợt Bối rối Hôm nay (CV + ML)',
      value: stats?.dailyConfusionEpisodes || 194,
      suffix: 'lượt',
      icon: <AlertOutlined style={{ fontSize: 22, color: '#da1f27' }} />,
      sub: 'Sliding Window 3 · Cooldown 300s',
    },
    {
      title: 'Tỷ lệ AI Tutor Giải quyết',
      value: stats?.aiTutorResolutionRate || 89.4,
      suffix: '%',
      icon: <CheckCircleOutlined style={{ fontSize: 22, color: '#0caf60' }} />,
      sub: '3-Tier RAG + GPT-4o-mini Vision',
    },
    {
      title: 'Xác thực Khuôn mặt FaceGuard',
      value: stats?.faceGuardVerifiedRate || 97.8,
      suffix: '%',
      icon: <SafetyCertificateOutlined style={{ fontSize: 22, color: '#0A3150' }} />,
      sub: 'MobileFaceNet 192-d (Cosine >= 0.55)',
    },
  ];

  const episodeColumns = [
    {
      title: 'Sinh viên',
      key: 'student',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.student_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.student_code}
          </Text>
        </div>
      ),
    },
    {
      title: 'Bài giảng & Khóa học',
      key: 'lesson',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.lesson_title}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.course_title} · Mốc video: {Math.floor(r.video_timestamp_sec / 60)}:
            {String(r.video_timestamp_sec % 60).padStart(2, '0')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Nguồn Kích hoạt',
      dataIndex: 'trigger_source',
      key: 'trigger_source',
      render: (src) => {
        if (src === 'ml_model') return <Tag color="volcano">MLP 12-Features</Tag>;
        if (src === 'hybrid_rule') return <Tag color="orange">Hybrid Rule (&ge;35)</Tag>;
        return <Tag color="geekblue">Self-Report</Tag>;
      },
    },
    {
      title: 'Xác suất ML / Điểm Luật',
      key: 'scores',
      render: (_, r) => (
        <span>
          <strong>{Math.round((r.ml_probability || 0) * 100)}%</strong> ({r.rule_score} đ)
        </span>
      ),
    },
    {
      title: 'Cảm xúc Chủ đạo',
      dataIndex: 'dominant_emotion',
      key: 'dominant_emotion',
      render: (emo) => (
        <Tag color={emo === 'confused' ? 'red' : 'gold'}>
          {emo === 'confused' ? 'Confused (Nhíu mày/Eye-Lock)' : 'Frustrated'}
        </Tag>
      ),
    },
    {
      title: 'Kết quả Can thiệp AI',
      key: 'resolved',
      render: (_, r) =>
        r.resolved ? (
          <Tag color="success">Đã hiểu rõ (Helpful)</Tag>
        ) : (
          <Tag color="processing">Đang hỗ trợ</Tag>
        ),
    },
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      key: 'created_at',
    },
  ];

  return (
    <div>
      <PageTitle
        title="Dashboard Tổng quan Hệ thống (System Overview)"
        subtitle="Giám sát thời gian thực Mô hình Phát hiện Sự Bối rối qua Computer Vision, Trợ lý Ảo 3-Tier RAG & Học vụ Đại học"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchOverview} loading={loading}>
              Làm mới số liệu
            </Button>
            <Button
              type="primary"
              icon={<DatabaseOutlined />}
              onClick={() => history.push('/app/ai-settings')}
            >
              Cấu hình AI &amp; pgvector
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {kpiCards.map((card, index) => (
          <Col xl={8} lg={8} md={12} sm={24} xs={24} key={index}>
            <div className="metric-kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Statistic
                  title={<span style={{ fontWeight: 500, color: '#4b5563' }}>{card.title}</span>}
                  value={card.value}
                  suffix={card.suffix}
                  valueStyle={{ color: '#0A3150', fontWeight: 700, fontSize: 26 }}
                />
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 2,
                    background: '#f0f4f8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </div>
              </div>
              <Divider style={{ margin: '12px 0 8px' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {card.sub}
              </Text>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col lg={14} xs={24}>
          <div className="admin-page-card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <Title level={5} style={{ margin: 0, color: '#0A3150' }}>
                  Xu hướng Phát hiện Bối rối &amp; Can thiệp AI Tutor (7 Ngày qua)
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tổng hợp từ MediaPipe 478 Landmarks + BiLSTM ONNX + 12 Đặc trưng Đa phương thức
                </Text>
              </div>
              <Tag color="blue">AUC = 0.9999 (MLP 12-Features)</Tag>
            </div>
            <ConfusionTrendChart data={stats?.confusionTrend7Days || []} />
          </div>
        </Col>

        <Col lg={10} xs={24}>
          <div className="admin-page-card" style={{ height: '100%' }}>
            <Title level={5} style={{ margin: '0 0 4px', color: '#0A3150' }}>
              Phân bổ Sinh viên &amp; Tỷ lệ Bối rối theo Khoa
            </Title>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
              Thống kê ghi danh học phần và tần suất cần AI giải thích lại
            </Text>

            <Space direction="vertical" style={{ width: '100%' }} size={14}>
              {(stats?.departmentEnrollments || []).map((dept) => {
                const pct = Math.round((dept.students / (stats?.totalStudents || 2840)) * 100);
                return (
                  <div key={dept.code}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong>
                        [{dept.code}] {dept.department}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dept.students} SV ({pct}%) · Bối rối TB: {dept.avgConfusionRate}%
                      </Text>
                    </div>
                    <Progress
                      percent={pct}
                      strokeColor="#0A3150"
                      size="small"
                    />
                  </div>
                );
              })}
            </Space>

            <Divider style={{ margin: '16px 0 12px' }} />
            <Button
              type="link"
              icon={<BankOutlined />}
              style={{ padding: 0 }}
              onClick={() => history.push('/app/departments')}
            >
              Quản lý Cấu trúc Khoa · Chuyên ngành · Học kỳ <ArrowRightOutlined />
            </Button>
          </div>
        </Col>
      </Row>

      <div className="admin-page-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <Title level={5} style={{ margin: 0, color: '#0A3150' }}>
              Nhật ký Can thiệp Chủ động Thời gian thực (`confusion_episodes`)
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Các phiên học sinh vừa được Trợ lý Ảo tự động dừng video và giải thích nội dung qua 3-Tier RAG
            </Text>
          </div>
          <Button size="small" onClick={() => history.push('/app/ai-settings')}>
            Tinh chỉnh Ngưỡng Kích hoạt
          </Button>
        </div>

        <Table
          dataSource={stats?.recentConfusionEpisodes || []}
          columns={episodeColumns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </div>
    </div>
  );
}
