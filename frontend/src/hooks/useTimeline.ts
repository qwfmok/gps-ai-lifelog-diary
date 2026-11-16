import { useCallback, useEffect, useState } from 'react';
import type { Activity, TimelineEvent, TimelineLoadStatus } from '../types';
import { services } from '../services';
import { TimelineApiError } from '../services/timeline/TimelineApiService';

interface TimelineState {
  status: TimelineLoadStatus;
  events: TimelineEvent[];
  error: string | null;
}

interface UseTimelineResult extends TimelineState {
  retry: () => void;
  confirmActivity: (eventId: string, activity: Activity) => Promise<TimelineEvent>;
  addNote: (eventId: string, note: string) => Promise<TimelineEvent>;
}

export function useTimeline(date: string): UseTimelineResult {
  const [state, setState] = useState<TimelineState>({
    status: 'loading',
    events: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  const confirmActivity = useCallback(async (eventId: string, activity: Activity) => {
    const updatedEvent = await services.activity.confirmActivity(eventId, activity);

    setState((currentState) => ({
      ...currentState,
      status: 'success',
      events: currentState.events.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
      error: null,
    }));

    return updatedEvent;
  }, []);

  const addNote = useCallback(async (eventId: string, note: string) => {
    const updatedEvent = await services.timelineData.addNote(date, eventId, note);

    setState((currentState) => ({
      ...currentState,
      status: 'success',
      events: currentState.events.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
      error: null,
    }));

    return updatedEvent;
  }, [date]);

  useEffect(() => {
    let isCurrentRequest = true;

    setState({ status: 'loading', events: [], error: null });

    services.timelineData
      .getTimelineByDate(date)
      .then((events) => {
        if (!isCurrentRequest) return;

        setState({
          status: events.length > 0 ? 'success' : 'empty',
          events,
          error: null,
        });
      })
      .catch((loadError: unknown) => {
        if (!isCurrentRequest) return;

        const failure = getTimelineFailure(loadError);
        setState({
          status: failure.status,
          events: [],
          error: failure.message,
        });
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [attempt, date]);

  return { ...state, retry, confirmActivity, addNote };
}

function getTimelineFailure(error: unknown): { status: Exclude<TimelineLoadStatus, 'loading' | 'success' | 'empty'>; message: string } {
  if (!(error instanceof TimelineApiError)) {
    return { status: 'error', message: '오늘의 기록을 불러오지 못했습니다. 다시 시도해 주세요.' };
  }

  if (error.kind === 'AUTH_REQUIRED') return { status: 'auth-required', message: error.message };
  if (error.kind === 'AUTH_CONFIGURATION' || error.kind === 'BACKEND_CONFIGURATION'
    || error.kind === 'INSECURE_TRANSPORT') {
    return { status: 'configuration-error', message: error.message };
  }
  return { status: 'error', message: error.message };
}
