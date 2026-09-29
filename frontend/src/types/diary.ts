import type { Place } from './location';

export type DiaryGenerationStatus = 'IDLE' | 'GENERATING' | 'GENERATED' | 'ERROR';

export interface Diary {
  id: string;
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  emotion?: string;
  keywords?: string[];
  places?: Place[];
}
