import type { TimelineEvent } from '../../types';
import TimelineStatusBadge from './TimelineStatusBadge';

interface TimelineItemProps {
  event: TimelineEvent;
  onConfirmActivity: (event: TimelineEvent) => void;
  onAddMemory: (event: TimelineEvent) => void;
}

export default function TimelineItem({ event, onConfirmActivity, onAddMemory }: TimelineItemProps) {
  const needsConfirmation = event.status === 'UNCERTAIN' || event.status === 'EMPTY';
  const activityName =
    event.activity?.name && event.activity.name !== 'UNKNOWN'
      ? event.activity.name
      : event.status === 'EMPTY'
        ? '활동 정보가 없습니다'
        : '행동 확인 필요';
  const placeName = event.place?.name ?? '장소 정보 없음';
  const placeCategory = event.placeCategory ?? event.place?.category;

  return (
    <li className={`timeline-item timeline-item--${event.status.toLowerCase()}`}>
      <div
        className="timeline-time"
        role="group"
        aria-label={`${event.startTime}부터 ${event.endTime}까지`}
      >
        <time dateTime={`${event.date}T${event.startTime}`}>{event.startTime}</time>
        <span aria-hidden="true">–</span>
        <time dateTime={`${event.date}T${event.endTime}`}>{event.endTime}</time>
      </div>

      <span className="timeline-marker" aria-hidden="true" />

      <article
        className="timeline-card"
        aria-label={`${placeName}, ${activityName}`}
        data-timeline-event={event.id}
        data-timeline-status={event.status}
        tabIndex={-1}
      >
        <div className="timeline-card__topline">
          <div className="timeline-place">
            <h3>{placeName}</h3>
            {placeCategory && <span className="timeline-place__category">{placeCategory}</span>}
          </div>
          <TimelineStatusBadge status={event.status} />
        </div>

        <p className="timeline-activity">{activityName}</p>

        {event.confidence !== null && (
          <p className="timeline-confidence">
            신뢰도 {Math.round(event.confidence * 100)}%
          </p>
        )}

        {event.note && (
          <section className="timeline-memory" aria-label="추가한 기억">
            <span className="timeline-memory__label">기억</span>
            <p>{event.note}</p>
          </section>
        )}

        {needsConfirmation && (
          <p className="timeline-confirmation-hint">
            {event.status === 'EMPTY'
              ? '이 시간의 기록을 확인해 주세요.'
              : '이 시간의 활동을 확인해 주세요.'}
          </p>
        )}

        <div className="timeline-card__actions">
          {event.status === 'UNCERTAIN' && (
            <button
              className="timeline-confirm-button"
              onClick={() => onConfirmActivity(event)}
              type="button"
              aria-haspopup="dialog"
            >
              활동 확인하기
            </button>
          )}
          <button
            className="timeline-memory-button"
            onClick={() => onAddMemory(event)}
            type="button"
            aria-haspopup="dialog"
          >
            {event.note ? '기억 수정' : '기억 추가'}
          </button>
        </div>
      </article>
    </li>
  );
}
