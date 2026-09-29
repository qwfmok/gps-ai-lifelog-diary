import { useCallback, useEffect, useState } from 'react';
import type { Activity } from '../types';
import { services } from '../services';

type CandidateLoadStatus = 'loading' | 'success' | 'empty' | 'error';

interface CandidateState {
  status: CandidateLoadStatus;
  candidates: Activity[];
}

interface UseActivityCandidatesResult extends CandidateState {
  retry: () => void;
}

export function useActivityCandidates(eventId: string): UseActivityCandidatesResult {
  const [state, setState] = useState<CandidateState>({
    status: 'loading',
    candidates: [],
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;

    setState({ status: 'loading', candidates: [] });

    services.activity
      .getActivityCandidates(eventId)
      .then((candidates) => {
        if (!isCurrentRequest) return;

        setState({
          status: candidates.length > 0 ? 'success' : 'empty',
          candidates,
        });
      })
      .catch(() => {
        if (!isCurrentRequest) return;

        setState({ status: 'error', candidates: [] });
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [attempt, eventId]);

  return { ...state, retry };
}
