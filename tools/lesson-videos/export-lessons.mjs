// Dumps the video lessons of the programming courses (titles, slide code, key points) as JSON for generate.py.
// Run with: node --experimental-strip-types tools/lesson-videos/export-lessons.mjs
import { PROGRAMMING_COURSES } from '../../lms-web/src/api/mockProgrammingCourses.ts';

const LANGUAGE_BY_COURSE = { 5: 'python', 6: 'javascript' };

const lessons = PROGRAMMING_COURSES.flatMap((course) =>
  course.modules.flatMap((m) =>
    m.lessons
      .filter((l) => l.type === 'video')
      .map((l) => ({
        id: l.id,
        courseTitle: course.title,
        instructor: course.instructor.name,
        language: LANGUAGE_BY_COURSE[course.id] ?? 'python',
        title: l.title,
        segments: l.segments.map((s) => ({
          segmentIndex: s.segmentIndex,
          title: s.title.replace(/^Phân đoạn \d+ \([^)]*\):\s*/, ''),
          codeSnippet: s.codeSnippet ?? '',
          keyFormulas: s.keyFormulas ?? [],
          summary: s.summary,
        })),
      })),
  ),
);

process.stdout.write(JSON.stringify(lessons, null, 2));
