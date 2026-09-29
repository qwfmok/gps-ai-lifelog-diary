import { useCallback, useEffect, useRef, useState } from 'react';
import { services } from '../services';
import type { LocationPermissionStatus } from '../types';

export function useLocationPermission() {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('UNKNOWN');
  const [isChecking, setIsChecking] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInProgress = useRef(false);

  const refreshPermissionStatus = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    try {
      const status = await services.location.getPermissionStatus();
      setPermissionStatus(status);
      return status;
    } catch {
      setError('위치 권한 상태를 확인하지 못했습니다. 다시 시도해 주세요.');
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => { void refreshPermissionStatus(); }, [refreshPermissionStatus]);

  const requestPermission = useCallback(async () => {
    if (requestInProgress.current) return null;
    requestInProgress.current = true;
    setIsRequesting(true);
    setError(null);
    try {
      const status = await services.location.requestPermission();
      setPermissionStatus(status);
      return status;
    } catch {
      setError('위치 권한 상태를 확인하지 못했습니다. 다시 시도해 주세요.');
      return null;
    } finally {
      requestInProgress.current = false;
      setIsRequesting(false);
    }
  }, []);

  return {
    permissionStatus,
    isChecking,
    isRequesting,
    error,
    refreshPermissionStatus,
    requestPermission,
  };
}
