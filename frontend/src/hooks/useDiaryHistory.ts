import { useCallback, useEffect, useState } from 'react';
import { services } from '../services';
import type { Diary } from '../types';

type DiaryHistoryStatus = 'loading' | 'success' | 'empty' | 'error';

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
      .catch(() => {
        if (!isCurrentRequest) return;
        setState({
          diaries: [],
          status: 'error',
          error: '지난 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [attempt]);

  return { ...state, retry };
}
