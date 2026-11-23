import { useEffect, useRef, useState } from 'react';
import type { SettingsDeleteAction } from '../../hooks/useSettings';

interface SettingsConfirmationDialogProps {
  action: SettingsDeleteAction;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const dialogCopy: Record<SettingsDeleteAction, { title: string; description: string; confirm: string }> = {
  location: {
    title: '앱 내 위치 상태를 초기화하시겠습니까?',
    description: '위치 추적을 중지하고 이 앱의 임시 위치 기록과 현재 위치 상태를 지웁니다. 서버 위치 기록과 Timeline 기억은 유지되며, 저장된 일기도 유지됩니다.',
    confirm: '앱 내 위치 상태 초기화',
  },
  diaries: {
    title: '모든 일기를 삭제하시겠습니까?',
    description: '저장된 일기가 모두 삭제됩니다. 위치 기반 Timeline 기록은 유지됩니다.',
    confirm: '모든 일기 삭제',
  },
  all: {
    title: '앱 내 위치 상태와 모든 일기를 삭제하시겠습니까?',
    description: '위치 추적을 중지하고 이 앱의 임시 위치 상태와 저장된 일기를 삭제합니다. 서버 GPS 위치 기록과 Timeline 기억은 삭제되지 않습니다.',
    confirm: '위치 상태와 일기 삭제',
  },
};

export default function SettingsConfirmationDialog({
  action,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: SettingsConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLParagraphElement>(null);
  const isDeletingRef = useRef(isDeleting);
  const [acknowledged, setAcknowledged] = useState(false);
  isDeletingRef.current = isDeleting;
  const copy = dialogCopy[action];

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeletingRef.current) onCancel();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onCancel]);

  useEffect(() => {
    if (isDeleting) progressRef.current?.focus();
  }, [isDeleting]);

  const closeOnBackdrop = (target: EventTarget) => {
    if (target === dialogRef.current?.parentElement && !isDeleting) onCancel();
  };

  return (
    <div className="activity-dialog-backdrop delete-dialog-backdrop" onMouseDown={(event) => closeOnBackdrop(event.target)}>
      <div
        aria-labelledby="settings-confirm-title"
        aria-describedby="settings-confirm-description"
        aria-modal="true"
        aria-busy={isDeleting}
        className="activity-dialog delete-dialog settings-confirm-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <p className="page-eyebrow">데이터 관리</p>
        <h2 id="settings-confirm-title">{copy.title}</h2>
        <p id="settings-confirm-description">{copy.description}</p>
        {action === 'all' && (
          <label className="settings-confirm-acknowledgement">
            <input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
            <span>앱 내 위치 상태와 저장된 일기가 삭제되며 서버 위치 기록과 Timeline 기억은 남는다는 점을 확인했습니다.</span>
          </label>
        )}
        {error && <p className="diary-editor__error" role="alert">{error}</p>}
        {isDeleting && <p className="diary-delete-progress" ref={progressRef} role="status" tabIndex={-1}>데이터를 삭제하고 있습니다.</p>}
        <footer className="activity-dialog__actions">
          <button className="activity-dialog__cancel" disabled={isDeleting} onClick={onCancel} type="button">취소</button>
          <button
            className="delete-dialog__confirm"
            disabled={isDeleting || (action === 'all' && !acknowledged)}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? '삭제 중...' : error ? '다시 시도' : copy.confirm}
          </button>
        </footer>
      </div>
    </div>
  );
}
