import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Drawer,
  Select,
  Alert,
  Statistic,
  Row,
  Col,
  message,
  Typography,
} from 'antd';
import {
  FileExcelOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PageTitle from '../../components/PageTitle';
import ExcelImportDropzone from '../../components/ExcelImportDropzone';
import academicApi from '../../api/academic';

const { Title, Text } = Typography;

const IMPORT_TYPE_CONFIG = {
  students: {
    label: '1. Import Danh sách Sinh viên (`POST /v1/admin/import-users`)',
    endpoint: 'POST /v1/admin/import-users',
    columns: ['student_code', 'full_name', 'email', 'department_code', 'major_code', 'academic_year', 'student_class'],
  },
  teachers: {
    label: '2. Import Danh sách Giảng viên (`POST /v1/admin/import-teachers`)',
    endpoint: 'POST /v1/admin/import-teachers',
    columns: ['teacher_code', 'full_name', 'email', 'department_code', 'expertise'],
  },
  subjects: {
    label: '3. Import Danh mục Học phần (`POST /v1/admin/import-subjects`)',
    endpoint: 'POST /v1/admin/import-subjects',
    columns: ['course_code', 'course_name', 'credits', 'department_code', 'course_type'],
  },
  enrollments: {
    label: '4. Import Ghi danh Lớp Học phần (`POST /v1/admin/import-enrollments`)',
    endpoint: 'POST /v1/admin/import-enrollments',
    columns: ['class_code', 'student_code', 'email', 'semester_id', 'status'],
  },
};

export default function BulkImports() {
  const [importType, setImportType] = useState('students');
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState(3);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, sems] = await Promise.all([
        academicApi.getImportHistory(),
        academicApi.getSemesters(),
      ]);
      setHistory(hist || []);
      setSemesters(sems || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleUploadExcel = async (file, previewRows) => {
    setUploading(true);
    try {
      const res = await academicApi.bulkImportExcel({
        importType,
        semesterId: selectedSemester,
        file,
        parsedPreviewRows: previewRows,
      });
      message.success(
        `Import hoàn tất (${res.file_name}): Thành công ${res.success_count}/${res.total_rows} dòng (${res.error_count} lỗi).`
      );
      await fetchHistory();
      if (res.error_count > 0) {
        setDrawerRecord(res);
      }
    } catch (e) {
      message.error('Import file Excel thất bại');
    } finally {
      setUploading(false);
    }
  };

  const historyColumns = [
    {
      title: 'Phân loại Import',
      dataIndex: 'import_type',
      key: 'import_type',
      width: 150,
      render: (t) => {
        const colorMap = {
          students: 'blue',
          teachers: 'green',
          subjects: 'purple',
          enrollments: 'geekblue',
        };
        return <Tag color={colorMap[t] || 'default'}>{t?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Tên File Excel (`file_name`)',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (name, r) => (
        <div>
          <Space>
            <FileExcelOutlined style={{ color: '#1c906c' }} />
            <strong style={{ color: '#0A3150' }}>{name}</strong>
          </Space>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.semester_name}</div>
        </div>
      ),
    },
    {
      title: 'Tổng số dòng (`total_rows`)',
      dataIndex: 'total_rows',
      key: 'total_rows',
      width: 140,
      render: (n) => <strong>{n} dòng</strong>,
    },
    {
      title: 'Thành công (`success_count`)',
      dataIndex: 'success_count',
      key: 'success_count',
      width: 150,
      render: (n) => (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          {n} hợp lệ
        </Tag>
      ),
    },
    {
      title: 'Bản ghi lỗi (`error_count`)',
      dataIndex: 'error_count',
      key: 'error_count',
      width: 150,
      render: (errCount, record) =>
        errCount > 0 ? (
          <Button
            size="small"
            danger
            icon={<WarningOutlined />}
            onClick={() => setDrawerRecord(record)}
          >
            {errCount} dòng lỗi (Xem)
          </Button>
        ) : (
          <Tag color="default">0 lỗi</Tag>
        ),
    },
    {
      title: 'Người thực hiện & Thời gian',
      key: 'meta',
      width: 210,
      render: (_, r) => (
        <div>
          <div>{r.admin_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.imported_at}
          </Text>
        </div>
      ),
    },
  ];

  const currentCfg = IMPORT_TYPE_CONFIG[importType];

  return (
    <div>
      <PageTitle
        title="Trung tâm Import Dữ liệu Excel Hàng loạt (`enrollment_imports`)"
        subtitle="Tự động đồng bộ danh sách Sinh viên, Giảng viên, Học phần và Ghi danh Lớp học phần bằng thư viện excelize trên Go Backend"
        routes={[
          { path: '/app/home', breadcrumbName: 'Trang chủ' },
          { breadcrumbName: 'Import Excel Hàng loạt' },
        ]}
        extra={
          <Space>
            <span>Học kỳ áp dụng:</span>
            <Select
              value={selectedSemester}
              onChange={setSelectedSemester}
              style={{ width: 280 }}
              options={semesters.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchHistory}>
              Làm mới
            </Button>
          </Space>
        }
      />

      <div className="admin-page-card">
        <Tabs
          activeKey={importType}
          onChange={setImportType}
          items={Object.entries(IMPORT_TYPE_CONFIG).map(([key, cfg]) => ({
            key,
            label: cfg.label.split('(')[0].trim(),
            children: (
              <ExcelImportDropzone
                importType={key}
                title={`Kéo thả file Excel cho "${cfg.label}"`}
                templateColumns={cfg.columns}
                loading={uploading}
                onUploadFile={handleUploadExcel}
              />
            ),
          }))}
        />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Endpoint đích: <code>{currentCfg.endpoint}</code> (Header:{' '}
            <code>Scope: admin-dashboard</code>)
          </Text>
        </div>
      </div>

      <div className="admin-page-card">
        <Title level={5} style={{ marginTop: 0, color: '#0A3150' }}>
          Lịch sử Import Excel &amp; Báo cáo Kiểm tra Ràng buộc (`enrollment_imports`)
        </Title>
        <Table
          dataSource={history}
          columns={historyColumns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </div>

      <Drawer
        title={`Chi tiết Lỗi Từng Dòng — ${drawerRecord?.file_name || ''}`}
        placement="right"
        width={680}
        onClose={() => setDrawerRecord(null)}
        open={Boolean(drawerRecord)}
      >
        {drawerRecord && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Statistic title="Tổng số dòng" value={drawerRecord.total_rows} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Import thành công"
                  value={drawerRecord.success_count}
                  valueStyle={{ color: '#0caf60' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Số dòng lỗi"
                  value={drawerRecord.error_count}
                  valueStyle={{ color: '#da1f27' }}
                />
              </Col>
            </Row>

            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Các dòng lỗi đã được hệ thống bỏ qua an toàn mà không làm gián đoạn các dòng hợp lệ."
            />

            <Table
              size="small"
              rowKey="row"
              dataSource={drawerRecord.error_details || []}
              pagination={false}
              columns={[
                {
                  title: 'Dòng Excel',
                  dataIndex: 'row',
                  key: 'row',
                  width: 95,
                  render: (r) => <Tag color="red">Dòng #{r}</Tag>,
                },
                {
                  title: 'Mã SV / Mã lớp',
                  dataIndex: 'code',
                  key: 'code',
                  width: 130,
                },
                {
                  title: 'Email',
                  dataIndex: 'email',
                  key: 'email',
                  width: 180,
                },
                {
                  title: 'Nguyên nhân lỗi (`error_details`)',
                  dataIndex: 'reason',
                  key: 'reason',
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
