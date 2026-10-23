'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LocaleLink, withLocale } from '../_components/LocaleLink';
import { Avatar, Icon } from '../_components/primitives';
import { Badge, Button, SearchInput, segmented } from '../_components/ui';
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from '@/components/catalyst/dialog';
import { useAccountStore } from '@/store/useAccountStore';
import { stripLocale } from './chrome';

export function AppHeader({
  locale,
  onOpenMobileMenu,
}: {
  locale: string;
  onOpenMobileMenu: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { mode, setMode, profile, notifications, markAllNotificationsRead } = useAccountStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(withLocale(q ? `/search?q=${encodeURIComponent(q)}` : '/search', locale));
  };

  const handleModeSwitch = (targetMode: 'student' | 'teacher') => {
    setMode(targetMode);
    if (targetMode === 'teacher') {
      router.push(withLocale('/teacher/dashboard', locale));
    } else {
      router.push(withLocale('/student/dashboard', locale));
    }
  };

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'vi' : 'en';
    const clean = stripLocale(pathname);
    router.push(withLocale(clean, nextLocale));
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-line-subtle bg-white/95 backdrop-blur-md">
        <div className="flex h-full items-center gap-2 px-3 md:px-5 lg:gap-4 lg:pr-8 lg:pl-65">
          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Mở menu điều hướng"
            className="grid size-10 shrink-0 place-items-center rounded-full text-primary hover:bg-muted lg:hidden"
          >
            <Icon name="menu" size={22} />
          </button>

          {/* Brand Logo */}
          <LocaleLink href="/" className="flex shrink-0 items-center gap-2.5">
            <span
              className={`grid size-9 place-items-center rounded-xl text-white ${
                mode === 'teacher' ? 'bg-seller-600' : 'bg-brand'
              }`}
            >
              <Icon name="academic_cap" fill size={20} />
            </span>
            <div className="hidden sm:block">
              <p className="text-base leading-none font-semibold tracking-tight text-primary">
                ALARMM <span className={mode === 'teacher' ? 'text-seller' : 'text-brand'}>LMS</span>
              </p>
              <p className="mt-0.5 text-xs text-secondary">
                {mode === 'teacher' ? 'Teacher Studio · AI Analytics' : 'CV Confusion & Smart AI Tutor'}
              </p>
            </div>
          </LocaleLink>

          {/* Global Hybrid Search */}
          <form onSubmit={handleSearchSubmit} className="hidden max-w-md min-w-0 flex-1 md:block">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                locale === 'en'
                  ? 'Semantic pgvector search: courses, 5-7m video segments, formulas...'
                  : 'Tìm kiếm ngữ nghĩa pgvector: khóa học, phân đoạn video 5-7p, công thức...'
              }
            />
          </form>

          {/* Right Header Actions Host */}
          <div className="ml-auto flex items-center gap-2">
            {/* Mode Switcher (Student / Teacher Studio) using segmented tab bar */}
            <div className={segmented.list} role="tablist" aria-label="Chế độ vai trò">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'student'}
                onClick={() => handleModeSwitch('student')}
                className={segmented.tab}
              >
                <Icon name="academic_cap" size={16} className={mode === 'student' ? 'text-brand' : 'text-secondary'} />
                <span>{locale === 'en' ? 'Student' : 'Học viên'}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'teacher'}
                onClick={() => handleModeSwitch('teacher')}
                className={segmented.tab}
              >
                <Icon name="verified" size={16} className={mode === 'teacher' ? 'text-seller' : 'text-secondary'} />
                <span>{locale === 'en' ? 'Teacher Studio' : 'Giảng viên'}</span>
              </button>
            </div>

            {/* Locale Switcher */}
            <Button variant="outline" size="sm" onClick={toggleLocale} className="hidden sm:inline-flex">
              <Icon name="language" size={16} />
              <span>{locale.toUpperCase()}</span>
            </Button>

            {/* Direct Messages shortcut */}
            <LocaleLink
              href="/messages"
              aria-label="Tin nhắn trực tiếp"
              className=" relative grid size-10 shrink-0 place-items-center rounded-full text-primary transition hover:bg-muted"
            >
              <Icon name="chat" size={20} className="text-chat" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-chat" />
            </LocaleLink>

            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="Thông báo thông minh"
              className="relative grid size-10 shrink-0 place-items-center rounded-full text-primary transition hover:bg-muted"
            >
              <Icon name="notifications" size={20} />
              {unreadCount > 0 ? (
                <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-brand text-xs leading-none font-medium text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>

            {/* Account Profile Trigger */}
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pr-3 pl-1 transition hover:border-line-strong"
            >
              <Avatar name={profile.fullName} className="size-8 rounded-full" />
              <div className="hidden text-left xl:block">
                <p className="text-xs leading-tight font-medium text-primary">{profile.fullName}</p>
                <p className="text-xs leading-tight text-secondary">
                  {mode === 'teacher' ? 'PGS.TS · Giảng viên' : `MSSV ${profile.studentCode}`}
                </p>
              </div>
            </button>
          </div>
        </div>
      </header>
      <div aria-hidden="true" className="h-16 shrink-0" />

      {/* Smart Notifications Dialog */}
      <Dialog open={notifOpen} onClose={setNotifOpen} size="lg">
        <div className="flex items-center justify-between gap-3">
          <DialogTitle>Trung tâm Thông báo & Cron Nhắc học AI</DialogTitle>
          <Button variant="ghost" size="sm" onClick={markAllNotificationsRead}>
            Đánh dấu đã đọc
          </Button>
        </div>
        <DialogDescription>
          Hệ thống tự động nhắc học theo 4 mốc giờ (07:00, 12:00, 16:00, 20:00) trước khi AttendanceEngine chốt điểm danh lúc 23:59.
        </DialogDescription>
        <DialogBody className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="rounded-xl bg-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge
                  tone={
                    n.type === 'urgent_20'
                      ? 'danger'
                      : n.type === 'grade_published'
                        ? 'seller'
                        : n.type === 'teacher_nudge'
                          ? 'chat'
                          : 'info'
                  }
                >
                  {n.type === 'urgent_20'
                    ? 'Khẩn cấp 20:00'
                    : n.type === 'grade_published'
                      ? 'AI Rubric'
                      : 'Cron Thông minh'}
                </Badge>
                <span className="text-xs text-secondary">{n.time}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-primary">{n.title}</p>
              <p className="mt-1 text-sm text-secondary">{n.message}</p>
              {n.href ? (
                <div className="mt-3">
                  <LocaleLink
                    href={n.href}
                    onClick={() => setNotifOpen(false)}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Mở ngay →
                  </LocaleLink>
                </div>
              ) : null}
            </div>
          ))}
        </DialogBody>
        <DialogActions>
          <Button variant="outline" onClick={() => setNotifOpen(false)}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account & Academic Profile Dialog */}
      <Dialog open={profileOpen} onClose={setProfileOpen} size="md">
        <DialogTitle>Hồ sơ Học thuật & Định danh Khuôn mặt</DialogTitle>
        <DialogDescription>
          Thông tin này được tự động tiêm (inject) vào System Prompt của Trợ lý Ảo AI để cá nhân hóa bài giải thích.
        </DialogDescription>
        <DialogBody className="space-y-3">
          <div className="rounded-xl bg-muted p-4">
            <div className="flex items-center gap-3">
              <Avatar name={profile.fullName} className="size-12 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-primary">{profile.fullName}</p>
                <p className="text-sm text-secondary">{profile.email}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-secondary">Mã số sinh viên</p>
                <p className="font-medium text-primary">{profile.studentCode}</p>
              </div>
              <div>
                <p className="text-xs text-secondary">Lớp hành chính</p>
                <p className="font-medium text-primary">{profile.studentClass} · Năm {profile.academicYear}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-secondary">Chuyên ngành đào tạo</p>
                <p className="font-medium text-primary">{profile.major}</p>
              </div>
              <div className="col-span-2 flex items-center justify-between pt-1">
                <span className="text-xs text-secondary">Sinh trắc học MobileFaceNet (192-d):</span>
                <Badge tone={profile.faceRegistered ? 'success' : 'warning'} icon="verified_user">
                  {profile.faceRegistered ? 'Đã đăng ký đủ 3 góc mặt' : 'Chưa đăng ký'}
                </Badge>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button variant="outline" onClick={() => setProfileOpen(false)}>
            Đóng
          </Button>
          <LocaleLink
            href="/student/face-setup"
            onClick={() => setProfileOpen(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-button bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Cấu hình Khuôn mặt 3 Góc
          </LocaleLink>
        </DialogActions>
      </Dialog>
    </>
  );
}
