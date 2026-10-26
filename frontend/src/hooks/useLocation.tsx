import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { services } from '../services';
import type { LocationPoint } from '../types';
import { LocationServiceError } from '../services/location/LocationServiceError';
import { LocationApiError } from '../services/location/LocationApiService';
import { useLocationPermission } from './useLocationPermission';

export type CurrentLocationStatus = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR' | 'UNAVAILABLE';
export type LocationSaveStatus = 'IDLE' | 'SAVING' | 'SUCCESS' | 'ERROR';

interface LocationContextValue {
  permissionStatus: ReturnType<typeof useLocationPermission>['permissionStatus'];
  isCheckingPermission: boolean;
  isRequestingPermission: boolean;
  permissionError: string | null;
  refreshPermissionStatus: () => Promise<unknown>;
  requestPermission: () => Promise<ReturnType<typeof useLocationPermission>['permissionStatus'] | null>;
  currentPosition: LocationPoint | null;
  locationStatus: CurrentLocationStatus;
  trackingEnabled: boolean;
  isGettingPosition: boolean;
  isUpdatingTracking: boolean;
  locationError: string | null;
  locationSaveStatus: LocationSaveStatus;
  locationSaveError: string | null;
  lastLocationSavedAt: string | null;
  requestCurrentPosition: () => Promise<void>;
  toggleTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  clearLocationHistory: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

function presentLocationError(error: unknown): { message: string; unavailable: boolean } {
  if (error instanceof LocationServiceError) {
    if (error.code === 'PERMISSION_DENIED') return { message: '위치 사용 권한이 필요합니다.', unavailable: false };
    if (error.code === 'POSITION_UNAVAILABLE') return { message: '현재 위치를 확인할 수 없습니다.', unavailable: false };
    if (error.code === 'TIMEOUT') return { message: '위치 확인 시간이 초과되었습니다.', unavailable: false };
    if (error.code === 'UNAVAILABLE') return { message: '현재 환경에서는 위치 기능을 사용할 수 없습니다.', unavailable: true };
  }
  return { message: '현재 위치를 확인하지 못했습니다. 다시 시도해 주세요.', unavailable: false };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const permission = useLocationPermission();
  const [currentPosition, setCurrentPosition] = useState<LocationPoint | null>(null);
  const [locationStatus, setLocationStatus] = useState<CurrentLocationStatus>('IDLE');
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [isGettingPosition, setIsGettingPosition] = useState(false);
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSaveStatus, setLocationSaveStatus] = useState<LocationSaveStatus>('IDLE');
  const [locationSaveError, setLocationSaveError] = useState<string | null>(null);
  const [lastLocationSavedAt, setLastLocationSavedAt] = useState<string | null>(null);
  const trackingGeneration = useRef(0);
  const lastLocationSentAt = useRef(0);
  const positionRequestInProgress = useRef(false);
  const trackingOperationInProgress = useRef(false);

  useEffect(() => {
    let active = true;
    services.location.getTrackingStatus()
      .then((tracking) => { if (active) setTrackingEnabled(tracking); })
      .catch(() => { if (active) setTrackingEnabled(false); });
    return () => {
      active = false;
      void services.location.stopTracking().catch(() => undefined);
    };
  }, []);

  const requestCurrentPosition = useCallback(async () => {
    if (positionRequestInProgress.current) return;
    if (permission.permissionStatus !== 'GRANTED') {
      setLocationStatus(permission.permissionStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'ERROR');
      setLocationError(permission.permissionStatus === 'UNAVAILABLE'
        ? '현재 환경에서는 위치 기능을 사용할 수 없습니다.'
        : '위치 사용 권한을 먼저 허용해 주세요.');
      return;
    }

    positionRequestInProgress.current = true;
    setIsGettingPosition(true);
    setLocationStatus('LOADING');
    setLocationError(null);
    try {
      const point = await services.location.getCurrentPosition();
      setCurrentPosition(point);
      setLocationStatus('SUCCESS');
    } catch (error) {
      const result = presentLocationError(error);
      setLocationStatus(result.unavailable ? 'UNAVAILABLE' : 'ERROR');
      setLocationError(result.message);
      if (error instanceof LocationServiceError && error.code === 'PERMISSION_DENIED') {
        await permission.refreshPermissionStatus();
      }
    } finally {
      positionRequestInProgress.current = false;
      setIsGettingPosition(false);
    }
  }, [permission.permissionStatus, permission.refreshPermissionStatus]);

