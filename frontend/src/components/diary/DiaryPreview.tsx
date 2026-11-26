import type { Diary } from '../../types';
import { formatKoreanDate } from '../../utils/date';

interface DiaryPreviewProps {
  diary: Diary;
  isDraftOnly?: boolean;
  isSaved: boolean;
  uncertainPoints?: string[];
  saveNotice: string | null;
  saveError: string | null;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

export default function DiaryPreview({
  diary,
  isDraftOnly = false,
  isSaved,
  uncertainPoints = [],
  saveNotice,
  saveError,
  isSaving,
  onEdit,
  onSave,
  onRegenerate,
  onDelete,
}: DiaryPreviewProps) {
  const date = new Date(`${diary.date}T12:00:00`);

  return (
    <article className="diary-preview" aria-labelledby="diary-preview-title">
      <div className="diary-preview__heading">
        <div>
          <p className="diary-preview__eyebrow">오늘의 일기</p>
          <h3 id="diary-preview-title">{formatKoreanDate(date)}</h3>
        </div>
        <span className="diary-preview__status">{isDraftOnly ? '생성 초안 · 미저장' : isSaved ? '저장됨' : '생성 완료'}</span>
      </div>
      <p className="diary-preview__content">{diary.content}</p>
      {uncertainPoints.length > 0 && (
        <details className="diary-preview__places">
          <summary>장소 추론 결과</summary>
          <ul>
            {uncertainPoints.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </details>
      )}
      {saveNotice && <p className="diary-preview__notice" role="status">{saveNotice}</p>}
      {saveError && <p className="diary-editor__error" role="alert">{saveError}</p>}
      <div className="diary-preview__actions">
        <button className="diary-preview__edit" onClick={onEdit} type="button">수정</button>
        {isDraftOnly && (
          <button className="diary-preview__save" disabled={isSaving} onClick={onSave} type="button">
            {isSaving ? '저장 중...' : '저장'}
          </button>
        )}
        <button className="diary-preview__regenerate" onClick={onRegenerate} type="button">다시 생성</button>
        {!isDraftOnly && <button className="diary-preview__delete" onClick={onDelete} type="button">삭제</button>}
      </div>
    </article>
  );
}
