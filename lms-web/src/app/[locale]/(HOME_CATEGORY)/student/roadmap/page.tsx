'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import {
  Badge,
  ButtonLink,
  Card,
  PageHeader,
  segmented,
} from '../../_components/ui';
import { MOCK_ROADMAP_EDGES, MOCK_ROADMAP_NODES } from '@/api/mockData';

export default function StudentRoadmapPage() {
  const [viewMode, setViewMode] = useState<'dag' | 'semesters'>('dag');

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Cây Lộ trình Tiên quyết DAG & Kế hoạch Đào tạo 8 Học kỳ"
        description="Đồ thị có hướng không chu trình (Directed Acyclic Graph) tự động đề xuất học phần tiếp theo dựa trên tiến độ và mức độ nắm vững kiến thức của bạn."
      />

      <div className={segmented.list} role="tablist" aria-label="Chế độ xem lộ trình">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'dag'}
          onClick={() => setViewMode('dag')}
          className={segmented.tab}
        >
          Đồ thị Tiên quyết DAG ({MOCK_ROADMAP_NODES.length} nút)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'semesters'}
          onClick={() => setViewMode('semesters')}
          className={segmented.tab}
        >
          Khung Chương trình 8 Học kỳ Đại học
        </button>
      </div>

      {viewMode === 'dag' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MOCK_ROADMAP_NODES.map((node) => {
              const incomingEdges = MOCK_ROADMAP_EDGES.filter((e) => e.to === node.id);
              return (
                <Card key={node.id} padding="md" className="flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge
                        tone={
                          node.status === 'completed'
                            ? 'success'
                            : node.status === 'in_progress'
                              ? 'brand'
                              : 'neutral'
                        }
                      >
                        {node.status === 'completed'
                          ? 'Đã hoàn thành'
                          : node.status === 'in_progress'
                            ? 'Đang học'
                            : 'Chưa mở khóa'}
                      </Badge>
                      {node.aiRecommended && (
                        <Badge tone="chat" icon="sparkles">
                          AI Khuyên học
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-primary">{node.title}</h3>
                    <p className="text-xs leading-relaxed text-secondary">{node.description}</p>

                    {node.aiReason && (
                      <div className="rounded-xl bg-muted p-3 text-xs text-primary">
                        <span className="font-semibold text-chat">Phân tích AI Advisor: </span>
                        {node.aiReason}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-line-subtle pt-3 text-xs text-secondary">
                    <span>
                      Tiên quyết:{' '}
                      {incomingEdges.length > 0
                        ? incomingEdges.map((e) => e.from).join(', ')
                        : 'Không yêu cầu'}
                    </span>
                    {node.lessonId && (
                      <ButtonLink href={`/learn/${node.lessonId}`} variant="primary" size="xs">
                        Học ngay
                      </ButtonLink>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'semesters' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((sem) => {
            const semNodes = MOCK_ROADMAP_NODES.filter((n) => (n.semester || 3) === sem);
            return (
              <Card key={sem} padding="md" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-primary">Học kỳ {sem}</h3>
                  <Badge tone="info">Chuẩn đầu ra KHMT & AI</Badge>
                </div>
                {semNodes.length === 0 ? (
                  <p className="rounded-xl bg-muted p-3 text-xs text-secondary">
                    Đã hoàn thành toàn bộ học phần cơ sở của học kỳ {sem}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {semNodes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center justify-between rounded-xl bg-muted p-3 text-xs"
                      >
                        <span className="font-semibold text-primary">{n.title}</span>
                        <Badge tone="brand">{n.credits || 3} TC</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
