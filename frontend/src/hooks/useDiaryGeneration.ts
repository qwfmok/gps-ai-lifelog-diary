import { useCallback, useEffect, useRef, useState } from 'react';
import { services } from '../services';
import type { Diary, DiaryGenerationStatus } from '../types';
import { DiaryGenerationError } from '../services/diary/DiaryGenerationApiService';
import type { DiaryGenerationResult } from '../services/diary/DiaryGenerationService';

interface DiaryGenerationState {
  status: DiaryGenerationStatus;
  diary: Diary | null;
  result: DiaryGenerationResult | null;
  error: string | null;
}

interface UseDiaryGenerationResult extends DiaryGenerationState {
  generate: (memo?: string, transcript?: string, preserveDiaryIdentity?: boolean) => Promise<void>;
  retry: () => Promise<void>;
  replaceDiary: (diary: Diary) => void;
  reset: () => void;
}

export function useDiaryGeneration(date: string): UseDiaryGenerationResult {
  const [state, setState] = useState<DiaryGenerationState>({
    status: 'IDLE',
    diary: null,
    result: null,
    error: null,
  });
  const statusRef = useRef<DiaryGenerationStatus>('IDLE');
  const requestIdRef = useRef(0);
  const currentDateRef = useRef(date);
  const lastInputRef = useRef({ memo: '', transcript: '' });

  const generate = useCallback(async (
    memo = lastInputRef.current.memo,
    transcript = lastInputRef.current.transcript,
    preserveDiaryIdentity = false,
  ) => {
    if (statusRef.current === 'GENERATING') return;
    lastInputRef.current = { memo, transcript };

    const requestId = ++requestIdRef.current;
    statusRef.current = 'GENERATING';
    setState((currentState) => ({ ...currentState, status: 'GENERATING', error: null }));

    try {
      const result = await services.diaryGeneration.generateDiaryDraft({ date, memo, transcript });
      if (requestId !== requestIdRef.current) return;

      statusRef.current = 'GENERATED';
      setState((currentState) => {
        const diary = preserveDiaryIdentity && currentState.diary
          ? {
              ...result.diary,
              id: currentState.diary.id,
              date: currentState.diary.date,
              createdAt: currentState.diary.createdAt,
              updatedAt: currentState.diary.updatedAt,
            }
          : result.diary;
        return {
          status: 'GENERATED',
          diary,
          result: { ...result, diary },
          error: null,
        };
      });
    } catch (generationError) {
      if (requestId !== requestIdRef.current) return;

      statusRef.current = 'ERROR';
      setState((currentState) => ({
        ...currentState,
        status: 'ERROR',
        error: generationError instanceof DiaryGenerationError
          ? generationError.message
          : '일기를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      }));
    }
  }, [date]);

  const retry = useCallback(() => generate(), [generate]);

  const replaceDiary = useCallback((diary: Diary) => {
    statusRef.current = 'GENERATED';
    setState((currentState) => ({
      ...currentState,
      status: 'GENERATED',
      diary,
      result: currentState.result ? { ...currentState.result, diary } : null,
      error: null,
    }));
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    statusRef.current = 'IDLE';
    setState({ status: 'IDLE', diary: null, result: null, error: null });
  }, []);

  useEffect(() => {
    if (currentDateRef.current !== date) {
      currentDateRef.current = date;
      requestIdRef.current += 1;
      statusRef.current = 'IDLE';
      setState({ status: 'IDLE', diary: null, result: null, error: null });
    }

    return () => {
      requestIdRef.current += 1;
    };
  }, [date]);

  return { ...state, generate, retry, replaceDiary, reset };
}
