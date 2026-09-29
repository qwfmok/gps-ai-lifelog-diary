import type { LocationPermissionStatus, LocationPoint } from '../../types';
import type { TimelineService } from '../timeline/TimelineService';
import { LocationServiceError, type LocationServiceErrorCode } from './LocationServiceError';
import type { LocationErrorListener, LocationService, LocationUpdateListener } from './LocationService';

const currentPositionOptions: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 30_000,
};

const trackingOptions: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 5_000,
};

export class WebLocationService implements LocationService {
  private permissionStatus: LocationPermissionStatus = 'UNKNOWN';
  private watchId: number | null = null;
  private locationHistory: LocationPoint[] = [];

  constructor(private readonly timelineService: TimelineService) {}

  async requestPermission(): Promise<LocationPermissionStatus> {
    if (!this.getGeolocation()) {
      this.permissionStatus = 'UNAVAILABLE';
      return this.permissionStatus;
    }

    try {
      // Browsers expose the geolocation prompt through a position request. The result is
      // deliberately discarded here; location display/tracking still need separate actions.
      await this.readPosition(false);
      this.permissionStatus = 'GRANTED';
    } catch (error) {
      if (error instanceof LocationServiceError && error.code === 'PERMISSION_DENIED') {
        this.permissionStatus = 'DENIED';
      } else if (error instanceof LocationServiceError && error.code === 'UNAVAILABLE') {
        this.permissionStatus = 'UNAVAILABLE';
      } else {
        const status = await this.getPermissionStatus();
        if (status !== 'GRANTED') throw error;
      }
    }
    return this.permissionStatus;
  }

  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    if (!this.getGeolocation()) {
      this.permissionStatus = 'UNAVAILABLE';
      return this.permissionStatus;
    }

    if (typeof navigator.permissions?.query !== 'function') return this.permissionStatus;
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      this.permissionStatus = result.state === 'granted'
        ? 'GRANTED'
        : result.state === 'denied'
          ? 'DENIED'
          : 'UNKNOWN';
    } catch {
      // Permission query support differs by browser; keep the last known state.
    }
    return this.permissionStatus;
  }

  async getTrackingStatus(): Promise<boolean> {
    return this.watchId !== null;
  }

  async getCurrentPosition(): Promise<LocationPoint> {
    await this.assertPermissionGranted();
    return this.readPosition(true);
  }

  async startTracking(onUpdate: LocationUpdateListener, onError: LocationErrorListener): Promise<void> {
    if (this.watchId !== null) return;
    await this.assertPermissionGranted();
    const geolocation = this.getGeolocation();
    if (!geolocation) throw new LocationServiceError('UNAVAILABLE');

    this.watchId = geolocation.watchPosition(
      (position) => onUpdate(this.toLocationPoint(position, true)),
      (error) => {
        const normalized = this.normalizeError(error);
        if (normalized.code === 'PERMISSION_DENIED') this.permissionStatus = 'DENIED';
        void this.stopTracking();
        onError(normalized);
      },
      trackingOptions,
    );
  }

  async stopTracking(): Promise<void> {
    if (this.watchId === null) return;
    const watchId = this.watchId;
    this.watchId = null;
    this.getGeolocation()?.clearWatch(watchId);
  }

  async getLocationHistory(): Promise<LocationPoint[]> {
    return structuredClone(this.locationHistory);
  }

  async deleteLocationHistory(): Promise<void> {
    await this.stopTracking();
    this.locationHistory = [];
    await this.timelineService.deleteAllEvents();
  }

  private async assertPermissionGranted(): Promise<void> {
    const status = await this.getPermissionStatus();
    if (status === 'UNAVAILABLE') throw new LocationServiceError('UNAVAILABLE');
    if (status !== 'GRANTED') throw new LocationServiceError('PERMISSION_DENIED');
  }

  private readPosition(store: boolean): Promise<LocationPoint> {
    const geolocation = this.getGeolocation();
    if (!geolocation) return Promise.reject(new LocationServiceError('UNAVAILABLE'));

    return new Promise((resolve, reject) => {
      geolocation.getCurrentPosition(
        (position) => resolve(this.toLocationPoint(position, store)),
        (error) => {
          const normalized = this.normalizeError(error);
          if (normalized.code === 'PERMISSION_DENIED') this.permissionStatus = 'DENIED';
          reject(normalized);
        },
        currentPositionOptions,
      );
    });
  }

  private toLocationPoint(position: GeolocationPosition, store: boolean): LocationPoint {
    const point: LocationPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      recordedAt: new Date(position.timestamp).toISOString(),
    };
    if (store) this.locationHistory.push(point);
    return point;
  }

  private normalizeError(error: GeolocationPositionError): LocationServiceError {
    const code: LocationServiceErrorCode = error.code === 1
      ? 'PERMISSION_DENIED'
      : error.code === 2
        ? 'POSITION_UNAVAILABLE'
        : error.code === 3
          ? 'TIMEOUT'
          : 'UNKNOWN';
    return new LocationServiceError(code);
  }

  private getGeolocation(): Geolocation | null {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return navigator.geolocation;
  }
}
