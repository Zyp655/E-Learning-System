import React from 'react';
import { Input, Col, Row, Select } from 'antd';

const { Search } = Input;

function FilterBar({
  textSearch = true,
  searchPlaceholder = 'Tìm kiếm theo tên, mã, email...',
  onFilter = () => {},
  filters = [],
  colTextSearch = 8,
  children,
}) {
  return (
    <div className="admin-page-card" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <Row gutter={[12, 12]} align="middle">
        {textSearch && (
          <Col lg={colTextSearch} md={10} sm={12} xs={24}>
            <Search
              allowClear
              placeholder={searchPlaceholder}
              onChange={(e) => onFilter(e.target.value, 'keyword', 'search')}
              onSearch={(val) => onFilter(val, 'keyword', 'search')}
              style={{ width: '100%' }}
            />
          </Col>
        )}

        {filters.map((item, idx) => (
          <Col lg={item.col || 5} md={7} sm={12} xs={24} key={item.name || idx}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={item.placeholder || 'Tất cả'}
              style={{ width: '100%' }}
              value={item.value}
              onChange={(val) => onFilter(val, item.name, 'select')}
              options={(item.options || []).map((opt) => ({
                value: opt.value ?? opt.id,
                label: opt.label ?? opt.title,
              }))}
            />
          </Col>
        ))}

        {children && <Col flex="auto">{children}</Col>}
      </Row>
    </div>
  );
}

export default FilterBar;
