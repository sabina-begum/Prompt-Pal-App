import { Level } from '../game/store';
import { convexHttpClient } from '../../lib/convex-client';
import { api } from '../../../convex/_generated/api.js';

// Note: Target images are now stored in Convex and URLs are provided by the backend API
// Local assets are only used for UI display

// Pre-import local level images mapped by API level ID for instant loading
// Map API level IDs (e.g., "image-1-easy") to local assets
const LEVEL_IMAGE_ASSETS = {
  // Beginner levels
  'image-1-easy': require('../../../assets/images/level-1-image.png'),
  'image-2-easy': require('../../../assets/images/level-2-image.png'),
  'image-3-easy': require('../../../assets/images/level-3-image.png'),

  // Intermediate levels
  'image-4-medium': require('../../../assets/images/level-4-image.png'),
  'image-5-medium': require('../../../assets/images/level-5-image.png'),
  'image-6-medium': require('../../../assets/images/level-6-image.png'),
  'image-7-medium': require('../../../assets/images/level-7-image.png'),

  // Advanced levels
  'image-8-hard': require('../../../assets/images/level-8-image.png'),
  'image-9-hard': require('../../../assets/images/level-9-image.png'),
  'image-10-hard': require('../../../assets/images/level-10-image.png'),

  // Coding Logic levels
  'code-1-easy': require('../../../assets/images/level-4-image.png'),
  'code-2-easy': require('../../../assets/images/level-5-image.png'),
  'code-3-easy': require('../../../assets/images/level-6-image.png'),

  // Copywriting levels
  'copywriting-1-easy': require('../../../assets/images/level-7-image.png'),
  'copywriting-2-easy': require('../../../assets/images/level-8-image.png'),
  'copywriting-3-easy': require('../../../assets/images/level-9-image.png'),

  // Alternative ID formats for backward compatibility
  'level-1': require('../../../assets/images/level-1-image.png'),
  'level-2': require('../../../assets/images/level-2-image.png'),
  'level-3': require('../../../assets/images/level-3-image.png'),
  'level-4': require('../../../assets/images/level-4-image.png'),
  'level-5': require('../../../assets/images/level-5-image.png'),
  'level-6': require('../../../assets/images/level-6-image.png'),
  'level-7': require('../../../assets/images/level-7-image.png'),
  'level-8': require('../../../assets/images/level-8-image.png'),
  'level-9': require('../../../assets/images/level-9-image.png'),
  'level-10': require('../../../assets/images/level-10-image.png'),
} as const;

// Note: getHostedImageUrlForLevel removed - backend now provides URLs directly

// Helper function to get local image asset for a level ID
function getLocalImageForLevel(levelId: string): any {
  const image = LEVEL_IMAGE_ASSETS[levelId as keyof typeof LEVEL_IMAGE_ASSETS];
  if (!image) {
    console.warn(`[Levels] No local image asset found for level ${levelId}, using fallback`);
    // Return first available image as fallback
    return Object.values(LEVEL_IMAGE_ASSETS)[0] || null;
  }
  return image;
}

const APP_ID = 'prompt-pal';

const MODULE_ID_BY_TYPE: Record<string, string> = {
  image: 'image-generation',
  code: 'coding-logic',
  copywriting: 'copywriting',
};

// Process API levels to use local assets for images
export function processApiLevelsWithLocalAssets(apiLevels: Level[]): Level[] {
  return apiLevels.map(level => ({
    ...level,
    moduleId: level.moduleId ?? (level.type ? MODULE_ID_BY_TYPE[level.type] : undefined),
    // Only get local image for image-based levels
    targetImageUrl: level.type === 'image' ? getLocalImageForLevel(level.id) : level.targetImageUrl,
  }));
}


// Validation helper to ensure we have enough assets for configured levels
function validateLevelAssets(): void {
  const configCount = LEVEL_CONFIGS.length;
  const assetCount = Object.keys(LEVEL_IMAGE_ASSETS).length;

  if (configCount > assetCount) {
    console.warn(`[Levels] More level configs (${configCount}) than image assets (${assetCount}). Some levels will use fallback images.`);
  }
}

/**
 * LEVEL CONFIGURATION - How to Add New Levels
 *
 * 1. Add image asset to: PromptPal/assets/images/level-X-image.png
 * 2. Add entry to levelImages object above with next index
 * 3. Add new config object to LEVEL_CONFIGS array below
 * 4. Update prerequisites of next level (if any)
 *
 * That's it! The system automatically maps configs to assets by index.
 */

