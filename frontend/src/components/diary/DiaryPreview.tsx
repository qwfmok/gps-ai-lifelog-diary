import type { Diary } from '../../types';
import { formatKoreanDate } from '../../utils/date';

interface DiaryPreviewProps {
  diary: Diary;
  isSaved: boolean;
  saveNotice: string | null;
  onEdit: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

export default function DiaryPreview({
  diary,
  isSaved,
  saveNotice,
  onEdit,
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
        <span className="diary-preview__status">{isSaved ? '저장됨' : '생성 완료'}</span>
      </div>
      <p className="diary-preview__content">{diary.content}</p>
      {saveNotice && <p className="diary-preview__notice" role="status">{saveNotice}</p>}
      <div className="diary-preview__actions">
        <button className="diary-preview__edit" onClick={onEdit} type="button">수정</button>
        <button className="diary-preview__regenerate" onClick={onRegenerate} type="button">
          다시 생성
        </button>
        <button className="diary-preview__delete" onClick={onDelete} type="button">삭제</button>
      </div>
    </article>
  );
}
