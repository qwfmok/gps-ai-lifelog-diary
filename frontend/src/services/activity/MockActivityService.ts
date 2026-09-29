import type { Activity, TimelineEvent } from '../../types';
import { MOCK_ACTIVITY_CANDIDATES } from '../../mocks';
import type { TimelineService } from '../timeline/TimelineService';
import type { ActivityService } from './ActivityService';

export class MockActivityService implements ActivityService {
  constructor(private readonly timelineService: TimelineService) {}

  async getActivityCandidates(eventId: string): Promise<Activity[]> {
    return (MOCK_ACTIVITY_CANDIDATES[eventId] ?? []).map((activity) =>
      structuredClone(activity),
    );
  }

  async confirmActivity(eventId: string, activity: Activity): Promise<TimelineEvent> {
    await this.timelineService.updateActivity(eventId, activity);
    return this.timelineService.confirmEvent(eventId);
  }

  async updateActivity(eventId: string, activity: Activity): Promise<TimelineEvent> {
    return this.timelineService.updateActivity(eventId, activity);
  }
}
