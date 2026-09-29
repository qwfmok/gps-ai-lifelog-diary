import type { Diary } from '../../types';

export interface DiaryService {
  generateDiary(date: string): Promise<Diary>;
  getDiaries(): Promise<Diary[]>;
  getDiary(id: string): Promise<Diary | null>;
  saveDiary(diary: Diary): Promise<Diary>;
  updateDiary(id: string, content: string): Promise<Diary>;
  deleteDiary(id: string): Promise<void>;
  deleteAllDiaries(): Promise<void>;
}
