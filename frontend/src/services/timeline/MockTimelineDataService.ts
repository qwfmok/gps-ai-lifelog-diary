import type { TimelineService } from './TimelineService';
import type { TimelineDataService } from './TimelineDataService';
import type { TimelineEvent } from '../../types';

export class MockTimelineDataService implements TimelineDataService {
  constructor(private readonly timelineService: TimelineService) {}

  getTimelineByDate(date: string): Promise<TimelineEvent[]> {
    return this.timelineService.getTimeline(date);
  }

  addNote(_date: string, eventId: string, note: string): Promise<TimelineEvent> {
    return this.timelineService.addNote(eventId, note);
  }
}
