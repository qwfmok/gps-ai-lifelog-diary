import type { LocationPermissionStatus, LocationPoint } from '../../types';
import { MOCK_LOCATION_POINT } from '../../mocks';
import type { LocationErrorListener, LocationService, LocationUpdateListener } from './LocationService';
import type { TimelineService } from '../timeline/TimelineService';

export class MockLocationService implements LocationService {
  private permissionStatus: LocationPermissionStatus = 'UNKNOWN';
  private trackingEnabled = false;
  private locationHistory: LocationPoint[] = [];

  constructor(private readonly timelineService: TimelineService) {}

  async requestPermission(): Promise<LocationPermissionStatus> {
    this.permissionStatus = 'GRANTED';
    return this.permissionStatus;
  }

  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    return this.permissionStatus;
  }

  async getTrackingStatus(): Promise<boolean> {
    return this.trackingEnabled;
  }

  async getCurrentPosition(): Promise<LocationPoint> {
    const point = structuredClone(MOCK_LOCATION_POINT);
    this.locationHistory.push(point);
    return point;
  }

  async startTracking(onUpdate: LocationUpdateListener, _onError: LocationErrorListener): Promise<void> {
    void _onError;
    this.trackingEnabled = true;
    const point = structuredClone(MOCK_LOCATION_POINT);
    this.locationHistory.push(point);
    onUpdate(point);
  }

  async stopTracking(): Promise<void> {
    this.trackingEnabled = false;
  }

  async getLocationHistory(): Promise<LocationPoint[]> {
    return structuredClone(this.locationHistory);
  }

  async deleteLocationHistory(): Promise<void> {
    this.locationHistory = [];
    await this.timelineService.deleteAllEvents();
  }
}
