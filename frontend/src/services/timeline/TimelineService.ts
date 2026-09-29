import type { Activity, TimelineEvent } from '../../types';

export interface TimelineService {
  getTimeline(date: string): Promise<TimelineEvent[]>;
  updateActivity(eventId: string, activity: Activity): Promise<TimelineEvent>;
  addNote(eventId: string, note: string): Promise<TimelineEvent>;
  confirmEvent(eventId: string): Promise<TimelineEvent>;
  deleteAllEvents(): Promise<void>;
}
