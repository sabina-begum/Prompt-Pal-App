import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

const getIsoDateString = (date: Date): string => date.toISOString().split("T")[0];

function toPublicLevel(level: any) {
  return {
    id: level.id,
    type: level.type,
    title: level.title,
    description: level.description,
    difficulty: level.difficulty,
    passingScore: level.passingScore,
    unlocked: level.unlocked,
    isActive: level.isActive,
    order: level.order,
    targetImageUrl: level.targetImageUrl,
    hiddenPromptKeywords: level.hiddenPromptKeywords,
    style: level.style,
    moduleTitle: level.moduleTitle,
    language: level.language,
    briefTitle: level.briefTitle,
    wordLimit: level.wordLimit,
    metrics: level.metrics,
    hints: level.hints,
    estimatedTime: level.estimatedTime,
    points: level.points,
    tags: level.tags,
    learningObjectives: level.learningObjectives,
    prerequisites: level.prerequisites,
    createdAt: level.createdAt,
    updatedAt: level.updatedAt,
  };
}

// Get user usage and plan for a specific app
// userId is now automatically extracted from the auth token
export const getUserUsage = query({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { appId } = args;
    
    // Get user ID from auth context (Clerk JWT)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get app configuration
    const app = await ctx.db
      .query("apps")
      .withIndex("by_app_id", (q) => q.eq("id", appId))
      .first();

    const now = Date.now();
    // Calculate actual days in current month for accurate quota periods
    const currentDate = new Date(now);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const oneMonthMs = daysInMonth * 24 * 60 * 60 * 1000;

    if (!app) {
      return {
        tier: "free" as const,
        used: {
          textCalls: 0,
          imageCalls: 0,
          audioSummaries: 0,
        },
        limits: {
          textCalls: 50,
          imageCalls: 50,
          audioSummaries: 0,
        },
        periodStart: now,
        periodEnd: now + oneMonthMs,
      };
    }

    // Get user plan
    const plan = await ctx.db
      .query("appPlans")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .first();

    let tier: "free" | "pro" = "free";
    let used = {
      textCalls: 0,
      imageCalls: 0,
      audioSummaries: 0,
    };
    let periodStart = now;

    if (plan) {
      tier = plan.tier;
      periodStart = plan.periodStart;

      // Check if we need to reset the period
      if (now - plan.periodStart >= oneMonthMs) {
        // Period has expired, show zero usage
        used = {
          textCalls: 0,
          imageCalls: 0,
          audioSummaries: 0,
        };
      } else {
        used = plan.used;
      }
    }

    // Get limits based on tier
    const limits = tier === "pro" ? app.proLimits : app.freeLimits;

    return {
      tier,
      used,
      limits,
      periodStart,
      periodEnd: periodStart + oneMonthMs,
    };
  },
});

// Get app configuration (for validation)
export const getApp = query({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_app_id", (q) => q.eq("id", args.appId))
      .first();

    return app;
  },
});

// Get user progress data
// NOTE: userId is now extracted from authentication context for security
export const getUserProgress = query({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { appId } = args;
    
    // Get userId from authenticated identity - prevents spoofing
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .first();

    if (!progress) {
      // Return default progress
      return {
        levelId: "",
        isUnlocked: false,
        isCompleted: false,
        bestScore: 0,
        attempts: 0,
        timeSpent: 0,
        completedAt: null,
        hintsUsed: 0,
        firstAttemptScore: 0,
      };
    }

    return {
      levelId: progress.levelId,
      isUnlocked: progress.isUnlocked,
      isCompleted: progress.isCompleted,
      bestScore: progress.bestScore,
      attempts: progress.attempts,
      timeSpent: progress.timeSpent,
      completedAt: progress.completedAt,
      hintsUsed: progress.hintsUsed,
      firstAttemptScore: progress.firstAttemptScore,
    };
  },
});

