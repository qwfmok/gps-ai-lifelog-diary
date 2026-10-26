import type { Diary } from '../types';

export const MOCK_DIARIES: readonly Diary[] = [
  {
    id: 'diary-2026-09-22',
    date: '2026-09-22',
    content: '수업을 듣고 도서관에서 과제를 하며 하루를 보냈다.',
    createdAt: '2026-09-22T20:15:00.000Z',
    updatedAt: '2026-09-22T20:15:00.000Z',
    emotion: '차분함',
    keywords: ['수업', '과제'],
  },
];

export const MOCK_GENERATED_DIARY_CONTENT =
  '오전에는 학교에서 수업을 들었다. 점심에는 학생식당에서 식사를 하고, 오후에는 카페에서 시간을 보냈다. 저녁에는 도서관에서 공부하며 하루를 마무리했다.';

export const MOCK_GENERATED_DIARY_WITH_NOTES =
  '오전에는 학교에서 수업을 들었다. 점심에는 학생식당에서 식사를 하고, 오후에는 카페에서 시간을 보냈다. 저녁에는 도서관에서 공부하며 하루를 마무리했다. 오늘의 기록에 남긴 기억도 함께 떠올려 본다. {{notes}}';
