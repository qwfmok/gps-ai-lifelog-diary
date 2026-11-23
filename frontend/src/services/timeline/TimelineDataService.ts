import type { TimelineEvent } from '../../types';

export interface TimelineDataService {
  getTimelineByDate(date: string): Promise<TimelineEvent[]>;
  addNote(date: string, eventId: string, note: string): Promise<TimelineEvent>;
}
