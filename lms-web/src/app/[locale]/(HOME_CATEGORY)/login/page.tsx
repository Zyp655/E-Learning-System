'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '../_components/Container';
import { LocaleLink, withLocale } from '../_components/LocaleLink';
import { Icon } from '../_components/primitives';
import {
  Badge,
  Button,
  Card,
  FieldLabel,
  Input,
  segmented,
} from '../_components/ui';
import { useAccountStore } from '@/store/useAccountStore';

export default function LoginPage() {
  const router = useRouter();
  const { setMode } = useAccountStore();
  const [roleTab, setRoleTab] = useState<'student' | 'teacher'>('student');
  const [email, setEmail] = useState('hieu.nm2021604123@sis.hust.edu.vn');
  const [password, setPassword] = useState('••••••••••••');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setMode(roleTab);
    router.push(withLocale(roleTab === 'teacher' ? '/teacher/dashboard' : '/student/dashboard', 'vi'));
  };

  return (
    <Container className="py-8">
      <div className="mx-auto max-w-md">
        <Card padding="lg" className="space-y-5">
          <div className="space-y-1 text-center">
            <Badge tone={roleTab === 'teacher' ? 'seller' : 'brand'}>
              {roleTab === 'teacher' ? 'Teacher Studio · Giảng viên' : 'Cổng Học viên · ALARMM LMS'}
            </Badge>
            <h1 className="pt-2 text-2xl font-semibold text-primary">Đăng nhập Hệ thống</h1>
            <p className="text-sm text-secondary">
              Truy cập Trình phát Học tập nhận diện Bối rối & Trợ lý AI Đa phương thức
            </p>
          </div>

          <div className="flex justify-center">
            <div className={segmented.list} role="tablist" aria-label="Chọn vai trò đăng nhập">
              <button
                type="button"
                role="tab"
                aria-selected={roleTab === 'student'}
                onClick={() => {
                  setRoleTab('student');
                  setEmail('hieu.nm2021604123@sis.hust.edu.vn');
                }}
                className={segmented.tab}
              >
                Học viên (Student)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={roleTab === 'teacher'}
                onClick={() => {
                  setRoleTab('teacher');
                  setEmail('minh.tq@cs.university.edu.vn');
                }}
                className={segmented.tab}
              >
                Giảng viên (Teacher)
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <FieldLabel htmlFor="login-email" required>
                Email Học thuật
              </FieldLabel>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <FieldLabel htmlFor="login-password" required>
                Mật khẩu
              </FieldLabel>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant={roleTab === 'teacher' ? 'seller' : 'primary'}
              size="md"
              block
            >
              <Icon name="checkCircle" size="sm" />
              {roleTab === 'teacher' ? 'Đăng nhập Teacher Studio' : 'Đăng nhập Khu Học viên'}
            </Button>
          </form>

          <div className="rounded-xl bg-muted p-3.5 text-xs text-secondary space-y-1">
            <p className="font-semibold text-primary">Tài khoản Demo đã cấu hình sẵn:</p>
            <p>• Học viên: Nguyễn Minh Hiếu (MSSV 2021604123 · KHMT & AI)</p>
            <p>• Giảng viên: PGS.TS. Trần Quang Minh (Khoa KHMT)</p>
          </div>

          <p className="text-center text-xs text-secondary">
            Chưa có tài khoản?{' '}
            <LocaleLink href="/register" className="font-semibold text-brand hover:underline">
              Đăng ký Hồ sơ Học thuật & Khuôn mặt
            </LocaleLink>
          </p>
        </Card>
      </div>
    </Container>
  );
}
