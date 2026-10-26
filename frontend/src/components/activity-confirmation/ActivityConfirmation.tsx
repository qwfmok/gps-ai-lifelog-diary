import { useEffect, useRef, useState } from 'react';
import type { Activity, TimelineEvent } from '../../types';
import { useActivityCandidates } from '../../hooks/useActivityCandidates';

interface ActivityConfirmationProps {
  event: TimelineEvent;
  onClose: () => void;
  onConfirm: (activity: Activity) => Promise<void>;
}

export default function ActivityConfirmation({
  event,
  onClose,
  onConfirm,
}: ActivityConfirmationProps) {
  const { status, candidates, retry } = useActivityCandidates(event.id);
  const [selectedCandidate, setSelectedCandidate] = useState<Activity | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customActivity, setCustomActivity] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';

    dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' && !isSavingRef.current) {
        onClose();
        return;
      }

      if (keyboardEvent.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        keyboardEvent.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (keyboardEvent.shiftKey && document.activeElement === first) {
        keyboardEvent.preventDefault();
        last.focus();
      } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      } else {
        const timelineItems = document.querySelectorAll<HTMLElement>('[data-timeline-event]');
        const timelineItem = Array.from(timelineItems).find(
          (item) => item.dataset.timelineEvent === event.id,
        );
        timelineItem?.focus();
      }
    };
  }, [event.id, onClose]);

  const selectedActivity = isCustom
    ? customActivity.trim()
      ? {
          id: `user-${event.id}`,
          name: customActivity.trim(),
          category: '사용자 입력',
          source: 'USER' as const,
          confidence: 1,
        }
      : null
    : selectedCandidate
      ? { ...selectedCandidate, source: 'USER' as const, confidence: 1 }
      : null;

  const handleConfirm = async () => {
    if (!selectedActivity || isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(false);
    try {
      await onConfirm(selectedActivity);
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (target: EventTarget) => {
    if (target === dialogRef.current?.parentElement && !isSaving) onClose();
  };

  return (
    <div
      className="activity-dialog-backdrop"
      onMouseDown={(eventClick) => handleBackdropClick(eventClick.target)}
    >
      <div
        aria-labelledby="activity-dialog-title"
        aria-modal="true"
        className="activity-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="activity-dialog__handle" aria-hidden="true" />
        <header className="activity-dialog__header">
          <div>
            <p className="activity-dialog__time">
              {event.startTime} – {event.endTime}
            </p>
            <h2 id="activity-dialog-title">이 시간에는 무엇을 하셨나요?</h2>
            <p className="activity-dialog__place">{event.place?.name ?? '장소 정보 없음'}</p>
          </div>
          <button
            aria-label="활동 확인 창 닫기"
            className="activity-dialog__close"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="activity-dialog__body">
          <section aria-labelledby="activity-candidates-title">
            <div className="activity-dialog__section-heading">
              <h3 id="activity-candidates-title">추천 활동</h3>
              {status === 'loading' && <span>불러오는 중</span>}
            </div>

            {status === 'loading' && (
              <p className="activity-dialog__message" role="status">
                활동 후보를 불러오는 중입니다.
              </p>
            )}
            {status === 'error' && (
              <div className="activity-dialog__message activity-dialog__message--error" role="alert">
                <p>활동 후보를 불러오지 못했습니다.</p>
                <button className="activity-dialog__text-button" onClick={retry} type="button">
                  다시 시도
                </button>
              </div>
            )}
            {status === 'empty' && (
              <p className="activity-dialog__message">추천 활동이 없습니다. 직접 입력해 주세요.</p>
            )}
            {candidates.length > 0 && (
              <div aria-label="추천 활동 후보" className="activity-candidate-list">
                {candidates.map((candidate) => {
                  const selected = !isCustom && selectedCandidate?.id === candidate.id;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`activity-candidate${selected ? ' activity-candidate--selected' : ''}`}
                      disabled={isSaving}
                      key={candidate.id}
                      onClick={() => {
                        setSelectedCandidate(candidate);
                        setIsCustom(false);
                        setSaveError(false);
                      }}
                      type="button"
                    >
                      <span>{candidate.name}</span>
                      {selected && <span className="activity-candidate__selected-label">선택됨 ✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="activity-custom-title" className="activity-custom">
            <button
              aria-pressed={isCustom}
              className={`activity-custom__toggle${isCustom ? ' activity-custom__toggle--selected' : ''}`}
              disabled={isSaving}
              id="activity-custom-title"
              onClick={() => {
                setIsCustom(true);
                setSelectedCandidate(null);
                setSaveError(false);
                window.setTimeout(() => customInputRef.current?.focus(), 0);
              }}
              type="button"
            >
              직접 입력 <span>{isCustom ? '선택됨 ✓' : '다른 활동 입력하기'}</span>
            </button>
            {isCustom && (
              <div className="activity-custom__field">
                <label htmlFor="custom-activity">어떤 활동을 하셨나요?</label>
                <input
                  autoComplete="off"
                  disabled={isSaving}
                  id="custom-activity"
                  maxLength={100}
                  onChange={(changeEvent) => {
                    setCustomActivity(changeEvent.target.value);
                    setSaveError(false);
                  }}
                  placeholder="예: 팀 프로젝트 진행"
                  ref={customInputRef}
                  type="text"
                  value={customActivity}
                />
                <p>{customActivity.length}/100자</p>
              </div>
            )}
          </section>

          {saveError && (
            <p className="activity-dialog__save-error" role="alert">
              활동을 저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.
            </p>
          )}
        </div>

        <footer className="activity-dialog__actions">
          <button
            className="activity-dialog__cancel"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            취소
          </button>
          <button
            className="activity-dialog__confirm"
            disabled={!selectedActivity || isSaving}
            onClick={() => void handleConfirm()}
            type="button"
          >
            {isSaving ? '저장 중...' : '확인'}
          </button>
        </footer>
      </div>
    </div>
  );
}
