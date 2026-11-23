import { useCallback, useEffect, useState } from 'react';
import { services } from '../services';
import type { Diary, TimelineEvent } from '../types';
import { DiaryServiceError } from '../services/diary/DiaryApiService';

type DiaryDetailStatus = 'loading' | 'success' | 'notFound' | 'auth-required' | 'configuration-error' | 'error';

export function useDiaryDetail(diaryId: string | undefined) {
  const [diary, setDiary] = useState<Diary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [status, setStatus] = useState<DiaryDetailStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setDiary(null);
    setTimeline([]);
    setStatus('loading');
    setError(null);
    setTimelineLoading(true);

    if (!diaryId) {
      setStatus('notFound');
      setTimelineLoading(false);
      return () => { active = false; };
    }

    services.diary.getDiary(diaryId).then((result) => {
      if (!active) return;
      if (!result) {
        setStatus('notFound');
        setTimelineLoading(false);
        return;
      }
      setDiary(result);
      setStatus('success');
      return services.timeline.getTimeline(result.date)
        .then((events) => { if (active) setTimeline(events); })
        .catch(() => { if (active) setTimeline([]); })
        .finally(() => { if (active) setTimelineLoading(false); });
    }).catch((loadError) => {
      if (!active) return;
      setStatus(getDetailErrorStatus(loadError));
      setError(loadError instanceof DiaryServiceError
        ? loadError.message
        : '일기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setTimelineLoading(false);
    });

    return () => { active = false; };
  }, [attempt, diaryId]);

  return { diary, setDiary, timeline, timelineLoading, status, error, retry };
}

function getDetailErrorStatus(error: unknown): DiaryDetailStatus {
  if (!(error instanceof DiaryServiceError)) return 'error';
  if (error.kind === 'AUTH_REQUIRED' || error.kind === 'AUTH_FORBIDDEN') return 'auth-required';
  if (error.kind === 'AUTH_CONFIGURATION' || error.kind === 'BACKEND_CONFIGURATION' || error.kind === 'INSECURE_TRANSPORT') {
    return 'configuration-error';
  }
  if (error.kind === 'NOT_FOUND') return 'notFound';
  return 'error';
}
