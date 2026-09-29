import { useEffect, useRef } from 'react';

interface DiaryDeleteDialogProps {
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DiaryDeleteDialog({
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DiaryDeleteDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isDeletingRef = useRef(isDeleting);
  isDeletingRef.current = isDeleting;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled])';
    dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeletingRef.current) {
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      } else {
        document.querySelector<HTMLElement>('[data-diary-generator-entry]')?.focus();
      }
    };
  }, [onCancel]);

  useEffect(() => {
    if (isDeleting) {
      dialogRef.current?.querySelector<HTMLElement>('[data-delete-progress]')?.focus();
    }
  }, [isDeleting]);

  const closeOnBackdrop = (target: EventTarget) => {
    if (target === dialogRef.current?.parentElement && !isDeleting) onCancel();
  };

  return (
    <div className="activity-dialog-backdrop delete-dialog-backdrop" onMouseDown={(event) => closeOnBackdrop(event.target)}>
      <div
        aria-describedby="diary-delete-description"
        aria-labelledby="diary-delete-title"
        aria-modal="true"
        className="activity-dialog delete-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-busy={isDeleting}
      >
        <div className="activity-dialog__handle" aria-hidden="true" />
        <div className="delete-dialog__content">
          <p className="page-eyebrow">기록 관리</p>
          <h2 id="diary-delete-title">이 일기를 삭제하시겠습니까?</h2>
          <p id="diary-delete-description">
            삭제한 기록은 현재 Mock 환경에서 되돌릴 수 없습니다. Timeline과 기억 기록은 삭제되지 않습니다.
          </p>
          {error && <p className="diary-editor__error" role="alert">{error}</p>}
          {isDeleting && (
            <p className="diary-delete-progress" data-delete-progress role="status" tabIndex={0}>
              일기를 삭제하고 있습니다.
            </p>
          )}
        </div>
        <footer className="activity-dialog__actions">
          <button className="activity-dialog__cancel" disabled={isDeleting} onClick={onCancel} type="button">
            취소
          </button>
          <button className="delete-dialog__confirm" disabled={isDeleting} onClick={onConfirm} type="button">
            {isDeleting ? '삭제 중...' : error ? '다시 시도' : '삭제'}
          </button>
        </footer>
      </div>
    </div>
  );
}
