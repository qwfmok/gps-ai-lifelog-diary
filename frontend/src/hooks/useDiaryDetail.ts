import { useCallback, useEffect, useState } from 'react';
import { services } from '../services';
import type { Diary, TimelineEvent } from '../types';

type DiaryDetailStatus = 'loading' | 'success' | 'notFound' | 'error';

export function useDiaryDetail(diaryId: string | undefined) {
  const [diary, setDiary] = useState<Diary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [status, setStatus] = useState<DiaryDetailStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setDiary(null);
    setTimeline([]);
    setStatus('loading');
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
    }).catch(() => {
      if (!active) return;
      setStatus('error');
      setTimelineLoading(false);
    });

    return () => { active = false; };
  }, [attempt, diaryId]);

  return { diary, setDiary, timeline, timelineLoading, status, retry };
}
