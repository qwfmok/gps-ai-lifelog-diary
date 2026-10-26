import type { Activity } from './activity';
import type { Place } from './location';

export type TimelineEventStatus =
  | 'CONFIRMED'
  | 'INFERRED'
  | 'UNCERTAIN'
  | 'EMPTY';

export interface TimelineEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  place: Place | null;
  placeCategory: string | null;
  activity: Activity | null;
  confidence: number | null;
  status: TimelineEventStatus;
  userConfirmed: boolean;
  note: string | null;
  emotion: string | null;
}
