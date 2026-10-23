'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from '@/app/[locale]/(HOME_CATEGORY)/_components/primitives';
import {
  Badge,
  Button,
  Card,
  Textarea,
  chipVariants,
  formClass,
} from '@/app/[locale]/(HOME_CATEGORY)/_components/ui';
import { lmsApi } from '@/api';
import { MOCK_CODING_CHALLENGES } from '@/api/mockData';
import type { CodingChallengeItem, CodingTestCaseResult } from '@/api/types';

interface CodingLabPanelProps {
  initialChallengeId?: number;
  onAskAiTutor?: (prompt: string) => void;
  onLabCompleted?: (score: number, similarityScore: number) => void;
}

export function CodingLabPanel({
  initialChallengeId = 1,
  onAskAiTutor,
  onLabCompleted,
}: CodingLabPanelProps) {
  const [selectedChallengeId, setSelectedChallengeId] = useState<number>(initialChallengeId);
  const challenge: CodingChallengeItem =
    MOCK_CODING_CHALLENGES.find((c) => c.id === selectedChallengeId) || MOCK_CODING_CHALLENGES[0];

  const [language, setLanguage] = useState<'python' | 'typescript' | 'go'>('python');
  const [code, setCode] = useState<string>(challenge.starterCode.python);
  const [honorCodeChecked, setHonorCodeChecked] = useState(true);
  const [honorCodeError, setHonorCodeError] = useState<string | null>(null);
  const [showAiHint, setShowAiHint] = useState(false);

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<CodingTestCaseResult[]>([]);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [submissionScore, setSubmissionScore] = useState<number | null>(null);
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);

  useEffect(() => {
    setSelectedChallengeId(initialChallengeId);
  }, [initialChallengeId]);

  useEffect(() => {
    const ch =
      MOCK_CODING_CHALLENGES.find((c) => c.id === selectedChallengeId) || MOCK_CODING_CHALLENGES[0];
    setCode(ch.starterCode[language]);
    setTestResults([]);
    setAiFeedback(null);
    setSubmissionScore(null);
    setSimilarityScore(null);
    setShowAiHint(false);
  }, [selectedChallengeId, language]);

  const handleRunPublicTests = async () => {
    setRunning(true);
    setHonorCodeError(null);
    const res = await lmsApi.runCodingPublicTests({
      challengeId: challenge.id,
      language,
      code,
    });
    setTestResults(res.results);
    setAiFeedback(res.aiFeedback);
    setRunning(false);
  };

  const handleSubmitAllTests = async () => {
    if (!honorCodeChecked) {
      setHonorCodeError(
        'Vui lòng tích chọn Cam kết Danh dự Học thuật (Coursera Honor Code) trước khi nộp bài chấm điểm chính thức.',
      );
      return;
    }
    setHonorCodeError(null);
    setSubmitting(true);
    const res = await lmsApi.submitCodingAllTests({
      challengeId: challenge.id,
      language,
      code,
      honorCodeAccepted: honorCodeChecked,
    });
    setTestResults(res.results);
    setAiFeedback(res.aiFeedback);
    setSubmissionScore(res.score);
    setSimilarityScore(res.similarityScore);
    setSubmitting(false);

    if (res.score >= 75 && onLabCompleted) {
      onLabCompleted(res.score, res.similarityScore);
    }
  };

  const handleRequestAlgorithmHint = () => {
    setShowAiHint(true);
    if (onAskAiTutor) {
      onAskAiTutor(
        `Hãy gợi ý thuật toán từng bước cho bài thực hành "${challenge.title}" với công thức ${challenge.keyFormula}`,
      );
    }
  };

  return (
    <Card padding="md" className="space-y-5">
      {/* Header & Problem Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="chat" icon="code">
              Coursera In-Browser Coding Lab · Chấm Tự động
            </Badge>
            <Badge
              tone={
                challenge.difficulty === 'hard'
                  ? 'danger'
                  : challenge.difficulty === 'medium'
                    ? 'info'
                    : 'success'
              }
            >
              Độ khó: {challenge.difficulty.toUpperCase()}
            </Badge>
            {submissionScore !== null && (
              <Badge tone={submissionScore >= 75 ? 'success' : 'warning'} icon="verified">
                Điểm Lab: {submissionScore}/100
              </Badge>
            )}
            {similarityScore !== null && (
              <Badge tone={similarityScore <= 25 ? 'seller' : 'danger'} icon="shield">
                Độ trùng lặp: {similarityScore}% — {similarityScore <= 25 ? 'Hợp lệ' : 'Cảnh báo'}
              </Badge>
            )}
          </div>
          <h3 className="text-base font-semibold text-primary">{challenge.title}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {MOCK_CODING_CHALLENGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedChallengeId(item.id)}
              className={chipVariants({
                active: selectedChallengeId === item.id,
                tone: 'chat',
                size: 'xs',
              })}
            >
              Lab #{item.id}
            </button>
          ))}
        </div>
      </div>

      {/* Left (Problem Statement) + Right (Code Editor & Honor Code) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Panel: Problem Statement, Constraints, Formula & AI Hint Button */}
        <div className="space-y-3.5 lg:col-span-5">
          <div className="rounded-xl bg-muted p-4 space-y-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Đề bài & Yêu cầu Thuật toán
              </span>
              <p className="mt-1 text-sm leading-relaxed text-primary">
                {challenge.problemStatement}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3 space-y-1">
              <span className="text-xs font-semibold text-chat">
                Công thức Toán học Trọng tâm:
              </span>
              <p className="text-xs font-medium text-primary">{challenge.keyFormula}</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-primary">
                Ràng buộc Đầu vào / Đầu ra (Constraints):
              </span>
              <ul className="space-y-1 text-xs text-secondary">
                {challenge.constraints.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-brand">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-1">
              <Button
                size="sm"
                variant="soft-chat"
                block
                onClick={handleRequestAlgorithmHint}
              >
                <Icon name="sparkles" size="sm" />
                Nhờ AI Tutor gợi ý thuật toán
              </Button>
            </div>

            {showAiHint && (
              <div className="rounded-xl border border-chat/25 bg-chat-50 p-3 text-xs text-primary space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-chat-700">
                  <Icon name="lightBulb" size="xs" />
                  <span>Gợi ý Sư phạm từ AI Tutor (Socratic Coach):</span>
                </div>
                <p className="leading-relaxed">{challenge.aiHint}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Language Switcher, Code Editor, Honor Code & Run/Submit Buttons */}
        <div className="space-y-3.5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-secondary">Ngôn ngữ:</span>
              {(['python', 'typescript', 'go'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={chipVariants({
                    active: language === lang,
                    tone: 'brand',
                    size: 'xs',
                  })}
                >
                  {lang === 'python' ? 'Python 3.11' : lang === 'typescript' ? 'TypeScript 5' : 'Go 1.25'}
                </button>
              ))}
            </div>

            <Button
              size="xs"
              variant="ghost"
              onClick={() => setCode(challenge.starterCode[language])}
            >
              <Icon name="arrowPath" size="xs" />
              Khôi phục Code mẫu
            </Button>
          </div>

          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={11}
            className="bg-gray-900 text-xs text-white"
            aria-label="Trình soạn thảo mã nguồn Coding Lab"
          />

          {/* Coursera #7: Honor Code Attestation Checkbox */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-muted p-3 text-xs text-primary">
            <input
              type="checkbox"
              checked={honorCodeChecked}
              onChange={(e) => {
                setHonorCodeChecked(e.target.checked);
                if (e.target.checked) setHonorCodeError(null);
              }}
              className={formClass.checkbox}
            />
            <span>
              <strong className="font-semibold text-primary">
                Cam kết Danh dự Học thuật (Coursera Honor Code):
              </strong>{' '}
              Tôi cam kết bài làm này là kết quả tự thực hiện của cá nhân tôi, không sao chép trái phép mã nguồn. Hệ thống sẽ tự động kiểm tra độ trùng lặp AST/Token khi nộp bài.
            </span>
          </label>

          {honorCodeError && (
            <p className="text-xs font-medium text-danger">{honorCodeError}</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button
              size="sm"
              variant="outline"
              disabled={running || submitting}
              onClick={handleRunPublicTests}
            >
              <Icon name="play" size="sm" />
              {running ? 'Đang chạy Public Tests...' : 'Chạy Test Cases (Run Public Tests)'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={running || submitting}
              onClick={handleSubmitAllTests}
            >
              <Icon name="checkCircle" size="sm" />
              {submitting ? 'Đang chấm toàn bộ Test Cases...' : 'Nộp bài chấm điểm (Submit All Tests)'}
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Automated Test Cases Runner Table & AI Debugging Feedback */}
      <div className="rounded-xl bg-muted p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="terminal" size="sm" className="text-chat" />
            <h4 className="text-sm font-semibold text-primary">
              Bảng Kết quả Chạy Kiểm thử Tự động (Test Cases #1..#4)
            </h4>
          </div>
          {testResults.length > 0 && (
            <Badge
              tone={testResults.every((r) => r.passed) ? 'success' : 'warning'}
            >
              Đạt {testResults.filter((r) => r.passed).length}/{testResults.length} Test Cases
            </Badge>
          )}
        </div>

        {testResults.length === 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {challenge.testCases.map((tc) => (
              <div key={tc.id} className="rounded-lg bg-white p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">{tc.name}</span>
                  <Badge tone={tc.isPublic ? 'info' : 'neutral'}>
                    {tc.isPublic ? 'Public Test' : 'Hidden Edge Case'}
                  </Badge>
                </div>
                <p className="text-secondary">Input: {tc.input}</p>
                <p className="text-secondary">Expected: {tc.expectedOutput}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-subtle text-secondary">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Test Case</th>
                  <th className="px-3 py-2.5 font-semibold">Input</th>
                  <th className="px-3 py-2.5 font-semibold">Expected</th>
                  <th className="px-3 py-2.5 font-semibold">Actual</th>
                  <th className="px-3 py-2.5 font-semibold">Runtime</th>
                  <th className="px-3 py-2.5 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {testResults.map((tr) => (
                  <tr key={tr.id}>
                    <td className="px-3 py-2.5 font-semibold text-primary">{tr.name}</td>
                    <td className="px-3 py-2.5 text-secondary">{tr.input}</td>
                    <td className="px-3 py-2.5 text-secondary">{tr.expectedOutput}</td>
                    <td className="px-3 py-2.5 text-primary">{tr.actualOutput}</td>
                    <td className="px-3 py-2.5 tabular-nums text-secondary">{tr.runtimeMs} ms</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={tr.passed ? 'success' : 'danger'}>
                        {tr.passed ? 'Passed' : 'Failed'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aiFeedback && (
          <div className="rounded-xl bg-white p-3.5 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-chat flex items-center gap-1.5">
                <Icon name="sparkles" size="xs" />
                Nhận xét & Gỡ lỗi Tự động từ AI Auto-Grader:
              </span>
              {similarityScore !== null && (
                <Badge tone={similarityScore <= 25 ? 'success' : 'danger'}>
                  Originality Check: Độ trùng lặp {similarityScore}% — Hợp lệ
                </Badge>
              )}
            </div>
            <p className="text-primary leading-relaxed">{aiFeedback}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
