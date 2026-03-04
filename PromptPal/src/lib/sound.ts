import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { logger } from './logger';

/* -----------------------------
   Sound Settings Store
-------------------------------- */

interface SoundSettingsState {
  soundsEnabled: boolean;
  toggleSounds: () => void;
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {}
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {}
  },
};

export const useSoundSettings = create<SoundSettingsState>()(
  persist(
    (set) => ({
      soundsEnabled: true, // Default to enabled
      toggleSounds: () => {
        set((state) => ({ soundsEnabled: !state.soundsEnabled }));
      },
    }),
    {
      name: 'promptpal-sound-settings',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);

/* -----------------------------
   Sound Manager
-------------------------------- */

class SoundManager {
  private isInitialized = false;

  /**
   * Initialize audio mode
   * TODO: Install expo-audio and implement actual sound loading when audio assets are ready
   */
  async initialize() {
    this.isInitialized = true;
  }

  /**
   * Play a sound effect (placeholder until expo-audio is installed)
   */
  async play(soundName: 'success' | 'error' | 'button' | 'levelComplete') {
    const { soundsEnabled } = useSoundSettings.getState();
    if (!soundsEnabled || !this.isInitialized) {
      return;
    }
    // No-op until expo-audio is installed and audio assets are added
  }

  /**
   * Stop a specific sound
   */
  async stop(_soundName: 'success' | 'error' | 'button' | 'levelComplete') {
    // No-op until expo-audio is installed
  }

  /**
   * Stop all sounds
   */
  async stopAll() {
    // No-op until expo-audio is installed
  }

  /**
   * Unload all sounds (cleanup)
   */
  async unloadAll() {
    // No-op until expo-audio is installed
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

/* -----------------------------
   Convenience Functions
-------------------------------- */

/**
 * Play success sound
 */
export const playSuccess = () => soundManager.play('success');

/**
 * Play error sound
 */
export const playError = () => soundManager.play('error');

/**
 * Play button click sound
 */
export const playButton = () => soundManager.play('button');

/**
 * Play level complete sound
 */
export const playLevelComplete = () => soundManager.play('levelComplete');

/**
 * Initialize sound system (call this in your app startup)
 */
export const initializeSounds = async () => {
  await soundManager.initialize();
};

/**
 * Cleanup sounds (call this when app unmounts)
 */
export const cleanupSounds = async () => {
  await soundManager.unloadAll();
};