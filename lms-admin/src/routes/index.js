import Home from './home';
import Users from './users';
import TeacherApplications from './teacher-applications';
import Departments from './departments';
import AcademicCourses from './academic-courses';
import BulkImports from './bulk-imports';
import Courses from './courses';
import Proctoring from './proctoring';
import AiSettings from './ai-settings';

export const routes = [
  {
    path: 'home',
    component: Home,
    permission: null,
  },
  {
    path: 'users',
    component: Users,
    permission: null,
  },
  {
    path: 'proctoring',
    component: Proctoring,
    permission: null,
  },
  {
    path: 'teacher-applications',
    component: TeacherApplications,
    permission: null,
  },
  {
    path: 'departments',
    component: Departments,
    permission: null,
  },
  {
    path: 'academic-courses',
    component: AcademicCourses,
    permission: null,
  },
  {
    path: 'bulk-imports',
    component: BulkImports,
    permission: null,
  },
  {
    path: 'courses',
    component: Courses,
    permission: null,
  },
  {
    path: 'ai-settings',
    component: AiSettings,
    permission: null,
  },
];

export default routes;
