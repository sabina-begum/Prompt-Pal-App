import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { convexHttpClient, refreshAuth } from '@/lib/convex-client';
import { api } from '../../../convex/_generated/api.js';
import { getModuleThumbnail } from '@/lib/thumbnails';

// Default learning modules shown immediately (no API wait needed)
const getDefaultLearningModules = (): LearningModule[] => [
  {
    id: 'coding-logic',
    category: 'Programming',
    title: 'Coding Logic',
    level: 'Beginner',
    topic: 'Problem Solving',
    currentLevelName: 'Hello Function',
    currentLevelOrder: 1,
    progress: 0,
    icon: 'code',
    thumbnail: getModuleThumbnail('Coding Logic', 'Programming', 'Problem Solving'),
    accentColor: 'bg-blue-500',
    buttonText: 'Start Coding',
    type: 'module',
    format: 'interactive',
    estimatedTime: 15,
  },
  {
    id: 'copywriting',
    category: 'Writing',
    title: 'Copywriting',
    level: 'Beginner',
    topic: 'Marketing',
    currentLevelName: 'Product Headline',
    currentLevelOrder: 1,
    progress: 0,
    icon: 'create',
    thumbnail: getModuleThumbnail('Copywriting', 'Writing', 'Marketing'),
    accentColor: 'bg-purple-500',
    buttonText: 'Start Writing',
    type: 'module',
    format: 'interactive',
    estimatedTime: 20,
  },
  {
    id: 'image-generation',
    category: 'Design',
    title: 'Image Generation',
    level: 'Beginner',
    topic: 'AI Art',
    currentLevelName: 'Color Match',
    currentLevelOrder: 1,
    progress: 0,
    icon: 'color-palette',
    thumbnail: getModuleThumbnail('Image Generation', 'Design', 'AI Art'),
    accentColor: 'bg-gray-500',
    buttonText: 'Locked',
    type: 'module',
    format: 'interactive',
    estimatedTime: 10,
    isLocked: true,
  },
];

export interface LearningModule {
  id: string;
  category: string;
  title: string;
  level: string;
  topic: string;
  currentLevelName?: string;
  currentLevelOrder?: number;
  progress: number; // 0-100
  icon: string;
  thumbnail?: any;
  accentColor: string;
  buttonText: string;
  type?: 'module' | 'course';
  format?: 'interactive' | 'video' | 'text';
  estimatedTime?: number;
  isLocked?: boolean;
}

export interface DailyQuest {
  id: string;
  levelId?: string;
  title: string;
  description: string;
  xpReward: number;
  timeRemaining: number; // hours
  completed: boolean;
  expiresAt: number; // timestamp
  questType?: 'image' | 'code' | 'copywriting';
}

export interface UserProgress {
  // User stats
  level: number;
  xp: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null; // ISO date string

  // Learning modules progress
  learningModules: LearningModule[];

  // Daily quest
  currentQuest: DailyQuest | null;

  // Actions
  addXP: (amount: number) => Promise<void>;
  updateStreak: () => Promise<void>;
  resetStreak: () => void;
  updateModuleProgress: (moduleId: string, progress: number) => void;
  setCurrentQuest: (quest: DailyQuest) => void;
  completeQuest: () => Promise<void>;
  resetProgress: () => void;

  // Backend sync actions
  syncWithBackend: () => Promise<void>;
  loadFromBackend: (userId?: string) => Promise<void>;
  setLearningModules: (modules: LearningModule[]) => void;
}

const initialState = {
  level: 1,
  xp: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: null, // No activity yet for new users
  learningModules: getDefaultLearningModules(), // Show default modules immediately
  currentQuest: null, // Will be loaded from API
};

const calculateLevel = (xp: number): number => {
  // Simple level calculation: level = floor(xp / 200) + 1
  return Math.floor(xp / 200) + 1;
};

const calculateXPForNextLevel = (currentXP: number): number => {
  const currentLevel = calculateLevel(currentXP);
  return currentLevel * 200; // Next level at currentLevel * 200 XP
};

const getDateString = (date: Date): string => date.toISOString().split('T')[0];

const getTodayString = (): string => getDateString(new Date());

const getYesterdayString = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateString(yesterday);
};

// Custom storage adapter for expo-secure-store (native) or localStorage (web)
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(name);
      }
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(name, value);
      } else {
        await SecureStore.setItemAsync(name, value);
      }
    } catch {
      // Persist failures are non-fatal; app state still remains in memory.
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(name);
      } else {
        await SecureStore.deleteItemAsync(name);
      }
    } catch {
      // Handle error silently
    }
  },
};

