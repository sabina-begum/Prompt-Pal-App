import { useUser, useAuth } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { Text, View, ScrollView, Pressable, Alert, ActivityIndicator, useColorScheme } from 'react-native'
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback, memo, ComponentProps } from 'react';
import { FlashList } from "@shopify/flash-list";
import { getUnlockedLevels } from '@/features/levels/data';
import { UsageDisplay } from '@/components/UsageDisplay';
import { useUsage, UsageStats } from '@/lib/usage';
import { useGameStore } from '@/features/game/store';
import { useUserProgressStore, getOverallProgress } from '@/features/user/store';
import { logDailyQuestStart } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { SignOutButton } from '@/components/SignOutButton';
import { Button, Card, Modal, ProgressBar, StatCard } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { convexHttpClient } from '@/lib/convex-client';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api.js';

// Local type definitions for UI components
export interface LearningModule {
  id: string;
  category: string;
  title: string;
  level: string;
  topic: string;
  currentLevelName?: string;
  currentLevelOrder?: number;
  progress: number;
  icon: string;
  thumbnail?: string | number; // string for URL, number for require() asset
  accentColor: string;
  buttonText: string;
  type?: 'module' | 'course';
  format?: 'interactive' | 'video' | 'text';
  estimatedTime?: number;
  isLocked?: boolean;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  timeRemaining: number;
  completed: boolean;
  expiresAt: number;
  questType?: 'image' | 'code' | 'copywriting';
}

// --- Sub-components ---

// Helper to get greeting based on time of day
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Night';
};

// Helper to map emoji icons to Ionicons names
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const getIconName = (icon: string): IoniconName => {
  const mapping: Record<string, IoniconName> = {
    "🎨": "color-palette",
    "💻": "laptop",
    "✍️": "create",
    "🧠": "hardware-chip",
    "✨": "sparkles",
    "🔥": "flame",
    "🏆": "trophy",
    "📅": "calendar",
  };
  if (icon && icon in Ionicons.glyphMap) {
    return icon as IoniconName;
  }

  return mapping[icon] || "book";
};

interface QuestCardProps {
  quest: DailyQuest;
}

