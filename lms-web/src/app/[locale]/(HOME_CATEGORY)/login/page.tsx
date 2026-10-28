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
  FieldError,
  FieldLabel,
  Input,
  segmented,
} from '../_components/ui';
import { useAccountStore } from '@/store/useAccountStore';
import { accountModeForRole, authApi } from '@/api/auth';
import { describeApiError } from '@/api/client';

const IS_DEV = process.env.NODE_ENV !== 'production';

export default function LoginPage() {
  const router = useRouter();
  const { setMode } = useAccountStore();
  const [roleTab, setRoleTab] = useState<'student' | 'teacher'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setLoginError(null);
    try {
      const bundle = await authApi.login(email, password);
      // The workspace follows the account role returned by lms-api, not the selected tab.
      const mode = accountModeForRole(bundle.user.role);
      setMode(mode);
      router.push(withLocale(mode === 'teacher' ? '/teacher/dashboard' : '/student/dashboard', 'vi'));
    } catch (err) {
      setLoginError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
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
                onClick={() => setRoleTab('student')}
                className={segmented.tab}
              >
                Học viên (Student)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={roleTab === 'teacher'}
                onClick={() => setRoleTab('teacher')}
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
                autoComplete="username"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <FieldError id="login-error">{loginError}</FieldError>

            <Button
              type="submit"
              variant={roleTab === 'teacher' ? 'seller' : 'primary'}
              size="md"
              block
              disabled={submitting}
            >
              <Icon name="checkCircle" size="sm" />
              {submitting
                ? 'Đang đăng nhập...'
                : roleTab === 'teacher'
                  ? 'Đăng nhập Teacher Studio'
                  : 'Đăng nhập Khu Học viên'}
            </Button>
          </form>

          {IS_DEV && (
            <div className="rounded-xl bg-muted p-3.5 text-xs text-secondary space-y-1">
              <p className="font-semibold text-primary">Tài khoản seed (chỉ môi trường phát triển):</p>
              <p>• Học viên: student@lms.edu.vn / 123456</p>
              <p>• Giảng viên: teacher@lms.edu.vn / 123456</p>
            </div>
          )}

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