export const useUserProgressStore = create<UserProgress>()(
  persist(
    (set, get) => ({
      ...initialState,

      addXP: async (amount: number) => {
        const newXP = get().xp + amount;
        const newLevel = calculateLevel(newXP);
        set({
          xp: newXP,
          level: newLevel
        });

        // Sync XP and level changes to backend via updateUserStatistics
        try {
          await convexHttpClient.mutation(api.mutations.updateUserStatistics, {
            totalXp: newXP,
            currentLevel: newLevel,
          });
        } catch {
          // Sync is retried by background flows.
        }
      },

      updateStreak: async () => {
        const today = getTodayString();
        const lastActivityDate = get().lastActivityDate;

        if (lastActivityDate === today) {
          // Already updated today
          return;
        }

        const yesterdayStr = getYesterdayString();

        let newStreak = 1; // Default for new streak
        let newLongestStreak = get().longestStreak;

        if (lastActivityDate === yesterdayStr) {
          // Consecutive day
          newStreak = get().currentStreak + 1;
          newLongestStreak = Math.max(newLongestStreak, newStreak);
        }

        set({
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastActivityDate: today,
        });

        await get().syncWithBackend();
      },

      resetStreak: () => {
        set({
          currentStreak: 0,
          lastActivityDate: null,
        });
      },

      updateModuleProgress: async (moduleId: string, progress: number) => {
        const modules = get().learningModules || [];
        const updatedModules = modules.map(module =>
          module.id === moduleId
            ? { ...module, progress: Math.min(100, Math.max(0, progress)) }
            : module
        );
        set({ learningModules: updatedModules });

        // Sync with backend
        try {
          await convexHttpClient.mutation(api.mutations.updateModuleProgress, {
            moduleId,
            progress,
          });
        } catch {
          // Sync is retried by background flows.
        }
      },

      setCurrentQuest: (quest: DailyQuest) => {
        set({ currentQuest: quest });
      },

      completeQuest: async () => {
        const quest = get().currentQuest;
        if (quest && !quest.completed) {
          // Add XP reward
          await get().addXP(quest.xpReward);
          // Mark quest as completed locally
          set({
            currentQuest: { ...quest, completed: true }
          });

          await get().updateStreak();

          // Sync with backend
          try {
            await convexHttpClient.mutation(api.mutations.completeDailyQuest, {
              questId: quest.id,
            });
          } catch {
            // Sync is retried by background flows.
          }
        }
      },

      resetProgress: () => {
        set(initialState);
      },

      // Backend sync actions
      syncWithBackend: async () => {
        try {
          // Sync progress data
          const progressData: {
            totalXp: number;
            currentLevel: number;
            currentStreak: number;
            longestStreak: number;
            lastActivityDate?: string;
          } = {
            totalXp: get().xp,
            currentLevel: get().level,
            currentStreak: get().currentStreak,
            longestStreak: get().longestStreak,
          };

          if (get().lastActivityDate) {
            progressData.lastActivityDate = get().lastActivityDate ?? undefined;
          }

          await convexHttpClient.mutation(api.mutations.updateUserStatistics, progressData);
        } catch {
          // Sync is retried by background flows.
        }
      },

      loadFromBackend: async (userId?: string) => {
        try {
          // Load learning modules and user module progress from Convex
          const [apiModules, progressRows] = await Promise.all([
            convexHttpClient.query(api.queries.getLearningModules, {
              appId: "prompt-pal"
            }),
            userId
              ? convexHttpClient.query(api.queries.getUserModuleProgress, {
                userId,
              })
              : Promise.resolve([]),
          ]);

          const progressByModuleId = new Map(
            (progressRows ?? []).map((row: any) => [row.moduleId, row.progress])
          );

          // Start with default modules
          let modules = getDefaultLearningModules();

          modules = modules.map(defaultModule => {
            // Find matching API module by ID or category
            const apiModule = apiModules?.find((api: any) =>
              api.id === defaultModule.id ||
              api.category.toLowerCase() === defaultModule.category.toLowerCase()
            );

            // Merge API data with default module
            const mergedModule = {
              ...defaultModule,
              ...apiModule,
              thumbnail: defaultModule.thumbnail, // Keep our local thumbnail
            };

            const moduleProgress = progressByModuleId.get(mergedModule.id);

            return {
              ...mergedModule,
              progress: typeof moduleProgress === 'number' ? moduleProgress : mergedModule.progress,
            };
          });

          set({ learningModules: modules });

          // Load current quest
          const quest = await convexHttpClient.mutation(api.mutations.getOrAssignCurrentQuest, {
            appId: "prompt-pal",
            ...(userId ? { userId } : {}),
          });
          if (quest) {
            set({ currentQuest: quest });
          }

          // Load user statistics (streak, level, XP)
          const stats = await convexHttpClient.query(api.queries.getMyUserStatistics, {});
          if (stats) {
            set({
              xp: stats.totalXp,
              level: stats.currentLevel,
              currentStreak: stats.currentStreak,
              longestStreak: stats.longestStreak,
              lastActivityDate: stats.lastActivityDate ?? null,
            });
          }

          const today = getTodayString();
          const yesterdayStr = getYesterdayString();
          const lastActivityDate = get().lastActivityDate;
          const hasGap =
            !lastActivityDate ||
            (lastActivityDate !== today && lastActivityDate !== yesterdayStr);

          if (hasGap && get().currentStreak !== 0) {
            set({ currentStreak: 0 });
            await get().syncWithBackend();
          }
        } catch (error: any) {

          // If authentication failed, try to refresh auth and retry once
          if (error?.message?.includes('User must be authenticated') || error?.response?.status === 401) {
            console.warn('Authentication failed when loading user data, attempting to refresh...');

            try {
              await refreshAuth();

              // Retry queries once
              const [apiModules, progressRows] = await Promise.all([
                convexHttpClient.query(api.queries.getLearningModules, {
                  appId: "prompt-pal"
                }),
                userId
                  ? convexHttpClient.query(api.queries.getUserModuleProgress, {
                    userId,
                  })
                  : Promise.resolve([]),
              ]);

              // Process retry results (same logic as above)
              const progressByModuleId = new Map(
                (progressRows ?? []).map((row: any) => [row.moduleId, row.progress])
              );

              let modules = getDefaultLearningModules();
              modules = modules.map(defaultModule => {
                const apiModule = apiModules?.find((api: any) =>
                  api.id === defaultModule.id ||
                  api.category.toLowerCase() === defaultModule.category.toLowerCase()
                );

                const mergedModule = {
                  ...defaultModule,
                  ...apiModule,
                  thumbnail: defaultModule.thumbnail,
                };

                const moduleProgress = progressByModuleId.get(mergedModule.id);

                return {
                  ...mergedModule,
                  progress: typeof moduleProgress === 'number' ? moduleProgress : mergedModule.progress,
                };
              });

              set({ learningModules: modules });

              // Load current quest
              const quest = await convexHttpClient.mutation(api.mutations.getOrAssignCurrentQuest, {
                appId: "prompt-pal",
                ...(userId ? { userId } : {}),
              });
              if (quest) {
                set({ currentQuest: quest });
              }

              // Load user statistics
              const stats = await convexHttpClient.query(api.queries.getMyUserStatistics, {});
              if (stats) {
                set({
                  xp: stats.totalXp,
                  level: stats.currentLevel,
                  currentStreak: stats.currentStreak,
                  longestStreak: stats.longestStreak,
                  lastActivityDate: stats.lastActivityDate ?? null,
                });
              }

              return; // Success on retry
            } catch {
              // Keep local/default state if retry fails.
            }
          }

          // Keep existing/default state if API fails
        }
      },

      setLearningModules: (modules: LearningModule[]) => {
        set({ learningModules: modules });
      },
    }),
    {
      name: 'promptpal-user-progress-storage',
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('User progress store rehydration error:', error);
        }

        // Ensure state is valid after rehydration
        if (state) {
          // Ensure learningModules is an array
          if (!state.learningModules || !Array.isArray(state.learningModules)) {
            state.learningModules = [];
          }

          // Note: We no longer call loadFromBackend() here to avoid double initialization
          // Backend data is now loaded via SyncManager.syncUserProgress() which is
          // triggered once on app startup and periodically thereafter.
          // This prevents duplicate API calls when both rehydration and SyncManager run.
        }
      },
    }
  )
);

// Helper functions
export const getXPForNextLevel = (currentXP: number): number => {
  return calculateXPForNextLevel(currentXP);
};

/**
 * Returns overall mastery progress showing total accumulated XP.
 * Max mastery is capped at MAX_MASTERY_XP.
 */
const MAX_MASTERY_XP = 5000; // Total XP representing full mastery

export const getOverallProgress = (currentXP: number): { current: number; total: number; percentage: number } => {
  return {
    current: currentXP,
    total: MAX_MASTERY_XP,
    percentage: Math.min((currentXP / MAX_MASTERY_XP) * 100, 100),
  };
};
