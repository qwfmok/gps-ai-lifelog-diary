import { useCallback, useEffect, useRef, useState } from 'react';
import { services } from '../services';
import { useLocation } from './useLocation';

export type SettingsDeleteAction = 'location' | 'diaries' | 'all';

export function useSettings() {
  const location = useLocation();
  const [diaryCount, setDiaryCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAction, setDeleteAction] = useState<SettingsDeleteAction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isDeletingRef = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const diaries = await services.diary.getDiaries();
      setDiaryCount(diaries.length);
    } catch {
      setError('설정 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggleTracking = useCallback(async () => {
    if (!location.trackingEnabled && location.permissionStatus !== 'GRANTED') return false;
    setError(null);
    setMessage(null);
    await location.toggleTracking();
    return true;
  }, [location.permissionStatus, location.toggleTracking, location.trackingEnabled]);

  const requestDelete = useCallback((action: SettingsDeleteAction) => {
    setDeleteAction(action);
    setDeleteError(null);
    setMessage(null);
    setError(null);
  }, []);

  const cancelDelete = useCallback(() => {
    if (isDeletingRef.current) return;
    setDeleteAction(null);
    setDeleteError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteAction || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    setError(null);
    setMessage(null);
    try {
      if (deleteAction === 'location' || deleteAction === 'all') {
        await location.clearLocationHistory();
      }
      if (deleteAction === 'diaries' || deleteAction === 'all') {
        await services.diary.deleteAllDiaries();
        setDiaryCount(0);
      }
      if (deleteAction === 'all') await services.voice.clearRecord();

      setMessage(
        deleteAction === 'location' ? '위치 기록이 삭제되었습니다.'
          : deleteAction === 'diaries' ? '저장된 일기가 삭제되었습니다.'
            : '전체 데이터가 삭제되었습니다.',
      );
      setDeleteAction(null);
    } catch {
      setDeleteError('데이터를 삭제하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  }, [deleteAction, location.clearLocationHistory]);

  return {
    trackingEnabled: location.trackingEnabled,
    isUpdatingTracking: location.isUpdatingTracking,
    currentPosition: location.currentPosition,
    locationStatus: location.locationStatus,
    isGettingPosition: location.isGettingPosition,
    locationError: location.locationError,
    requestCurrentPosition: location.requestCurrentPosition,
    permissionStatus: location.permissionStatus,
    isCheckingPermission: location.isCheckingPermission,
    isRequestingPermission: location.isRequestingPermission,
    permissionError: location.permissionError,
    refreshPermissionStatus: location.refreshPermissionStatus,
    requestPermission: location.requestPermission,
    diaryCount,
    isLoading,
    isDeleting,
    deleteAction,
    deleteError,
    error,
    message,
    refresh,
    toggleTracking,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