// Get user learning module progress
export const getUserModules = query({
  args: {
    userId: v.string(),
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, appId } = args;

    const modules = await ctx.db
      .query("userModules")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .collect();

    return modules.map(module => ({
      moduleId: module.moduleId,
      level: module.level,
      topic: module.topic,
      progress: module.progress,
      completedAt: module.completedAt,
    }));
  },
});

// Get user quest states
export const getUserQuests = query({
  args: {
    userId: v.string(),
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, appId } = args;

    const quests = await ctx.db
      .query("userQuests")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .collect();

    return quests.map(quest => ({
      questId: quest.questId,
      completed: quest.completed,
      completedAt: quest.completedAt,
      expiresAt: quest.expiresAt,
    }));
  },
});

// Get user game state
export const getUserGameState = query({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { appId } = args;
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const userId = identity.subject;

    const gameState = await ctx.db
      .query("gameProgress")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .first();

    if (!gameState) {
      // Return default game state
      return {
        currentLevelId: null,
        lives: 3,
        score: 0,
        isPlaying: false,
        unlockedLevels: [
          "image-1-easy", "image-2-easy", "image-3-easy",       // Image module
          "code-1-easy", "code-2-easy", "code-3-easy",           // Code module
          "copywriting-1-easy", "copywriting-2-easy", "copywriting-3-easy" // Copywriting module
        ], // Start with first 3 easy levels of all 3 modules unlocked
        completedLevels: [],
      };
    }

    return {
      currentLevelId: gameState.currentLevelId,
      lives: gameState.lives,
      score: gameState.score,
      isPlaying: gameState.isPlaying,
      unlockedLevels: gameState.unlockedLevels,
      completedLevels: gameState.completedLevels,
    };
  },
});

// Get all learning modules for an app
export const getLearningModules = query({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { appId } = args;

    const modules = await ctx.db
      .query("learningModules")
      .withIndex("by_app", (q) => q.eq("appId", appId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return modules
      .sort((a, b) => a.order - b.order)
      .map(module => ({
        id: module.id,
        category: module.category,
        title: module.title,
        level: module.level,
        topic: module.topic,
        description: module.description,
        icon: module.icon,
        accentColor: module.accentColor,
        buttonText: module.buttonText,
      }));
  },
});

// Get all daily quests for an app
export const getDailyQuests = query({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { appId } = args;

    const quests = await ctx.db
      .query("dailyQuests")
      .withIndex("by_app", (q) => q.eq("appId", appId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return quests.map(quest => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      xpReward: quest.xpReward,
      type: quest.type,
      category: quest.category,
    }));
  },
});

// Get all levels for an app
export const getLevels = query({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { appId } = args;

    const levels = await ctx.db
      .query("levels")
      .withIndex("by_app_order", (q) => q.eq("appId", appId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return levels.map(level => ({
      id: level.id,
      type: level.type,
      title: level.title,
      difficulty: level.difficulty,
      targetImageUrl: level.targetImageUrl,
      hiddenPromptKeywords: level.hiddenPromptKeywords,
      passingScore: level.passingScore,
      order: level.order,
      unlocked: level.unlocked,
      prerequisites: level.prerequisites,
    }));
  },
});

// Get user AI generations history
export const getUserGenerations = query({
  args: {
    userId: v.string(),
    appId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, appId, limit = 50 } = args;

    const generations = await ctx.db
      .query("aiGenerations")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("appId"), appId))
      .order("desc")
      .take(limit);

    return generations.map(gen => ({
      requestId: gen.requestId,
      type: gen.type,
      model: gen.model,
      promptLength: gen.promptLength,
      responseLength: gen.responseLength,
      tokensUsed: gen.tokensUsed,
      durationMs: gen.durationMs,
      success: gen.success,
      errorMessage: gen.errorMessage,
      createdAt: gen.createdAt,
    }));
  },
});

