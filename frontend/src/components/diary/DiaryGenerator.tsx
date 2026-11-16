import { useState } from 'react';
import type { TimelineEvent, TimelineLoadStatus } from '../../types';
import { useDiaryGeneration } from '../../hooks/useDiaryGeneration';
import { useDiaryEditor } from '../../hooks/useDiaryEditor';
import DiaryPreview from './DiaryPreview';
import DiaryEditor from './DiaryEditor';
import DiaryDeleteDialog from './DiaryDeleteDialog';
import { diaryGenerationSource } from '../../services';

interface DiaryGeneratorProps {
  date: string;
  transcript: string;
  onTranscriptChange: (value: string) => void;
  events: TimelineEvent[];
  timelineStatus: TimelineLoadStatus;
  onReviewPending: (eventId: string) => void;
}

export default function DiaryGenerator({
  date,
  transcript,
  onTranscriptChange,
  events,
  timelineStatus,
  onReviewPending,
}: DiaryGeneratorProps) {
  const {
    status,
    diary,
    error,
    generate,
    replaceDiary,
    reset,
  } = useDiaryGeneration(date);
  const editor = useDiaryEditor(diary, replaceDiary, reset);
  const [memo, setMemo] = useState('');
  const isApiSource = diaryGenerationSource === 'api';
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const pendingEvents = events.filter(
    (event) => event.status === 'UNCERTAIN' || event.status === 'EMPTY',
  );
  const timelineReady = timelineStatus === 'success' && events.length > 0;

  const canGenerate = isApiSource ? status !== 'GENERATING' : timelineReady && status !== 'GENERATING';
  const requestGeneration = () => {
    if (!canGenerate) return;
    if (!isApiSource && pendingEvents.length > 0) {
      setShowReviewPrompt(true);
      return;
    }
    void generate(memo, transcript, isApiSource && editor.isSaved);
  };

  const generateAnyway = () => {
    setShowReviewPrompt(false);
    void generate(memo, transcript, isApiSource && editor.isSaved);
  };

  return (
    <section className="diary-generator" aria-labelledby="diary-generator-title">
      <div className="diary-generator__intro">
        <p className="page-eyebrow">A DAY IN REVIEW</p>
        <h2 id="diary-generator-title">오늘의 하루가 정리되었습니다.</h2>
        <p>자동 기록과 추가한 기억을 바탕으로 오늘의 일기를 만들어볼까요?</p>
      </div>

      {!isApiSource && timelineStatus === 'loading' && (
        <p className="diary-generator__availability" role="status">
          오늘의 기록을 불러온 뒤 일기를 만들 수 있습니다.
        </p>
      )}
      {!isApiSource && (timelineStatus === 'error' || timelineStatus === 'auth-required' || timelineStatus === 'configuration-error') && (
        <p className="diary-generator__availability" role="status">
          오늘의 기록을 불러오면 일기를 만들 수 있습니다.
        </p>
      )}
      {!isApiSource && (timelineStatus === 'empty' || (timelineStatus === 'success' && events.length === 0)) && (
        <p className="diary-generator__availability" role="status">
          오늘의 기록이 없어 일기를 생성할 수 없습니다.
        </p>
      )}

      {isApiSource && !editor.isEditing && status !== 'GENERATING' && (
        <div className="diary-generator__inputs">
          <label htmlFor="diary-generation-memo">오늘의 메모 (선택)</label>
          <textarea
            id="diary-generation-memo"
            maxLength={4000}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="일기에 담고 싶은 기억이나 감정을 적어 주세요."
            value={memo}
          />
          <label htmlFor="diary-generation-transcript">음성 전사 내용 (선택)</label>
          <textarea
            id="diary-generation-transcript"
            maxLength={12000}
            onChange={(event) => onTranscriptChange(event.target.value)}
            placeholder="음성 기록을 저장하면 수정한 전사 내용이 여기에 표시됩니다."
            value={transcript}
          />
          <p>날짜별 장소와 저장된 기억은 Backend가 계정 기준으로 조회합니다.</p>
        </div>
      )}

      {status === 'IDLE' && (
        <>
          <p className="diary-generator__hint">
            오늘의 기록을 바탕으로 일기를 만들어 드릴게요.
          </p>
          <button
            className="diary-generator__primary diary-generator__start"
            data-diary-generator-entry
            disabled={!canGenerate}
            onClick={requestGeneration}
            type="button"
          >
            오늘의 일기 만들기
          </button>
        </>
      )}

      {!isApiSource && showReviewPrompt && pendingEvents.length > 0 && status !== 'GENERATING' && (
        <div className="diary-review-prompt" role="group" aria-labelledby="diary-review-title">
          <h3 id="diary-review-title">
            아직 확인하지 않은 기록이 {pendingEvents.length}개 있습니다.
          </h3>
          <p>
            지금 생성할 수도 있고, 먼저 기록을 보완하면 더 자연스러운 일기를 만들 수 있습니다.
          </p>
          <div className="diary-review-prompt__actions">
            <button
              className="diary-generator__secondary"
              onClick={() => {
                const firstPendingEvent = pendingEvents[0];
                setShowReviewPrompt(false);
                if (firstPendingEvent) onReviewPending(firstPendingEvent.id);
              }}
              type="button"
            >
              기록 확인하기
            </button>
            <button className="diary-generator__primary" onClick={generateAnyway} type="button">
              그대로 생성하기
            </button>
          </div>
        </div>
      )}

      {status === 'GENERATING' && (
        <div className="diary-generator__loading" role="status" aria-live="polite">
          <span className="timeline-state__spinner" aria-hidden="true" />
          <div>
            <p>오늘의 기록을 정리하고 있습니다.</p>
            <span>하루의 흐름을 일기로 만들고 있어요.</span>
          </div>
          <button className="diary-generator__primary" disabled type="button">
            일기 생성 중...
          </button>
        </div>
      )}

      {status === 'ERROR' && (
        <div className="diary-generator__error">
          <p role="alert">{error ?? '일기를 생성하지 못했습니다.'}</p>
          <button
            className="diary-generator__primary"
            disabled={!canGenerate}
            onClick={() => void generate(memo, transcript, isApiSource && editor.isSaved)}
            type="button"
          >
            다시 시도
          </button>
        </div>
      )}

      {diary && editor.isEditing && (
        <DiaryEditor
          diary={diary}
          content={editor.draftContent}
          isSaving={editor.isSaving}
          saveError={editor.saveError}
          validationError={editor.validationError}
          onChange={editor.updateDraft}
          onCancel={editor.cancelEditing}
          onSave={() => void editor.save()}
        />
      )}

      {diary && !editor.isEditing && (status === 'GENERATED' || status === 'ERROR') && (
        <DiaryPreview
          diary={diary}
          isDraftOnly={isApiSource && !editor.isSaved}
          isSaved={editor.isSaved}
          saveNotice={editor.saveNotice}
          onEdit={editor.startEditing}
          onRegenerate={requestGeneration}
          onDelete={editor.requestDelete}
        />
      )}

      {editor.isDeleteDialogOpen && (
        <DiaryDeleteDialog
          isDeleting={editor.isDeleting}
          error={editor.deleteError}
          onCancel={editor.cancelDelete}
          onConfirm={() => void editor.confirmDelete()}
        />
      )}
    </section>
  );
}
