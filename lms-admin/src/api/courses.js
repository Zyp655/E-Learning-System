import api from '../utils/api';
import { isHttpError } from '../utils/httpError';
import { mockStore } from '../utils/mockData';

export const normalizeSegment = (s = {}) => {
  const segmentOrder = Number(s.segment_order ?? s.segmentOrder ?? 1);
  const startTimestamp = Number(s.start_timestamp ?? s.startTimestamp ?? 0);
  const endTimestamp = Number(s.end_timestamp ?? s.endTimestamp ?? startTimestamp + 360);
  const quizQuestion = s.quiz_question || s.quizQuestion || '';
  const quizOptions = Array.isArray(s.quiz_options)
    ? s.quiz_options
    : Array.isArray(s.quizOptions)
    ? s.quizOptions
    : [
        'A. Đáp án A',
        'B. Đáp án B',
        'C. Đáp án C',
        'D. Đáp án D',
      ];
  const correctAnswer = s.correct_answer || s.correctAnswer || 'A';

  return {
    ...s,
    id: s.id,
    lesson_id: s.lesson_id ?? s.lessonId,
    lessonId: s.lesson_id ?? s.lessonId,
    segment_order: segmentOrder,
    segmentOrder,
    start_timestamp: startTimestamp,
    startTimestamp,
    end_timestamp: endTimestamp,
    endTimestamp,
    title: s.title || `Phân đoạn ${segmentOrder}`,
    summary: s.summary || '',
    transcript: s.transcript || '',
    quiz_question: quizQuestion,
    quizQuestion,
    quiz_options: quizOptions,
    quizOptions,
    correct_answer: correctAnswer,
    correctAnswer,
    explanation: s.explanation || '',
  };
};

export const normalizeLesson = (l = {}) => {
  const lessonType = l.lesson_type || l.lessonType || 'video';
  const videoDuration = Number(l.video_duration ?? l.videoDuration ?? 600);
  const videoUrl = l.video_url ?? l.videoUrl ?? '';
  const textContent = l.text_content ?? l.textContent ?? '';
  const cachedTranscript = l.cached_transcript ?? l.cachedTranscript ?? '';
  const allowSkip = Boolean(l.allow_skip ?? l.allowSkip ?? false);
  const orderIndex = Number(l.order_index ?? l.orderIndex ?? 1);
  const segments = Array.isArray(l.segments)
    ? l.segments.map(normalizeSegment)
    : Array.isArray(l.videoSegments)
    ? l.videoSegments.map(normalizeSegment)
    : [];

  return {
    ...l,
    id: l.id,
    module_id: l.module_id ?? l.moduleId,
    moduleId: l.module_id ?? l.moduleId,
    title: l.title || 'Bài học mới',
    lesson_type: lessonType,
    lessonType,
    video_duration: videoDuration,
    videoDuration,
    video_url: videoUrl,
    videoUrl,
    text_content: textContent,
    textContent,
    cached_transcript: cachedTranscript,
    cachedTranscript,
    allow_skip: allowSkip,
    allowSkip,
    order_index: orderIndex,
    orderIndex,
    segments,
    videoSegments: segments,
  };
};

export const normalizeModule = (m = {}) => {
  const orderIndex = Number(m.order_index ?? m.orderIndex ?? 1);
  const lessons = Array.isArray(m.lessons) ? m.lessons.map(normalizeLesson) : [];
  return {
    ...m,
    id: m.id,
    course_id: m.course_id ?? m.courseId,
    courseId: m.course_id ?? m.courseId,
    title: m.title || 'Chương mới',
    description: m.description || '',
    order_index: orderIndex,
    orderIndex,
    lessons,
  };
};

