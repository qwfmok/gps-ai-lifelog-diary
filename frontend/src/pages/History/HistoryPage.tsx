import { Link } from 'react-router';
import DiaryHistoryCard from '../../components/diary/DiaryHistoryCard';
import { useDiaryHistory } from '../../hooks/useDiaryHistory';

export default function HistoryPage() {
  const { diaries, status, error, retry } = useDiaryHistory();

  return (
    <div className="history-page">
      <header className="page-intro" aria-labelledby="page-title">
        <p className="page-eyebrow">HISTORY</p>
        <h1 id="page-title">지난 기록</h1>
        <p className="page-description">기록해 둔 하루를 다시 돌아보세요.</p>
      </header>

      <section className="diary-history" aria-labelledby="diary-history-title">
        <div className="diary-history__heading">
          <h2 id="diary-history-title">저장한 일기</h2>
          {status === 'success' && <span>{diaries.length}편</span>}
        </div>

        {status === 'loading' && (
          <div className="diary-history__state" role="status" aria-live="polite">
            <span className="timeline-state__spinner" aria-hidden="true" />
            <p>지난 기록을 불러오는 중입니다.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="diary-history__state diary-history__state--error">
            <p role="alert">{error ?? '지난 기록을 불러오지 못했습니다.'}</p>
            <button className="timeline-retry-button" onClick={retry} type="button">
              다시 시도
            </button>
          </div>
        )}

        {status === 'empty' && (
          <div className="diary-history__state diary-history__state--empty">
            <span className="diary-history__empty-mark" aria-hidden="true">日</span>
            <h3>아직 저장된 일기가 없습니다.</h3>
            <p>오늘의 하루를 기록하면 지난 기록에서 다시 볼 수 있습니다.</p>
            <Link className="diary-history__today-link" to="/">
              오늘 기록하러 가기
            </Link>
          </div>
        )}

        {status === 'success' && (
          <ul className="diary-history-list" aria-label="날짜별 저장된 일기">
            {diaries.map((diary) => <DiaryHistoryCard diary={diary} key={diary.id} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
