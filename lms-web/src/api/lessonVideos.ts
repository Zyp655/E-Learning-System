import type { CourseItem, LessonItem } from './types';
import generated from './generatedLessonVideos.json';

/** Output of tools/lesson-videos/generate.py: one narrated lecture video per lesson. */
interface GeneratedLessonVideo {
  videoUrl: string;
  captionsUrl: string;
  durationSeconds: number;
  segments: { segmentIndex: number; startTimestamp: number; endTimestamp: number; transcript: string }[];
}

const GENERATED = generated as Record<string, GeneratedLessonVideo>;

function withVideo(lesson: LessonItem): LessonItem {
  const video = GENERATED[String(lesson.id)];
  if (!video) return lesson;
  return {
    ...lesson,
    videoUrl: video.videoUrl,
    captionsUrl: video.captionsUrl,
    durationSeconds: video.durationSeconds,
    durationMinutes: Math.max(1, Math.round(video.durationSeconds / 60)),
    // Segment boundaries and transcripts follow the real narration, so in-video quizzes fire when it ends.
    segments: lesson.segments.map((seg) => {
      const timing = video.segments.find((s) => s.segmentIndex === seg.segmentIndex);
      if (!timing) return seg;
      const label = `Phân đoạn ${seg.segmentIndex} (${mmss(timing.startTimestamp)} – ${mmss(timing.endTimestamp)})`;
      return {
        ...seg,
        title: seg.title.replace(/^Phân đoạn \d+ \([^)]*\)/, label),
        startTimestamp: timing.startTimestamp,
        endTimestamp: timing.endTimestamp,
        transcript: timing.transcript,
      };
    }),
  };
}

function mmss(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

/** Attaches the generated lecture videos to the courses' lessons and refreshes course durations. */
export function withGeneratedVideos(courses: CourseItem[]): CourseItem[] {
  return courses.map((course) => {
    const modules = course.modules.map((m) => ({ ...m, lessons: m.lessons.map(withVideo) }));
    return {
      ...course,
      modules,
      durationMinutes: modules.flatMap((m) => m.lessons).reduce((a, l) => a + l.durationMinutes, 0),
    };
  });
}
