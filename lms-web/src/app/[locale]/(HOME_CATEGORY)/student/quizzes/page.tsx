'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  formClass,
  segmented,
} from '../../_components/ui';
import { useQuizRoomStore } from '@/store/useQuizRoomStore';
import { MOCK_QUIZZES, MOCK_TOPIC_SKILLS } from '@/api/mockData';
import type { QuizItem } from '@/api/types';

export default function StudentQuizzesPage() {
  const [activeTab, setActiveTab] = useState<'adaptive' | 'multiplayer' | 'ai_generator'>('adaptive');
  const [quizzes, setQuizzes] = useState<QuizItem[]>(MOCK_QUIZZES);
  const [activeQuiz, setActiveQuiz] = useState<QuizItem | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [scoreCount, setScoreCount] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [honorCodeAccepted, setHonorCodeAccepted] = useState(false);

  // Power-ups for gamified quiz
  const [used5050, setUsed5050] = useState(false);
  const [doublePointsActive, setDoublePointsActive] = useState(false);

  // AI Custom Quiz Generator state
  const [genTopic, setGenTopic] = useState('Nhận diện Bối rối MediaPipe & Temporal Attention');
  const [genDifficulty, setGenDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Multiplayer WebSocket GameManager store
  const {
    roomCode,
    status: roomStatus,
    currentQuestionIndex: mpIndex,
    players,
    joinRoom,
    startMatch,
    submitMultiplayerAnswer,
    nextMultiplayerQuestion,
    leaveRoom,
  } = useQuizRoomStore();
  const [pinInput, setPinInput] = useState('AI2026');

  const handleStartPractice = (qz: QuizItem) => {
    setActiveQuiz(qz);
    setQIndex(0);
    setSelectedOpt(null);
    setScoreCount(0);
    setQuizCompleted(false);
    setHonorCodeAccepted(false);
    setUsed5050(false);
    setDoublePointsActive(false);
  };

  const handleAnswerSubmit = () => {
    if (!activeQuiz || selectedOpt === null) return;
    const isLastQuestion = qIndex + 1 >= activeQuiz.questions.length;
    if (isLastQuestion && !honorCodeAccepted) return;

    const currentQ = activeQuiz.questions[qIndex];
    const isCorrect = selectedOpt === currentQ.correctIndex;
    if (isCorrect) {
      setScoreCount((prev) => prev + (doublePointsActive ? 2 : 1));
    }
    setDoublePointsActive(false);

    if (isLastQuestion) {
      setQuizCompleted(true);
    } else {
      setQIndex(qIndex + 1);
      setSelectedOpt(null);
    }
  };

  const handleGenerateAiQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    const created: QuizItem = {
      id: Date.now(),
      title: `AI Sinh tự động: ${genTopic}`,
      topic: genTopic,
      subjectContext: 'KHMT & Trí tuệ Nhân tạo',
      difficulty: genDifficulty,
      questionCount: 2,
      timeLimitSeconds: 180,
      questions: [
        {
          id: 901,
          questionType: 'multiple_choice',
          question: `Trong chủ đề "${genTopic}", điều kiện nào kích hoạt trạng thái Eye-Lock x1.6?`,
          options: [
            'EAR > 0.22 kết hợp Var(EAR) < 0.002 và Nose Drift < 3.5px',
            'EAR < 0.15 trong 5 giây',
            'Tốc độ phát video > 1.5x',
            'Không bật webcam',
          ],
          correctIndex: 0,
          explanation:
            'Eye-Lock xảy ra khi mắt mở to tập trung (EAR > 0.22), hầu như không chớp (Var < 0.002) và đầu đứng yên (Drift < 3.5px).',
        },
        {
          id: 902,
          questionType: 'multiple_choice',
          question: 'Vector nhúng ngữ nghĩa dùng trong tầng 1 của AI Tutor RAG có số chiều là bao nhiêu?',
          options: ['128 chiều', '512 chiều', '1536 chiều (pgvector)', '4096 chiều'],
          correctIndex: 2,
          explanation: 'Sử dụng mô hình text-embedding-3-small với 1536 chiều lưu trên PostgreSQL pgvector.',
        },
      ],
    };
    setQuizzes([created, ...quizzes]);
    setActiveTab('adaptive');
    handleStartPractice(created);
  };

  const mpQuiz = quizzes[0];
  const mpQuestion = mpQuiz.questions[mpIndex] || mpQuiz.questions[0];

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Luyện tập Quiz Thích ứng (TopicSkill) & Phòng Đấu Trực tuyến"
        description="Hệ thống tự động điều chỉnh độ khó câu hỏi theo năng lực từng chủ đề (`0.0 - 1.0`), tích hợp Cam kết Danh dự Học thuật (Coursera Honor Code) và thi đấu thời gian thực."
      />

      <div className={segmented.list} role="tablist" aria-label="Chế độ Quiz">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'adaptive'}
          onClick={() => setActiveTab('adaptive')}
          className={segmented.tab}
        >
          Luyện tập Thích ứng ({quizzes.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'multiplayer'}
          onClick={() => setActiveTab('multiplayer')}
          className={segmented.tab}
        >
          Phòng Đấu Multiplayer (PIN: {roomCode})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ai_generator'}
          onClick={() => setActiveTab('ai_generator')}
          className={segmented.tab}
        >
          AI Tạo Đề Tự động
        </button>
      </div>

      {/* Tab 1: Adaptive Practice */}
      {activeTab === 'adaptive' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {activeQuiz ? (
              <Card padding="lg" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="brand">{activeQuiz.title}</Badge>
                  <Badge tone="chat">
                    Câu {qIndex + 1} / {activeQuiz.questions.length}
                  </Badge>
                </div>

                {quizCompleted ? (
                  <div className="rounded-xl bg-muted p-6 text-center space-y-3">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Badge tone="success">Đã hoàn thành bài kiểm tra</Badge>
                      <Badge tone="seller" icon="verified">
                        Độ trùng lặp: 3.1% — Hợp lệ (Honor Code Verified)
                      </Badge>
                    </div>
                    <h3 className="text-xl font-semibold text-primary">
                      Điểm số: {scoreCount} / {activeQuiz.questions.length}
                    </h3>
                    <p className="text-sm text-secondary">
                      Hệ thống đã cập nhật chỉ số TopicSkill, đồng bộ Bảng điểm Trọng số (Course Gradebook) và vector đặc trưng `quiz_score` trong bộ phân loại MLP.
                    </p>
                    <Button variant="primary" onClick={() => setActiveQuiz(null)}>
                      Quay lại danh sách đề
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl bg-muted p-4">
                      <p className="text-base font-semibold text-primary">
                        {activeQuiz.questions[qIndex].question}
                      </p>
                    </div>

                    {/* Power-up Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-secondary">Trợ giúp Gamification:</span>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={used5050}
                        onClick={() => setUsed5050(true)}
                      >
                        50:50 Loại 2 đáp án sai
                      </Button>
                      <Button
                        size="xs"
                        variant={doublePointsActive ? 'chat' : 'outline'}
                        onClick={() => setDoublePointsActive(true)}
                      >
                        x2 Điểm câu này
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {activeQuiz.questions[qIndex].options.map((opt, idx) => {
                        const isWrongHidden =
                          used5050 &&
                          idx !== activeQuiz.questions[qIndex].correctIndex &&
                          idx % 2 === 1;
                        if (isWrongHidden) return null;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedOpt(idx)}
                            className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left text-sm transition-colors ${
                              selectedOpt === idx
                                ? 'border-brand bg-brand-50 font-semibold text-primary'
                                : 'border-line bg-white text-secondary hover:bg-muted'
                            }`}
                          >
                            <span>{opt}</span>
                            {selectedOpt === idx && (
                              <Icon name="checkCircle" size="sm" className="text-brand" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Coursera Honor Code Attestation on final question before submitting */}
                    {qIndex + 1 >= activeQuiz.questions.length && (
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-muted p-3.5 text-xs text-primary">
                        <input
                          type="checkbox"
                          checked={honorCodeAccepted}
                          onChange={(e) => setHonorCodeAccepted(e.target.checked)}
                          className={formClass.checkbox}
                        />
                        <span>
                          <strong>Cam kết Danh dự Học thuật (Coursera Honor Code):</strong> Tôi cam kết bài kiểm tra này là công sức cá nhân của tôi và tuân thủ Quy tắc Danh dự Học thuật.
                        </span>
                      </label>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setActiveQuiz(null)}>
                        Thoát
                      </Button>
                      <Button
                        variant="primary"
                        disabled={
                          selectedOpt === null ||
                          (qIndex + 1 >= activeQuiz.questions.length && !honorCodeAccepted)
                        }
                        onClick={handleAnswerSubmit}
                      >
                        {qIndex + 1 >= activeQuiz.questions.length
                          ? 'Nộp bài Kiểm tra (Honor Code) →'
                          : 'Xác nhận câu trả lời →'}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ) : (
              <div className="space-y-3">
                {quizzes.map((qz) => (
                  <Card key={qz.id} padding="md" className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={
                            qz.difficulty === 'hard'
                              ? 'danger'
                              : qz.difficulty === 'medium'
                                ? 'info'
                                : 'success'
                          }
                        >
                          Độ khó: {qz.difficulty.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-secondary">{qz.subjectContext}</span>
                      </div>
                      <h3 className="text-base font-semibold text-primary">{qz.title}</h3>
                      <p className="text-xs text-secondary">
                        Chủ đề: {qz.topic} · {qz.questions.length} câu hỏi · Thời gian: {qz.timeLimitSeconds}s
                      </p>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => handleStartPractice(qz)}>
                      Bắt đầu làm bài
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 lg:col-span-4">
            <Card padding="md" className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">
                Bảng Năng lực Chủ đề Cá nhân (TopicSkill Engine)
              </h3>
              <p className="text-xs text-secondary">
                Điểm kỹ năng &lt; 0.45 tự động đề xuất đề `EASY`, 0.45–0.75 đề xuất `MEDIUM`, và &gt; 0.75 mở khóa `HARD`.
              </p>
              <div className="space-y-3">
                {MOCK_TOPIC_SKILLS.map((sk) => (
                  <div key={sk.topic} className="rounded-xl bg-muted p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary">{sk.topic}</span>
                      <Badge tone="chat">{Math.round(sk.skillLevel * 100)}%</Badge>
                    </div>
                    <ProgressBar value={Math.round(sk.skillLevel * 100)} tone="brand" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Multiplayer Quiz Battle Room */}
      {activeTab === 'multiplayer' && (
        <Card padding="lg" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="chat" icon="bolt">
                WebSocket GameManager · Thi đấu Trực tuyến
              </Badge>
              <h2 className="mt-1 text-lg font-semibold text-primary">
                Phòng Đấu Trắc nghiệm Thời gian thực (Mã PIN: {roomCode})
              </h2>
            </div>

            {roomStatus === 'idle' ? (
              <div className="flex items-center gap-2">
                <Input
                  compact
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Nhập mã PIN 6 ký tự..."
                  className="w-40"
                />
                <Button variant="chat" size="sm" onClick={() => joinRoom(pinInput)}>
                  Vào Phòng Đấu
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={leaveRoom}>
                Rời phòng
              </Button>
            )}
          </div>

          {roomStatus === 'waiting' && (
            <div className="rounded-xl bg-muted p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">
                  Sảnh chờ ({players.length} sinh viên đã sẵn sàng)
                </span>
                <Button variant="primary" size="sm" onClick={startMatch}>
                  Bắt đầu Trận đấu Ngay →
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                {players.map((p) => (
                  <div key={p.id} className="rounded-xl bg-white p-3 text-xs space-y-1">
                    <p className="font-semibold text-primary">{p.name}</p>
                    <p className="text-secondary">MSSV: {p.studentCode}</p>
                    <Badge tone="success">Sẵn sàng</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {roomStatus === 'playing' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="rounded-xl bg-muted p-4">
                  <span className="text-xs font-semibold text-chat">
                    Câu hỏi #{mpIndex + 1} / {mpQuiz.questions.length}
                  </span>
                  <p className="mt-1 text-base font-semibold text-primary">{mpQuestion.question}</p>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {mpQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        submitMultiplayerAnswer(idx === mpQuestion.correctIndex, 22);
                        nextMultiplayerQuestion(mpQuiz.questions.length);
                      }}
                      className="rounded-xl border border-line bg-white p-3.5 text-left text-sm font-medium text-primary hover:border-chat hover:bg-chat-50"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-muted p-4 space-y-3 lg:col-span-5">
                <h3 className="text-sm font-semibold text-primary">Bảng Xếp hạng Trực tiếp (Live Scoreboard)</h3>
                <div className="space-y-2">
                  {players.map((p, rank) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-primary">
                        #{rank + 1} {p.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {p.streak > 0 && <Badge tone="warning">Chuỗi x{p.streak}</Badge>}
                        <span className="font-semibold text-chat">{p.score} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {roomStatus === 'finished' && (
            <div className="rounded-xl bg-muted p-6 text-center space-y-3">
              <Badge tone="success">Kết thúc trận đấu Multiplayer</Badge>
              <h3 className="text-xl font-semibold text-primary">
                Quán quân: {players[0]?.name} ({players[0]?.score} điểm)
              </h3>
              <Button variant="primary" size="sm" onClick={() => joinRoom(roomCode)}>
                Chơi lại ván mới
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: AI Custom Quiz Generator */}
      {activeTab === 'ai_generator' && (
        <Card padding="lg" className="max-w-2xl space-y-4">
          <div>
            <Badge tone="chat" icon="sparkles">
              AI Quiz Generator · Cá nhân hóa theo Chuyên ngành
            </Badge>
            <h2 className="mt-2 text-lg font-semibold text-primary">
              Khởi tạo Đề Trắc nghiệm Tự động từ Phụ đề Bài giảng
            </h2>
          </div>

          <form onSubmit={handleGenerateAiQuiz} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-primary">
                Chủ đề hoặc Phân đoạn Bài giảng cần ôn tập
              </label>
              <Input
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-primary">
                Độ khó mục tiêu
              </label>
              <Select
                value={genDifficulty}
                onChange={(e) => setGenDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              >
                <option value="easy">Cơ bản (Easy — Ôn tập khái niệm)</option>
                <option value="medium">Trung bình (Medium — Vận dụng công thức)</option>
                <option value="hard">Nâng cao (Hard — Phân tích tình huống & Code)</option>
              </Select>
            </div>

            <Button type="submit" variant="chat">
              <Icon name="sparkles" size="sm" />
              Sinh Đề Kiểm tra Bằng AI & Bắt đầu Làm bài
            </Button>
          </form>
        </Card>
      )}
    </Container>
  );
}
