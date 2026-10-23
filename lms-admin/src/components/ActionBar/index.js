import React from 'react';
import { Button, Modal, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';

const { confirm } = Modal;

function ActionBar({
  isShowAddButton = true,
  addButtonText = 'Thêm mới',
  isShowDeleteButton = false,
  isShowRefreshButton = true,
  onAdd,
  onDelete,
  onRefresh,
  isDisabled = false,
  children,
}) {
  const openDeleteConfirm = () => {
    confirm({
      title: 'Xác nhận xóa dữ liệu đã chọn?',
      content: 'Hành động này không thể hoàn tác.',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => onDelete && onDelete(),
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <Space wrap size={[8, 12]}>
        {isShowAddButton && onAdd && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ backgroundColor: '#da1f27', borderColor: '#da1f27' }}
            onClick={onAdd}
          >
            {addButtonText}
          </Button>
        )}

        {isShowDeleteButton && onDelete && (
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={openDeleteConfirm}
            disabled={isDisabled}
          >
            Xóa đã chọn
          </Button>
        )}

        {isShowRefreshButton && onRefresh && (
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            Làm mới
          </Button>
        )}

        {children}
      </Space>
    </div>
  );
}

export default ActionBar;
