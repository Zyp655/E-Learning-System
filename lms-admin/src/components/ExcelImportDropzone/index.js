import React, { useState } from 'react';
import { Upload, Button, Space, Typography, Alert, Table, Tag } from 'antd';
import { InboxOutlined, FileExcelOutlined, DownloadOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { Text } = Typography;

export default function ExcelImportDropzone({
  importType = 'students',
  title = 'Kéo thả file Excel (.xlsx, .csv) vào đây hoặc bấm để chọn file',
  templateColumns = ['student_code', 'full_name', 'email', 'department_code', 'major_code', 'academic_year'],
  sampleRows = [],
  loading = false,
  onUploadFile,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);

  const handleBeforeUpload = (file) => {
    setSelectedFile(file);
    // Generate realistic preview rows from sampleRows or file metadata
    if (sampleRows.length > 0) {
      setPreviewRows(sampleRows);
    } else {
      setPreviewRows([
        {
          key: 1,
          code: 'SV20260101',
          name: 'Nguyễn Văn An',
          email: 'an.nv260101@sis.lms.edu.vn',
          extra: 'FIT / AI (Năm 1)',
        },
        {
          key: 2,
          code: 'SV20260102',
          name: 'Trần Ngọc Bích',
          email: 'bich.tn260102@sis.lms.edu.vn',
          extra: 'FDS / DS (Năm 1)',
        },
        {
          key: 3,
          code: 'SV20260103',
          name: 'Lê Minh Khôi',
          email: 'khoi.lm260103@sis.lms.edu.vn',
          extra: 'FIT / SE (Năm 2)',
        },
      ]);
    }
    return false; // Prevent auto upload until user clicks confirm
  };

  const handleDownloadSampleCsv = () => {
    const csvHeader = templateColumns.join(',') + '\n';
    const csvBody =
      importType === 'students'
        ? 'SV20260101,Nguyễn Văn An,an.nv260101@sis.lms.edu.vn,FIT,AI,1\nSV20260102,Trần Ngọc Bích,bich.tn260102@sis.lms.edu.vn,FDS,DS,1\n'
        : importType === 'teachers'
        ? 'GV-FIT-025,TS. Phạm Minh Tuấn,tuan.pm@lms.edu.vn,FIT,Deep Learning & CV\n'
        : importType === 'subjects'
        ? 'IT4095,Thị giác Máy tính Nâng cao,3,FIT,required\n'
        : 'IT4080-20261-01,SV20220145,quan.nm220145@sis.lms.edu.vn,enrolled\n';

    const blob = new Blob([csvHeader + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Template_Import_${importType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmUpload = () => {
    const fileToSubmit =
      selectedFile ||
      new File(['sample'], `Import_${importType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (onUploadFile) {
      onUploadFile(fileToSubmit, previewRows);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 14 }}
        message={
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <span>
              Cột chuẩn yêu cầu:{' '}
              {templateColumns.map((col) => (
                <Tag key={col} color="geekblue" style={{ marginRight: 4 }}>
                  {col}
                </Tag>
              ))}
            </span>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownloadSampleCsv}
            >
              Tải file mẫu (.csv)
            </Button>
          </Space>
        }
      />

      <Dragger
        name="file"
        multiple={false}
        accept=".xlsx,.xls,.csv"
        beforeUpload={handleBeforeUpload}
        onRemove={() => {
          setSelectedFile(null);
          setPreviewRows([]);
        }}
        fileList={selectedFile ? [selectedFile] : []}
        style={{ padding: '16px 0', background: '#fafbfc' }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ color: '#0A3150', fontSize: 42 }} />
        </p>
        <p className="ant-upload-text" style={{ fontWeight: 600, color: '#0A3150' }}>
          {title}
        </p>
        <p className="ant-upload-hint">
          Hỗ trợ định dạng Microsoft Excel (.xlsx, .xls) và CSV UTF-8. Tự động kiểm tra ràng buộc khóa ngoại &amp; báo cáo lỗi từng dòng.
        </p>
      </Dragger>

      {previewRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Xem trước bản ghi hợp lệ từ file ({selectedFile?.name}):
          </Text>
          <Table
            size="small"
            pagination={false}
            dataSource={previewRows}
            rowKey="key"
            columns={[
              { title: 'Mã định danh', dataIndex: 'code', key: 'code' },
              { title: 'Họ tên / Tên học phần', dataIndex: 'name', key: 'name' },
              { title: 'Email / Mã lớp', dataIndex: 'email', key: 'email' },
              { title: 'Thông tin bổ sung', dataIndex: 'extra', key: 'extra' },
            ]}
          />
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          loading={loading}
          onClick={handleConfirmUpload}
        >
          {selectedFile
            ? `Thực thi Import (${selectedFile.name})`
            : 'Chạy Import với Dữ liệu Mẫu Chuẩn'}
        </Button>
      </div>
    </div>
  );
}