  const toggleTracking = useCallback(async () => {
    if (trackingOperationInProgress.current) return;
    trackingOperationInProgress.current = true;
    setIsUpdatingTracking(true);
    setLocationError(null);
    try {
      if (trackingEnabled) {
        trackingGeneration.current += 1;
        setLocationSaveStatus('IDLE');
        await services.location.stopTracking();
        setTrackingEnabled(false);
        setLocationStatus(currentPosition ? 'SUCCESS' : 'IDLE');
      } else {
        if (permission.permissionStatus !== 'GRANTED') {
          setLocationStatus(permission.permissionStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'ERROR');
          setLocationError(permission.permissionStatus === 'DENIED'
            ? '위치 권한이 허용되어야 위치 기록을 시작할 수 있습니다.'
            : permission.permissionStatus === 'UNAVAILABLE'
              ? '현재 환경에서는 위치 기록을 사용할 수 없습니다.'
              : '위치 사용 권한을 먼저 허용해 주세요.');
          return;
        }
        setLocationStatus('LOADING');
        lastLocationSentAt.current = 0;
        setLocationSaveStatus('IDLE');
        setLocationSaveError(null);
        const generation = ++trackingGeneration.current;
        await services.location.startTracking(
          (point) => {
            if (generation !== trackingGeneration.current || !isValidLocation(point)) return;
            setCurrentPosition(point);
            setLocationStatus('SUCCESS');
            setLocationError(null);
            if (Date.now() - lastLocationSentAt.current < 30_000) return;
            lastLocationSentAt.current = Date.now();
            setLocationSaveStatus('SAVING');
            setLocationSaveError(null);
            void services.locationApi.saveLocation(point).then(() => {
              if (generation !== trackingGeneration.current) return;
              setLocationSaveStatus('SUCCESS');
              setLastLocationSavedAt(new Date().toISOString());
            }).catch((error: unknown) => {
              if (generation !== trackingGeneration.current) return;
              setLocationSaveStatus('ERROR');
              setLocationSaveError(error instanceof LocationApiError && error.kind === 'VALIDATION'
                ? '서버가 위치 정보 형식을 확인해 달라고 응답했습니다.'
                : error instanceof LocationApiError && error.kind === 'SERVER'
                  ? '서버에서 위치를 저장하지 못했습니다.'
                  : error instanceof LocationApiError && error.kind === 'PROTOCOL'
                    ? '서버 응답을 확인하지 못했습니다.'
                    : '네트워크 문제로 위치를 저장하지 못했습니다. 위치 추적은 계속됩니다.');
            });
          },
          (error) => {
            const result = presentLocationError(error);
            setLocationStatus(result.unavailable ? 'UNAVAILABLE' : 'ERROR');
            setLocationError(result.message);
            setTrackingEnabled(false);
            if (error.code === 'PERMISSION_DENIED') void permission.refreshPermissionStatus();
          },
        );
        setTrackingEnabled(await services.location.getTrackingStatus());
        setLocationStatus(currentPosition ? 'SUCCESS' : 'IDLE');
      }
    } catch (error) {
      const result = presentLocationError(error);
      setLocationStatus(result.unavailable ? 'UNAVAILABLE' : 'ERROR');
      setLocationError(result.message);
      if (error instanceof LocationServiceError && error.code === 'PERMISSION_DENIED') {
        await permission.refreshPermissionStatus();
      }
    } finally {
      trackingOperationInProgress.current = false;
      setIsUpdatingTracking(false);
    }
  }, [currentPosition, permission.permissionStatus, permission.refreshPermissionStatus, trackingEnabled]);

  const stopTracking = useCallback(async () => {
    trackingGeneration.current += 1;
    setLocationSaveStatus('IDLE');
    setIsUpdatingTracking(true);
    try {
      await services.location.stopTracking();
      setTrackingEnabled(false);
      setLocationStatus(currentPosition ? 'SUCCESS' : 'IDLE');
      setLocationError(null);
    } catch {
      setLocationError('위치 기록을 중지하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsUpdatingTracking(false);
    }
  }, [currentPosition]);

  const clearLocationHistory = useCallback(async () => {
    if (trackingEnabled) await stopTracking();
    await services.location.deleteLocationHistory();
    setCurrentPosition(null);
    setLocationSaveStatus('IDLE');
    setLocationSaveError(null);
    setLastLocationSavedAt(null);
    setLocationStatus('IDLE');
    setLocationError(null);
  }, [stopTracking, trackingEnabled]);

  const value = useMemo<LocationContextValue>(() => ({
    permissionStatus: permission.permissionStatus,
    isCheckingPermission: permission.isChecking,
    isRequestingPermission: permission.isRequesting,
    permissionError: permission.error,
    refreshPermissionStatus: permission.refreshPermissionStatus,
    requestPermission: permission.requestPermission,
    currentPosition,
    locationStatus,
    trackingEnabled,
    isGettingPosition,
    isUpdatingTracking,
    locationError,
    locationSaveStatus,
    locationSaveError,
    lastLocationSavedAt,
    requestCurrentPosition,
    toggleTracking,
    stopTracking,
    clearLocationHistory,
  }), [
    currentPosition,
    clearLocationHistory,
    isGettingPosition,
    isUpdatingTracking,
    locationError,
    locationSaveStatus,
    locationSaveError,
    lastLocationSavedAt,
    locationStatus,
    permission.error,
    permission.isChecking,
    permission.isRequesting,
    permission.permissionStatus,
    permission.refreshPermissionStatus,
    permission.requestPermission,
    requestCurrentPosition,
    stopTracking,
    toggleTracking,
    trackingEnabled,
  ]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

function isValidLocation(point: LocationPoint): boolean {
  return Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
    && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180
    && Number.isFinite(Date.parse(point.recordedAt));
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used within a LocationProvider.');
  return context;
}
