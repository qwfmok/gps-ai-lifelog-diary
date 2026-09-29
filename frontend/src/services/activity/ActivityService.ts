import type { Activity, TimelineEvent } from '../../types';

export interface ActivityService {
  getActivityCandidates(eventId: string): Promise<Activity[]>;
  confirmActivity(eventId: string, activity: Activity): Promise<TimelineEvent>;
  updateActivity(eventId: string, activity: Activity): Promise<TimelineEvent>;
}
