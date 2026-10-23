'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog, DialogBody, DialogTitle } from '@/components/catalyst/dialog';
import { LocaleLink } from '../_components/LocaleLink';
import { Icon } from '../_components/primitives';
import { Badge } from '../_components/ui';
import { useAccountStore } from '@/store/useAccountStore';
import { AppHeader } from './AppHeader';
import { chromeFor, isTeacherPath, stripLocale } from './chrome';
import { STUDENT_NAV_ITEMS, TEACHER_NAV_ITEMS } from './nav';
import { NavMenu } from './NavMenu';
import { NavSlide } from './NavSlide';

export function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const pathname = usePathname() || '/';
  const { mode, setMode, profile } = useAccountStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const urlIsTeacher = isTeacherPath(pathname);
  useEffect(() => {
    if (urlIsTeacher && mode !== 'teacher') {
      setMode('teacher');
    } else if (!urlIsTeacher && stripLocale(pathname).startsWith('/student/') && mode !== 'student') {
      setMode('student');
    }
  }, [urlIsTeacher, pathname, mode, setMode]);

  const teacherMode = mode === 'teacher' || urlIsTeacher;
  const navItems = teacherMode ? TEACHER_NAV_ITEMS : STUDENT_NAV_ITEMS;
  const chrome = chromeFor(pathname);

  const [prevTeacherMode, setPrevTeacherMode] = useState(teacherMode);
  const [slideDir, setSlideDir] = useState<'forward' | 'back' | null>(null);
  if (prevTeacherMode !== teacherMode) {
    setPrevTeacherMode(teacherMode);
    setSlideDir(teacherMode ? 'forward' : 'back');
  }

  return (
    <div className="min-h-dvh bg-muted text-primary">
      {chrome === 'app' ? (
        <AppHeader locale={locale} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      ) : null}

      {/* Fixed Desktop Sidebar (w-65 = 260px, shadow-side) */}
      <aside
        aria-label="Thanh điều hướng bên trái"
        className="fixed top-16 bottom-0 left-0 z-40 hidden w-65 flex-col overflow-y-auto overscroll-contain bg-white px-3 pt-3 pb-5 shadow-side lg:flex"
      >
        {/* Role Context Banner inside Sidebar */}
        <div className="mb-3 rounded-xl bg-muted p-3">
          <div className="flex items-center justify-between gap-2">
            <Badge tone={teacherMode ? 'seller' : 'brand'} icon={teacherMode ? 'verified' : 'academic_cap'}>
              {teacherMode ? 'Teacher Studio' : 'Khu Học sinh'}
            </Badge>
            <span className="text-xs font-medium text-secondary">HK1 · 2026</span>
          </div>
          <p className="mt-1.5 truncate text-xs font-medium text-primary">
            {teacherMode ? 'PGS.TS. Trần Quang Minh' : `${profile.fullName} (${profile.studentCode})`}
          </p>
          <p className="truncate text-xs text-secondary">
            {teacherMode ? 'Khoa Khoa học Máy tính' : profile.major}
          </p>
        </div>

        <div className="flex-1 overflow-x-clip">
          <NavSlide key={teacherMode ? 'teacher' : 'student'} direction={slideDir}>
            <NavMenu
              items={navItems}
              pathname={pathname}
              locale={locale}
              teacherMode={teacherMode}
            />
          </NavSlide>
        </div>

        {/* Privacy & Edge CV Status Footer */}
        <div className="mt-4 border-t border-line-subtle pt-3">
          <div className="rounded-xl bg-muted p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Icon name="shield_warning" size={16} className="text-seller" />
              <span>Bảo mật CV: 0 ảnh rời máy</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-secondary">
              MediaPipe 478 Landmarks & MobileFaceNet chạy 100% trên trình duyệt.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Canvas (bg-muted) */}
      <div
        data-app-shell=""
        className="pb-20 lg:pr-8 lg:pb-10 lg:pl-65"
      >
        <main
          id="top"
          data-shell-frame=""
          className="min-w-0 px-3 pt-5 md:px-6 lg:min-h-[calc(100dvh-4rem)] lg:pt-6"
        >
          {children}
        </main>
      </div>

      {/* Mobile Navigation Sheet */}
      <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} size="md">
        <DialogTitle>
          {teacherMode ? 'Menu Giảng viên (Teacher Studio)' : 'Menu Học viên (ALARMM LMS)'}
        </DialogTitle>
        <DialogBody>
          <NavMenu
            items={navItems}
            pathname={pathname}
            locale={locale}
            teacherMode={teacherMode}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </DialogBody>
      </Dialog>

      {/* Mobile Bottom FlyBar */}
      <nav
        aria-label="Điều hướng nhanh trên di động"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-line bg-white/95 px-2 backdrop-blur-md lg:hidden"
      >
        <LocaleLink href="/" className="flex flex-col items-center gap-0.5 text-xs font-medium text-secondary hover:text-brand">
          <Icon name="home" size={20} />
          <span>Khám phá</span>
        </LocaleLink>
        <LocaleLink href="/learn/101" className="flex flex-col items-center gap-0.5 text-xs font-medium text-brand">
          <Icon name="videocam" size={20} />
          <span>Học AI CV</span>
        </LocaleLink>
        <LocaleLink
          href={teacherMode ? '/teacher/dashboard' : '/student/dashboard'}
          className="flex flex-col items-center gap-0.5 text-xs font-medium text-secondary hover:text-brand"
        >
          <Icon name="dashboard" size={20} />
          <span>Dashboard</span>
        </LocaleLink>
        <LocaleLink
          href={teacherMode ? '/teacher/analytics' : '/student/quizzes'}
          className="flex flex-col items-center gap-0.5 text-xs font-medium text-secondary hover:text-brand"
        >
          <Icon name={teacherMode ? 'analytics' : 'quiz'} size={20} />
          <span>{teacherMode ? 'Heatmap' : 'Đấu Quiz'}</span>
        </LocaleLink>
      </nav>
    </div>
  );
}