// Get analytics events for analysis
export const getAnalyticsEvents = query({
  args: {
    appId: v.string(),
    eventType: v.optional(v.string()),
    limit: v.optional(v.number()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { appId, eventType, limit = 100, startTime, endTime } = args;

    let query = ctx.db
      .query("userEvents")
      .filter((q) => q.eq(q.field("appId"), appId));

    if (eventType) {
      query = query.filter((q) => q.eq(q.field("eventType"), eventType));
    }

    if (startTime) {
      query = query.filter((q) => q.gte(q.field("timestamp"), startTime));
    }

    if (endTime) {
      query = query.filter((q) => q.lte(q.field("timestamp"), endTime));
    }

    const events = await query
      .order("desc")
      .take(limit);

    return events.map(event => ({
      userId: event.userId,
      eventType: event.eventType,
      eventData: event.eventData,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      userAgent: event.userAgent,
    }));
  },
});

// ===== GAMIFICATION SYSTEM QUERIES =====

// Get user profile
export const getUser = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    return user;
  },
});

// Get user preferences
export const getUserPreferences = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!prefs) {
      return {
        soundEnabled: true,
        hapticsEnabled: true,
        theme: "dark",
        difficulty: "easy",
        favoriteModule: null,
      };
    }

    return {
      soundEnabled: prefs.soundEnabled,
      hapticsEnabled: prefs.hapticsEnabled,
      theme: prefs.theme,
      difficulty: prefs.difficulty,
      favoriteModule: prefs.favoriteModule,
    };
  },
});

// Get user statistics
export const getUserStatistics = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("userStatistics")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!stats) {
      return {
        totalXp: 0,
        currentLevel: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        globalRank: 0,
        points: 0,
      };
    }

    return {
      totalXp: stats.totalXp,
      currentLevel: stats.currentLevel,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      lastActivityDate: stats.lastActivityDate,
      globalRank: stats.globalRank,
      points: stats.points,
    };
  },
});

// Get current user's statistics (auth-based)
export const getMyUserStatistics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const stats = await ctx.db
      .query("userStatistics")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!stats) {
      return {
        totalXp: 0,
        currentLevel: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        globalRank: 0,
        points: 0,
      };
    }

    return {
      totalXp: stats.totalXp,
      currentLevel: stats.currentLevel,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      lastActivityDate: stats.lastActivityDate,
      globalRank: stats.globalRank,
      points: stats.points,
    };
  },
});

// Get user performance results for profile page
export const getUserResults = query({
  args: {
    userId: v.string(),
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, appId } = args;

    // Get all completed user progress for this user and app
    const completedProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    // Transform the data into the expected format
    const taskResults = completedProgress.map((progress) => {
      // Determine task type from level ID
      const taskType = getTaskTypeFromLevelId(progress.levelId);

      return {
        id: progress.levelId,
        score: progress.bestScore,
        completedAt: progress.completedAt ? new Date(progress.completedAt).toISOString() : null,
        taskType,
      };
    });

    return {
      taskResults,
    };
  },
});

// Helper function to determine task type from level ID
function getTaskTypeFromLevelId(levelId: string): "image" | "code" | "copywriting" {
  if (levelId.startsWith("image-")) {
    return "image";
  } else if (levelId.startsWith("code-") || levelId.startsWith("coding-")) {
    return "code";
  } else if (levelId.startsWith("copywriting-") || levelId.startsWith("copy-")) {
    return "copywriting";
  } else {
    // Default fallback
    return "image";
  }
}

// Get leaderboard (top users by XP)
export const getLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { limit = 50, offset = 0 } = args;

    const users = await ctx.db
      .query("userStatistics")
      .withIndex("by_xp")
      .order("desc")
      .paginate({ numItems: limit, cursor: null });

    const leaderboard = [];
    for (const stat of users.page) {
      const user = await ctx.db.query("users").withIndex("by_clerk_id", (q) => q.eq("clerkId", stat.userId)).first();
      if (user) {
        leaderboard.push({
          userId: user._id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          totalXp: stat.totalXp,
          currentLevel: stat.currentLevel,
          globalRank: stat.globalRank,
          currentStreak: stat.currentStreak,
        });
      }
    }

    return {
      leaderboard,
      continueCursor: users.continueCursor,
    };
  },
});

