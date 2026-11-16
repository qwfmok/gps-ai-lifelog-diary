import type { TimelineEvent } from '../../types';
import type { TimelineApiItem, TimelineApiNote } from './TimelineApiTypes';

const koreanTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function mapTimelineApiItem(
  item: TimelineApiItem,
  date: string,
  notes: TimelineApiNote[],
): TimelineEvent {
  const noteText = notes
    .filter((note) => note.anchor_location_id === item.id)
    .map((note) => note.note)
    .join('\n\n');

  return {
    id: item.id,
    date,
    startTime: koreanTimeFormatter.format(new Date(item.started_at)),
    endTime: koreanTimeFormatter.format(new Date(item.ended_at)),
    place: {
      id: item.id,
      name: item.address ?? '주소 정보 없음',
      category: '',
      address: item.address ?? '',
      latitude: item.latitude,
      longitude: item.longitude,
    },
    placeCategory: null,
    activity: null,
    confidence: null,
    status: 'LOCATION',
    userConfirmed: false,
    note: noteText || null,
    emotion: null,
    durationMinutes: item.duration_minutes,
    pointCount: item.point_count,
  };
}
