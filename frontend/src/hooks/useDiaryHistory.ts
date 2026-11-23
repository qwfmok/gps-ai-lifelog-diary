import { useCallback, useEffect, useState } from 'react';
import { services } from '../services';
import type { Diary } from '../types';
import { DiaryServiceError } from '../services/diary/DiaryApiService';

type DiaryHistoryStatus = 'loading' | 'success' | 'empty' | 'auth-required' | 'configuration-error' | 'error';

interface DiaryHistoryState {
  diaries: Diary[];
  status: DiaryHistoryStatus;
  error: string | null;
}

interface UseDiaryHistoryResult extends DiaryHistoryState {
  retry: () => void;
}

export function useDiaryHistory(): UseDiaryHistoryResult {
  const [state, setState] = useState<DiaryHistoryState>({
    diaries: [],
    status: 'loading',
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;
    setState({ diaries: [], status: 'loading', error: null });

    services.diary
      .getDiaries()
      .then((diaries) => {
        if (!isCurrentRequest) return;
        setState({
          diaries,
          status: diaries.length > 0 ? 'success' : 'empty',
          error: null,
        });
      })
      .catch((loadError) => {
        if (!isCurrentRequest) return;
        const status = getHistoryErrorStatus(loadError);
        setState({
          diaries: [],
          status,
          error: loadError instanceof DiaryServiceError
            ? loadError.message
            : '지난 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [attempt]);

  return { ...state, retry };
}

function getHistoryErrorStatus(error: unknown): DiaryHistoryStatus {
  if (!(error instanceof DiaryServiceError)) return 'error';
  if (error.kind === 'AUTH_REQUIRED' || error.kind === 'AUTH_FORBIDDEN') return 'auth-required';
  if (error.kind === 'AUTH_CONFIGURATION' || error.kind === 'BACKEND_CONFIGURATION' || error.kind === 'INSECURE_TRANSPORT') {
    return 'configuration-error';
  }
  return 'error';
}