// Get all levels with optional filtering
export const getAllLevels = query({
  args: {
    type: v.optional(v.union(v.literal("image"), v.literal("code"), v.literal("copywriting"))),
    difficulty: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { type, difficulty, limit } = args;

    let query = ctx.db.query("levels");

    if (type) {
      query = query.filter((q) => q.eq(q.field("type"), type));
    }

    if (difficulty) {
      query = query.filter((q) => q.eq(q.field("difficulty"), difficulty));
    }

    const levels = await query.take(limit || 100);

    return levels.map(toPublicLevel);
  },
});

// Get level by ID
export const getLevelById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const level = await ctx.db
      .query("levels")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    if (!level) return null;

    return toPublicLevel(level);
  },
});

export const getLevelEvaluationData = internalQuery({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const level = await ctx.db
      .query("levels")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    if (!level) return null;

    return {
      id: level.id,
      type: level.type,
      title: level.title,
      description: level.description,
      difficulty: level.difficulty,
      passingScore: level.passingScore,
      moduleTitle: level.moduleTitle,
      requirementBrief: level.requirementBrief,
      requirementImage: level.requirementImage,
      language: level.language,
      functionName: level.functionName,
      testCases: level.testCases,
      briefTitle: level.briefTitle,
      briefProduct: level.briefProduct,
      briefTarget: level.briefTarget,
      briefTone: level.briefTone,
      briefGoal: level.briefGoal,
      wordLimit: level.wordLimit,
      requiredElements: level.requiredElements,
      metrics: level.metrics,
      hints: level.hints,
      promptChecklist: level.promptChecklist,
    };
  },
});

// Get user attempts for a specific level
export const getUserLevelAttempts = query({
  args: {
    userId: v.string(),
    levelId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, levelId } = args;

    const attempts = await ctx.db
      .query("userLevelAttempts")
      .withIndex("by_user_level", (q) => q.eq("userId", userId).eq("levelId", levelId))
      .order("asc") // Order by attempt number (which should be ascending)
      .collect();

    return attempts.map(attempt => ({
      id: attempt._id,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      feedback: attempt.feedback,
      keywordsMatched: attempt.keywordsMatched,
      imageUrl: attempt.imageUrl,
      code: attempt.code,
      copy: attempt.copy,
      testResults: attempt.testResults,
      createdAt: attempt.createdAt,
    }));
  },
});

// Get the next attempt number for a user and level
export const getNextAttemptNumber = query({
  args: {
    userId: v.string(),
    levelId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, levelId } = args;

    const lastAttempt = await ctx.db
      .query("userLevelAttempts")
      .withIndex("by_user_level", (q) => q.eq("userId", userId).eq("levelId", levelId))
      .order("desc")
      .first();

    return lastAttempt ? lastAttempt.attemptNumber + 1 : 1;
  },
});

// Get user progress on all levels
export const getUserLevelProgress = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return progress.map(p => ({
      levelId: p.levelId,
      isUnlocked: p.isUnlocked,
      isCompleted: p.isCompleted,
      bestScore: p.bestScore,
      attempts: p.attempts,
      timeSpent: p.timeSpent,
      completedAt: p.completedAt,
      hintsUsed: p.hintsUsed,
      firstAttemptScore: p.firstAttemptScore,
    }));
  },
});

// Get progress on specific level
export const getLevelProgress = query({
  args: {
    userId: v.string(),
    levelId: v.string(),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user_level", (q) => q.eq("userId", args.userId).eq("levelId", args.levelId))
      .first();

    if (!progress) {
      return {
        isUnlocked: false,
        isCompleted: false,
        bestScore: 0,
        attempts: 0,
        timeSpent: 0,
        completedAt: null,
        hintsUsed: 0,
        firstAttemptScore: 0,
      };
    }

    return {
      isUnlocked: progress.isUnlocked,
      isCompleted: progress.isCompleted,
      bestScore: progress.bestScore,
      attempts: progress.attempts,
      timeSpent: progress.timeSpent,
      completedAt: progress.completedAt,
      hintsUsed: progress.hintsUsed,
      firstAttemptScore: progress.firstAttemptScore,
    };
  },
});