// Level configuration for local fallback - matches API level IDs
// These are used when API is unavailable and should match your API level IDs
const LEVEL_CONFIGS = [
  {
    id: 'image-1-easy',
    moduleId: 'image-generation',
    type: 'image' as const,
    title: 'Brass Key',
    difficulty: 'beginner' as const,
    hiddenPromptKeywords: ['brass', 'key', 'velvet', 'cushion', 'weathered'] as string[],
    style: 'Realistic',
    passingScore: 75,
    unlocked: true,
    prerequisites: [] as string[],
  },
  {
    id: 'image-2-easy',
    moduleId: 'image-generation',
    type: 'image' as const,
    title: 'Porcelain Teacups',
    difficulty: 'beginner' as const,
    hiddenPromptKeywords: ['porcelain', 'teacups', 'stack', 'marble', 'pedestal'] as string[],
    style: 'Elegant',
    passingScore: 75,
    unlocked: false,
    prerequisites: ['image-1-easy'] as string[],
  },
  {
    id: 'image-3-easy',
    moduleId: 'image-generation',
    type: 'image' as const,
    title: 'Rain Gear',
    difficulty: 'beginner' as const,
    hiddenPromptKeywords: ['yellow', 'raincoat', 'wooden', 'hook', 'umbrella', 'wet'] as string[],
    style: 'Realistic',
    passingScore: 75,
    unlocked: false,
    prerequisites: ['image-2-easy'] as string[],
  },

  // Coding Logic Levels
  {
    id: 'code-1-easy',
    moduleId: 'coding-logic',
    type: 'code' as const,
    title: 'Sum Function',
    difficulty: 'beginner' as const,
    testCases: [
      {
        id: 'sum-1',
        name: 'Basic sum',
        input: [1, 2],
        expectedOutput: 3,
        description: 'Sum of 1 and 2 should be 3'
      },
      {
        id: 'sum-2',
        name: 'Sum with zero',
        input: [0, 5],
        expectedOutput: 5,
        description: 'Sum of 0 and 5 should be 5'
      },
      {
        id: 'sum-3',
        name: 'Negative numbers',
        input: [-1, 3],
        expectedOutput: 2,
        description: 'Sum of -1 and 3 should be 2'
      }
    ] as any,
    functionName: 'sum',
    language: 'javascript',
    passingScore: 75,
    unlocked: false,
    prerequisites: [] as string[],
  },
  {
    id: 'code-2-easy',
    moduleId: 'coding-logic',
    type: 'code' as const,
    title: 'Array Filter',
    difficulty: 'beginner' as const,
    testCases: [
      {
        id: 'filter-1',
        name: 'Filter even numbers',
        input: [[1, 2, 3, 4, 5, 6]],
        expectedOutput: [2, 4, 6],
        description: 'Filter array to keep only even numbers'
      },
      {
        id: 'filter-2',
        name: 'Filter strings longer than 3',
        input: [['a', 'ab', 'abc', 'abcd']],
        expectedOutput: ['abcd'],
        description: 'Filter array to keep strings longer than 3 characters'
      }
    ] as any,
    functionName: 'filterArray',
    language: 'javascript',
    passingScore: 75,
    unlocked: false,
    prerequisites: ['code-1-easy'] as string[],
  },
  {
    id: 'code-3-easy',
    moduleId: 'coding-logic',
    type: 'code' as const,
    title: 'String Reversal',
    difficulty: 'beginner' as const,
    testCases: [
      {
        id: 'reverse-1',
        name: 'Simple reversal',
        input: ['hello'],
        expectedOutput: 'olleh',
        description: 'Reverse the string "hello"'
      },
      {
        id: 'reverse-2',
        name: 'Empty string',
        input: [''],
        expectedOutput: '',
        description: 'Reverse an empty string'
      },
      {
        id: 'reverse-3',
        name: 'Single character',
        input: ['a'],
        expectedOutput: 'a',
        description: 'Reverse a single character string'
      }
    ] as any,
    functionName: 'reverseString',
    language: 'javascript',
    passingScore: 75,
    unlocked: false,
    prerequisites: ['code-2-easy'] as string[],
  },

  // Copywriting Levels
  {
    id: 'copywriting-1-easy',
    moduleId: 'copywriting',
    type: 'copywriting' as const,
    title: 'Product Description',
    difficulty: 'beginner' as const,
    briefProduct: 'Wireless Bluetooth Headphones',
    briefTarget: 'Tech-savvy millennials aged 25-35',
    briefTone: 'Casual and enthusiastic',
    briefGoal: 'Drive online purchases',
    wordLimit: { min: 50, max: 150 },
    requiredElements: ['comfort', 'battery life', 'sound quality', 'price'],
    passingScore: 75,
    unlocked: false,
    prerequisites: [] as string[],
  },
  {
    id: 'copywriting-2-easy',
    moduleId: 'copywriting',
    type: 'copywriting' as const,
    title: 'Social Media Post',
    difficulty: 'beginner' as const,
    briefProduct: 'Eco-friendly reusable water bottle',
    briefTarget: 'Environmentally conscious young adults',
    briefTone: 'Inspiring and motivational',
    briefGoal: 'Increase brand awareness and engagement',
    wordLimit: { min: 30, max: 100 },
    requiredElements: ['sustainability', 'durability', 'design', 'call to action'],
    passingScore: 75,
    unlocked: false,
    prerequisites: ['copywriting-1-easy'] as string[],
  },
  {
    id: 'copywriting-3-easy',
    moduleId: 'copywriting',
    type: 'copywriting' as const,
    title: 'Email Newsletter',
    difficulty: 'beginner' as const,
    briefProduct: 'Fitness tracking smartwatch',
    briefTarget: 'Health-conscious professionals',
    briefTone: 'Professional yet approachable',
    briefGoal: 'Convert readers to customers',
    wordLimit: { min: 100, max: 200 },
    requiredElements: ['features', 'benefits', 'testimonials', 'limited time offer'],
    passingScore: 75,
    unlocked: false,
    prerequisites: ['copywriting-2-easy'] as string[],
  },
] as const;