const QuestCard = memo(function QuestCard({ quest }: QuestCardProps) {
  const router = useRouter();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Real-time timer effect
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, quest.expiresAt - now);
      setTimeRemaining(remaining);
    };

    // Update immediately
    updateTimer();

    // Set up interval to update every second
    const interval = setInterval(updateTimer, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [quest.expiresAt]);

  const formatTimeRemaining = useCallback((milliseconds: number) => {
    if (milliseconds <= 0) {
      return 'Expired';
    }

    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }, []);

  const handleStartQuest = useCallback(() => {
    if (quest.id) {
      logDailyQuestStart(quest.id, quest.questType ?? 'unknown');
      router.push(`/game/quest/${quest.id}`);
    } else {
      Alert.alert('Quest Unavailable', 'This quest is currently locked.');
    }
  }, [quest.id, quest.questType, router]);

  return (
    <View className="bg-info p-6 rounded-[32px] mb-10 overflow-hidden shadow-lg shadow-info/30">
      <View className="flex-row justify-between items-center mb-6">
        <View className="bg-white/20 px-3 py-1.5 rounded-full">
          <Text className="text-white text-[10px] font-black uppercase tracking-[2px]">Daily Quest</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={16} color="black" />
          <Text className={`text-white text-xs font-black ml-1.5 uppercase tracking-tighter ${
            timeRemaining <= 0 ? 'text-red-300' : ''
          }`}>
            {formatTimeRemaining(timeRemaining)} {timeRemaining > 0 ? 'left' : ''}
          </Text>
        </View>
      </View>

      <Text className="text-white text-2xl font-black mb-2">{quest.title}</Text>
      <Text className="text-white/80 text-sm mb-8 font-medium leading-5">{quest.description}</Text>

      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center">
          <View className="bg-white/20 rounded-full p-2 mr-2">
            <Ionicons name="star" size={14} color="black" />
          </View>
          <Text className="text-white font-black text-lg">+{quest.xpReward} XP</Text>
        </View>
        {quest.completed ? (
          <View className="bg-white/20 px-8 py-4 rounded-full">
            <Text className="text-white font-black text-sm uppercase tracking-widest">Completed</Text>
          </View>
        ) : (
          <Pressable
            onPress={handleStartQuest}
            className="bg-white px-8 py-4 rounded-full shadow-sm active:opacity-80"
          >
            <Text className="text-info font-black text-sm uppercase tracking-widest">Start Quest</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

interface ModuleCardProps {
  id: string;
  title: string;
  category: string;
  level: string;
  topic: string;
  currentLevelName?: string;
  currentLevelOrder?: number;
  progress: number;
  icon: string;
  thumbnail?: any;
  accentColor: string;
  format?: 'interactive' | 'video' | 'text';
  buttonText?: string;
  isLocked?: boolean;
}

const ModuleCard = memo(function ModuleCard({
  id,
  title,
  category,
  level,
  topic,
  currentLevelName,
  currentLevelOrder,
  progress,
  icon,
  thumbnail,
  accentColor,
  format,
  buttonText = "Continue Learning",
  isLocked = false
}: ModuleCardProps) {
  const router = useRouter();

  const handlePress = useCallback(() => {
    if (isLocked) return; // Don't navigate if locked
    const href = `/game/levels/${id}`;
    router.push(href);
  }, [id, router, isLocked]);

  return (
    <View className={`bg-surface border border-outline/30 rounded-[32px] mb-8 overflow-hidden shadow-sm ${isLocked ? 'opacity-60' : ''}`}>
      {/* Header Pattern Area */}
      <View className="h-44 bg-surfaceVariant relative justify-center items-center">
        {thumbnail ? (
          <Image source={thumbnail} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center opacity-20">
            <Ionicons name={getIconName(icon)} size={80} color="black" />
          </View>
        )}
        {isLocked && (
          <View className="absolute inset-0 bg-black/40 items-center justify-center">
            <View className="bg-gray-800 px-6 py-3 rounded-full">
              <Text className="text-white text-sm font-black uppercase tracking-widest">Locked</Text>
            </View>
          </View>
        )}
        {format && !isLocked && (
          <View className="absolute top-4 right-4 bg-primary px-3 py-1 rounded-full">
            <Text className="text-white text-[8px] font-black uppercase tracking-widest">{format}</Text>
          </View>
        )}
      </View>

      <View className="p-6">
        <Text className={`text-2xl font-black mb-4 ${isLocked ? 'text-onSurfaceVariant' : 'text-onSurface'}`}>{title}</Text>

        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-1 mr-4">
            {currentLevelName && (
              <Text className="text-onSurface text-[11px] font-black uppercase tracking-widest">
                Level {currentLevelOrder}: {currentLevelName}
              </Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={handlePress}
          disabled={isLocked}
          className={`py-4 rounded-2xl items-center flex-row justify-center border border-outline/10 ${isLocked ? 'bg-gray-700/30' : 'bg-surfaceVariant/50'}`}
        >
          {isLocked ? (
            <>
              <Ionicons name="lock-closed" size={16} color="#6B7280" style={{ marginRight: 8 }} />
              <Text className="text-gray-500 font-black text-sm uppercase tracking-widest">Locked</Text>
            </>
          ) : (
            <>
              <Text className="text-primary font-black text-sm uppercase tracking-widest mr-2">{buttonText}</Text>
              {buttonText === "Continue Learning" && <Ionicons name="arrow-forward" size={18} color="#FF6B00" />}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
});


export default function HomeScreen() {
  const { user } = useUser()
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter();
  const usage = useUsage();
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const { unlockedLevels, completedLevels } = useGameStore();
  const { level, xp, currentStreak, learningModules, currentQuest, loadFromBackend } = useUserProgressStore();
  const overallProgress = getOverallProgress(xp);

  // Use useQuery for reactive level data
  const allLevels = useQuery(api.queries.getLevels, { appId: 'prompt-pal' }) || [];

  const getModuleLevelInfo = useCallback((moduleId: string) => {
    // Map moduleId to level types used in levels_data.ts
    const typeMapping: Record<string, string> = {
      'coding-logic': 'code',
      'copywriting': 'copywriting',
      'image-generation': 'image'
    };

    const type = typeMapping[moduleId];
    if (!type) return null;

    const moduleLevels = allLevels
      .filter(l => l.type === type)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (moduleLevels.length === 0) return null;

    // Find the first level not completed
    const currentLevel = moduleLevels.find(l => !completedLevels.includes(l.id)) || moduleLevels[moduleLevels.length - 1];

    // Calculate 1-based order within module
    const orderInModule = moduleLevels.indexOf(currentLevel) + 1;

    return {
      name: currentLevel.title,
      order: orderInModule
    };
  }, [allLevels, completedLevels]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user?.id) {
      loadFromBackend(user.id);
    }
  }, [isLoaded, isSignedIn, loadFromBackend, user?.id]);



  const renderModuleItem = useCallback(({ item }: { item: LearningModule }) => {
    const levelInfo = getModuleLevelInfo(item.id);

    // Calculate actual progress based on completed levels
    const typeMapping: Record<string, string> = {
      'coding-logic': 'code',
      'copywriting': 'copywriting',
      'image-generation': 'image'
    };

    const type = typeMapping[item.id];
    const moduleLevels = allLevels?.filter(l => l.type === type) || [];
    const completedLevelsInModule = moduleLevels.filter(l => completedLevels.includes(l.id)).length;
    const actualProgress = moduleLevels.length > 0 ? Math.round((completedLevelsInModule / moduleLevels.length) * 100) : 0;

    return (
      <ModuleCard
        {...item}
        progress={actualProgress}
        currentLevelName={levelInfo?.name}
        currentLevelOrder={levelInfo?.order}
      />
    );
  }, [getModuleLevelInfo, allLevels, completedLevels]);

  const handleSettingsPress = useCallback(() => {
    setSettingsModalVisible(true);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Fixed Header */}
      <View className="px-6 pt-4 pb-4 flex-row justify-between items-center">
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/50 items-center justify-center overflow-hidden mr-3">
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={24} color="#FF6B00" />
            )}
          </View>
          <View>
            <Text className="text-onSurfaceVariant text-[8px] font-black uppercase tracking-[3px] mb-0.5">{getGreeting()}</Text>
            <Text className="text-onSurface text-xl font-black">
              {user?.firstName || "Alex"} {user?.lastName || "Prompt"}
            </Text>
          </View>
        </View>
        <View className="flex-row">
          <Pressable
            className="w-10 h-10 rounded-full bg-surfaceVariant/50 items-center justify-center"
            onPress={handleSettingsPress}
          >
            <Ionicons name="settings-outline" size={20} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Stats Bar */}
        <View className="px-5 flex-row mb-8">
          <StatCard label="Level" value={level.toString()} icon="trophy-outline" color="#FF6B00" variant="compact" />
          <StatCard label="XP" value={xp.toLocaleString()} icon="flash-outline" color="#4151FF" variant="compact" />
          <StatCard label="Streak" value={currentStreak.toString()} icon="flame-outline" color="#F59E0B" variant="compact" />
        </View>

        {/* Overall Mastery */}
        <View className="px-6 mb-10">
          <View className="flex-row justify-between items-center mb-2.5">
            <Text className="text-onSurface text-[10px] font-black uppercase tracking-[2px]">Overall Mastery</Text>
            <Text className="text-onSurfaceVariant text-xs font-black">
              {overallProgress.current.toLocaleString()} / {overallProgress.total.toLocaleString()} XP
            </Text>
          </View>
          <ProgressBar progress={overallProgress.percentage / 100} />
        </View>

        {/* Daily Quest */}
        {currentQuest && (
          <View className="px-6">
            <QuestCard quest={currentQuest} />
          </View>
        )}

        {/* Learning Modules Section */}
        <View className="px-6">
          <View className="mb-6">
            <Text className="text-onSurface text-2xl font-black tracking-tight">Learning Modules</Text>
          </View>



          {/* Module Cards with FlashList */}
          {learningModules && learningModules.length > 0 && (
            <FlashList
              data={learningModules}
              renderItem={renderModuleItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        size="sm"
      >
        <View className="rounded-[28px] overflow-hidden bg-surface">
          <View className="px-1 pb-5">
            <View className="flex-row items-start justify-between mb-5">
              <View>
                <Text className="text-primary text-[10px] font-black uppercase tracking-[2.5px] mb-2">Account</Text>
                <Text className="text-onSurface text-[32px] font-black tracking-tight">Settings</Text>
                <Text className="text-onSurfaceVariant text-sm mt-1">
                  Manage your PromptPal account.
                </Text>
              </View>
              <Pressable
                onPress={() => setSettingsModalVisible(false)}
                className="w-11 h-11 rounded-full bg-surfaceVariant/40 items-center justify-center mt-1"
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>

            <View className="rounded-[28px] bg-surfaceVariant/30 border border-outline/10 p-5">
              <View className="flex-row items-center">
                <View className="w-14 h-14 rounded-full bg-primary/15 border border-primary/20 items-center justify-center overflow-hidden mr-4">
                  {user?.imageUrl ? (
                    <Image source={{ uri: user.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : (
                    <Ionicons name="person" size={28} color="#FF6B00" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-onSurface text-xl font-black">
                    {user?.firstName || "User"} {user?.lastName || ""}
                  </Text>
                  <Text className="text-onSurfaceVariant text-sm mt-1">
                    {user?.primaryEmailAddress?.emailAddress}
                  </Text>
                </View>
              </View>

              <View className="mt-5 pt-5 border-t border-outline/10">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-onSurface text-xs font-black uppercase tracking-[2px]">Session</Text>
                    <Text className="text-onSurfaceVariant text-sm mt-1">
                      Signed in and synced with Clerk
                    </Text>
                  </View>
                  <View className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15">
                    <Text className="text-primary text-[10px] font-black uppercase tracking-[2px]">Active</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="mt-5">
              <SignOutButton
                className="rounded-2xl py-4 px-5"
                textClassName="text-base font-black uppercase tracking-[2px]"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