// Get all learning modules
export const getAllLearningModules = query({
  args: {
    category: v.optional(v.string()),
    level: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { category, level } = args;

    let query = ctx.db.query("learningModules");

    if (category) {
      query = query.filter((q) => q.eq(q.field("category"), category));
    }

    if (level) {
      query = query.filter((q) => q.eq(q.field("level"), level));
    }

    const modules = await query.collect();

    return modules.map(module => ({
      id: module.id,
      category: module.category,
      title: module.title,
      level: module.level,
      topic: module.topic,
      icon: module.icon,
      accentColor: module.accentColor,
      buttonText: module.buttonText,
      description: module.description,
      objectives: module.objectives,
      content: module.content,
      type: module.type,
      format: module.format,
      estimatedTime: module.estimatedTime,
      tags: module.tags,
    }));
  },
});

// Get learning resources
export const getLearningResources = query({
  args: {
    appId: v.string(),
    category: v.optional(v.string()),
    type: v.optional(v.union(v.literal("guide"), v.literal("cheatsheet"), v.literal("lexicon"), v.literal("case-study"), v.literal("prompting-tip"))),
  },
  handler: async (ctx, args) => {
    const { appId, category, type } = args;

    let query = ctx.db
      .query("learningResources")
      .withIndex("by_app_category", (q) => category ? q.eq("appId", appId).eq("category", category) : q.eq("appId", appId))
      .filter((q) => q.eq(q.field("isActive"), true));

    if (type) {
      query = query.filter((q) => q.eq(q.field("type"), type));
    }

    const resources = await query.collect();

    return resources.sort((a, b) => a.order - b.order);
  },
});

// Get learning resource by ID
export const getLearningResourceById = query({
  args: {
    id: v.string(),
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db
      .query("learningResources")
      .filter((q) => q.eq(q.field("id"), args.id))
      .filter((q) => q.eq(q.field("appId"), args.appId))
      .first();

    return resource;
  },
});

// Get comprehensive library data for the UI
export const getLibraryData = query({
  args: {
    userId: v.string(),
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, appId } = args;

    // 1. Fetch all active learning modules
    const modules = await ctx.db
      .query("learningModules")
      .withIndex("by_app", (q) => q.eq("appId", appId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // 2. Fetch all active learning resources
    const resources = await ctx.db
      .query("learningResources")
      .filter((q) => q.eq(q.field("appId"), appId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // 3. Fetch user progress
    const userStats = await ctx.db
      .query("userStatistics")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const moduleProgress = await ctx.db
      .query("userModuleProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const levelProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .collect();

    // 4. Map everything together
    const categories = Array.from(new Set([
      ...modules.map(m => m.category),
      ...resources.map(r => r.category)
    ]));

    const structuredLibrary = categories.map(cat => ({
      category: cat,
      modules: modules
        .filter(m => m.category === cat)
        .sort((a, b) => a.order - b.order)
        .map(m => ({
          ...m,
          userProgress: moduleProgress.find(p => p.moduleId === m.id)?.progress || 0,
          isCompleted: moduleProgress.find(p => p.moduleId === m.id)?.completed || false,
        })),
      resources: resources
        .filter(r => r.category === cat)
        .sort((a, b) => a.order - b.order)
    }));

    return {
      userSummary: {
        totalXp: userStats?.totalXp || 0,
        currentLevel: userStats?.currentLevel || 1,
        streak: userStats?.currentStreak || 0,
        completedLevels: levelProgress.filter(p => p.isCompleted).length,
      },
      categories: structuredLibrary,
    };
  },
});

// Get learning module by ID
export const getLearningModuleById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const module = await ctx.db
      .query("learningModules")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    return module;
  },
});

// Get user module progress
export const getUserModuleProgress = query({
  args: {
    userId: v.string(),
    moduleId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, moduleId } = args;

    let query = ctx.db
      .query("userModuleProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    if (moduleId) {
      query = query.filter((q) => q.eq(q.field("moduleId"), moduleId));
    }

    const progress = await query.collect();

    return progress.map(p => ({
      moduleId: p.moduleId,
      progress: p.progress,
      completed: p.completed,
      completedAt: p.completedAt,
    }));
  },
});

