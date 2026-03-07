import { logger } from '@/lib/logger';

export const logEvent = (name: string, params?: Record<string, string | number | boolean>) => {
  logger.info('Analytics', name, params);
};

export const logLevelComplete = (levelId: string, score: number, timeSpent: number) => {
  logEvent('level_completed', { level_id: levelId, score, time_spent: timeSpent });
};

export const logDailyQuestStart = (questId: string, questType: string) => {
  logEvent('daily_quest_started', { quest_id: questId, quest_type: questType });
};

export const logDailyQuestComplete = (questId: string, xpEarned: number) => {
  logEvent('daily_quest_completed', { quest_id: questId, xp_earned: xpEarned });
};

export const logAchievementUnlocked = (achievementId: string) => {
  logEvent('achievement_unlocked', { achievement_id: achievementId });
};

export const logAppOpen = () => {
  logEvent('app_open', { timestamp: Date.now() });
};

export const logModuleStarted = (moduleId: string) => {
  logEvent('module_started', { module_id: moduleId });
};

export const logModuleCompleted = (moduleId: string, timeSpent: number) => {
  logEvent('module_completed', { module_id: moduleId, time_spent: timeSpent });
};
