import type { LocationPermissionStatus, LocationPoint } from '../../types';
import type { LocationServiceError } from './LocationServiceError';

export type LocationUpdateListener = (point: LocationPoint) => void;
export type LocationErrorListener = (error: LocationServiceError) => void;

export interface LocationService {
  requestPermission(): Promise<LocationPermissionStatus>;
  getPermissionStatus(): Promise<LocationPermissionStatus>;
  getTrackingStatus(): Promise<boolean>;
  getCurrentPosition(): Promise<LocationPoint>;
  startTracking(onUpdate: LocationUpdateListener, onError: LocationErrorListener): Promise<void>;
  stopTracking(): Promise<void>;
  getLocationHistory(): Promise<LocationPoint[]>;
  deleteLocationHistory(): Promise<void>;
}
