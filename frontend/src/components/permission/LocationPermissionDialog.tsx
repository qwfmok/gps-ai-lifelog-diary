import { useEffect, useRef } from 'react';

interface LocationPermissionDialogProps {
  isRequesting: boolean;
  error: string | null;
  onCancel: () => void;
  onAllow: () => void;
}

export default function LocationPermissionDialog({
  isRequesting,
  error,
  onCancel,
  onAllow,
}: LocationPermissionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLParagraphElement>(null);
  const isRequestingRef = useRef(isRequesting);
  isRequestingRef.current = isRequesting;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>('button:not([disabled])')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isRequestingRef.current) onCancel();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
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
    if (isRequesting) progressRef.current?.focus();
  }, [isRequesting]);

  const closeOnBackdrop = (target: EventTarget) => {
    if (target === dialogRef.current?.parentElement && !isRequesting) onCancel();
  };

  return (
    <div className="activity-dialog-backdrop permission-dialog-backdrop" onMouseDown={(event) => closeOnBackdrop(event.target)}>
      <section
        aria-labelledby="location-permission-title"
        aria-describedby="location-permission-description"
        aria-modal="true"
        aria-busy={isRequesting}
        className="activity-dialog location-permission-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <p className="page-eyebrow">자동 기록 안내</p>
        <h2 id="location-permission-title">위치 기록 사용</h2>
        <p id="location-permission-description">
          하루의 이동과 체류지를 정리해 Timeline을 만들기 위해 위치정보 사용이 필요합니다.
        </p>
        <div className="location-permission-dialog__detail">
          <p>위치정보는 하루의 흐름을 구성하기 위한 근거로 사용됩니다.</p>
          <ul>
            <li>하루 이동 흐름과 체류 장소 파악</li>
            <li>시간과 장소를 바탕으로 Timeline 구성</li>
            <li>하루의 맥락을 이해하기 위한 행동 후보 준비</li>
          </ul>
          <p>위치 기록은 설정에서 언제든 끌 수 있습니다.</p>
          <p>권한 확인은 현재 브라우저에서 이루어집니다. 이 프로토타입은 좌표를 외부 서버로 전송하거나 Timeline 기록으로 저장하지 않습니다.</p>
        </div>
        {error && <p className="diary-editor__error" role="alert">{error}</p>}
        {isRequesting && <p className="permission-dialog__progress" ref={progressRef} role="status" tabIndex={-1}>위치 권한을 확인하고 있습니다.</p>}
        <footer className="activity-dialog__actions">
          <button className="activity-dialog__cancel" disabled={isRequesting} onClick={onCancel} type="button">나중에</button>
          <button className="activity-dialog__confirm" disabled={isRequesting} onClick={onAllow} type="button">
            {isRequesting ? '확인 중...' : error ? '다시 시도' : '위치 사용 허용'}
          </button>
        </footer>
      </section>
    </div>
  );
}
