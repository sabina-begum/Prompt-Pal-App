import { View, Text, Image, Alert, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, InputAccessoryView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Card, Badge, ProgressBar, ResultModal } from '@/components/ui';
import { getLevelById as getLocalLevelById, fetchLevelsFromApi, getLevelsByModuleId } from '@/features/levels/data';
import { useGameStore, Level, ChallengeType } from '@/features/game/store';
import { useUserProgressStore } from '@/features/user/store';
import { useConvexAI } from '@/hooks/useConvexAI';
import { convexHttpClient } from '@/lib/convex-client';
import { api } from '../../../convex/_generated/api.js';
import { logger } from '@/lib/logger';
import { NanoAssistant } from '@/lib/nanoAssistant';
import { useUser } from '@clerk/clerk-expo';
import { CodeExecutionView } from '@/features/game/components/CodeExecutionView';
import type { CodeExecutionResult } from '@/features/game/components/CodeExecutionView';
import { CopyAnalysisView } from '@/features/game/components/CopyAnalysisView';
import type { CopyScoringResult } from '@/lib/scoring/copyScoring';

const { width, height: screenHeight } = Dimensions.get('window');

type UserLevelAttempt = {
  id: string;
  attemptNumber: number;
  score: number;
  feedback: string[];
  keywordsMatched: string[];
  imageUrl?: string;
  code?: string;
  copy?: string;
  testResults?: any[];
  createdAt: number;
};

// Helper function to map level type to moduleId for navigation
const getModuleIdFromLevelType = (levelType: string): string => {
  switch (levelType) {
    case 'image':
      return 'image-generation';
    case 'code':
      return 'coding-logic';
    case 'copywriting':
      return 'copywriting';
    default:
      return 'image-generation'; // fallback
  }
};

