import type { Diary } from '../../types';

export interface DiaryService {
  getDiaries(): Promise<Diary[]>;
  getDiary(id: string): Promise<Diary | null>;
  createDiary(diary: Pick<Diary, 'date' | 'content'>): Promise<Diary>;
  updateDiary(id: string, content: string): Promise<Diary>;
  deleteDiary(id: string): Promise<void>;
  deleteAllDiaries(): Promise<void>;
}