// Get active daily quests
export const getActiveDailyQuests = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    const now = Date.now();
    const quests = await ctx.db
      .query("dailyQuests")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();

    // If userId provided, include completion status
    if (userId) {
      const completions = await ctx.db
        .query("userQuestCompletions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      const completionMap = new Map(
        completions.map(c => [c.questId, c])
      );

      return quests.map(quest => ({
        id: quest.id,
        title: quest.title,
        description: quest.description,
        xpReward: quest.xpReward,
        questType: quest.questType,
        requirements: quest.requirements,
        difficulty: quest.difficulty,
        isActive: quest.isActive,
        expiresAt: quest.expiresAt,
        completed: completionMap.has(quest.id) ? completionMap.get(quest.id)!.completed : false,
        completedAt: completionMap.has(quest.id) ? completionMap.get(quest.id)!.completedAt : null,
      }));
    }

    return quests.map(quest => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      xpReward: quest.xpReward,
      questType: quest.questType,
      requirements: quest.requirements,
      difficulty: quest.difficulty,
      isActive: quest.isActive,
      expiresAt: quest.expiresAt,
      completed: false,
      completedAt: null,
    }));
  },
});

// Get daily quest by ID
export const getDailyQuestById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const quest = await ctx.db
      .query("dailyQuests")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    return quest;
  },
});

// Get current quest (assigned quest for today)
export const getCurrentQuest = query({
  args: {
    appId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const resolvedUserId = args.userId ?? identity?.subject;

    if (!resolvedUserId) {
      throw new Error("User must be authenticated");
    }

    const now = Date.now();
    const assignedDate = getIsoDateString(new Date(now));

    const assignment = await ctx.db
      .query("userDailyQuests")
      .withIndex("by_user_app_date", (q) =>
        q.eq("userId", resolvedUserId).eq("appId", args.appId).eq("assignedDate", assignedDate)
      )
      .first();

    if (!assignment || assignment.expiresAt <= now) {
      return null;
    }

    const quest = await ctx.db
      .query("dailyQuests")
      .filter((q) => q.eq(q.field("id"), assignment.questId))
      .first();

    if (!quest || !quest.isActive || (quest.expiresAt && quest.expiresAt <= now)) {
      return null;
    }

    const completion = await ctx.db
      .query("userQuestCompletions")
      .withIndex("by_user_quest", (q) => q.eq("userId", resolvedUserId).eq("questId", quest.id))
      .first();

    const timeRemaining = quest.expiresAt
      ? Math.max(0, Math.ceil((quest.expiresAt - now) / (1000 * 60 * 60)))
      : 24;

    return {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      xpReward: quest.xpReward,
      timeRemaining,
      completed: completion?.completed ?? false,
      expiresAt: quest.expiresAt ?? assignment.expiresAt,
    };
  },
});

// Get all achievements
export const getAllAchievements = query({
  args: {},
  handler: async (ctx) => {
    const achievements = await ctx.db
      .query("achievements")
      .collect();

    return achievements.map(achievement => ({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      rarity: achievement.rarity,
      conditionType: achievement.conditionType,
      conditionValue: achievement.conditionValue,
      conditionMetadata: achievement.conditionMetadata,
    }));
  },
});

// Get achievement by ID
export const getAchievementById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const achievement = await ctx.db
      .query("achievements")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    return achievement;
  },
});

