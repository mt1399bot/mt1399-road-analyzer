export type MemberView = {
  id: number;
  username: string;
  label: string;
  expiresAt: string;
  dailyLimit: number;
  usedToday: number;
  liveAnalysisEnabled: boolean;
  learningEnabled: boolean;
};