// Dynamic level data created from local assets when API is not available
export function createLocalLevelsFromAssets(): Level[] {
  // Validate we have enough assets for the configured levels
  validateLevelAssets();

  return LEVEL_CONFIGS.map((config) => ({
    ...config,
    targetImageUrl: getLocalImageForLevel(config.id),
  }));
}

// Fetch levels from API
export async function fetchLevelsFromApi(): Promise<Level[]> {
  try {
    const levels = await convexHttpClient.query(api.queries.getLevels, { appId: APP_ID });

    // Process levels to add local assets if needed (or if API returns full URLs, updated logic might be needed)
    // For now, mapping IDs to local assets for consistency as per existing logic
    if (levels && levels.length > 0) {
      return processApiLevelsWithLocalAssets(levels as Level[]);
    }

    // If no levels from API, return empty array (no fallback data)
    return [];
  } catch (error) {
    console.warn('[Levels] Failed to fetch from API:', error);
    return [];
  }
}

// Fetch a single level by ID from API
export async function fetchLevelById(id: string): Promise<Level | undefined> {
  try {
    const level = await convexHttpClient.query(api.queries.getLevelById, { id });

    if (level) {
      // Convert/process if needed, or return directly.
      // Existing logic used taskToLevel. Here we assume Level.
      // We still want local image assets for consistent UI if they use local images.
      const levels = processApiLevelsWithLocalAssets([level as Level]);
      return levels[0];
    }
    return undefined;
  } catch (error) {
    console.warn('[Levels] Failed to fetch level from API:', error);
    return getLevelById(id);
  }
}

// Legacy functions for backward compatibility
export function getLevelById(id: string): Level | undefined {
  // First try to find in local configs
  const localLevels = createLocalLevelsFromAssets();
  const localLevel = localLevels.find(level => level.id === id);
  if (localLevel) return localLevel;

  // If not found, return undefined (let API handle it)
  return undefined;
}

export function getLevelsByModuleId(moduleId: string): Level[] {
  // Get levels from local assets when API is not available
  const localLevels = createLocalLevelsFromAssets();
  return localLevels.filter(level => level.moduleId === moduleId);
}

export function getNextLevel(currentId: string): Level | undefined {
  const localLevels = createLocalLevelsFromAssets();
  const currentIndex = localLevels.findIndex(level => level.id === currentId);
  if (currentIndex === -1 || currentIndex === localLevels.length - 1) {
    return undefined;
  }
  return localLevels[currentIndex + 1];
}

export function getUnlockedLevels(): Level[] {
  const localLevels = createLocalLevelsFromAssets();
  return localLevels.filter(level => level.unlocked);
}


/**
 * Checks if a level is unlocked based on its prerequisites
 * @param level - The level to check
 * @param completedLevels - Array of completed level IDs
 * @returns Whether the level is unlocked
 */
export function isLevelUnlocked(level: Level, completedLevels: string[] = []): boolean {
  if (!level.prerequisites || level.prerequisites.length === 0) {
    return level.unlocked;
  }

  const allPrerequisitesMet = level.prerequisites.every(prereqId =>
    completedLevels.includes(prereqId)
  );

  return level.unlocked && allPrerequisitesMet;
}

/**
 * Gets all levels that should be unlocked based on completed levels
 * @param completedLevels - Array of completed level IDs
 * @returns Array of unlocked levels
 */
export function getUnlockedLevelsByProgress(completedLevels: string[]): Level[] {
  const localLevels = createLocalLevelsFromAssets();
  return localLevels.filter(level => isLevelUnlocked(level, completedLevels));
}

/**
 * Gets the next level that should be unlocked after completing a level
 * @param completedLevelId - The ID of the completed level
 * @returns The next level to unlock, or null if none
 */
export function getNextUnlockableLevel(completedLevelId: string): Level | null {
  const localLevels = createLocalLevelsFromAssets();
  const lockedLevels = localLevels.filter(level => !level.unlocked);

  return lockedLevels.find(level =>
    level.prerequisites?.includes(completedLevelId)
  ) || null;
}
