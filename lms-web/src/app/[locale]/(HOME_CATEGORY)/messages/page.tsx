'use client';

import React, { useState } from 'react';
import { Container } from '../_components/Container';
import { Avatar, Icon } from '../_components/primitives';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
} from '../_components/ui';
import { MOCK_DIRECT_MESSAGES } from '@/api/mockData';

export default function DirectMessagesPage() {
  const [threads, setThreads] = useState(MOCK_DIRECT_MESSAGES);
  const [activeThreadId, setActiveThreadId] = useState(MOCK_DIRECT_MESSAGES[0]?.id || 1);
  const [replyText, setReplyText] = useState('');

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeThread) return;
    const msg = {
      id: Date.now(),
      sender: 'me' as const,
      text: replyText.trim(),
      time: 'Vừa xong',
    };
    setThreads(
      threads.map((t) =>
        t.id === activeThread.id
          ? { ...t, lastMessage: msg.text, messages: [...t.messages, msg] }
          : t,
      ),
    );
    setReplyText('');
  };

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Tin nhắn Học thuật & Cảnh báo Can thiệp Sớm"
        description="Trao đổi trực tiếp với Giảng viên hướng dẫn và nhận gợi ý ôn tập khi hệ thống phát hiện điểm nóng bối rối."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Thread List */}
        <div className="space-y-3 lg:col-span-4">
          {threads.map((t) => {
            const isSelected = t.id === activeThread?.id;
            return (
              <Card
                key={t.id}
                padding="sm"
                interactive
                onClick={() => setActiveThreadId(t.id)}
                className={`cursor-pointer space-y-2 ${isSelected ? 'border-chat bg-chat-25' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={t.partnerName} className="size-9 rounded-full" />
                    <div>
                      <p className="text-sm font-semibold text-primary">{t.partnerName}</p>
                      <p className="text-xs text-secondary">{t.partnerRole}</p>
                    </div>
                  </div>
                  {t.unread > 0 && <Badge tone="chat">{t.unread} mới</Badge>}
                </div>
                <p className="line-clamp-2 text-xs text-secondary">{t.lastMessage}</p>
              </Card>
            );
          })}
        </div>

        {/* Active Conversation */}
        <div className="lg:col-span-8">
          {activeThread && (
            <Card padding="md" className="flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={activeThread.partnerName} className="size-10 rounded-full" />
                  <div>
                    <h3 className="text-sm font-semibold text-primary">{activeThread.partnerName}</h3>
                    <p className="text-xs text-secondary">{activeThread.partnerRole}</p>
                  </div>
                </div>
                <Badge tone="seller" icon="verified">
                  Kênh Hỗ trợ Học thuật Chính thức
                </Badge>
              </div>

              <div className="max-h-96 space-y-3 overflow-y-auto py-2">
                {activeThread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl p-3.5 text-sm ${
                      m.sender === 'me'
                        ? 'ml-10 bg-chat-subtle text-primary'
                        : 'mr-10 bg-muted text-primary'
                    }`}
                  >
                    <p className="leading-relaxed">{m.text}</p>
                    <span className="mt-1 block text-xs text-tertiary">{m.time}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendReply} className="flex items-center gap-2 pt-2">
                <div className="flex-1">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Nhập tin nhắn trao đổi với giảng viên..."
                  />
                </div>
                <Button type="submit" variant="chat">
                  <Icon name="paperAirplane" size="sm" />
                  Gửi
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </Container>
  );
}
