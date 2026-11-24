import type { TimelineEvent, TimelineLoadStatus } from '../../types';
import TimelineItem from './TimelineItem';

interface DailyTimelineProps {
  events: TimelineEvent[];
  status: TimelineLoadStatus;
  error: string | null;
  trackingEnabled: boolean;
  onRetry: () => void;
  onConfirmActivity: (event: TimelineEvent) => void;
  onAddMemory: (event: TimelineEvent) => void;
}

export default function DailyTimeline({
  events,
  status,
  error,
  trackingEnabled,
  onRetry,
  onConfirmActivity,
  onAddMemory,
}: DailyTimelineProps) {
  if (status === 'loading') {
    return (
      <div className="timeline-state" role="status" aria-live="polite">
        <span className="timeline-state__spinner" aria-hidden="true" />
        <p>오늘의 기록을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (status === 'error' || status === 'auth-required' || status === 'configuration-error') {
    return (
      <div className="timeline-state timeline-state--error" role="alert">
        <p>{error ?? '오늘의 기록을 불러오지 못했습니다.'}</p>
        <button className="timeline-retry-button" onClick={onRetry} type="button">
          다시 시도
        </button>
      </div>
    );
  }

  if (status === 'empty' || events.length === 0) {
    return (
      <div className="timeline-state timeline-state--empty" role="status">
        <p className="timeline-state__title">
          {trackingEnabled ? '위치를 기록하고 있습니다.' : '아직 오늘의 기록이 없습니다.'}
        </p>
        <p>
          {trackingEnabled
            ? '한 장소에 약 15분 이상 머무르면 하루의 흐름에 자동으로 표시됩니다.'
            : '위치 기록을 켜고 한 장소에 약 15분 이상 머무르면 하루의 흐름에 표시됩니다.'}
        </p>
        {trackingEnabled && (
          <button className="timeline-retry-button" onClick={onRetry} type="button">하루의 흐름 다시 확인</button>
        )}
      </div>
    );
  }

  return (
    <ol className="daily-timeline" aria-label="시간순 하루 기록">
      {events.map((event) => (
        <TimelineItem
          event={event}
          key={event.id}
          onConfirmActivity={onConfirmActivity}
          onAddMemory={onAddMemory}
        />
      ))}
    </ol>
  );
}
