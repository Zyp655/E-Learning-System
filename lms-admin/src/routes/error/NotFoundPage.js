import React from 'react';
import { Result, Button } from 'antd';
import { useHistory } from 'react-router-dom';

export default function NotFoundPage() {
  const history = useHistory();
  return (
    <Result
      status="404"
      title="404"
      subTitle="Trang quản trị bạn yêu cầu không tồn tại."
      extra={
        <Button type="primary" onClick={() => history.push('/app/home')}>
          Về Trang Tổng quan
        </Button>
      }
    />
  );
}