export const normalizeCourse = (c = {}) => {
  const seeded = mockStore.courses.find(
    (mc) => mc.id === c.id || (c.slug && mc.slug === c.slug)
  );
  const rawModules =
    Array.isArray(c.modules) && c.modules.length > 0
      ? c.modules
      : Array.isArray(seeded?.modules)
      ? seeded.modules
      : [];
  const modules = rawModules.map(normalizeModule);

  const computedModulesCount = modules.length;
  const computedLessonsCount = modules.reduce(
    (acc, mod) => acc + (mod.lessons?.length || 0),
    0
  );
  const computedSegmentsCount = modules.reduce(
    (acc, mod) =>
      acc +
      (mod.lessons || []).reduce((lAcc, les) => lAcc + (les.segments?.length || 0), 0),
    0
  );

  const modulesCount = Number(
    computedModulesCount || c.modules_count || c.modulesCount || 0
  );
  const lessonsCount = Number(
    computedLessonsCount || c.lessons_count || c.lessonsCount || c.totalLessons || 0
  );
  const videoSegmentsCount = Number(
    computedSegmentsCount || c.video_segments_count || c.videoSegmentsCount || 0
  );

  const instructorName =
    c.instructor_name ||
    c.instructorName ||
    c.teacherName ||
    seeded?.instructor_name ||
    'PGS.TS. Đỗ Đức Hùng';
  const departmentName =
    c.department_name ||
    c.departmentName ||
    seeded?.department_name ||
    'Khoa Công nghệ Thông tin & Trí tuệ Nhân tạo';
  const durationMinutes = Number(
    c.duration_minutes ?? c.durationMinutes ?? c.totalDuration ?? seeded?.duration_minutes ?? 900
  );
  const enrolledStudents = Number(
    c.enrolled_students ?? c.enrolledStudents ?? c.totalStudents ?? seeded?.enrolled_students ?? 0
  );
  const avgRating = Number(
    c.avg_rating ?? c.avgRating ?? c.ratingAvg ?? seeded?.avg_rating ?? 4.9
  );
  const isPublished = Boolean(
    c.is_published ?? c.isPublished ?? seeded?.is_published ?? true
  );
  const thumbnailUrl =
    c.thumbnail_url ||
    c.thumbnailUrl ||
    seeded?.thumbnail_url ||
    'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&auto=format&fit=crop&q=80';
  const category = c.category || seeded?.category || 'Trí tuệ Nhân tạo & Thị giác Máy tính';
  const description = c.description || seeded?.description || '';
  const createdAt = c.created_at || c.createdAt || seeded?.created_at || '2026-09-01';

  return {
    ...c,
    id: c.id,
    title: c.title || 'Khóa học Trực tuyến',
    slug:
      c.slug ||
      String(c.title || 'khoa-hoc')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    category,
    description,
    thumbnail_url: thumbnailUrl,
    thumbnailUrl,
    instructor_name: instructorName,
    instructorName,
    department_name: departmentName,
    departmentName,
    level: c.level || 'intermediate',
    duration_minutes: durationMinutes,
    durationMinutes,
    modules_count: modulesCount,
    modulesCount,
    lessons_count: lessonsCount,
    lessonsCount,
    video_segments_count: videoSegmentsCount,
    videoSegmentsCount,
    enrolled_students: enrolledStudents,
    enrolledStudents,
    totalStudents: enrolledStudents,
    avg_rating: avgRating,
    avgRating,
    ratingAvg: avgRating,
    is_published: isPublished,
    isPublished,
    has_pgvector_embedding: Boolean(c.has_pgvector_embedding ?? true),
    created_at: createdAt,
    createdAt,
    modules,
  };
};

export const normalizeReview = (r = {}) => {
  const courseTitle = r.course_title || r.courseTitle || '-';
  const userName = r.user_name || r.userName || r.studentName || r.user?.fullName || '-';
  const teacherResponse = r.teacher_response ?? r.teacherResponse ?? r.teacherReply ?? '';
  const helpfulCount = Number(r.helpful_count ?? r.helpfulCount ?? 0);
  const createdAt = r.created_at || r.createdAt || null;

  return {
    ...r,
    id: r.id,
    course_id: r.course_id ?? r.courseId,
    courseId: r.course_id ?? r.courseId,
    course_title: courseTitle,
    courseTitle,
    user_name: userName,
    userName,
    rating: Number(r.rating ?? 5),
    comment: r.comment || '',
    teacher_response: teacherResponse,
    teacherResponse,
    helpful_count: helpfulCount,
    helpfulCount,
    status: r.status || 'approved',
    created_at: createdAt,
    createdAt,
  };
};

