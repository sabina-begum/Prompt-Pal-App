import { mutation } from "./_generated/server";
import { v } from "convex/values";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const INITIAL_USAGE_VALUES = {
  textCalls: 0,
  imageCalls: 0,
  audioSummaries: 0,
  dailyQuests: 0,
  imageLevels: 0,
  codingLogicLevels: 0,
  copywritingLevels: 0,
} as const;

const getIsoDateString = (date: Date): string => date.toISOString().split("T")[0];

const DAILY_QUEST_TYPES = ["code", "copywriting"] as const;
type DailyQuestType = typeof DAILY_QUEST_TYPES[number];
type DailyQuestTemplate = {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  xpReward: number;
};

const DAILY_QUEST_TEMPLATES: Record<DailyQuestType, DailyQuestTemplate[]> = {
  code: [
    { title: "Sort Algorithm", description: "Write a prompt for a function that sorts an array of objects by a specific key.", difficulty: "easy", xpReward: 50 },
    { title: "RegEx Master", description: "Generate a regular expression that validates complex password requirements.", difficulty: "medium", xpReward: 100 },
    { title: "Data Transformer", description: "Create a function that flattens a nested JSON structure.", difficulty: "hard", xpReward: 200 },
  ],
  copywriting: [
    { title: "SaaS Tagline", description: "Write 5 catchy taglines for a new AI-powered productivity tool.", difficulty: "easy", xpReward: 50 },
    { title: "Event Invitation", description: "Draft a persuasive email invitation for a high-end tech conference.", difficulty: "medium", xpReward: 100 },
    { title: "Product Benefits", description: "Translate technical specifications into emotional user benefits for a luxury watch.", difficulty: "hard", xpReward: 200 },
  ],
};

const pickRandom = <T,>(items: readonly T[]): T => {
  return items[Math.floor(Math.random() * items.length)];
};

const updateUserStreakForActivity = async (
  ctx: any,
  userId: string,
  activityTimestamp = Date.now()
): Promise<void> => {
  const today = getIsoDateString(new Date(activityTimestamp));
  const yesterday = new Date(activityTimestamp);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getIsoDateString(yesterday);

  const existing = await ctx.db
    .query("userStatistics")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (existing?.lastActivityDate === today) {
    return;
  }

  const previousStreak = existing?.currentStreak ?? 0;
  const previousLongest = existing?.longestStreak ?? 0;

  let newStreak = 1;
  if (existing?.lastActivityDate === yesterdayStr) {
    newStreak = previousStreak + 1;
  }

  const newLongest = Math.max(previousLongest, newStreak);
  const updateData = {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastActivityDate: today,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, updateData);
  } else {
    await ctx.db.insert("userStatistics", {
      userId,
      totalXp: 0,
      currentLevel: 1,
      currentStreak: updateData.currentStreak,
      longestStreak: updateData.longestStreak,
      lastActivityDate: updateData.lastActivityDate,
      globalRank: 0,
      points: 0,
      createdAt: Date.now(),
      updatedAt: updateData.updatedAt,
    });
  }
};

const deleteDocumentsByIndex = async (
  ctx: any,
  tableName: string,
  indexName: string,
  indexBuilder: (q: any) => any
): Promise<number> => {
  const docs = await ctx.db
    .query(tableName)
    .withIndex(indexName, indexBuilder)
    .collect();

  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }

  return docs.length;
};

/**
 * Delete all backend data for the currently authenticated user.
 * This supports Apple guideline §5.1.1 account deletion requirements.
 */
