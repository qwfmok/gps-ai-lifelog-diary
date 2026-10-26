export type LocationPermissionStatus =
  | 'UNKNOWN'
  | 'GRANTED'
  | 'DENIED'
  | 'UNAVAILABLE';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracy?: number;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude?: number;
  longitude?: number;
}
