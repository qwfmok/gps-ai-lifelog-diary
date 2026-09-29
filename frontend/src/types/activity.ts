export type ActivitySource = 'INFERRED' | 'USER' | 'MOCK';

export interface Activity {
  id: string;
  name: string;
  category: string;
  source: ActivitySource;
  confidence: number;
}