export const deleteCurrentUserData = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const deleted: Record<string, number> = {};

    deleted.userStatistics = await deleteDocumentsByIndex(ctx, "userStatistics", "by_user", (q) =>
      q.eq("userId", userId)
    );
    deleted.userPreferences = await deleteDocumentsByIndex(ctx, "userPreferences", "by_user", (q) =>
      q.eq("userId", userId)
    );
    deleted.userLevelAttempts = await deleteDocumentsByIndex(ctx, "userLevelAttempts", "by_user_created", (q) =>
      q.eq("userId", userId)
    );
    deleted.userProgress = await deleteDocumentsByIndex(ctx, "userProgress", "by_user", (q) =>
      q.eq("userId", userId)
    );
    deleted.gameSessions = await deleteDocumentsByIndex(ctx, "gameSessions", "by_user", (q) =>
      q.eq("userId", userId)
    );
    deleted.gameProgress = await deleteDocumentsByIndex(ctx, "gameProgress", "by_user_app", (q) =>
      q.eq("userId", userId)
    );
    deleted.userModuleProgress = await deleteDocumentsByIndex(ctx, "userModuleProgress", "by_user", (q) =>
      q.eq("userId", userId)
    );
    deleted.userModules = await deleteDocumentsByIndex(ctx, "userModules", "by_user_app", (q) =>
      q.eq("userId", userId)
    );
    deleted.userQuestCompletions = await deleteDocumentsByIndex(ctx, "userQuestCompletions", "by_user", (q) =>
      q.eq("userId", userId)
    );
    deleted.userDailyQuests = await deleteDocumentsByIndex(ctx, "userDailyQuests", "by_user_date", (q) =>
      q.eq("userId", userId)
    );
    deleted.userQuests = await deleteDocumentsByIndex(ctx, "userQuests", "by_user_app", (q) =>
      q.eq("userId", userId)
    );
    deleted.userAchievements = await deleteDocumentsByIndex(ctx, "userAchievements", "by_user", (q) =>
      q.eq("userId", userId)
    );
    deleted.aiGenerations = await deleteDocumentsByIndex(ctx, "aiGenerations", "by_user_created", (q) =>
      q.eq("userId", userId)
    );
    deleted.userEvents = await deleteDocumentsByIndex(ctx, "userEvents", "by_user_app", (q) =>
      q.eq("userId", userId)
    );
    deleted.errorLogs = await deleteDocumentsByIndex(ctx, "errorLogs", "by_user", (q) =>
      q.eq("userId", userId)
    );
    deleted.appPlans = await deleteDocumentsByIndex(ctx, "appPlans", "by_user_app", (q) =>
      q.eq("userId", userId)
    );

    const generatedImages = await ctx.db
      .query("generatedImages")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    for (const image of generatedImages) {
      await ctx.storage.delete(image.fileId);
      await ctx.db.delete(image._id);
    }
    deleted.generatedImages = generatedImages.length;

    const relationshipsByUser = await ctx.db
      .query("userFriends")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const relationshipsByFriend = await ctx.db
      .query("userFriends")
      .withIndex("by_friend", (q: any) => q.eq("friendId", userId))
      .collect();

    const relationshipIds = new Map<string, any>();
    for (const relationship of [...relationshipsByUser, ...relationshipsByFriend]) {
      relationshipIds.set(String(relationship._id), relationship._id);
    }
    for (const relationshipId of relationshipIds.values()) {
      await ctx.db.delete(relationshipId);
    }
    deleted.userFriends = relationshipIds.size;

    const performanceMetrics = await ctx.db.query("performanceMetrics").collect();
    let deletedPerformanceMetrics = 0;
    for (const metric of performanceMetrics) {
      if (metric.userId === userId) {
        await ctx.db.delete(metric._id);
        deletedPerformanceMetrics += 1;
      }
    }
    deleted.performanceMetrics = deletedPerformanceMetrics;

    const userProfile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", userId))
      .first();
    if (userProfile) {
      await ctx.db.delete(userProfile._id);
      deleted.users = 1;
    } else {
      deleted.users = 0;
    }

    return {
      success: true,
      userId,
      deleted,
      deletedTotal: Object.values(deleted).reduce((sum, value) => sum + value, 0),
    };
  },
});

/**
 * Get or create user plan with atomic quota check and increment
 */
export const checkAndIncrementQuota = mutation({
  args: {
    userId: v.string(),
    appId: v.string(),
    quotaType: v.union(v.literal("textCalls"), v.literal("imageCalls"), v.literal("audioSummaries"), v.literal("dailyQuests"), v.literal("imageLevels"), v.literal("codingLogicLevels"), v.literal("copywritingLevels")),
  },
  handler: async (ctx, args) => {
    const { userId, appId, quotaType } = args;

    const app = await ctx.db
      .query("apps")
      .withIndex("by_app_id", (q) => q.eq("id", appId))
      .first();

    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    const now = Date.now();
    const currentDate = new Date(now);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const oneMonthMs = daysInMonth * MS_PER_DAY;

    let plan = await ctx.db
      .query("appPlans")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .first();

    if (!plan) {
      const planId = await ctx.db.insert("appPlans", {
        userId,
        appId,
        tier: "free",
        used: { ...INITIAL_USAGE_VALUES },
        periodStart: now,
      });
      plan = await ctx.db.get(planId);
    }

    if (!plan) {
      throw new Error("Failed to create or retrieve plan");
    }

    // Get the limit based on tier
    const limits = plan.tier === "pro" ? app.proLimits : app.freeLimits;
    const limit = limits[quotaType] ?? 0;

    const currentUsage = plan.used[quotaType] ?? 0;
    const needsReset = now - plan.periodStart >= oneMonthMs;

    if (needsReset) {
      const updateData = {
        used: {
          ...INITIAL_USAGE_VALUES,
          [quotaType]: 1,
        },
        periodStart: now,
      };

      await ctx.db.patch(plan._id, updateData);

      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        limit,
        tier: plan.tier,
      };
    } else {
      if (currentUsage >= limit) {
        return {
          allowed: false,
          remaining: 0,
          limit,
          tier: plan.tier,
        };
      }

      await ctx.db.patch(plan._id, {
        used: {
          ...plan.used,
          [quotaType]: currentUsage + 1,
        },
      });

      return {
        allowed: true,
        remaining: Math.max(0, limit - (currentUsage + 1)),
        limit,
        tier: plan.tier,
      };
    }
  },
});

/**
 * Update user plan (used by Superwall webhooks)
 */
export const updateUserPlan = mutation({
  args: {
    userId: v.string(),
    appId: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro")),
  },
  handler: async (ctx, args) => {
    const { userId, appId, tier } = args;

    const existing = await ctx.db
      .query("appPlans")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { tier });
    } else {
      await ctx.db.insert("appPlans", {
        userId,
        appId,
        tier,
        used: { ...INITIAL_USAGE_VALUES },
        periodStart: Date.now(),
      });
    }
  },
});

