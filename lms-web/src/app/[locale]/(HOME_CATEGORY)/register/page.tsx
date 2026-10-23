'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '../_components/Container';
import { LocaleLink, withLocale } from '../_components/LocaleLink';
import {
  Badge,
  Button,
  Card,
  FieldLabel,
  Input,
  Select,
} from '../_components/ui';
import { useAccountStore } from '@/store/useAccountStore';

export default function RegisterPage() {
  const router = useRouter();
  const { updateAcademicProfile } = useAccountStore();
  const [fullName, setFullName] = useState('Nguyễn Minh Hiếu');
  const [studentCode, setStudentCode] = useState('2021604123');
  const [major, setMajor] = useState('Khoa học Máy tính & Trí tuệ Nhân tạo');
  const [studentClass, setStudentClass] = useState('KHMT-01-K66');
  const [academicYear, setAcademicYear] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAcademicProfile({
      fullName,
      studentCode,
      major,
      studentClass,
      academicYear,
    });
    router.push(withLocale('/student/face-setup', 'vi'));
  };

  return (
    <Container className="py-8">
      <div className="mx-auto max-w-lg">
        <Card padding="lg" className="space-y-5">
          <div className="space-y-1">
            <Badge tone="brand">Bước 1 / 2 · Hồ sơ Học thuật</Badge>
            <h1 className="pt-1 text-2xl font-semibold text-primary">
              Đăng ký Tài khoản & Cá nhân hóa AI Tutor
            </h1>
            <p className="text-sm text-secondary">
              Chuyên ngành và năm học của bạn sẽ được truyền tự động vào System Prompt của Trợ lý AI để đưa ra ví dụ
              sát thực tế nhất.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="reg-name" required>
                  Họ và tên sinh viên
                </FieldLabel>
                <Input
                  id="reg-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <FieldLabel htmlFor="reg-code" required>
                  Mã số sinh viên (MSSV)
                </FieldLabel>
                <Input
                  id="reg-code"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="reg-major" required>
                Chuyên ngành Đào tạo (Dùng cho AI Prompt Injection)
              </FieldLabel>
              <Select
                id="reg-major"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
              >
                <option value="Khoa học Máy tính & Trí tuệ Nhân tạo">
                  Khoa học Máy tính & Trí tuệ Nhân tạo
                </option>
                <option value="Kỹ thuật Phần mềm & Hệ thống Thông tin">
                  Kỹ thuật Phần mềm & Hệ thống Thông tin
                </option>
                <option value="Khoa học Dữ liệu & Phân tích Kinh doanh">
                  Khoa học Dữ liệu & Phân tích Kinh doanh
                </option>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="reg-class" required>
                  Lớp hành chính
                </FieldLabel>
                <Input
                  id="reg-class"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  required
                />
              </div>
              <div>
                <FieldLabel htmlFor="reg-year" required>
                  Năm học hiện tại
                </FieldLabel>
                <Select
                  id="reg-year"
                  value={String(academicYear)}
                  onChange={(e) => setAcademicYear(Number(e.target.value))}
                >
                  <option value="1">Năm 1 (Nhập môn)</option>
                  <option value="2">Năm 2 (Cơ sở ngành)</option>
                  <option value="3">Năm 3 (Chuyên ngành)</option>
                  <option value="4">Năm 4 (Khóa luận)</option>
                </Select>
              </div>
            </div>

            <Button type="submit" variant="signup" size="md" block>
              Tiếp tục: Đăng ký Khuôn mặt 3 Góc (MobileFaceNet) →
            </Button>
          </form>

          <p className="text-center text-xs text-secondary">
            Đã có tài khoản?{' '}
            <LocaleLink href="/login" className="font-semibold text-brand hover:underline">
              Đăng nhập ngay
            </LocaleLink>
          </p>
        </Card>
      </div>
    </Container>
  );
}
