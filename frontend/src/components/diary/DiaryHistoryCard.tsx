import { Link } from 'react-router';
import type { Diary } from '../../types';
import { formatKoreanDateWithYear } from '../../utils/date';

interface DiaryHistoryCardProps {
  diary: Diary;
}

export default function DiaryHistoryCard({ diary }: DiaryHistoryCardProps) {
  return (
    <li className="diary-history-list__item">
      <Link className="diary-history-card" to={`/history/${encodeURIComponent(diary.id)}`}>
        <div className="diary-history-card__header">
          <time className="diary-history-card__date" dateTime={diary.date}>
            {formatKoreanDateWithYear(diary.date)}
          </time>
          <span className="diary-history-card__saved">저장된 일기</span>
        </div>
        <p className="diary-history-card__preview">{diary.content}</p>
        {(diary.emotion || (diary.keywords && diary.keywords.length > 0)) && (
          <div className="diary-history-card__metadata" aria-label="일기 정보">
            {diary.emotion && <span>{diary.emotion}</span>}
            {diary.keywords?.slice(0, 3).map((keyword) => (
              <span key={keyword}>#{keyword}</span>
            ))}
          </div>
        )}
        <span className="diary-history-card__link-label">
          기록 보기 <span aria-hidden="true">→</span>
        </span>
      </Link>
    </li>
  );
}
