import type { TimelineEvent } from '../../types';

interface DailyTimelineSummaryProps {
  events: TimelineEvent[];
}

export default function DailyTimelineSummary({ events }: DailyTimelineSummaryProps) {
  const confirmedCount = events.filter((event) => event.status === 'CONFIRMED').length;
  const inferredCount = events.filter((event) => event.status === 'INFERRED').length;
  const needsConfirmationCount = events.filter(
    (event) => event.status === 'UNCERTAIN' || event.status === 'EMPTY',
  ).length;

  const summaryItems = [
    { label: '오늘 기록', count: events.length, tone: 'total' },
    { label: '확인됨', count: confirmedCount, tone: 'confirmed' },
    { label: '자동 추론', count: inferredCount, tone: 'inferred' },
    { label: '확인 필요', count: needsConfirmationCount, tone: 'uncertain' },
  ];

  return (
    <dl className="daily-summary" aria-label="오늘의 기록 요약">
      {summaryItems.map(({ label, count, tone }) => (
        <div className={`daily-summary__item daily-summary__item--${tone}`} key={label}>
          <dt>{label}</dt>
          <dd>{count}<span>개</span></dd>
        </div>
      ))}
    </dl>
  );
}
