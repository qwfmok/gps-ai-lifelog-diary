import { useCallback, useEffect, useRef, useState } from 'react';
import { services } from '../services';
import type { Diary, DiaryGenerationStatus } from '../types';

interface DiaryGenerationState {
  status: DiaryGenerationStatus;
  diary: Diary | null;
  error: string | null;
}

interface UseDiaryGenerationResult extends DiaryGenerationState {
  generate: () => Promise<void>;
  retry: () => Promise<void>;
  replaceDiary: (diary: Diary) => void;
  reset: () => void;
}

export function useDiaryGeneration(date: string): UseDiaryGenerationResult {
  const [state, setState] = useState<DiaryGenerationState>({
    status: 'IDLE',
    diary: null,
    error: null,
  });
  const statusRef = useRef<DiaryGenerationStatus>('IDLE');
  const requestIdRef = useRef(0);
  const currentDateRef = useRef(date);

  const generate = useCallback(async () => {
    if (statusRef.current === 'GENERATING') return;

    const requestId = ++requestIdRef.current;
    statusRef.current = 'GENERATING';
    setState((currentState) => ({ ...currentState, status: 'GENERATING', error: null }));

    try {
      const diary = await services.diary.generateDiary(date);
      if (requestId !== requestIdRef.current) return;

      statusRef.current = 'GENERATED';
      setState({ status: 'GENERATED', diary, error: null });
    } catch {
      if (requestId !== requestIdRef.current) return;

      statusRef.current = 'ERROR';
      setState((currentState) => ({
        ...currentState,
        status: 'ERROR',
        error: '일기를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      }));
    }
  }, [date]);

  const retry = useCallback(() => generate(), [generate]);

  const replaceDiary = useCallback((diary: Diary) => {
    statusRef.current = 'GENERATED';
    setState({ status: 'GENERATED', diary, error: null });
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    statusRef.current = 'IDLE';
    setState({ status: 'IDLE', diary: null, error: null });
  }, []);

  useEffect(() => {
    if (currentDateRef.current !== date) {
      currentDateRef.current = date;
      requestIdRef.current += 1;
      statusRef.current = 'IDLE';
      setState({ status: 'IDLE', diary: null, error: null });
    }

    return () => {
      requestIdRef.current += 1;
    };
  }, [date]);

  return { ...state, generate, retry, replaceDiary, reset };
}
