import type { Activity, TimelineEvent } from '../../types';
import { MOCK_TIMELINE_EVENTS } from '../../mocks';
import type { TimelineService } from './TimelineService';

export class MockTimelineService implements TimelineService {
  private events = MOCK_TIMELINE_EVENTS.map((event) => structuredClone(event));

  async getTimeline(date: string): Promise<TimelineEvent[]> {
    return this.events
      .filter((event) => event.date === date)
      .sort((first, second) => first.startTime.localeCompare(second.startTime))
      .map((event) => structuredClone(event));
  }

  async updateActivity(eventId: string, activity: Activity): Promise<TimelineEvent> {
    const event = this.getEvent(eventId);
    event.activity = structuredClone(activity);
    event.confidence = activity.confidence;
    return structuredClone(event);
  }

  async addNote(eventId: string, note: string): Promise<TimelineEvent> {
    const event = this.getEvent(eventId);
    event.note = note;
    return structuredClone(event);
  }

  async confirmEvent(eventId: string): Promise<TimelineEvent> {
    const event = this.getEvent(eventId);
    event.status = 'CONFIRMED';
    event.userConfirmed = true;
    return structuredClone(event);
  }

  async deleteAllEvents(): Promise<void> {
    this.events = [];
  }

  private getEvent(eventId: string): TimelineEvent {
    const event = this.events.find((candidate) => candidate.id === eventId);

    if (!event) {
      throw new Error(`Timeline event not found: ${eventId}`);
    }

    return event;
  }
}