/**
 * Update user statistics (gamification data)
 */
export const updateUserStatistics = mutation({
  args: {
    userId: v.optional(v.string()),
    totalXp: v.optional(v.number()),
    currentLevel: v.optional(v.number()),
    currentStreak: v.optional(v.number()),
    longestStreak: v.optional(v.number()),
    lastActivityDate: v.optional(v.string()),
    points: v.optional(v.number()),
    globalRank: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, ...stats } = args;
    const identity = await ctx.auth.getUserIdentity();
    const resolvedUserId = userId ?? identity?.subject;

    if (!resolvedUserId) {
      throw new Error("User must be authenticated");
    }

    const existing = await ctx.db
      .query("userStatistics")
      .withIndex("by_user", (q) => q.eq("userId", resolvedUserId))
      .first();

    const statData = {
      ...stats,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, statData);
    } else {
      await ctx.db.insert("userStatistics", {
        userId: resolvedUserId,
        totalXp: 0,
        currentLevel: 1,
        currentStreak: 0,
        longestStreak: 0,
        globalRank: 0,
        points: 0,
        ...stats,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Save a new user level attempt with auto-numbering
 * NOTE: userId is now extracted from authentication context for security
 */
export const saveUserLevelAttempt = mutation({
  args: {
    levelId: v.string(),
    score: v.number(), // 0-100
    feedback: v.array(v.string()), // Array of feedback strings
    keywordsMatched: v.array(v.string()), // Array of matched keywords
    imageUrl: v.optional(v.string()), // Generated image URL
    code: v.optional(v.string()), // Generated code
    copy: v.optional(v.string()), // Generated copy
    testResults: v.optional(v.array(v.object({
      id: v.optional(v.string()),
      name: v.optional(v.string()),
      passed: v.boolean(),
      error: v.optional(v.string()),
      output: v.optional(v.any()),
      expectedOutput: v.optional(v.any()),
      actualOutput: v.optional(v.any()),
      executionTime: v.optional(v.number()),
    }))),
  },
  handler: async (ctx, args) => {
    const { levelId, score, feedback, keywordsMatched, imageUrl, code, copy, testResults } = args;
    
    // Get userId from authenticated identity - prevents spoofing
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;
    
    // Verify user has permission to attempt this level
    // (Add additional checks here if needed, e.g., level is unlocked for user)

    // Validate score range
    if (score < 0 || score > 100) {
      throw new Error("Score must be between 0 and 100");
    }

    // Validate feedback array (max 10 items, each max 200 chars)
    if (feedback.length > 10) {
      throw new Error("Feedback array cannot have more than 10 items");
    }
    for (const item of feedback) {
      if (item.length > 200) {
        throw new Error("Each feedback item cannot exceed 200 characters");
      }
    }

    if (!imageUrl && !code && !copy) {
      throw new Error("Attempt must include an imageUrl, code, or copy");
    }

    // Validate image URL domain (must be from convex.cloud)
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        // Whitelist specific Convex storage domains
        const allowedDomains = ['convex.cloud', 'storage.convex.dev'];
        const hostname = url.hostname.toLowerCase();
        const isAllowedDomain = allowedDomains.some(domain => 
          hostname === domain || hostname.endsWith(`.${domain}`)
        );
        
        if (!isAllowedDomain) {
          throw new Error("Image URL must be from a trusted domain");
        }
        
        // Ensure HTTPS protocol
        if (url.protocol !== 'https:') {
          throw new Error("Image URL must use HTTPS protocol");
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("trusted domain")) {
          throw error;
        }
        throw new Error("Invalid image URL format");
      }
    }

    // Get the next attempt number
    const lastAttempt = await ctx.db
      .query("userLevelAttempts")
      .withIndex("by_user_level", (q) => q.eq("userId", userId).eq("levelId", levelId))
      .order("desc")
      .first();

    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    // Insert the new attempt
    const attemptId = await ctx.db.insert("userLevelAttempts", {
      userId,
      levelId,
      attemptNumber,
      score,
      feedback,
      keywordsMatched,
      imageUrl,
      code,
      copy,
      testResults,
      createdAt: Date.now(),
    });

    // Return the created attempt data
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) {
      throw new Error("Failed to create attempt record");
    }

    return {
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
    };
  },
});

/**
 * Update user module progress
 */
export const updateUserModuleProgress = mutation({
  args: {
    userId: v.string(),
    appId: v.string(),
    moduleId: v.string(),
    level: v.string(),
    topic: v.string(),
    progress: v.number(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, appId, moduleId } = args;

    const existing = await ctx.db
      .query("userModules")
      .withIndex("by_user_module", (q) => q.eq("userId", userId).eq("moduleId", moduleId))
      .first();

    const moduleData = {
      userId,
      appId,
      moduleId,
      level: args.level,
      topic: args.topic,
      progress: args.progress,
      completedAt: args.completedAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completed: args.progress === 100,
    };

    if (existing) {
      await ctx.db.patch(existing._id, moduleData);
    } else {
      await ctx.db.insert("userModules", moduleData);
    }
  },
});

/**
 * Update user quest states
 */
export const updateUserQuests = mutation({
  args: {
    userId: v.string(),
    appId: v.string(),
    quests: v.array(v.object({
      questId: v.string(),
      completed: v.boolean(),
      completedAt: v.optional(v.number()),
      expiresAt: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const { userId, appId, quests } = args;

    // Delete existing quest states for this user/app (batch delete)
    const existingQuests = await ctx.db
      .query("userQuests")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .collect();

    await Promise.all(existingQuests.map(quest => ctx.db.delete(quest._id)));

    // Insert new quest states
    for (const quest of quests) {
      await ctx.db.insert("userQuests", {
        userId,
        appId,
        questId: quest.questId,
        completed: quest.completed,
        completedAt: quest.completedAt,
        expiresAt: quest.expiresAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Update user game state
 */
export const updateUserGameState = mutation({
  args: {
    appId: v.string(),
    currentLevelId: v.optional(v.string()),
    lives: v.number(),
    score: v.number(),
    isPlaying: v.boolean(),
    unlockedLevels: v.array(v.string()),
    completedLevels: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { appId, currentLevelId, lives, score, isPlaying, unlockedLevels, completedLevels } = args;
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const userId = identity.subject;

    const existing = await ctx.db
      .query("gameProgress")
      .withIndex("by_user_app", (q) => q.eq("userId", userId).eq("appId", appId))
      .first();

    const gameStateData = {
      userId,
      appId,
      currentLevelId,
      lives,
      score,
      isPlaying,
      unlockedLevels,
      completedLevels,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, gameStateData);
    } else {
      await ctx.db.insert("gameProgress", gameStateData);
    }
  },
});

/**
 * Log AI generation (privacy-safe - no sensitive content)
 */
export const logAIGeneration = mutation({
  args: {
    userId: v.string(),
    appId: v.string(),
    requestId: v.string(),
    type: v.union(v.literal("text"), v.literal("image"), v.literal("compare"), v.literal("evaluate")),
    model: v.string(),
    promptLength: v.optional(v.number()),
    responseLength: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    durationMs: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, appId, requestId, type, model, promptLength, responseLength, tokensUsed, durationMs, success, errorMessage } = args;

    await ctx.db.insert("aiGenerations", {
      userId,
      appId,
      requestId,
      type,
      model,
      promptLength,
      responseLength,
      tokensUsed,
      durationMs,
      success,
      errorMessage,
      createdAt: Date.now(),
    });
  },
});

/**
 * Log analytics event
 */
export const logAnalyticsEvent = mutation({
  args: {
    userId: v.string(),
    appId: v.string(),
    eventType: v.string(),
    eventData: v.optional(v.any()),
    sessionId: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, appId, eventType, eventData, sessionId, userAgent, ipAddress } = args;

    await ctx.db.insert("userEvents", {
      userId,
      appId,
      eventType,
      eventData,
      sessionId,
      timestamp: Date.now(),
      userAgent,
      ipAddress,
    });
  },
});

/**
 * Log error
 */
export const logError = mutation({
  args: {
    userId: v.optional(v.string()),
    appId: v.optional(v.string()),
    errorType: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    context: v.optional(v.any()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, appId, errorType, message, stack, context, userAgent } = args;

    await ctx.db.insert("errorLogs", {
      userId,
      appId,
      errorType,
      message,
      stack,
      context,
      userAgent,
      timestamp: Date.now(),
    });
  },
});

/**
 * Log performance metric
 */
export const logPerformanceMetric = mutation({
  args: {
    userId: v.optional(v.string()),
    appId: v.string(),
    metricType: v.string(),
    value: v.number(),
    metadata: v.optional(v.any()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, appId, metricType, value, metadata, userAgent } = args;

    await ctx.db.insert("performanceMetrics", {
      userId,
      appId,
      metricType,
      value,
      metadata,
      userAgent,
      timestamp: Date.now(),
    });
  },
});

// ===== GAMIFICATION SYSTEM MUTATIONS =====

/**
 * Create or update user profile
 */
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clerkId, name, email, avatarUrl } = args;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    const userData = {
      clerkId,
      name,
      email,
      avatarUrl,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, userData);
      return existing._id;
    } else {
      return await ctx.db.insert("users", {
        ...userData,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Update user preferences
 */
export const updateUserPreferences = mutation({
  args: {
    userId: v.string(),
    soundEnabled: v.optional(v.boolean()),
    hapticsEnabled: v.optional(v.boolean()),
    theme: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    favoriteModule: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...prefs } = args;

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const prefData = {
      ...prefs,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, prefData);
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        soundEnabled: true,
        hapticsEnabled: true,
        theme: "dark",
        difficulty: "easy",
        ...prefs,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Update user progress on a level
 */
export const updateLevelProgress = mutation({
  args: {
    userId: v.string(),
    appId: v.string(),
    levelId: v.string(),
    isUnlocked: v.optional(v.boolean()),
    isCompleted: v.optional(v.boolean()),
    bestScore: v.optional(v.number()),
    attempts: v.optional(v.number()),
    timeSpent: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    hintsUsed: v.optional(v.number()),
    firstAttemptScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, appId, levelId, ...progress } = args;

    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_user_level", (q) => q.eq("userId", userId).eq("levelId", levelId))
      .first();

    const progressData = {
      ...progress,
      appId,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, progressData);
    } else {
      await ctx.db.insert("userProgress", {
        userId,
        appId,
        levelId,
        isUnlocked: false,
        isCompleted: false,
        bestScore: 0,
        attempts: 0,
        timeSpent: 0,
        hintsUsed: 0,
        firstAttemptScore: 0,
        ...progress,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    if (progress.isCompleted) {
      await updateUserStreakForActivity(ctx, userId);
    }
  },
});

/**
 * Create a game session
 */
export const createGameSession = mutation({
  args: {
    userId: v.string(),
    levelId: v.string(),
    userPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, levelId, userPrompt } = args;

    return await ctx.db.insert("gameSessions", {
      userId,
      levelId,
      startedAt: Date.now(),
      score: 0,
      livesUsed: 0,
      hintsUsed: 0,
      completed: false,
      userPrompt,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update game session
 */
export const updateGameSession = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    endedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    livesUsed: v.optional(v.number()),
    hintsUsed: v.optional(v.number()),
    completed: v.optional(v.boolean()),
    aiResponse: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...updates } = args;

    await ctx.db.patch(sessionId, updates);
  },
});

/**
 * Update learning module progress
 */
export const updateModuleProgress = mutation({
  args: {
    userId: v.optional(v.string()),
    moduleId: v.string(),
    progress: v.number(),
    completed: v.optional(v.boolean()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId: providedUserId, moduleId, ...progressData } = args;
    const identity = await ctx.auth.getUserIdentity();
    const userId = providedUserId ?? identity?.subject;

    if (!userId) {
      throw new Error("User must be authenticated or userId must be provided");
    }

    const existing = await ctx.db
      .query("userModuleProgress")
      .withIndex("by_user_module", (q) => q.eq("userId", userId).eq("moduleId", moduleId))
      .first();

    const data = {
      ...progressData,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("userModuleProgress", {
        userId,
        moduleId,
        completed: false,
        ...progressData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Complete a daily quest
 */
export const completeDailyQuest = mutation({
  args: {
    userId: v.optional(v.string()),
    questId: v.string(),
    score: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, questId, score = 0 } = args;
    const identity = await ctx.auth.getUserIdentity();
    const resolvedUserId = userId ?? identity?.subject;

    if (!resolvedUserId) {
      throw new Error("User must be authenticated");
    }

    const existing = await ctx.db
      .query("userQuestCompletions")
      .withIndex("by_user_quest", (q) => q.eq("userId", resolvedUserId).eq("questId", questId))
      .first();

    if (existing) {
      // Update existing completion
      await ctx.db.patch(existing._id, {
        completed: true,
        completedAt: Date.now(),
        score,
      });
    } else {
      // Create new completion
      await ctx.db.insert("userQuestCompletions", {
        userId: resolvedUserId,
        questId,
        completed: true,
        completedAt: Date.now(),
        score,
        createdAt: Date.now(),
      });
    }

    await updateUserStreakForActivity(ctx, resolvedUserId);
  },
});

/**
 * Unlock achievement for user
 */
export const unlockAchievement = mutation({
  args: {
    userId: v.string(),
    achievementId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, achievementId } = args;

    const existing = await ctx.db
      .query("userAchievements")
      .withIndex("by_user_achievement", (q) => q.eq("userId", userId).eq("achievementId", achievementId))
      .first();

    if (!existing) {
      await ctx.db.insert("userAchievements", {
        userId,
        achievementId,
        unlockedAt: Date.now(),
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Recalculate global rankings (admin function)
 */
export const recalculateRankings = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all users ordered by total XP
    const userStats = await ctx.db
      .query("userStatistics")
      .withIndex("by_xp")
      .order("desc")
      .collect();

    // Update rankings
    for (let i = 0; i < userStats.length; i++) {
      await ctx.db.patch(userStats[i]._id, {
        globalRank: i + 1,
        updatedAt: Date.now(),
      });
    }
  },
});

// ===== CONTENT MANAGEMENT MUTATIONS =====

/**
 * Create a new level (admin function)
 */
export const createLevel = mutation({
  args: {
    id: v.string(),
    appId: v.string(),
    type: v.union(v.literal("image"), v.literal("code"), v.literal("copywriting")),
    title: v.string(),
    description: v.optional(v.string()),
    difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    passingScore: v.number(),
    unlocked: v.boolean(),
    isActive: v.boolean(),
    order: v.number(),
    // Image level fields
    targetImageUrl: v.optional(v.string()),
    hiddenPromptKeywords: v.optional(v.array(v.string())),
    style: v.optional(v.string()),
    // Code level fields
    moduleTitle: v.optional(v.string()),
    requirementBrief: v.optional(v.string()),
    requirementImage: v.optional(v.string()),
    language: v.optional(v.string()),
    functionName: v.optional(v.string()),
    testCases: v.optional(v.array(v.object({
      input: v.any(),
      expectedOutput: v.any(),
      description: v.optional(v.string()),
    }))),
    // Copywriting level fields
    briefTitle: v.optional(v.string()),
    briefProduct: v.optional(v.string()),
    briefTarget: v.optional(v.string()),
    briefTone: v.optional(v.string()),
    briefGoal: v.optional(v.string()),
    wordLimit: v.optional(v.object({
      min: v.optional(v.number()),
      max: v.optional(v.number()),
    })),
    requiredElements: v.optional(v.array(v.string())),
    metrics: v.optional(v.array(v.object({
      name: v.string(),
      target: v.number(),
      weight: v.number(),
    }))),
    promptChecklist: v.optional(v.array(v.string())),
    // Common fields
    hints: v.optional(v.array(v.string())),
    estimatedTime: v.optional(v.number()),
    points: v.number(),
    tags: v.optional(v.array(v.string())),
    learningObjectives: v.optional(v.array(v.string())),
    prerequisites: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, appId, ...levelData } = args;

    return await ctx.db.insert("levels", {
      id,
      appId,
      ...levelData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update level (admin function)
 */
export const updateLevel = mutation({
  args: {
    id: v.string(),
    appId: v.string(),
    type: v.optional(v.union(v.literal("image"), v.literal("code"), v.literal("copywriting"))),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    difficulty: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
    passingScore: v.optional(v.number()),
    unlocked: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
    // Image level fields
    targetImageUrl: v.optional(v.string()),
    hiddenPromptKeywords: v.optional(v.array(v.string())),
    style: v.optional(v.string()),
    // Code level fields
    moduleTitle: v.optional(v.string()),
    requirementBrief: v.optional(v.string()),
    requirementImage: v.optional(v.string()),
    language: v.optional(v.string()),
    functionName: v.optional(v.string()),
    testCases: v.optional(v.array(v.object({
      input: v.any(),
      expectedOutput: v.any(),
      description: v.optional(v.string()),
    }))),
    // Copywriting level fields
    briefTitle: v.optional(v.string()),
    briefProduct: v.optional(v.string()),
    briefTarget: v.optional(v.string()),
    briefTone: v.optional(v.string()),
    briefGoal: v.optional(v.string()),
    wordLimit: v.optional(v.object({
      min: v.optional(v.number()),
      max: v.optional(v.number()),
    })),
    requiredElements: v.optional(v.array(v.string())),
    metrics: v.optional(v.array(v.object({
      name: v.string(),
      target: v.number(),
      weight: v.number(),
    }))),
    promptChecklist: v.optional(v.array(v.string())),
    // Common fields
    hints: v.optional(v.array(v.string())),
    estimatedTime: v.optional(v.number()),
    points: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    learningObjectives: v.optional(v.array(v.string())),
    prerequisites: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, appId, ...updateData } = args;

    // Find the level by custom id
    const existing = await ctx.db
      .query("levels")
      .filter((q) => q.eq(q.field("id"), id))
      .first();

    if (!existing) {
      throw new Error(`Level ${id} not found`);
    }

    return await ctx.db.patch(existing._id, {
      ...updateData,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Create learning module (admin function)
 */
export const createLearningModule = mutation({
  args: {
    id: v.string(),
    appId: v.string(),
    category: v.string(),
    title: v.string(),
    level: v.string(),
    topic: v.string(),
    icon: v.string(),
    accentColor: v.string(),
    buttonText: v.string(),
    description: v.optional(v.string()),
    objectives: v.optional(v.array(v.string())),
    content: v.optional(v.any()),
    type: v.optional(v.union(v.literal("module"), v.literal("course"), v.literal("track"))),
    format: v.optional(v.string()),
    estimatedTime: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, appId, ...moduleData } = args;

    return await ctx.db.insert("learningModules", {
      id,
      appId,
      ...moduleData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Create learning resource (admin function)
 */
export const createLearningResource = mutation({
  args: {
    id: v.string(),
    appId: v.string(),
    type: v.union(v.literal("guide"), v.literal("cheatsheet"), v.literal("lexicon"), v.literal("case-study"), v.literal("prompting-tip")),
    title: v.string(),
    description: v.string(),
    content: v.any(),
    category: v.string(),
    difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    estimatedTime: v.optional(v.number()),
    tags: v.array(v.string()),
    icon: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, appId, ...resourceData } = args;

    return await ctx.db.insert("learningResources", {
      id,
      appId,
      ...resourceData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update learning resource (admin function)
 */
export const updateLearningResource = mutation({
  args: {
    id: v.string(),
    appId: v.string(),
    type: v.union(v.literal("guide"), v.literal("cheatsheet"), v.literal("lexicon"), v.literal("case-study"), v.literal("prompting-tip")),
    title: v.string(),
    description: v.string(),
    content: v.any(),
    category: v.string(),
    difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    estimatedTime: v.optional(v.number()),
    tags: v.array(v.string()),
    icon: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, appId, ...updateData } = args;

    const existing = await ctx.db
      .query("learningResources")
      .filter((q) => q.eq(q.field("id"), id))
      .filter((q) => q.eq(q.field("appId"), appId))
      .first();

    if (!existing) {
      throw new Error(`Learning resource ${id} not found`);
    }

    return await ctx.db.patch(existing._id, {
      ...updateData,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Create daily quest (admin function)
 */
export const createDailyQuest = mutation({
  args: {
    id: v.string(),
    appId: v.string(),
    title: v.string(),
    description: v.string(),
    xpReward: v.number(),
    questType: v.union(v.literal("image"), v.literal("code"), v.literal("copywriting")),
    type: v.string(),
    category: v.string(),
    requirements: v.any(),
    difficulty: v.string(),
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, appId, ...questData } = args;

    return await ctx.db.insert("dailyQuests", {
      id,
      appId,
      ...questData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Generate daily quest pool (one quest per type)
 */
export const generateDailyQuestPool = mutation({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const { appId } = args;
    const now = Date.now();
    const today = getIsoDateString(new Date(now));
    const expiresAt = now + MS_PER_DAY;

    // Delete all image quests to ensure they are fully removed from the pool
    const imageQuests = await ctx.db
      .query("dailyQuests")
      .withIndex("by_type", (q) => q.eq("questType", "image"))
      .collect();

    await Promise.all(imageQuests.map(q => ctx.db.delete(q._id)));

    // Deactivate all other active quests
    const activeQuests = await ctx.db
      .query("dailyQuests")
      .withIndex("by_app", (q) => q.eq("appId", appId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    await Promise.all(
      activeQuests.map((quest) =>
        ctx.db.patch(quest._id, {
          isActive: false,
          updatedAt: now,
        })
      )
    );

    // Get all active levels to pick as quest targets
    const activeLevels = await ctx.db
      .query("levels")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const type of DAILY_QUEST_TYPES) {
      const template = pickRandom(DAILY_QUEST_TEMPLATES[type]);
      const id = `daily-${today}-${type}`;

      // Pick random level of this type
      const relevantLevels = activeLevels.filter(l => l.type === type);
      const randomLevel = relevantLevels.length > 0 ? pickRandom(relevantLevels) : null;

      const existing = await ctx.db
        .query("dailyQuests")
        .filter((q) => q.eq(q.field("id"), id))
        .first();

      const questData = {
        id,
        appId,
        title: template.title,
        description: template.description,
        xpReward: template.xpReward,
        questType: type,
        levelId: randomLevel?.id,
        type,
        category: type.toUpperCase(),
        requirements: {
          difficulty: template.difficulty,
          topic: type,
          levelId: randomLevel?.id,
        },
        difficulty: template.difficulty,
        isActive: true,
        expiresAt,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, questData);
      } else {
        await ctx.db.insert("dailyQuests", {
          ...questData,
          createdAt: now,
        });
      }
    }
  },
});

/**
 * Get or assign the current daily quest for a user
 */
export const getOrAssignCurrentQuest = mutation({
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

    let assignment = await ctx.db
      .query("userDailyQuests")
      .withIndex("by_user_app_date", (q) =>
        q.eq("userId", resolvedUserId).eq("appId", args.appId).eq("assignedDate", assignedDate)
      )
      .first();

    const loadQuestIfValid = async (questId: string | undefined) => {
      if (!questId) return null;
      const quest = await ctx.db
        .query("dailyQuests")
        .filter((q) => q.eq(q.field("id"), questId))
        .first();

      if (!quest) return null;
      if (!quest.isActive) return null;
      if (quest.expiresAt && quest.expiresAt <= now) return null;

      return quest;
    };

    let quest = assignment && assignment.expiresAt > now
      ? await loadQuestIfValid(assignment.questId)
      : null;

    if (!quest) {
      const activeQuests = await ctx.db
        .query("dailyQuests")
        .withIndex("by_app", (q) => q.eq("appId", args.appId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .filter((q) => q.gt(q.field("expiresAt"), now))
        .collect();

      if (activeQuests.length === 0) {
        return null;
      }

      const questsByType = new Map<string, typeof activeQuests>();
      for (const activeQuest of activeQuests) {
        const key = activeQuest.questType ?? activeQuest.type ?? "unknown";
        const group = questsByType.get(key) ?? [];
        group.push(activeQuest);
        questsByType.set(key, group);
      }

      const availableTypes = Array.from(questsByType.keys());
      const selectedType = pickRandom(availableTypes);
      const candidates = questsByType.get(selectedType) ?? activeQuests;
      quest = pickRandom(candidates);

      const assignmentData = {
        userId: resolvedUserId,
        appId: args.appId,
        questId: quest.id,
        assignedDate,
        assignedAt: now,
        expiresAt: quest.expiresAt ?? now + MS_PER_DAY,
        updatedAt: now,
      };

      if (assignment) {
        await ctx.db.patch(assignment._id, assignmentData);
      } else {
        await ctx.db.insert("userDailyQuests", {
          ...assignmentData,
          createdAt: now,
        });
      }
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
      levelId: quest.levelId,
      title: quest.title,
      description: quest.description,
      xpReward: quest.xpReward,
      questType: quest.questType,
      timeRemaining,
      completed: completion?.completed ?? false,
      expiresAt: quest.expiresAt ?? now + MS_PER_DAY,
    };
  },
});

/**
 * Create achievement (admin function)
 */
export const createAchievement = mutation({
  args: {
    id: v.string(),
    title: v.string(),
    description: v.string(),
    icon: v.string(),
    rarity: v.union(v.literal("common"), v.literal("rare"), v.literal("epic"), v.literal("legendary")),
    conditionType: v.string(),
    conditionValue: v.number(),
    conditionMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...achievementData } = args;

    return await ctx.db.insert("achievements", {
      id,
      ...achievementData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

});

// ===== GENERATED IMAGES STORAGE =====

// Generate upload URL for image storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Save generated image metadata after upload
export const saveGeneratedImage = mutation({
  args: {
    userId: v.string(),
    appId: v.string(),
    storageId: v.id("_storage"),
    prompt: v.string(),
    model: v.string(),
    requestId: v.string(),
    mimeType: v.string(),
    size: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const imageId = await ctx.db.insert("generatedImages", {
      userId: args.userId,
      appId: args.appId,
      fileId: args.storageId,
      prompt: args.prompt,
      model: args.model,
      requestId: args.requestId,
      mimeType: args.mimeType,
      size: args.size,
      width: args.width,
      height: args.height,
      createdAt: Date.now(),
    });

    return imageId;
  },
});

// ===== FRIENDS SYSTEM MUTATIONS =====

// Send a friend request
export const sendFriendRequest = mutation({
  args: {
    friendId: v.string(), // The clerk ID of the user to add as friend
  },
  handler: async (ctx, args) => {
    const { friendId } = args;

    // Get current user ID from auth context
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Prevent sending request to self
    if (userId === friendId) {
      throw new Error("Cannot send friend request to yourself");
    }

    // Check if the friend exists
    const friend = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", friendId))
      .first();

    if (!friend) {
      throw new Error("User not found");
    }

    // Check if friendship already exists
    const existingFriendship = await ctx.db
      .query("userFriends")
      .withIndex("by_user_friend", (q) => q.eq("userId", userId).eq("friendId", friendId))
      .first();

    if (existingFriendship) {
      throw new Error("Friend request already exists");
    }

    // Check reverse direction (if friend already sent request to user)
    const reverseFriendship = await ctx.db
      .query("userFriends")
      .withIndex("by_user_friend", (q) => q.eq("userId", friendId).eq("friendId", userId))
      .first();

    if (reverseFriendship) {
      if (reverseFriendship.status === "pending") {
        // Auto-accept if there's a pending request from the other user
        await ctx.db.patch(reverseFriendship._id, {
          status: "accepted",
          acceptedAt: Date.now(),
          updatedAt: Date.now(),
        });
        return { success: true, message: "Friend request accepted", autoAccepted: true };
      } else if (reverseFriendship.status === "accepted") {
        throw new Error("Already friends with this user");
      }
    }

    // Create new friend request
    const requestId = await ctx.db.insert("userFriends", {
      userId,
      friendId,
      status: "pending",
      requestedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, requestId, message: "Friend request sent" };
  },
});

// Accept a friend request
export const acceptFriendRequest = mutation({
  args: {
    requestId: v.id("userFriends"),
  },
  handler: async (ctx, args) => {
    const { requestId } = args;

    // Get current user ID from auth context
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get the friend request
    const request = await ctx.db.get(requestId);
    if (!request) {
      throw new Error("Friend request not found");
    }

    // Verify the current user is the recipient
    if (request.friendId !== userId) {
      throw new Error("Not authorized to accept this request");
    }

    // Verify the request is still pending
    if (request.status !== "pending") {
      throw new Error("Friend request is no longer pending");
    }

    // Accept the request
    await ctx.db.patch(requestId, {
      status: "accepted",
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, message: "Friend request accepted" };
  },
});

// Reject a friend request
export const rejectFriendRequest = mutation({
  args: {
    requestId: v.id("userFriends"),
  },
  handler: async (ctx, args) => {
    const { requestId } = args;

    // Get current user ID from auth context
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Get the friend request
    const request = await ctx.db.get(requestId);
    if (!request) {
      throw new Error("Friend request not found");
    }

    // Verify the current user is the recipient
    if (request.friendId !== userId) {
      throw new Error("Not authorized to reject this request");
    }

    // Verify the request is still pending
    if (request.status !== "pending") {
      throw new Error("Friend request is no longer pending");
    }

    // Reject the request by updating status
    await ctx.db.patch(requestId, {
      status: "rejected",
      updatedAt: Date.now(),
    });

    return { success: true, message: "Friend request rejected" };
  },
});

// Remove a friend
export const removeFriend = mutation({
  args: {
    friendId: v.string(), // The clerk ID of the friend to remove
  },
  handler: async (ctx, args) => {
    const { friendId } = args;

    // Get current user ID from auth context
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Find friendship in either direction
    const friendship1 = await ctx.db
      .query("userFriends")
      .withIndex("by_user_friend", (q) => q.eq("userId", userId).eq("friendId", friendId))
      .first();

    const friendship2 = await ctx.db
      .query("userFriends")
      .withIndex("by_user_friend", (q) => q.eq("userId", friendId).eq("friendId", userId))
      .first();

    const friendship = friendship1 || friendship2;

    if (!friendship) {
      throw new Error("Friendship not found");
    }

    // Delete the friendship record
    await ctx.db.delete(friendship._id);

    return { success: true, message: "Friend removed" };
  },
});
