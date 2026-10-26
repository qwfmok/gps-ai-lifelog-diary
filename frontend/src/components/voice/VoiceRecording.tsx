import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineEvent } from '../../types';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';

interface VoiceRecordingProps {
  event: TimelineEvent;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}

function formatDuration(duration: number): string {
  const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
  const seconds = (duration % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function VoiceRecording({ event, onClose, onSave }: VoiceRecordingProps) {
  const voice = useVoiceRecording(event.id, event.note ?? '');
  const [isDirectEntry, setIsDirectEntry] = useState(Boolean(event.note));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isSavingRef = useRef(false);
  const voiceStatusRef = useRef(voice.status);
  voiceStatusRef.current = voice.status;
  const handleClose = useCallback(() => {
    if (
      voiceStatusRef.current === 'RECORDING' ||
      voiceStatusRef.current === 'PROCESSING' ||
      voiceStatusRef.current === 'ERROR'
    ) {
      void voice.cancel();
    }
    onClose();
  }, [onClose, voice.cancel]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
    dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' && !isSavingRef.current) {
        handleClose();
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
  }, [event.id, handleClose]);

  const handleSave = async () => {
    const note = voice.transcript.trim();
    if (!note || isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(false);
    try {
      await onSave(note);
      handleClose();
    } catch {
      setSaveError(true);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const startRecording = () => {
    setIsDirectEntry(false);
    setSaveError(false);
    void voice.start();
  };

  const handleBackdropMouseDown = (target: EventTarget) => {
    if (target === dialogRef.current?.parentElement && !isSaving) handleClose();
  };

  return (
    <div
      className="activity-dialog-backdrop"
      onMouseDown={(mouseEvent) => handleBackdropMouseDown(mouseEvent.target)}
    >
      <div
        aria-labelledby="voice-dialog-title"
        aria-modal="true"
        className="activity-dialog voice-dialog"
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
            <h2 id="voice-dialog-title">{event.note ? '기억 수정' : '기억 추가'}</h2>
            <p className="activity-dialog__place">{event.place?.name ?? '장소 정보 없음'}</p>
          </div>
          <button
            aria-label="기억 입력 창 닫기"
            className="activity-dialog__close"
            disabled={isSaving}
            onClick={handleClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="activity-dialog__body voice-dialog__body">
          {voice.status === 'IDLE' && !isDirectEntry && (
            <div className="voice-idle">
              <p>이 시간에 있었던 일이나 감정을 자유롭게 말해 주세요.</p>
              <button className="voice-record-button" onClick={startRecording} type="button">
                <span aria-hidden="true">●</span> 녹음 시작
              </button>
              <button
                className="activity-dialog__text-button"
                onClick={() => setIsDirectEntry(true)}
                type="button"
              >
                직접 입력하기
              </button>
            </div>
          )}

          {voice.status === 'RECORDING' && (
            <div className="voice-recording-state">
              <span className="voice-recording-state__indicator" aria-hidden="true" />
              <p className="voice-recording-state__label" role="status" aria-live="polite">
                녹음 중
              </p>
              <p aria-label={`녹음 시간 ${formatDuration(voice.duration)}`} className="voice-timer" role="timer">
                {formatDuration(voice.duration)}
              </p>
              <button
                className="voice-stop-button"
                disabled={isSaving}
                onClick={() => void voice.stop()}
                type="button"
              >
                <span aria-hidden="true">■</span> 녹음 종료
              </button>
              <button className="activity-dialog__text-button" onClick={handleClose} type="button">
                취소
              </button>
            </div>
          )}

          {voice.status === 'PROCESSING' && (
            <div className="voice-processing" role="status" aria-live="polite">
              <span className="timeline-state__spinner" aria-hidden="true" />
              <p>음성을 텍스트로 변환하고 있습니다.</p>
              <button className="activity-dialog__text-button" onClick={handleClose} type="button">
                취소
              </button>
            </div>
          )}

          {voice.status === 'ERROR' && (
            <div className="voice-error" role="alert">
              <p>{voice.error ?? '음성 기록을 처리하지 못했습니다.'}</p>
              <button
                className="activity-dialog__text-button"
                onClick={() => void voice.retry()}
                type="button"
              >
                다시 시도
              </button>
              <button
                className="activity-dialog__text-button"
                onClick={() => setIsDirectEntry(true)}
                type="button"
              >
                직접 입력
              </button>
            </div>
          )}

          {(isDirectEntry || voice.status === 'COMPLETED') && (
            <div className="voice-transcript-field">
              <label htmlFor="voice-transcript">
                {isDirectEntry ? '이 시간에 있었던 일을 입력해 주세요.' : '음성 기록'}
              </label>
              <textarea
                disabled={isSaving}
                id="voice-transcript"
                onChange={(changeEvent) => {
                  voice.setTranscript(changeEvent.target.value);
                  setSaveError(false);
                }}
                placeholder="기억이나 감정을 적어 주세요."
                rows={5}
                value={voice.transcript}
              />
              {voice.status === 'COMPLETED' && !isDirectEntry && (
                <button className="activity-dialog__text-button" onClick={startRecording} type="button">
                  다시 녹음
                </button>
              )}
            </div>
          )}

          {saveError && (
            <p className="activity-dialog__save-error" role="alert">
              기억을 저장하지 못했습니다. 다시 시도해 주세요.
            </p>
          )}
        </div>

        <footer className="activity-dialog__actions">
          <button
            className="activity-dialog__cancel"
            disabled={isSaving}
            onClick={handleClose}
            type="button"
          >
            취소
          </button>
          <button
            className="activity-dialog__confirm"
            disabled={!voice.transcript.trim() || isSaving || (!isDirectEntry && voice.status !== 'COMPLETED')}
            onClick={() => void handleSave()}
            type="button"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}