// Get user achievements
export const getUserAchievements = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const userAchievements = await ctx.db
      .query("userAchievements")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get full achievement details
    const achievements = [];
    for (const ua of userAchievements) {
      const achievement = await ctx.db
        .query("achievements")
        .filter((q) => q.eq(q.field("id"), ua.achievementId))
        .first();
      if (achievement) {
        achievements.push({
          id: achievement.id,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          rarity: achievement.rarity,
          unlockedAt: ua.unlockedAt,
        });
      }
    }

    return achievements;
  },
});

// Get game sessions for user
export const getUserGameSessions = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, limit = 10 } = args;

    const sessions = await ctx.db
      .query("gameSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return sessions.map(session => ({
      id: session._id,
      levelId: session.levelId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      score: session.score,
      livesUsed: session.livesUsed,
      hintsUsed: session.hintsUsed,
      completed: session.completed,
      userPrompt: session.userPrompt,
      aiResponse: session.aiResponse,
      createdAt: session.createdAt,
    }));
  },
});

// Get analytics for levels (completion rates, average scores, etc.)
export const getLevelAnalytics = query({
  args: {
    levelId: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { levelId, startTime, endTime } = args;

    let query = ctx.db.query("gameSessions");

    if (levelId) {
      query = query.filter((q) => q.eq(q.field("levelId"), levelId));
    }

    if (startTime) {
      query = query.filter((q) => q.gte(q.field("startedAt"), startTime));
    }

    if (endTime) {
      query = query.filter((q) => q.lte(q.field("startedAt"), endTime));
    }

    const sessions = await query.collect();

    if (sessions.length === 0) {
      return {
        totalAttempts: 0,
        completionRate: 0,
        averageScore: 0,
        averageTime: 0,
        totalHints: 0,
      };
    }

    const completedSessions = sessions.filter(s => s.completed);
    const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
    const totalTime = sessions
      .filter(s => s.endedAt)
      .reduce((sum, s) => sum + (s.endedAt! - s.startedAt), 0);
    const totalHints = sessions.reduce((sum, s) => sum + s.hintsUsed, 0);

    return {
      totalAttempts: sessions.length,
      completionRate: completedSessions.length / sessions.length,
      averageScore: totalScore / sessions.length,
      averageTime: totalTime / Math.max(1, sessions.filter(s => s.endedAt).length),
      totalHints,
    };
  },

});

// ===== GENERATED IMAGES STORAGE =====

// Get image URL for display
export const getImageUrl = query({
  args: { imageId: v.id("generatedImages") },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    const url = await ctx.storage.getUrl(image.fileId);
    return {
      url,
      metadata: {
        prompt: image.prompt,
        model: image.model,
        createdAt: image.createdAt,
        mimeType: image.mimeType,
        size: image.size,
      },
    };
  },
});

// Get user's generated images
export const getUserImages = query({
  args: {
    userId: v.string(),
    appId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, appId, limit = 20 } = args;

    let query = ctx.db.query("generatedImages").withIndex("by_user", (q) => q.eq("userId", userId));

    if (appId) {
      query = query.filter((q) => q.eq(q.field("appId"), appId));
    }

    const images = await query
      .order("desc")
      .take(limit);

    // Get URLs for all images
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        const url = await ctx.storage.getUrl(image.fileId);
        return {
          id: image._id,
          url,
          prompt: image.prompt,
          model: image.model,
          createdAt: image.createdAt,
          mimeType: image.mimeType,
          size: image.size,
        };
      })
    );

    return imagesWithUrls;
  },
});

// ===== FRIENDS SYSTEM QUERIES =====