const extractCodeFromResponse = (text: string): string => {
  const match = text.match(/```(?:[a-z]+)?\s*([\s\S]*?)\s*```/i);
  return (match?.[1] || text).trim();
};

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const { generateText, generateImage, evaluateImage, evaluateCodeSubmission, evaluateCopySubmission } = useConvexAI();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState<string | null>(null);
  const [codeExecutionResult, setCodeExecutionResult] = useState<CodeExecutionResult | null>(null);
  const [copyScoringResult, setCopyScoringResult] = useState<CopyScoringResult | null>(null);
  const [activeTab, setActiveTab] = useState<'target' | 'attempt'>('target');
  const [activeCodeTab, setActiveCodeTab] = useState<'instructions' | 'attempt'>('instructions');
  const [activeCopyTab, setActiveCopyTab] = useState<'brief' | 'attempt'>('brief');
  const [showResult, setShowResult] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [attemptHistory, setAttemptHistory] = useState<UserLevelAttempt[]>([]);
  const [level, setLevel] = useState<Level | null>(null);

  // Refs for keyboard scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visibleHints = useMemo(() => level?.hints ?? [], [level?.hints]);
  const codeVisibleBrief = useMemo(
    () => [level?.moduleTitle, level?.description].filter(Boolean).join('\n\n'),
    [level?.description, level?.moduleTitle]
  );
  const copyVisibleBrief = useMemo(
    () => [level?.briefTitle, level?.description].filter(Boolean).join('\n\n'),
    [level?.briefTitle, level?.description]
  );

  // Hint system state
  const [hints, setHints] = useState<string[]>([]);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [hintCooldown, setHintCooldown] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [moduleLevels, setModuleLevels] = useState<Level[]>([]);
  const inputAccessoryId = 'promptInputAccessory';

  const progressInfo = useMemo(() => {
    if (!level || moduleLevels.length === 0) return { current: 1, total: 1, percentage: 0 };

    // Find all levels for the current module/type
    const currentModuleId = level.moduleId || getModuleIdFromLevelType(level.type || 'image');
    const relevantLevels = moduleLevels.filter(l =>
      l.moduleId === currentModuleId ||
      l.type === level.type
    );

    // Sort by order
    const sortedLevels = [...relevantLevels].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Find index of current level
    const currentIndex = sortedLevels.findIndex(l => l.id === level.id);
    const current = currentIndex >= 0 ? currentIndex + 1 : 1;
    const total = sortedLevels.length;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return { current, total, percentage };
  }, [level, moduleLevels]);

  const { lives, loseLife, startLevel, completeLevel } = useGameStore();
  const { updateStreak, addXP } = useUserProgressStore();

  // Helper to determine XP reward for a level
  const getLevelXPReward = useCallback((lvl: Level): number => {
    // Use the level's points field if available, otherwise fallback by difficulty
    if (lvl.points && lvl.points > 0) return lvl.points;
    switch (lvl.difficulty) {
      case 'beginner': return 50;
      case 'intermediate': return 100;
      case 'advanced': return 200;
      default: return 50;
    }
  }, []);

  useEffect(() => {
    const loadLevel = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get level data from Convex
        const apiLevel = await convexHttpClient.query(api.queries.getLevelById, { id: id as string });

        if (apiLevel) {
          // Process with local assets if available (for images only)
          const localLevel = getLocalLevelById(id as string);
          const processedLevel = {
            ...apiLevel,
            // Use local asset for display, API URL for evaluation
            targetImageUrl: localLevel?.targetImageUrl ?? apiLevel.targetImageUrl,
            // Use API-provided Convex storage URL for evaluation (ensure it's a string)
            targetImageUrlForEvaluation: typeof apiLevel.targetImageUrl === 'string' ? apiLevel.targetImageUrl : undefined,
            hiddenPromptKeywords: apiLevel.hiddenPromptKeywords || localLevel?.hiddenPromptKeywords || [],
          };

          setLevel(processedLevel);
          startLevel(processedLevel.id);
          // Reset hints for this level
          NanoAssistant.resetHintsForLevel(processedLevel.id);
          setHints([]);

          // Fetch all levels to calculate progress
          try {
            const apiLevels = await fetchLevelsFromApi();
            const currentModuleId = processedLevel.moduleId || getModuleIdFromLevelType(processedLevel.type || 'image');
            const sourceLevels = apiLevels.length > 0 ? apiLevels : getLevelsByModuleId(currentModuleId);

            if (sourceLevels && sourceLevels.length > 0) {
              setModuleLevels(sourceLevels);
            }
          } catch (levelsError) {
            logger.warn('GameScreen', 'Failed to load all levels for progress', { error: levelsError });
            const currentModuleId = processedLevel.moduleId || getModuleIdFromLevelType(processedLevel.type || 'image');
            setModuleLevels(getLevelsByModuleId(currentModuleId));
          }

          // Fetch attempt history for this level
          try {
            const attempts = user?.id
              ? await convexHttpClient.query(api.queries.getUserLevelAttempts, { userId: user.id, levelId: id as string })
              : [];
            setAttemptHistory(attempts);

            // Restore the latest attempt's data based on level type
            if (attempts.length > 0) {
              const latestAttempt = attempts[attempts.length - 1]; // Most recent attempt

              // Restore based on level type
              if (processedLevel.type === 'image') {
                if (latestAttempt.imageUrl) {
                  setGeneratedImage(latestAttempt.imageUrl);
                }
              } else if (processedLevel.type === 'code') {
                if (latestAttempt.code) {
                  setGeneratedCode(latestAttempt.code);
                }
                if (latestAttempt.testResults) {
                  setCodeExecutionResult({
                    code: latestAttempt.code || '',
                    testResults: latestAttempt.testResults,
                    output: latestAttempt.feedback?.join('\n') || '',
                    success: (latestAttempt.score || 0) >= processedLevel.passingScore,
                    error: latestAttempt.testResults.find((result: any) => !result.passed)?.error,
                    score: latestAttempt.score,
                    passingScore: processedLevel.passingScore,
                  });
                }
              } else if (processedLevel.type === 'copywriting') {
                if (latestAttempt.copy) {
                  setGeneratedCopy(latestAttempt.copy);
                }
              }

              if (latestAttempt.score) {
                setLastScore(latestAttempt.score);
              }
              if (latestAttempt.feedback && latestAttempt.feedback.length > 0) {
                setFeedback(latestAttempt.feedback);
              }
              if (latestAttempt.keywordsMatched && latestAttempt.keywordsMatched.length > 0) {
                setMatchedKeywords(latestAttempt.keywordsMatched);
              }
            }
          } catch (attemptsError) {
            // Don't fail level loading if attempt history fails
            logger.warn('GameScreen', 'Failed to load attempt history', { error: attemptsError });
            setAttemptHistory([]);
          }
        } else {
          throw new Error('Level not found');
        }
      } catch (error: any) {
        logger.error('GameScreen', error, { operation: 'loadLevel', id });

        // Determine error message based on error type
        let errorMessage = 'Failed to load level. Please try again.';

        if (error.status === 403) {
          errorMessage = 'This level is locked. Complete previous levels to unlock it.';
        } else if (error.status === 404) {
          errorMessage = 'Level not found.';
        } else if (error.status === 401) {
          errorMessage = 'Authentication required. Please sign in again.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadLevel();
    }
  }, [id, startLevel, user?.id]);

  // Hint cooldown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const { isOnCooldown, remainingMs } = NanoAssistant.getCooldownStatus();
      setHintCooldown(isOnCooldown ? Math.ceil(remainingMs / 1000) : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Keyboard handling - keep input visible and avoid unexpected dismissals
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const nextKeyboardHeight = event?.endCoordinates?.height ?? 0;
        setKeyboardHeight(nextKeyboardHeight);

        requestAnimationFrame(() => {
          if (!inputRef.current || !scrollViewRef.current) return;

          inputRef.current.measureInWindow((_x, y, _width, height) => {
            const inputBottom = y + height;
            const keyboardTop = screenHeight - nextKeyboardHeight;
            const safePadding = 24;

            if (inputBottom > keyboardTop - safePadding) {
              const overlap = inputBottom - (keyboardTop - safePadding);
              scrollViewRef.current?.scrollTo({
                y: Math.max(0, scrollYRef.current + overlap),
                animated: true,
              });
            }
          });
        });
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Handle getting a hint
  const handleGetHint = useCallback(async () => {
    if (!level || isLoadingHint || hintCooldown > 0) return;

    setIsLoadingHint(true);
    try {
      const moduleType = (level.type || 'image') as ChallengeType;
      const hint = await NanoAssistant.getHint(prompt, moduleType, level as Parameters<typeof NanoAssistant.getHint>[2]);
      setHints(prev => [...prev, hint]);
      setShowHints(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Could not get hint. Please try again.';
      Alert.alert('Hint Unavailable', errorMessage);
    } finally {
      setIsLoadingHint(false);
    }
  }, [level, prompt, isLoadingHint, hintCooldown]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text className="text-onSurface mt-4 font-black">Loading Challenge…</Text>
      </SafeAreaView>
    );
  }

  if (!level) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <Card className="w-full items-center p-8">
            <Text className="text-error text-xl font-bold mb-4">Level Not Found</Text>
            <Text className="text-onSurfaceVariant text-center mb-8">
              We couldn't find challenge "{id}". It may have been removed or moved.
            </Text>
            <Button onPress={() => router.back()} variant="primary">Go Back</Button>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const charCount = prompt.length;
  const tokenCount = Math.ceil(charCount / 4); // Rough estimation

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      if (level.type === 'image') {
        // Step 1: Generate image
        const generateResult = await generateImage(prompt);
        const generatedImageUrl = generateResult.imageUrl;

        if (!generatedImageUrl) {
          throw new Error('Failed to generate image: no image URL returned');
        }

        setGeneratedImage(generatedImageUrl);
        setActiveTab('attempt');

        // Step 2: Evaluate the generated image
        if (!level.targetImageUrlForEvaluation) {
          throw new Error('No target image URL available for evaluation');
        }

        const evaluationResult = await evaluateImage({
          taskId: level.id,
          userImageUrl: generatedImageUrl,
          expectedImageUrl: level.targetImageUrlForEvaluation,
          hiddenPromptKeywords: level.hiddenPromptKeywords,
          style: level.style,
          userPrompt: prompt,
        });

        const evaluation = evaluationResult.evaluation;
        const score = evaluation.score;

        // Apply hint penalty to score
        const penaltyDetails = NanoAssistant.getPenaltyDetails(level.id, score, level.passingScore, level.difficulty);
        const finalScore = penaltyDetails.finalScore;

        setLastScore(finalScore);
        setFeedback(evaluation.feedback || []);
        setMatchedKeywords(evaluation.keywordsMatched || []);

        // Save attempt to backend for history
        try {
          if (user?.id) {
            await convexHttpClient.mutation(api.mutations.saveUserLevelAttempt, {
              userId: user.id,
              levelId: level.id,
              score: finalScore,
              feedback: evaluation.feedback || [],
              keywordsMatched: evaluation.keywordsMatched || [],
              imageUrl: generatedImageUrl,
            });

            // Refresh attempt history to include the new attempt
            const attempts = await convexHttpClient.query(api.queries.getUserLevelAttempts, {
              userId: user.id,
              levelId: level.id,
            });
            setAttemptHistory(attempts || []);
          }
        } catch (saveError) {
          // Don't fail the evaluation if saving attempt fails
          logger.warn('GameScreen', 'Failed to save attempt', { error: saveError });
        }

        if (finalScore >= level.passingScore) {
          // Update progress - user passed
          if (user?.id) {
            const nextAttemptsCount = (attemptHistory?.length ?? 0) + 1;
            await convexHttpClient.mutation(api.mutations.updateLevelProgress, {
              userId: user.id,
              appId: "prompt-pal",
              levelId: level.id,
              isCompleted: true,
              bestScore: finalScore,
              attempts: nextAttemptsCount,
              completedAt: Date.now(),
            });
          }

          await updateStreak();
          // Award XP for completing the level
          await addXP(getLevelXPReward(level));
          setShowResult(true);
          await completeLevel(level.id);
        } else {
          // User didn't pass - lose a life
          await loseLife();

          // Evaluation results are already displayed inline below the button
        }
      } else if (level.type === 'code') {
        setGeneratedCode(null);
        setCodeExecutionResult(null);

        const codeSystemPrompt = [
          'You are a JavaScript coding assistant.',
          '',
          'VISIBLE CHALLENGE:',
          codeVisibleBrief || level.description || 'Solve the coding challenge described by the player.',
          '',
          visibleHints.length > 0 ? `VISIBLE GUIDANCE:\n- ${visibleHints.join('\n- ')}` : '',
          '',
          'Use the player prompt as the implementation direction.',
          'Return only executable JavaScript code.',
          'Do not include markdown or explanations.',
        ].join('\n');

        const generateResult = await generateText(prompt, codeSystemPrompt);
        const generatedCodeText = extractCodeFromResponse(generateResult.result || '');

        if (!generatedCodeText) {
          throw new Error('Failed to generate code: no code returned');
        }

        setGeneratedCode(generatedCodeText);
        setActiveCodeTab('attempt');

        const evaluation = await evaluateCodeSubmission({
          levelId: level.id,
          code: generatedCodeText,
          userPrompt: prompt,
          visibleBrief: codeVisibleBrief,
          visibleHints,
        });

        const penaltyDetails = NanoAssistant.getPenaltyDetails(level.id, evaluation.score, level.passingScore, level.difficulty);
        const finalScore = penaltyDetails.finalScore;
        const userPassed = finalScore >= level.passingScore;

        setLastScore(finalScore);
        setFeedback(evaluation.feedback || []);
        setCodeExecutionResult({
          code: generatedCodeText,
          testResults: (evaluation.testResults || []).map((result: any, index: number) => ({
            id: result.id || `test-${index + 1}`,
            name: result.name || `Hidden Test ${index + 1}`,
            passed: result.passed || false,
            error: result.error,
            expectedOutput: result.expectedOutput,
            actualOutput: result.actualOutput,
            executionTime: result.executionTime || 0,
          })) as CodeTestResult[],
          output: (evaluation.feedback || []).join('\n'),
          success: userPassed,
          error: evaluation.testResults?.find((r: any) => !r.passed)?.error,
          score: finalScore,
          passingScore: level.passingScore,
        });

        try {
          if (user?.id) {
            const passedTestNames = (evaluation.testResults || [])
              .filter((r: any) => r.passed && r.name)
              .map((r: any) => r.name)
              .filter((name: any): name is string => name !== undefined);

            const sanitizedTestResults = (evaluation.testResults || []).map((r: any) => ({
              ...r,
              id: r.id ?? undefined,
              name: r.name ?? undefined,
              error: r.error ?? undefined,
              output: r.output ?? undefined,
              expectedOutput: r.expectedOutput ?? undefined,
              actualOutput: r.actualOutput ?? undefined,
              executionTime: r.executionTime ?? undefined,
            }));

            await convexHttpClient.mutation(api.mutations.saveUserLevelAttempt, {
              userId: user.id,
              levelId: level.id,
              score: finalScore,
              feedback: evaluation.feedback || [],
              keywordsMatched: passedTestNames.length > 0 ? passedTestNames : [],
              code: generatedCodeText,
              testResults: sanitizedTestResults,
            });

            const attempts = await convexHttpClient.query(api.queries.getUserLevelAttempts, {
              userId: user.id,
              levelId: level.id,
            });
            setAttemptHistory(attempts || []);
          }
        } catch (saveError) {
          logger.warn('GameScreen', 'Failed to save attempt', { error: saveError });
        }

        if (userPassed) {
          if (user?.id) {
            const nextAttemptsCount = (attemptHistory?.length ?? 0) + 1;
            await convexHttpClient.mutation(api.mutations.updateLevelProgress, {
              userId: user.id,
              appId: "prompt-pal",
              levelId: level.id,
              isCompleted: true,
              bestScore: finalScore,
              attempts: nextAttemptsCount,
              completedAt: Date.now(),
            });
          }

          await updateStreak();
          await addXP(getLevelXPReward(level));
          setShowResult(true);
          await completeLevel(level.id);
        } else {
          await loseLife();
        }
      } else if (level.type === 'copywriting') {
        // Step 1: Generate copy using AI
        const copyGenerationPrompt = [
          'You are a conversion-focused copywriter.',
          '',
          'VISIBLE BRIEF:',
          copyVisibleBrief || level.description || 'Write the requested marketing asset.',
          '',
          visibleHints.length > 0 ? `VISIBLE GUIDANCE:\n- ${visibleHints.join('\n- ')}` : '',
          '',
          'Use the player prompt as the strategic direction for the final copy.',
          'Return only the final copy text, with no markdown or explanation.',
        ].join('\n');

        const generateResult = await generateText(prompt, copyGenerationPrompt);
        const generatedCopyText = generateResult.result || '';

        if (!generatedCopyText) {
          throw new Error('Failed to generate copy: no copy returned');
        }

        setGeneratedCopy(generatedCopyText);
        setActiveCopyTab('attempt');

        // Step 2: Evaluate the generated copy
        const copyScoringResult = await evaluateCopySubmission({
          levelId: level.id,
          text: generatedCopyText,
          userPrompt: prompt,
          visibleBrief: copyVisibleBrief,
          visibleHints,
        });

        const score = copyScoringResult.score;

        // Apply hint penalty to score
        const penaltyDetails = NanoAssistant.getPenaltyDetails(level.id, score, level.passingScore, level.difficulty);
        const finalScore = penaltyDetails.finalScore;

        setLastScore(finalScore);
        setFeedback(copyScoringResult.feedback || []);
        setCopyScoringResult(copyScoringResult);

        // Save attempt to backend for history
        try {
          if (user?.id) {
            const highMetrics = copyScoringResult.metrics
              .filter(m => m.value >= 60 && m.label)
              .map(m => m.label)
              .filter((label): label is string => label !== undefined);

            await convexHttpClient.mutation(api.mutations.saveUserLevelAttempt, {
              userId: user.id,
              levelId: level.id,
              score: finalScore,
              feedback: copyScoringResult.feedback || [],
              keywordsMatched: highMetrics.length > 0 ? highMetrics : [],
              copy: generatedCopyText,
            });

            // Refresh attempt history to include the new attempt
            const attempts = await convexHttpClient.query(api.queries.getUserLevelAttempts, {
              userId: user.id,
              levelId: level.id,
            });
            setAttemptHistory(attempts || []);
          }
        } catch (saveError) {
          logger.warn('GameScreen', 'Failed to save attempt', { error: saveError });
        }

        if (finalScore >= level.passingScore) {
          if (user?.id) {
            const nextAttemptsCount = (attemptHistory?.length ?? 0) + 1;
            await convexHttpClient.mutation(api.mutations.updateLevelProgress, {
              userId: user.id,
              appId: "prompt-pal",
              levelId: level.id,
              isCompleted: true,
              bestScore: finalScore,
              attempts: nextAttemptsCount,
              completedAt: Date.now(),
            });
          }

          await updateStreak();
          // Award XP for completing the level
          await addXP(getLevelXPReward(level));
          setShowResult(true);
          await completeLevel(level.id);
        } else {
          await loseLife();
        }
      }
    } catch (error: any) {
      logger.error('GameScreen', error, { operation: 'handleGenerate' });

      // Handle specific error types
      if (error.response?.status === 429) {
        Alert.alert('Rate Limited', 'Too many requests. Please wait before trying again.');
      } else if (error.response?.status === 403) {
        Alert.alert('Content Policy', 'Your prompt may violate content policies. Please try a different prompt.');
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const renderHeader = () => (
    <SafeAreaView className="bg-background" edges={['top']}>
      <View className="px-6 py-2">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => {
            if (level) {
              const moduleId = getModuleIdFromLevelType(level.type || 'image');
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push(`/game/levels/${moduleId}`);
              }
            } else {
              router.back();
            }
          }} className="w-10 h-10 items-center justify-center rounded-full bg-surfaceVariant">
            <Text className="text-onSurface text-xl font-bold">←</Text>
          </TouchableOpacity>

          <View className="items-center flex-1 mx-4">
            <Text className="text-primary text-[10px] font-black uppercase tracking-widest mb-0.5" numberOfLines={1}>
              {level.type === 'image' ? 'CHALLENGE' : level.type === 'code' ? level.moduleTitle : 'COPYWRITING CHALLENGE'}
            </Text>
            <Text className="text-onSurface text-base font-black text-center" numberOfLines={2}>
              {level.title}
            </Text>
          </View>

          <TouchableOpacity className="w-10 h-10 items-center justify-center rounded-full bg-surfaceVariant">
            <Text className="text-onSurface text-xl font-bold">?</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );

  const renderImageChallenge = () => {
    const imageUri = activeTab === 'target' ? level.targetImageUrl : (generatedImage || level.targetImageUrl);
    const isLocalAsset = activeTab === 'target' && typeof imageUri === 'number';

    return (
      <View className="px-6 pt-4 pb-6">
        {level.description && (
          <View className="mb-4">
            <Text className="text-onSurface text-base font-black leading-6 text-center">
              {level.description}
            </Text>
          </View>
        )}
        <Card className="p-0 overflow-hidden rounded-[40px] border-0" variant="elevated">
          <View className="aspect-square relative">
            {imageUri ? (
              <Image
                source={isLocalAsset ? imageUri : { uri: imageUri as string }}
                className="w-full h-full"
                resizeMode="cover"
                onError={(error) => {
                  console.log('Image load error:', error.nativeEvent);
                }}
              />
            ) : (
              <View className="w-full h-full bg-surfaceVariant items-center justify-center">
                <Ionicons name="image-outline" size={64} color="#9CA3AF" />
                <Text className="text-onSurfaceVariant text-center mt-4 font-bold">
                  {activeTab === 'target' ? 'Target Image Not Available' : 'Your Attempt Will Appear Here'}
                </Text>
              </View>
            )}
            {activeTab === 'target' && imageUri && (
              <View className="absolute top-6 right-6">
                <Badge label="🎯 TARGET" variant="primary" className="bg-primary px-3 py-1.5 rounded-full border-0" />
              </View>
            )}
          </View>

          <View className="flex-row bg-surfaceVariant/50 p-2 m-4 rounded-full">
            <TouchableOpacity
              onPress={() => setActiveTab('target')}
              className={`flex-1 py-3 rounded-full items-center ${activeTab === 'target' ? 'bg-surface' : ''}`}
            >
              <Text className={`font-bold ${activeTab === 'target' ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>Target Image</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('attempt')}
              className={`flex-1 py-3 rounded-full items-center ${activeTab === 'attempt' ? 'bg-surface' : ''}`}
            >
              <Text className={`font-bold ${activeTab === 'attempt' ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>Your Attempt</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    );
  };

  const renderCodeChallenge = () => {
    const hasCode = generatedCode && generatedCode.trim().length > 0;

    return (
      <View className="px-6 pt-4 pb-6">
        {level.description && (
          <View className="mb-4">
            <Text className="text-onSurface text-base font-black leading-6 text-center">
              {level.description}
            </Text>
          </View>
        )}

        <Card className="p-0 overflow-hidden rounded-[40px] border-0" variant="elevated">
          {/* Tab Content */}
          <View className="min-h-[400px] bg-surface">
            {activeCodeTab === 'instructions' ? (
              <View className="p-6">
                {/* Header */}
                <View className="flex-row items-center mb-2">
                  <Ionicons name="code-slash-outline" size={18} color="#FF6B00" />
                  <Text className="text-primary text-[11px] font-black uppercase tracking-[3px] ml-2">Algorithm Challenge</Text>
                </View>

                <Text className="text-onSurface text-[26px] font-black mb-6 leading-8">{level.title}</Text>

                {/* Mission Card — left accent border */}
                <View className="flex-row mb-5 bg-surfaceVariant/25 rounded-2xl overflow-hidden">
                  <View className="w-1 bg-onSurfaceVariant/40 rounded-l-2xl" />
                  <View className="flex-1 p-4 pl-4">
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="flag-outline" size={14} color="#6B7280" />
                      <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-[3px] ml-1.5">Mission</Text>
                    </View>
                    <Text className="text-onSurface text-[15px] leading-[22px]">
                      {level.description || 'Write a prompt that guides the model to solve this challenge.'}
                    </Text>
                  </View>
                </View>

                {/* Focus Area Card — warm accent */}
                {level.moduleTitle && (
                  <View className="flex-row mb-5 bg-primary/8 rounded-2xl overflow-hidden">
                    <View className="w-1 bg-primary rounded-l-2xl" />
                    <View className="flex-1 p-4 pl-4">
                      <View className="flex-row items-center mb-1.5">
                        <Ionicons name="compass-outline" size={14} color="#FF6B00" />
                        <Text className="text-primary text-[10px] font-black uppercase tracking-[3px] ml-1.5">Focus Area</Text>
                      </View>
                      <Text className="text-onSurface text-lg font-black">{level.moduleTitle}</Text>
                    </View>
                  </View>
                )}

                {/* How You Are Judged */}
                <View className="mb-5">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="analytics-outline" size={16} color="#6B7280" />
                    <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-[3px] ml-1.5">How You Are Judged</Text>
                  </View>
                  <View className="pl-1">
                    <View className="flex-row items-start mb-2.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-onSurfaceVariant/40 mt-1.5 mr-3" />
                      <Text className="text-onSurface text-[13px] leading-5 flex-1">Your prompt must lead the model to working JavaScript.</Text>
                    </View>
                    <View className="flex-row items-start mb-2.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-onSurfaceVariant/40 mt-1.5 mr-3" />
                      <Text className="text-onSurface text-[13px] leading-5 flex-1">Repeating the brief is not enough.</Text>
                    </View>
                    <View className="flex-row items-start">
                      <View className="w-1.5 h-1.5 rounded-full bg-onSurfaceVariant/40 mt-1.5 mr-3" />
                      <Text className="text-onSurface text-[13px] leading-5 flex-1">Strong prompts add constraints, output expectations, and edge-case guidance.</Text>
                    </View>
                  </View>
                </View>

                {/* Prompt Signals To Consider */}
                {visibleHints.length > 0 && (
                  <View className="mb-4">
                    <View className="flex-row items-center mb-3">
                      <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
                      <Text className="text-warning text-[10px] font-black uppercase tracking-[3px] ml-1.5">Prompt Signals To Consider</Text>
                    </View>
                    {visibleHints.map((hint, index) => (
                      <View key={`${level.id}-code-hint-${index}`} className="flex-row bg-warning/5 rounded-xl p-4 mb-2.5 border border-warning/15">
                        <View className="w-6 h-6 rounded-full bg-warning/15 items-center justify-center mr-3 mt-0.5">
                          <Text className="text-warning text-[10px] font-black">{index + 1}</Text>
                        </View>
                        <Text className="text-onSurface text-[14px] leading-[22px] flex-1">{hint}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View className="p-6">
                <CodeExecutionView
                  code={generatedCode || ''}
                  executionResult={codeExecutionResult}
                  language={level.language || 'javascript'}
                />
              </View>
            )}
          </View>

          {/* Tab Switcher */}
          <View className="flex-row bg-surfaceVariant/50 p-2 m-4 rounded-full">
            <TouchableOpacity
              onPress={() => setActiveCodeTab('instructions')}
              className={`flex-1 py-3 rounded-full items-center ${activeCodeTab === 'instructions' ? 'bg-surface' : ''}`}
            >
              <Text className={`font-bold ${activeCodeTab === 'instructions' ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>Instructions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveCodeTab('attempt')}
              className={`flex-1 py-3 rounded-full items-center ${activeCodeTab === 'attempt' ? 'bg-surface' : ''}`}
              disabled={!hasCode}
            >
              <Text className={`font-bold ${activeCodeTab === 'attempt' ? 'text-onSurface' : !hasCode ? 'text-onSurfaceVariant/40' : 'text-onSurfaceVariant'}`}>Your Attempt</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    );
  };

  const renderCopywritingChallenge = () => {
    const hasCopy = generatedCopy && generatedCopy.trim().length > 0;

    return (
      <View className="px-6 pt-4 pb-6">
        {level.description && (
          <View className="mb-4">
            <Text className="text-onSurface text-base font-black leading-6 text-center">
              {level.description}
            </Text>
          </View>
        )}

        <Card className="p-0 overflow-hidden rounded-[40px] border-0" variant="elevated">
          {/* Tab Content */}
          <View className="min-h-[400px] bg-surface">
            {activeCopyTab === 'brief' ? (
              <View className="p-6">
                {/* Header */}
                <View className="flex-row items-center mb-2">
                  <Ionicons name="create-outline" size={18} color="#FF6B00" />
                  <Text className="text-primary text-[11px] font-black uppercase tracking-[3px] ml-2">Copywriting Challenge</Text>
                </View>

                <Text className="text-onSurface text-[26px] font-black mb-6 leading-8">{level.title}</Text>

                {/* Visible Brief Card — left accent border */}
                <View className="flex-row mb-5 bg-surfaceVariant/25 rounded-2xl overflow-hidden">
                  <View className="w-1 bg-onSurfaceVariant/40 rounded-l-2xl" />
                  <View className="flex-1 p-4 pl-4">
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="document-text-outline" size={14} color="#6B7280" />
                      <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-[3px] ml-1.5">Visible Brief</Text>
                    </View>
                    <Text className="text-onSurface text-[15px] leading-[22px]">
                      {level.description || 'Write a prompt that steers the model toward stronger copy.'}
                    </Text>
                  </View>
                </View>

                {/* Deliverable Card — warm accent */}
                {level.briefTitle && (
                  <View className="flex-row mb-5 bg-primary/8 rounded-2xl overflow-hidden">
                    <View className="w-1 bg-primary rounded-l-2xl" />
                    <View className="flex-1 p-4 pl-4">
                      <View className="flex-row items-center mb-1.5">
                        <Ionicons name="gift-outline" size={14} color="#FF6B00" />
                        <Text className="text-primary text-[10px] font-black uppercase tracking-[3px] ml-1.5">Deliverable</Text>
                      </View>
                      <Text className="text-onSurface text-lg font-black">{level.briefTitle}</Text>
                    </View>
                  </View>
                )}

                {/* Word Limit */}
                {level.wordLimit && (
                  <View className="flex-row items-center mb-5 bg-secondary/5 rounded-xl px-4 py-3 border border-secondary/15">
                    <Ionicons name="text-outline" size={14} color="#4151FF" />
                    <Text className="text-onSurfaceVariant text-xs font-bold ml-2 mr-2">Word Limit:</Text>
                    <View className="bg-secondary/15 px-3 py-1 rounded-full">
                      <Text className="text-secondary text-[11px] font-black">{level.wordLimit.min || 0}–{level.wordLimit.max || 500} words</Text>
                    </View>
                  </View>
                )}

                {/* How You Are Judged */}
                <View className="mb-5">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="analytics-outline" size={16} color="#6B7280" />
                    <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-[3px] ml-1.5">How You Are Judged</Text>
                  </View>
                  <View className="pl-1">
                    <View className="flex-row items-start mb-2.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-onSurfaceVariant/40 mt-1.5 mr-3" />
                      <Text className="text-onSurface text-[13px] leading-5 flex-1">Your prompt needs strategy, not just a restatement of the brief.</Text>
                    </View>
                    <View className="flex-row items-start mb-2.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-onSurfaceVariant/40 mt-1.5 mr-3" />
                      <Text className="text-onSurface text-[13px] leading-5 flex-1">Strong prompts shape audience, tone, structure, and CTA.</Text>
                    </View>
                    <View className="flex-row items-start">
                      <View className="w-1.5 h-1.5 rounded-full bg-onSurfaceVariant/40 mt-1.5 mr-3" />
                      <Text className="text-onSurface text-[13px] leading-5 flex-1">Weak prompts that only paraphrase the brief score lower.</Text>
                    </View>
                  </View>
                </View>

                {/* Prompt Signals To Consider */}
                {visibleHints.length > 0 && (
                  <View className="mb-4">
                    <View className="flex-row items-center mb-3">
                      <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
                      <Text className="text-warning text-[10px] font-black uppercase tracking-[3px] ml-1.5">Prompt Signals To Consider</Text>
                    </View>
                    {visibleHints.map((hint, index) => (
                      <View key={`${level.id}-copy-hint-${index}`} className="flex-row bg-warning/5 rounded-xl p-4 mb-2.5 border border-warning/15">
                        <View className="w-6 h-6 rounded-full bg-warning/15 items-center justify-center mr-3 mt-0.5">
                          <Text className="text-warning text-[10px] font-black">{index + 1}</Text>
                        </View>
                        <Text className="text-onSurface text-[14px] leading-[22px] flex-1">{hint}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {level.requiredElements && level.requiredElements.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-widest mb-2">
                      Required Elements
                    </Text>
                    <View className="bg-surfaceVariant/30 rounded-2xl p-4">
                      {level.requiredElements.map((element, index) => (
                        <View key={`${level.id}-required-${index}`} className="flex-row items-center mb-2 last:mb-0">
                          <View className="w-4 h-4 rounded-full bg-primary/20 items-center justify-center mr-3">
                            <Text className="text-primary text-xs font-bold">✓</Text>
                          </View>
                          <Text className="text-onSurface text-sm flex-1">{element}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {level.wordLimit && (
                  <View className="mt-4 flex-row items-center">
                    <Text className="text-onSurfaceVariant text-xs mr-2">Word Limit:</Text>
                    <Badge
                      label={`${level.wordLimit.min || 0}-${level.wordLimit.max || 500} words`}
                      variant="surface"
                      className="bg-surfaceVariant border-0"
                    />
                  </View>
                )}
              </View>
            ) : (
              <View className="p-6">
                <CopyAnalysisView
                  copy={generatedCopy || ''}
                  scoringResult={copyScoringResult}
                />
              </View>
            )}
          </View>

          {/* Tab Switcher */}
          <View className="flex-row bg-surfaceVariant/50 p-2 m-4 rounded-full">
            <TouchableOpacity
              onPress={() => setActiveCopyTab('brief')}
              className={`flex-1 py-3 rounded-full items-center ${activeCopyTab === 'brief' ? 'bg-surface' : ''}`}
            >
              <Text className={`font-bold ${activeCopyTab === 'brief' ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>Brief</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveCopyTab('attempt')}
              className={`flex-1 py-3 rounded-full items-center ${activeCopyTab === 'attempt' ? 'bg-surface' : ''}`}
              disabled={!hasCopy}
            >
              <Text className={`font-bold ${activeCopyTab === 'attempt' ? 'text-onSurface' : !hasCopy ? 'text-onSurfaceVariant/40' : 'text-onSurfaceVariant'}`}>Your Attempt</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    );
  };

  const renderPromptSection = () => {
    const hintsUsed = level ? NanoAssistant.getHintsUsed(level.id) : 0;
    const hintsRemaining = level ? NanoAssistant.getHintsRemaining(level.id, level.difficulty) : 0;
    const maxHints = level ? NanoAssistant.getMaxHintsPerLevel(level.difficulty) : 4;
    const noHintsLeft = hintsRemaining === 0;

    // Word and character counting for copywriting
    const wordCount = level?.type === 'copywriting' ? prompt.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
    const charCount = prompt.length;
    const wordLimit = level?.wordLimit;
    const wordProgress = wordLimit ? Math.min((wordCount / wordLimit.max) * 100, 100) : 0;
    const isWordOverLimit = wordLimit && wordCount > wordLimit.max;
    const isWordUnderLimit = wordLimit && wordCount < wordLimit.min;

    return (
      <View className="px-6 pb-8">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-onSurfaceVariant text-xs font-black uppercase tracking-widest">
            {level.type === 'image' ? 'YOUR PROMPT' : level.type === 'code' ? 'YOUR PROMPT EDITOR' : 'CRAFT YOUR PROMPT'}
          </Text>
          <TouchableOpacity
            onPress={handleGetHint}
            disabled={isLoadingHint || hintCooldown > 0 || noHintsLeft}
            className={`flex-row items-center px-3 py-2 rounded-full ${noHintsLeft ? 'bg-surfaceVariant/30' : hintCooldown > 0 ? 'bg-surfaceVariant/50' : 'bg-secondary/20'
              }`}
          >
            {isLoadingHint ? (
              <ActivityIndicator size="small" color="#4151FF" />
            ) : (
              <>
                <Text className={`text-base mr-1 ${noHintsLeft ? 'opacity-50' : ''}`}>{hintCooldown > 0 ? '⏳' : '🪄'}</Text>
                <Text className={`text-xs font-bold ${noHintsLeft ? 'text-onSurfaceVariant/50' : hintCooldown > 0 ? 'text-onSurfaceVariant' : 'text-secondary'}`}>
                  {noHintsLeft ? 'No hints left' : hintCooldown > 0 ? `${hintCooldown}s` : hintsUsed === 0 ? 'Free Hint' : `Hint (${hintsRemaining}/${maxHints})`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Hints Display */}
        {hints.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowHints(!showHints)}
            className="mb-4"
          >
            <Card className={`p-4 rounded-[24px] border border-secondary/30 bg-secondary/5 ${showHints ? '' : 'overflow-hidden'}`}>
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Text className="text-secondary text-sm mr-2">💡</Text>
                  <Text className="text-secondary text-xs font-black uppercase tracking-widest">
                    Hints ({hints.length})
                  </Text>
                </View>
                <Text className="text-onSurfaceVariant text-xs">
                  {showHints ? '▲ Hide' : '▼ Show'}
                </Text>
              </View>
              {showHints && (
                <View className="mt-2">
                  {hints.map((hint, index) => (
                    <View key={index} className="flex-row mb-2">
                      <Text className="text-secondary text-xs mr-2">{index + 1}.</Text>
                      <Text className="text-onSurface text-sm flex-1">{hint}</Text>
                    </View>
                  ))}
                  <Text className="text-onSurfaceVariant text-[10px] mt-2 italic">
                    {NanoAssistant.getNextHintPenaltyDescription(level.id, level.difficulty)}
                  </Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        )}

        <View ref={inputRef}>
          <Card className="p-6 rounded-[32px] border-2 border-primary/30 bg-surfaceVariant/20 mb-4">
            <Input
              value={prompt}
              onChangeText={setPrompt}
              placeholder={level.type === 'image' ? "Describe the floating islands, the nebula sky..." : "Enter your prompt here..."}
              multiline
              className="text-lg text-onSurface min-h-[120px] bg-transparent border-0 p-0 mb-4"
              inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryId : undefined}
            />

            {level.type === 'copywriting' ? (
              <View className="space-y-3">
                {/* Word Count with Progress Bar */}
                {wordLimit && (
                  <View>
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-onSurfaceVariant text-xs font-bold uppercase tracking-widest">
                        Word Count
                      </Text>
                      <Text className={`text-xs font-bold ${isWordOverLimit ? 'text-error' : isWordUnderLimit ? 'text-warning' : 'text-success'}`}>
                        {wordCount} / {wordLimit.min}-{wordLimit.max}
                      </Text>
                    </View>
                    <View className="h-2 bg-surfaceVariant rounded-full overflow-hidden">
                      <View
                        className={`h-full rounded-full transition-all duration-300 ${
                          isWordOverLimit ? 'bg-error' : isWordUnderLimit ? 'bg-warning' : 'bg-success'
                        }`}
                        style={{ width: `${wordProgress}%` }}
                      />
                    </View>
                  </View>
                )}

                {/* Character and Token Counts */}
                <View className="flex-row items-center">
                  <View className="flex-row">
                    <Badge label={`${charCount} chars`} variant="surface" className="bg-surfaceVariant mr-2 border-0 px-3" />
                    <Badge label={`${tokenCount} tokens`} variant="surface" className="bg-surfaceVariant mr-2 border-0 px-3" />
                    {level.type === 'image' && <Badge label={level.style || ''} variant="primary" className="bg-primary/20 border-0 px-3" />}
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center">
                <View className="flex-row">
                  <Badge label={`${charCount} chars`} variant="surface" className="bg-surfaceVariant mr-2 border-0 px-3" />
                  <Badge label={`${tokenCount} tokens`} variant="surface" className="bg-surfaceVariant mr-2 border-0 px-3" />
                  {level.type === 'image' && <Badge label={level.style || ''} variant="primary" className="bg-primary/20 border-0 px-3" />}
                </View>
              </View>
            )}
          </Card>
        </View>

        <View className="mt-6">
          <Button
            onPress={handleGenerate}
            loading={isGenerating}
            variant="primary"
            size="lg"
            fullWidth
            className="rounded-full py-5 shadow-glow"
          >
            {level.type === 'image' ? 'Generate & Compare' : 'Generate'}
          </Button>
        </View>

        {/* Evaluation Results */}
        {lastScore !== null && level.type === 'image' && (
          <View className="mt-4">
            <Card className="p-4 rounded-[24px] border border-primary/30 bg-primary/5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-onSurface text-sm font-black">Evaluation Score</Text>
                <View className="flex-row items-center">
                  <Text className="text-primary text-xl font-black mr-2">{lastScore}%</Text>
                  <View className={`w-3 h-3 rounded-full ${lastScore >= level.passingScore ? 'bg-success' : 'bg-error'}`} />
                </View>
              </View>

              {feedback && feedback.length > 0 && (
                <View className="mt-2">
                  <Text className="text-onSurface text-xs font-bold uppercase tracking-widest mb-2">Feedback</Text>
                  {feedback.map((feedbackItem, index) => (
                    <View key={index} className="flex-row mb-1">
                      <Text className="text-onSurfaceVariant text-xs mr-2">•</Text>
                      <Text className="text-onSurface text-sm flex-1">{feedbackItem}</Text>
                    </View>
                  ))}
                </View>
              )}

              {matchedKeywords && matchedKeywords.length > 0 && (
                <View className="mt-3">
                  <Text className="text-onSurface text-xs font-bold uppercase tracking-widest mb-2">Keywords Captured</Text>
                  <View className="flex-row flex-wrap">
                    {matchedKeywords.map((keyword, index) => (
                      <View key={index} className="bg-primary/20 px-2 py-1 rounded-full mr-2 mb-1">
                        <Text className="text-primary text-xs font-bold">{keyword}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Attempt History */}
        {attemptHistory.length > 0 && level.type === 'image' && (
          <View className="mt-4">
            <Card className="p-4 rounded-[24px] border border-outline/30 bg-surfaceVariant/20">
              <Text className="text-onSurface text-sm font-black mb-3">Attempt History</Text>

              <View className="space-y-3">
                {attemptHistory.map((attempt) => (
                  <View key={attempt.id} className="bg-surfaceVariant/30 rounded-lg p-3">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-onSurfaceVariant text-xs font-bold uppercase tracking-widest">
                        Attempt #{attempt.attemptNumber}
                      </Text>
                      <View className="flex-row items-center">
                        <Text className="text-onSurfaceVariant text-sm mr-2">{attempt.score}%</Text>
                        <View className={`w-2 h-2 rounded-full ${attempt.score >= (level?.passingScore || 75) ? 'bg-success' : 'bg-error'}`} />
                      </View>
                    </View>

                    {attempt.feedback && attempt.feedback.length > 0 && (
                      <View className="mt-2">
                        <Text className="text-onSurfaceVariant text-xs font-bold uppercase tracking-widest mb-1">Feedback</Text>
                        {attempt.feedback.map((feedbackItem, index) => (
                          <View key={index} className="flex-row mb-1">
                            <Text className="text-onSurfaceVariant text-xs mr-2">•</Text>
                            <Text className="text-onSurfaceVariant text-xs flex-1">{feedbackItem}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {attempt.keywordsMatched && attempt.keywordsMatched.length > 0 && (
                      <View className="mt-2">
                        <Text className="text-onSurfaceVariant text-xs font-bold uppercase tracking-widest mb-1">Keywords</Text>
                        <View className="flex-row flex-wrap">
                          {attempt.keywordsMatched.map((keyword, index) => (
                            <View key={index} className="bg-surfaceVariant/50 px-2 py-0.5 rounded mr-1 mb-1">
                              <Text className="text-onSurfaceVariant text-xs">{keyword}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    <Text className="text-onSurfaceVariant text-xs mt-2">
                      {new Date(attempt.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}
      </View>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        {renderHeader()}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="text-onSurface mt-4">Loading level...</Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View className="flex-1 bg-background">
        {renderHeader()}
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text className="text-onSurface text-xl font-black mt-4 text-center">
            Unable to Load Level
          </Text>
          <Text className="text-onSurfaceVariant text-center mt-2 mb-6">
            {error}
          </Text>
          <Button
            onPress={() => {
              setError(null);
              setIsLoading(true);
              // Reload the level
              const loadLevel = async () => {
                try {
                  const apiLevel = await convexHttpClient.query(api.queries.getLevelById, { id: id as string });
                  if (apiLevel) {
                    const localLevel = getLocalLevelById(id as string);
                    const processedLevel = {
                      ...apiLevel,
                      // Use local asset for display, API URL for evaluation
                      targetImageUrl: localLevel?.targetImageUrl ?? apiLevel.targetImageUrl,
                      // Use API-provided Convex storage URL for evaluation (ensure it's a string)
                      targetImageUrlForEvaluation: typeof apiLevel.targetImageUrl === 'string' ? apiLevel.targetImageUrl : undefined,
                      hiddenPromptKeywords: apiLevel.hiddenPromptKeywords || localLevel?.hiddenPromptKeywords || [],
                    };
                    setLevel(processedLevel);
                    startLevel(processedLevel.id);
                    NanoAssistant.resetHintsForLevel(processedLevel.id);
                    setHints([]);
                  }
                } catch (err) {
                  logger.error('GameScreen', err, { operation: 'retryLoadLevel', id });
                  setError('Failed to load level. Please check your connection and try again.');
                } finally {
                  setIsLoading(false);
                }
              };
              loadLevel();
            }}
            className="mb-4"
          >
            Try Again
          </Button>
          <Button
            variant="outline"
            onPress={() => router.back()}
          >
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  // Show error if level not loaded
  if (!level) {
    return (
      <View className="flex-1 bg-background">
        {renderHeader()}
        <View className="flex-1 items-center justify-center">
          <Text className="text-onSurface">No level data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {renderHeader()}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 60}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          onScroll={(event) => {
            scrollYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 + keyboardHeight }}
        >
          {level.type === 'image' && renderImageChallenge()}
          {level.type === 'code' && renderCodeChallenge()}
          {level.type === 'copywriting' && renderCopywritingChallenge()}

          {renderPromptSection()}
        </ScrollView>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={inputAccessoryId}>
          <View className="px-4 py-2 bg-surface border-t border-outline flex-row justify-end">
            <TouchableOpacity
              onPress={Keyboard.dismiss}
              className="px-4 py-2 rounded-full bg-primary/15"
            >
              <Text className="text-primary text-xs font-black uppercase tracking-widest">Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      {Platform.OS !== 'ios' && keyboardHeight > 0 && (
        <View
          className="absolute left-0 right-0 px-4 py-2 bg-surface border-t border-outline flex-row justify-end"
          style={{ bottom: keyboardHeight }}
        >
          <TouchableOpacity
            onPress={Keyboard.dismiss}
            className="px-4 py-2 rounded-full bg-primary/15"
          >
            <Text className="text-primary text-xs font-black uppercase tracking-widest">Done</Text>
          </TouchableOpacity>
        </View>
      )}

      <ResultModal
        visible={showResult}
        score={lastScore || 0}
        xp={50}
        moduleType={level.type}
        testCases={codeExecutionResult?.testResults}
        output={codeExecutionResult?.output}
        copyMetrics={copyScoringResult?.metrics}
        imageSimilarity={lastScore || undefined}
        imageFeedback={feedback}
        keywordsMatched={matchedKeywords}
        onNext={() => {
          setShowResult(false);
          if (level) {
            const moduleId = getModuleIdFromLevelType(level.type || 'image');
            router.push(`/game/levels/${moduleId}`);
          } else {
            router.push(`/game/levels/${getModuleIdFromLevelType('image')}`);
          }
        }}
        onClose={() => setShowResult(false)}
      />
    </View>
  );
}
