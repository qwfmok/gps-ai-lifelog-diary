import type { Diary } from '../../types';
import { formatKoreanDate } from '../../utils/date';

interface DiaryEditorProps {
  diary: Diary;
  content: string;
  isSaving: boolean;
  saveError: string | null;
  validationError: string | null;
  onChange: (content: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export default function DiaryEditor({
  diary,
  content,
  isSaving,
  saveError,
  validationError,
  onChange,
  onCancel,
  onSave,
}: DiaryEditorProps) {
  const date = new Date(`${diary.date}T12:00:00`);

  return (
    <section className="diary-editor" aria-labelledby="diary-editor-title">
      <div className="diary-editor__heading">
        <p className="diary-preview__eyebrow">{formatKoreanDate(date)}</p>
        <h3 id="diary-editor-title">오늘의 일기 수정</h3>
        <p>원하는 표현으로 편하게 다듬어 주세요.</p>
      </div>
      <div className="diary-editor__field">
        <label htmlFor="diary-content">일기 내용</label>
        <textarea
          autoFocus
          disabled={isSaving}
          id="diary-content"
          onChange={(event) => onChange(event.target.value)}
          value={content}
        />
      </div>
      {validationError && <p className="diary-editor__error" role="alert">{validationError}</p>}
      {saveError && <p className="diary-editor__error" role="alert">{saveError}</p>}
      <div className="diary-editor__actions">
        <button className="diary-generator__secondary" disabled={isSaving} onClick={onCancel} type="button">
          취소
        </button>
        <button className="diary-generator__primary" disabled={isSaving} onClick={onSave} type="button">
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </section>
  );
}
