import type { Diary } from '../../types';
import {
  MOCK_DIARIES,
  MOCK_GENERATED_DIARY_CONTENT,
  MOCK_GENERATED_DIARY_WITH_NOTES,
} from '../../mocks';
import type { DiaryService } from './DiaryService';
import type { TimelineService } from '../timeline/TimelineService';

export class MockDiaryService implements DiaryService {
  private diaries = MOCK_DIARIES.map((diary) => structuredClone(diary));
  private generatedDrafts = new Map<string, string>();

  constructor(private readonly timelineService: TimelineService) {}

  async generateDiary(date: string): Promise<Diary> {
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const now = new Date().toISOString();
    const timeline = await this.timelineService.getTimeline(date);
    const notes = timeline
      .map((event) => event.note?.trim())
      .filter((note): note is string => Boolean(note));
    const content = notes.length > 0
      ? MOCK_GENERATED_DIARY_WITH_NOTES.replace('{{notes}}', notes.map((note) => `“${note}”`).join(' '))
      : MOCK_GENERATED_DIARY_CONTENT;

    const diary: Diary = {
      id: `generated-${date}-${Date.now()}`,
      date,
      content,
      createdAt: now,
      updatedAt: now,
    };
    this.clearGeneratedDraftsForDate(date);
    this.generatedDrafts.set(diary.id, date);

    // Generation returns a preview; persistence remains the responsibility of saveDiary.
    return structuredClone(diary);
  }

  async getDiaries(): Promise<Diary[]> {
    return [...this.diaries]
      .sort((first, second) => second.date.localeCompare(first.date))
      .map((diary) => structuredClone(diary));
  }

  async getDiary(id: string): Promise<Diary | null> {
    const diary = this.diaries.find((candidate) => candidate.id === id);
    return diary ? structuredClone(diary) : null;
  }

  async saveDiary(diary: Diary): Promise<Diary> {
    const indexById = this.diaries.findIndex((candidate) => candidate.id === diary.id);
    const index = indexById >= 0
      ? indexById
      : this.diaries.findIndex((candidate) => candidate.date === diary.date);
    const existing = index >= 0 ? this.diaries[index] : null;
    const savedDiary = {
      ...structuredClone(diary),
      createdAt: existing?.createdAt ?? diary.createdAt,
    };

    if (index === -1) {
      this.diaries.push(savedDiary);
    } else {
      this.diaries[index] = savedDiary;
    }

    this.clearGeneratedDraftsForDate(diary.date);
    return structuredClone(savedDiary);
  }

  async updateDiary(id: string, content: string): Promise<Diary> {
    const diary = this.diaries.find((candidate) => candidate.id === id);

    if (!diary) {
      throw new Error(`Diary not found: ${id}`);
    }

    diary.content = content;
    diary.updatedAt = new Date().toISOString();
    return structuredClone(diary);
  }

  async deleteDiary(id: string): Promise<void> {
    const savedDiary = this.diaries.find((diary) => diary.id === id);
    const date = savedDiary?.date ?? this.generatedDrafts.get(id);
    if (date) {
      this.diaries = this.diaries.filter((diary) => diary.date !== date);
      this.clearGeneratedDraftsForDate(date);
    }
  }

  async deleteAllDiaries(): Promise<void> {
    this.diaries = [];
    this.generatedDrafts.clear();
  }

  private clearGeneratedDraftsForDate(date: string): void {
    for (const [id, draftDate] of this.generatedDrafts) {
      if (draftDate === date) this.generatedDrafts.delete(id);
    }
  }
}
