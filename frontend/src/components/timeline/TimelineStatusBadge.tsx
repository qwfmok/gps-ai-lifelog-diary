import type { TimelineEventStatus } from '../../types';

interface TimelineStatusBadgeProps {
  status: TimelineEventStatus;
}

const statusLabels: Record<TimelineEventStatus, string> = {
  CONFIRMED: '확인됨',
  INFERRED: '자동 추론',
  UNCERTAIN: '확인 필요',
  EMPTY: '기록 없음',
};

export default function TimelineStatusBadge({ status }: TimelineStatusBadgeProps) {
  return (
    <span className={`timeline-status timeline-status--${status.toLowerCase()}`}>
      <span className="timeline-status__dot" aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