class CoursesApi {
  getAllCourses = async (params = {}) => {
    try {
      const res = await api.get('/v1/admin/courses', { params });
      const items = res?.data?.data?.items || res?.data?.data || res?.data;
      if (Array.isArray(items) && items.length > 0) {
        return items.map(normalizeCourse);
      }
    } catch (e) {
      try {
        const pubRes = await api.get('/v1/public/courses', { params });
        const pubItems = pubRes?.data?.data?.items || pubRes?.data?.data || pubRes?.data;
        if (Array.isArray(pubItems) && pubItems.length > 0) {
          return pubItems.map(normalizeCourse);
        }
      } catch (err) {}
    }

    let list = mockStore.courses.map(normalizeCourse);
    if (params.is_published !== undefined && params.is_published !== '') {
      const pub = params.is_published === 'true' || params.is_published === true;
      list = list.filter((c) => Boolean(c.is_published) === pub);
    }
    if (params.level) {
      list = list.filter((c) => c.level === params.level);
    }
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(kw) ||
          c.instructor_name.toLowerCase().includes(kw) ||
          c.department_name.toLowerCase().includes(kw)
      );
    }
    return list;
  };

  getCourseById = async (courseId) => {
    // lms-api has no GET /v1/admin/courses/:id; GET /v1/admin/courses already returns every course with its
    // full Modules -> Lessons -> VideoSegments tree, so pick the course from that list.
    try {
      const res = await api.get('/v1/admin/courses');
      const body = res?.data?.data ?? res?.data;
      const items = Array.isArray(body) ? body : body?.items ?? body?.courses ?? [];
      const raw = (Array.isArray(items) ? items : []).find((c) => Number(c.id) === Number(courseId));
      return raw ? normalizeCourse(raw) : null;
    } catch (e) {
      if (isHttpError(e)) throw e;
    }
    const found = mockStore.courses.find((c) => Number(c.id) === Number(courseId));
    return found ? normalizeCourse(found) : null;
  };

  createCourse = async (data) => {
    const slug =
      data.slug ||
      String(data.title || 'khoa-hoc-moi')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const payload = {
      ...data,
      slug,
      instructorName: data.instructor_name || data.instructorName,
      departmentName: data.department_name || data.departmentName,
      durationMinutes: Number(data.duration_minutes ?? data.durationMinutes ?? 900),
      thumbnailUrl: data.thumbnail_url || data.thumbnailUrl,
      isPublished: Boolean(data.is_published ?? data.isPublished ?? true),
    };

    try {
      await api.post('/v1/admin/courses', payload);
    } catch (e) {}

    const newCourse = normalizeCourse({
      id: Date.now(),
      title: data.title,
      slug,
      category: data.category || 'Trí tuệ Nhân tạo & Thị giác Máy tính',
      instructor_name: data.instructor_name || 'PGS.TS. Đỗ Đức Hùng',
      department_name: data.department_name || 'Khoa Công nghệ Thông tin & Trí tuệ Nhân tạo',
      level: data.level || 'intermediate',
      duration_minutes: Number(data.duration_minutes || 900),
      description: data.description || '',
      thumbnail_url:
        data.thumbnail_url ||
        'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&auto=format&fit=crop&q=80',
      enrolled_students: 0,
      avg_rating: 5.0,
      is_published: Boolean(data.is_published ?? true),
      has_pgvector_embedding: true,
      created_at: new Date().toISOString().slice(0, 10),
      modules: [
        {
          id: Date.now() + 1,
          title: 'Chương 1: Tổng quan & Kiến thức Nền tảng',
          description: 'Giới thiệu đề cương khóa học và cấu trúc bài giảng tương tác AI Tutor.',
          order_index: 1,
          lessons: [],
        },
      ],
    });

    mockStore.courses = [newCourse, ...mockStore.courses];
    return newCourse;
  };

  updateCourse = async (courseId, data) => {
    const payload = {
      ...data,
      instructorName: data.instructor_name || data.instructorName,
      departmentName: data.department_name || data.departmentName,
      durationMinutes: Number(data.duration_minutes ?? data.durationMinutes ?? 900),
      thumbnailUrl: data.thumbnail_url || data.thumbnailUrl,
      isPublished: Boolean(data.is_published ?? data.isPublished),
    };

    try {
      await api.put(`/v1/admin/courses/${courseId}`, payload);
    } catch (e) {}

    mockStore.courses = mockStore.courses.map((c) =>
      Number(c.id) === Number(courseId) ? normalizeCourse({ ...c, ...data }) : c
    );
    return mockStore.courses.find((c) => Number(c.id) === Number(courseId));
  };

  deleteCourse = async (courseId) => {
    try {
      await api.delete(`/v1/admin/courses/${courseId}`);
    } catch (e) {}
    mockStore.courses = mockStore.courses.filter((c) => Number(c.id) !== Number(courseId));
    return { id: courseId };
  };

  toggleCoursePublish = async (courseId, isPublished) => {
    try {
      await Promise.allSettled([
        api.put(`/v1/admin/courses/${courseId}`, {
          is_published: isPublished,
          isPublished,
        }),
        api.put(`/v1/teacher/courses/${courseId}`, {
          is_published: isPublished,
          isPublished,
        }),
      ]);
    } catch (e) {}

    mockStore.courses = mockStore.courses.map((c) =>
      Number(c.id) === Number(courseId)
        ? normalizeCourse({ ...c, is_published: isPublished, isPublished })
        : c
    );
    return mockStore.courses.find((c) => Number(c.id) === Number(courseId));
  };

  // --- MODULE CRUD (/v1/admin/modules) ---
  createModule = async (courseId, data) => {
    const payload = {
      course_id: courseId,
      courseId,
      title: data.title,
      description: data.description || '',
      order_index: Number(data.order_index ?? data.orderIndex ?? 1),
      orderIndex: Number(data.order_index ?? data.orderIndex ?? 1),
    };
    try {
      await api.post('/v1/admin/modules', payload);
    } catch (e) {}

    const newModule = normalizeModule({
      id: Date.now(),
      course_id: courseId,
      title: data.title,
      description: data.description || '',
      order_index: Number(data.order_index ?? data.orderIndex ?? 1),
      lessons: [],
    });

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = [...(c.modules || []), newModule].sort(
        (a, b) => Number(a.order_index || 1) - Number(b.order_index || 1)
      );
      return normalizeCourse({ ...c, modules: updatedModules });
    });

    return newModule;
  };

  updateModule = async (courseId, moduleId, data) => {
    const payload = {
      ...data,
      course_id: courseId,
      courseId,
      order_index: Number(data.order_index ?? data.orderIndex ?? 1),
      orderIndex: Number(data.order_index ?? data.orderIndex ?? 1),
    };
    try {
      await api.put(`/v1/admin/modules/${moduleId}`, payload);
    } catch (e) {}

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = (c.modules || [])
        .map((m) =>
          Number(m.id) === Number(moduleId) ? normalizeModule({ ...m, ...data }) : m
        )
        .sort((a, b) => Number(a.order_index || 1) - Number(b.order_index || 1));
      return normalizeCourse({ ...c, modules: updatedModules });
    });
    return { id: moduleId };
  };

  deleteModule = async (courseId, moduleId) => {
    try {
      await api.delete(`/v1/admin/modules/${moduleId}`);
    } catch (e) {}

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = (c.modules || []).filter(
        (m) => Number(m.id) !== Number(moduleId)
      );
      return normalizeCourse({ ...c, modules: updatedModules });
    });
    return { id: moduleId };
  };

  // --- LESSON CRUD (/v1/admin/lessons) ---
  createLesson = async (courseId, moduleId, data) => {
    const payload = {
      module_id: moduleId,
      moduleId,
      title: data.title,
      lesson_type: data.lesson_type || data.lessonType || 'video',
      lessonType: data.lesson_type || data.lessonType || 'video',
      video_duration: Number(data.video_duration ?? data.videoDuration ?? 600),
      videoDuration: Number(data.video_duration ?? data.videoDuration ?? 600),
      video_url: data.video_url || data.videoUrl || '',
      videoUrl: data.video_url || data.videoUrl || '',
      text_content: data.text_content || data.textContent || '',
      textContent: data.text_content || data.textContent || '',
      cached_transcript: data.cached_transcript || data.cachedTranscript || '',
      cachedTranscript: data.cached_transcript || data.cachedTranscript || '',
      allow_skip: Boolean(data.allow_skip ?? data.allowSkip ?? false),
      allowSkip: Boolean(data.allow_skip ?? data.allowSkip ?? false),
      order_index: Number(data.order_index ?? data.orderIndex ?? 1),
      orderIndex: Number(data.order_index ?? data.orderIndex ?? 1),
    };

    try {
      await api.post('/v1/admin/lessons', payload);
    } catch (e) {}

    const newLesson = normalizeLesson({
      id: Date.now(),
      ...payload,
      segments: [],
    });

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = (c.modules || []).map((m) => {
        if (Number(m.id) !== Number(moduleId)) return m;
        const updatedLessons = [...(m.lessons || []), newLesson].sort(
          (a, b) => Number(a.order_index || 1) - Number(b.order_index || 1)
        );
        return normalizeModule({ ...m, lessons: updatedLessons });
      });
      return normalizeCourse({ ...c, modules: updatedModules });
    });

    return newLesson;
  };

  updateLesson = async (courseId, moduleId, lessonId, data) => {
    const payload = {
      ...data,
      module_id: moduleId,
      moduleId,
      lesson_type: data.lesson_type || data.lessonType || 'video',
      lessonType: data.lesson_type || data.lessonType || 'video',
      video_duration: Number(data.video_duration ?? data.videoDuration ?? 600),
      videoDuration: Number(data.video_duration ?? data.videoDuration ?? 600),
      video_url: data.video_url ?? data.videoUrl ?? '',
      videoUrl: data.video_url ?? data.videoUrl ?? '',
      text_content: data.text_content ?? data.textContent ?? '',
      textContent: data.text_content ?? data.textContent ?? '',
      cached_transcript: data.cached_transcript ?? data.cachedTranscript ?? '',
      cachedTranscript: data.cached_transcript ?? data.cachedTranscript ?? '',
      allow_skip: Boolean(data.allow_skip ?? data.allowSkip ?? false),
      allowSkip: Boolean(data.allow_skip ?? data.allowSkip ?? false),
      order_index: Number(data.order_index ?? data.orderIndex ?? 1),
      orderIndex: Number(data.order_index ?? data.orderIndex ?? 1),
    };

    try {
      await api.put(`/v1/admin/lessons/${lessonId}`, payload);
    } catch (e) {}

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = (c.modules || []).map((m) => {
        if (Number(m.id) !== Number(moduleId)) return m;
        const updatedLessons = (m.lessons || [])
          .map((l) =>
            Number(l.id) === Number(lessonId) ? normalizeLesson({ ...l, ...payload }) : l
          )
          .sort((a, b) => Number(a.order_index || 1) - Number(b.order_index || 1));
        return normalizeModule({ ...m, lessons: updatedLessons });
      });
      return normalizeCourse({ ...c, modules: updatedModules });
    });

    return { id: lessonId };
  };

  deleteLesson = async (courseId, moduleId, lessonId) => {
    try {
      await api.delete(`/v1/admin/lessons/${lessonId}`);
    } catch (e) {}

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = (c.modules || []).map((m) => {
        if (Number(m.id) !== Number(moduleId)) return m;
        const updatedLessons = (m.lessons || []).filter(
          (l) => Number(l.id) !== Number(lessonId)
        );
        return normalizeModule({ ...m, lessons: updatedLessons });
      });
      return normalizeCourse({ ...c, modules: updatedModules });
    });

    return { id: lessonId };
  };

  // --- VIDEO SEGMENT CRUD (/v1/admin/segments) ---
  createSegment = async (courseId, moduleId, lessonId, data) => {
    const quizOptions = [
      data.option_a || data.quiz_options?.[0] || 'A. Đáp án A',
      data.option_b || data.quiz_options?.[1] || 'B. Đáp án B',
      data.option_c || data.quiz_options?.[2] || 'C. Đáp án C',
      data.option_d || data.quiz_options?.[3] || 'D. Đáp án D',
    ];
    const payload = {
      lesson_id: lessonId,
      lessonId,
      segment_order: Number(data.segment_order ?? data.segmentOrder ?? 1),
      segmentOrder: Number(data.segment_order ?? data.segmentOrder ?? 1),
      start_timestamp: Number(data.start_timestamp ?? data.startTimestamp ?? 0),
      startTimestamp: Number(data.start_timestamp ?? data.startTimestamp ?? 0),
      end_timestamp: Number(data.end_timestamp ?? data.endTimestamp ?? 360),
      endTimestamp: Number(data.end_timestamp ?? data.endTimestamp ?? 360),
      title: data.title,
      summary: data.summary || '',
      transcript: data.transcript || '',
      quiz_question: data.quiz_question || data.quizQuestion || '',
      quizQuestion: data.quiz_question || data.quizQuestion || '',
      quiz_options: quizOptions,
      quizOptions,
      correct_answer: data.correct_answer || data.correctAnswer || 'A',
      correctAnswer: data.correct_answer || data.correctAnswer || 'A',
      explanation: data.explanation || '',
    };

    try {
      await api.post('/v1/admin/segments', payload);
    } catch (e) {}

    const newSeg = normalizeSegment({
      id: Date.now(),
      ...payload,
    });

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = (c.modules || []).map((m) => {
        if (Number(m.id) !== Number(moduleId)) return m;
        const updatedLessons = (m.lessons || []).map((l) => {
          if (Number(l.id) !== Number(lessonId)) return l;
          const updatedSegments = [...(l.segments || []), newSeg].sort(
            (a, b) => Number(a.segment_order || 1) - Number(b.segment_order || 1)
          );
          return normalizeLesson({ ...l, segments: updatedSegments });
        });
        return normalizeModule({ ...m, lessons: updatedLessons });
      });
      return normalizeCourse({ ...c, modules: updatedModules });
    });

    return newSeg;
  };

  updateSegment = async (courseId, moduleId, lessonId, segmentId, data) => {
    const quizOptions = [
      data.option_a || data.quiz_options?.[0] || 'A. Đáp án A',
      data.option_b || data.quiz_options?.[1] || 'B. Đáp án B',
      data.option_c || data.quiz_options?.[2] || 'C. Đáp án C',
      data.option_d || data.quiz_options?.[3] || 'D. Đáp án D',
    ];
    const payload = {
      ...data,
      lesson_id: lessonId,
      lessonId,
      segment_order: Number(data.segment_order ?? data.segmentOrder ?? 1),
      segmentOrder: Number(data.segment_order ?? data.segmentOrder ?? 1),
      start_timestamp: Number(data.start_timestamp ?? data.startTimestamp ?? 0),
      startTimestamp: Number(data.start_timestamp ?? data.startTimestamp ?? 0),
      end_timestamp: Number(data.end_timestamp ?? data.endTimestamp ?? 360),
      endTimestamp: Number(data.end_timestamp ?? data.endTimestamp ?? 360),
      quiz_question: data.quiz_question ?? data.quizQuestion ?? '',
      quizQuestion: data.quiz_question ?? data.quizQuestion ?? '',
      quiz_options: quizOptions,
      quizOptions,
      correct_answer: data.correct_answer || data.correctAnswer || 'A',
      correctAnswer: data.correct_answer || data.correctAnswer || 'A',
    };

    try {
      await api.put(`/v1/admin/segments/${segmentId}`, payload);
    } catch (e) {}

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = (c.modules || []).map((m) => {
        if (Number(m.id) !== Number(moduleId)) return m;
        const updatedLessons = (m.lessons || []).map((l) => {
          if (Number(l.id) !== Number(lessonId)) return l;
          const updatedSegments = (l.segments || [])
            .map((s) =>
              Number(s.id) === Number(segmentId)
                ? normalizeSegment({ ...s, ...payload })
                : s
            )
            .sort((a, b) => Number(a.segment_order || 1) - Number(b.segment_order || 1));
          return normalizeLesson({ ...l, segments: updatedSegments });
        });
        return normalizeModule({ ...m, lessons: updatedLessons });
      });
      return normalizeCourse({ ...c, modules: updatedModules });
    });

    return { id: segmentId };
  };

  deleteSegment = async (courseId, moduleId, lessonId, segmentId) => {
    try {
      await api.delete(`/v1/admin/segments/${segmentId}`);
    } catch (e) {}

    mockStore.courses = mockStore.courses.map((c) => {
      if (Number(c.id) !== Number(courseId)) return c;
      const updatedModules = (c.modules || []).map((m) => {
        if (Number(m.id) !== Number(moduleId)) return m;
        const updatedLessons = (m.lessons || []).map((l) => {
          if (Number(l.id) !== Number(lessonId)) return l;
          const updatedSegments = (l.segments || []).filter(
            (s) => Number(s.id) !== Number(segmentId)
          );
          return normalizeLesson({ ...l, segments: updatedSegments });
        });
        return normalizeModule({ ...m, lessons: updatedLessons });
      });
      return normalizeCourse({ ...c, modules: updatedModules });
    });

    return { id: segmentId };
  };

  // lms-api GET /v1/admin/reviews -> { items: AdminReviewView[], total }. Reviews have no moderation status in
  // lms-api (published on creation), so they normalize to status 'approved'.
  getReviews = async (params = {}) => {
    try {
      const query = {};
      if (params.courseId || params.course_id) query.courseId = params.courseId || params.course_id;
      const res = await api.get('/v1/admin/reviews', { params: query });
      const body = res?.data?.data ?? res?.data;
      const items = Array.isArray(body) ? body : body?.items ?? [];
      return (Array.isArray(items) ? items : []).map(normalizeReview);
    } catch (e) {
      if (isHttpError(e)) throw e;
    }

    // Offline demo mode only.
    let list = mockStore.courseReviews.map(normalizeReview);
    if (params.status) {
      list = list.filter((r) => r.status === params.status);
    }
    return list;
  };

  // lms-api has no review moderation status (no PUT /v1/admin/reviews/:id), so approval only exists for the
  // offline demo reviews; real reviews are always shown as approved and only deletion is available.
  moderateReview = async (reviewId, status) => {
    const exists = mockStore.courseReviews.some((r) => r.id === reviewId);
    if (!exists) {
      throw new Error('lms-api không hỗ trợ duyệt đánh giá (đánh giá được hiển thị ngay khi tạo)');
    }
    mockStore.courseReviews = mockStore.courseReviews.map((r) =>
      r.id === reviewId ? normalizeReview({ ...r, status }) : r
    );
    return mockStore.courseReviews.find((r) => r.id === reviewId);
  };

  // lms-api DELETE /v1/admin/reviews/:id.
  deleteReview = async (reviewId) => {
    try {
      await api.delete(`/v1/admin/reviews/${reviewId}`);
      return { id: reviewId };
    } catch (e) {
      if (isHttpError(e)) throw e;
    }
    mockStore.courseReviews = mockStore.courseReviews.filter((r) => r.id !== reviewId);
    return { id: reviewId };
  };
}

const coursesApi = new CoursesApi();
export default coursesApi;
