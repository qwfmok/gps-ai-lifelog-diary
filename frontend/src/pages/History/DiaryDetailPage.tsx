import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import DiaryDeleteDialog from '../../components/diary/DiaryDeleteDialog';
import DiaryEditor from '../../components/diary/DiaryEditor';
import { useDiaryDetail } from '../../hooks/useDiaryDetail';
import { useDiaryEditor } from '../../hooks/useDiaryEditor';
import { formatKoreanDateWithYear } from '../../utils/date';

function DiaryTimelineSummary({ events, loading }: {
  events: ReturnType<typeof useDiaryDetail>['timeline'];
  loading: boolean;
}) {
  return (
    <section className="diary-detail__timeline" aria-labelledby="diary-timeline-title">
      <div className="diary-detail__section-heading">
        <p className="page-eyebrow">THE DAY</p>
        <h2 id="diary-timeline-title">하루의 흐름</h2>
      </div>
      {loading ? <p className="diary-detail__muted" role="status">하루 기록을 불러오는 중입니다.</p> : events.length === 0 ? (
        <p className="diary-detail__muted">연결된 하루 기록이 없습니다.</p>
      ) : (
        <ol className="diary-detail__events">
          {events.map((event) => (
            <li key={event.id}>
              <time dateTime={`${event.date}T${event.startTime}`}>{event.startTime}</time>
              <span>{event.place?.name ?? '장소 미상'} · {event.activity?.name ?? '활동 미상'}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function DiaryDetailPage() {
  const { diaryId } = useParams();
  const navigate = useNavigate();
  const { diary, setDiary, timeline, timelineLoading, status, retry } = useDiaryDetail(diaryId);
  const onDiarySaved = useCallback((savedDiary: NonNullable<typeof diary>) => setDiary(savedDiary), [setDiary]);
  const onDiaryDeleted = useCallback(() => navigate('/history', { replace: true }), [navigate]);
  const editor = useDiaryEditor(diary, onDiarySaved, onDiaryDeleted);

  if (status === 'loading') {
    return <section className="diary-detail-state" role="status" aria-live="polite"><span className="timeline-state__spinner" aria-hidden="true" /><p>일기를 불러오는 중입니다.</p></section>;
  }

  if (status === 'notFound') {
    return (
      <section className="diary-detail-state" aria-labelledby="diary-not-found-title">
        <p className="page-eyebrow">HISTORY</p>
        <h1 id="diary-not-found-title">일기를 찾을 수 없습니다.</h1>
        <p>삭제되었거나 존재하지 않는 기록입니다.</p>
        <Link className="diary-detail__back" to="/history">지난 기록으로 돌아가기</Link>
      </section>
    );
  }

  if (status === 'error' || !diary) {
    return (
      <section className="diary-detail-state" aria-labelledby="diary-load-error-title">
        <p className="page-eyebrow">HISTORY</p>
        <h1 id="diary-load-error-title">일기를 불러오지 못했습니다.</h1>
        <div className="diary-detail__actions">
          <button className="diary-detail__back" onClick={retry} type="button">다시 시도</button>
          <Link className="diary-detail__back diary-detail__back--quiet" to="/history">지난 기록으로 돌아가기</Link>
        </div>
      </section>
    );
  }

  return (
    <article className="diary-detail" aria-labelledby="diary-detail-title">
      <Link className="diary-detail__back-link" to="/history">← 지난 기록</Link>
      <header className="diary-detail__header">
        <p className="page-eyebrow">DIARY</p>
        <time dateTime={diary.date}>{formatKoreanDateWithYear(diary.date)}</time>
        <h1 id="diary-detail-title">오늘의 일기</h1>
      </header>

      {editor.isEditing ? (
        <DiaryEditor
          diary={diary}
          content={editor.draftContent}
          isSaving={editor.isSaving}
          saveError={editor.saveError}
          validationError={editor.validationError}
          onChange={editor.updateDraft}
          onCancel={editor.cancelEditing}
          onSave={() => { void editor.save(); }}
        />
      ) : (
        <>
          <section className="diary-detail__content" aria-label="일기 본문">
            {diary.content.split(/\n\s*\n/).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}
          </section>

          {(diary.emotion || (diary.keywords?.length ?? 0) > 0 || (diary.places?.length ?? 0) > 0) && (
            <section className="diary-detail__metadata" aria-label="일기 정보">
              {diary.emotion && <span>{diary.emotion}</span>}
              {diary.keywords?.map((keyword) => <span key={keyword}>#{keyword}</span>)}
              {diary.places?.map((place) => <span key={place.id}>{place.name}</span>)}
            </section>
          )}

          <DiaryTimelineSummary events={timeline} loading={timelineLoading} />

          <dl className="diary-detail__timestamps">
            <div><dt>작성</dt><dd><time dateTime={diary.createdAt}>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(diary.createdAt))}</time></dd></div>
            <div><dt>수정</dt><dd><time dateTime={diary.updatedAt}>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(diary.updatedAt))}</time></dd></div>
          </dl>

          <footer className="diary-detail__actions" aria-label="일기 관리">
            <button className="diary-detail__edit" onClick={editor.startEditing} type="button">일기 수정</button>
            <button className="diary-detail__delete" onClick={editor.requestDelete} type="button">일기 삭제</button>
          </footer>
          {editor.saveNotice && <p className="diary-preview__notice" role="status">{editor.saveNotice}</p>}
        </>
      )}

      {editor.isDeleteDialogOpen && (
        <DiaryDeleteDialog
          isDeleting={editor.isDeleting}
          error={editor.deleteError}
          onCancel={editor.cancelDelete}
          onConfirm={() => { void editor.confirmDelete(); }}
        />
      )}
    </article>
  );
}