// Get friends leaderboard for a user
export const getFriendsLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { limit = 50 } = args;
    
    // Get user ID from auth context (Clerk JWT)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get all accepted friends where this user is either the user or the friend
    const friendsAsUser = await ctx.db
      .query("userFriends")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "accepted"))
      .collect();

    const friendsAsFriend = await ctx.db
      .query("userFriends")
      .withIndex("by_friend_status", (q) => q.eq("friendId", userId).eq("status", "accepted"))
      .collect();

    // Combine both lists and get unique friend IDs
    const friendIds = new Set<string>();
    friendsAsUser.forEach(f => friendIds.add(f.friendId));
    friendsAsFriend.forEach(f => friendIds.add(f.userId));

    // Get statistics for all friends
    const friendsLeaderboard = [];
    for (const friendId of friendIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", friendId))
        .first();
      
      const stats = await ctx.db
        .query("userStatistics")
        .withIndex("by_user", (q) => q.eq("userId", friendId))
        .first();

      if (user && stats) {
        friendsLeaderboard.push({
          userId: user._id,
          clerkId: user.clerkId,
          name: user.name,
          avatarUrl: user.avatarUrl,
          totalXp: stats.totalXp,
          currentLevel: stats.currentLevel,
          currentStreak: stats.currentStreak,
          globalRank: stats.globalRank,
        });
      }
    }

    // Sort by XP descending and assign ranks
    friendsLeaderboard.sort((a, b) => b.totalXp - a.totalXp);
    const rankedLeaderboard = friendsLeaderboard.map((friend, index) => ({
      ...friend,
      friendRank: index + 1,
    }));

    // Also include the current user in the friends leaderboard
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    const currentUserStats = await ctx.db
      .query("userStatistics")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    let currentUserRank = null;
    if (currentUser && currentUserStats) {
      currentUserRank = {
        userId: currentUser._id,
        clerkId: currentUser.clerkId,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
        totalXp: currentUserStats.totalXp,
        currentLevel: currentUserStats.currentLevel,
        currentStreak: currentUserStats.currentStreak,
        globalRank: currentUserStats.globalRank,
        friendRank: rankedLeaderboard.findIndex(f => f.clerkId === userId) + 1 || rankedLeaderboard.length + 1,
        isCurrentUser: true,
      };
    }

    return {
      leaderboard: rankedLeaderboard.slice(0, limit),
      currentUser: currentUserRank,
      totalFriends: friendIds.size,
    };
  },
});

// Get pending friend requests for current user
export const getFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    // Get user ID from auth context (Clerk JWT)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get pending requests where this user is the recipient
    const requests = await ctx.db
      .query("userFriends")
      .withIndex("by_friend_status", (q) => q.eq("friendId", userId).eq("status", "pending"))
      .collect();

    const detailedRequests = [];
    for (const request of requests) {
      const sender = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", request.userId))
        .first();

      if (sender) {
        detailedRequests.push({
          requestId: request._id,
          senderId: sender.clerkId,
          senderName: sender.name,
          senderAvatar: sender.avatarUrl,
          requestedAt: request.requestedAt,
        });
      }
    }

    return detailedRequests;
  },
});

// Get user's friends list
export const getMyFriends = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { limit = 100 } = args;
    
    // Get user ID from auth context (Clerk JWT)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get all accepted friends
    const friendsAsUser = await ctx.db
      .query("userFriends")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "accepted"))
      .collect();

    const friendsAsFriend = await ctx.db
      .query("userFriends")
      .withIndex("by_friend_status", (q) => q.eq("friendId", userId).eq("status", "accepted"))
      .collect();

    // Get unique friend IDs
    const friendIds = new Set<string>();
    friendsAsUser.forEach(f => friendIds.add(f.friendId));
    friendsAsFriend.forEach(f => friendIds.add(f.userId));

    // Get friend details
    const friends = [];
    for (const friendId of Array.from(friendIds).slice(0, limit)) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", friendId))
        .first();

      const stats = await ctx.db
        .query("userStatistics")
        .withIndex("by_user", (q) => q.eq("userId", friendId))
        .first();

      if (user) {
        friends.push({
          userId: user._id,
          clerkId: user.clerkId,
          name: user.name,
          avatarUrl: user.avatarUrl,
          totalXp: stats?.totalXp || 0,
          currentLevel: stats?.currentLevel || 1,
        });
      }
    }

    return friends;
  },
});
