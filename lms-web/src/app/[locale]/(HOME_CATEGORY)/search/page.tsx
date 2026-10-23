'use client';

import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container } from '../_components/Container';
import { LocaleLink } from '../_components/LocaleLink';
import { Icon } from '../_components/primitives';
import {
  Badge,
  ButtonLink,
  Card,
  PageHeader,
  SearchInput,
  chipVariants,
  segmented,
} from '../_components/ui';
import { formatSeconds } from '@/lib/utils';
import { MOCK_COURSES } from '@/api/mockData';

export default function GlobalSearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<'hybrid' | 'semantic' | 'fuzzy'>('hybrid');

  const allSegments = useMemo(
    () =>
      MOCK_COURSES.flatMap((c) =>
        c.modules.flatMap((m) =>
          m.lessons.flatMap((l) =>
            l.segments.map((seg) => ({
              ...seg,
              courseTitle: c.title,
              courseCode: c.code,
              lessonTitle: l.title,
            })),
          ),
        ),
      ),
    [],
  );

  const matchedCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_COURSES;
    return MOCK_COURSES.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [query]);

  const matchedSegments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSegments;
    return allSegments.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.transcript.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        (s.keyFormulas || []).some((f) => f.toLowerCase().includes(q)),
    );
  }, [query, allSegments]);

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Tìm kiếm Lai Ngữ nghĩa & Mốc Video (pgvector + pg_trgm)"
        description="Tra cứu trực tiếp công thức toán, đoạn mã PyTorch, phụ đề bài giảng hoặc tên học phần với độ tương đồng Cosine 1536 chiều."
      />

      <Card padding="md" className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập từ khóa hoặc câu hỏi tự nhiên: ví dụ 'EAR Eye-Lock', 'Temporal Attention', 'MobileFaceNet'..."
            />
          </div>

          <div className={segmented.list} role="tablist" aria-label="Chế độ tìm kiếm">
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'hybrid'}
              onClick={() => setSearchMode('hybrid')}
              className={segmented.tab}
            >
              Hybrid (Vector + Trigram)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'semantic'}
              onClick={() => setSearchMode('semantic')}
              className={segmented.tab}
            >
              pgvector (1536-d)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'fuzzy'}
              onClick={() => setSearchMode('fuzzy')}
              className={segmented.tab}
            >
              pg_trgm (Fuzzy)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-secondary">Gợi ý truy vấn nhanh:</span>
          {['EAR', 'Temporal Attention', 'MobileFaceNet', 'AU4', 'pgvector'].map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => setQuery(kw)}
              className={chipVariants({ variant: 'subtle', size: 'xs' })}
            >
              {kw}
            </button>
          ))}
        </div>
      </Card>

      {/* Matched VideoSegments (Deep Timestamp Jump) */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">
          Phân đoạn Bài giảng & Công thức Khớp Ngữ nghĩa ({matchedSegments.length})
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {matchedSegments.map((seg) => (
            <Card key={seg.id} padding="md" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="chat" icon="sparkles">
                  Cosine Similarity: 0.91 · [{formatSeconds(seg.startTimestamp)} – {formatSeconds(seg.endTimestamp)}]
                </Badge>
                <span className="text-xs text-secondary">{seg.courseCode}</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-primary">{seg.title}</h3>
                <p className="mt-1 text-xs text-secondary">{seg.summary}</p>
              </div>
              <div className="rounded-xl bg-muted p-3 text-xs text-primary">
                <span className="font-semibold text-secondary">Trích đoạn phụ đề: </span>
                &ldquo;{seg.transcript}&rdquo;
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-secondary">{seg.lessonTitle}</span>
                <ButtonLink href={`/learn/${seg.lessonId}`} variant="primary" size="xs">
                  <Icon name="play" size="xs" />
                  Phát ngay tại {formatSeconds(seg.startTimestamp)}
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Matched Courses */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">
          Học phần Liên quan ({matchedCourses.length})
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {matchedCourses.map((c) => (
            <Card key={c.id} padding="md" className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Badge tone="brand">{c.code}</Badge>
                <LocaleLink href={`/courses/${c.id}`} className="block text-base font-semibold text-primary hover:text-brand">
                  {c.title}
                </LocaleLink>
                <p className="text-xs text-secondary">{c.instructor.name} · {c.department}</p>
              </div>
              <ButtonLink href={`/courses/${c.id}`} variant="outline" size="xs">
                Mở học phần
              </ButtonLink>
            </Card>
          ))}
        </div>
      </div>
    </Container>
  );
}
