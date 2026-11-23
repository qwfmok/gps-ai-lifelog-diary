export interface TimelineApiItem {
  id: string;
  latitude: number;
  longitude: number;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  point_count: number;
  address: string | null;
}

export interface TimelineApiNote {
  id: string;
  anchor_location_id: string;
  stay_started_at: string;
  stay_ended_at: string;
  note: string;
  created_at: string;
}
