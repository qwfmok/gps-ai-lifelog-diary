import type { Activity } from '../types';

export const MOCK_ACTIVITY_CANDIDATES: Readonly<Record<string, readonly Activity[]>> = {
  'event-cafe': [
    {
      id: 'candidate-study',
      name: '공부',
      category: '학업',
      source: 'MOCK',
      confidence: 0.72,
    },
    {
      id: 'candidate-meeting',
      name: '친구 만남',
      category: '교류',
      source: 'MOCK',
      confidence: 0.68,
    },
    {
      id: 'candidate-rest',
      name: '휴식',
      category: '개인',
      source: 'MOCK',
      confidence: 0.61,
    },
    {
      id: 'candidate-work',
      name: '업무',
      category: '업무',
      source: 'MOCK',
      confidence: 0.54,
    },
  ],
};
