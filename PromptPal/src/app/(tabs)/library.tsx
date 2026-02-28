import React, { memo, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Card } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../convex/_generated/api.js';
import { Resource, getResourceIcon } from '@/components/ui/ResourceUtils';

interface Category {
  category: string;
  resources: Resource[];
}

interface LibraryData {
  userSummary: {
    totalXp: number;
    currentLevel: number;
    streak: number;
    completedLevels: number;
  };
  categories: Category[];
}

interface ResourceCardProps {
  resource: Resource;
}

const ResourceCard = memo(function ResourceCard({ resource }: ResourceCardProps) {
  const router = useRouter();
  
  const handlePress = useCallback(() => {
    router.push(`/library/${resource.id}`);
  }, [router, resource.id]);
  
  return (
    <Pressable 
      onPress={handlePress}
      className="mb-4 active:opacity-70"
    >
      <View className="flex-row items-center p-4 rounded-[24px] border-0 bg-surfaceVariant/30">
        <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center mr-4">
          <Ionicons name={getResourceIcon(resource.type)} size={24} color="#FF6B00" />
        </View>
        <View className="flex-1">
          <Text className="text-onSurface text-base font-black">{resource.title}</Text>
          <Text className="text-onSurfaceVariant text-xs" numberOfLines={1}>{resource.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </Pressable>
  );
});

interface CategorySectionProps {
  category: Category;
  index: number;
}

const CategorySection = memo(function CategorySection({ 
  category, 
  index, 
}: CategorySectionProps) {
  return (
    <View className="mb-10">
      <View className="flex-row justify-between items-end mb-4">
        <View>
          <Text className="text-primary text-[10px] font-black uppercase tracking-[2px] mb-1">Category</Text>
          <Text className="text-onSurface text-2xl font-black">{category.category}</Text>
        </View>
      </View>

      {/* Resources List */}
      {category.resources.length > 0 && (
        <View>
          <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-widest mb-3">Resources</Text>
          {category.resources.map((resource, rIdx) => (
            <ResourceCard
              key={`res-${index}-${resource.id}-${rIdx}`}
              resource={resource}
            />
          ))}
        </View>
      )}
    </View>
  );
});

interface UserSummaryProps {
  userSummary: {
    totalXp: number;
    currentLevel: number;
    streak: number;
    completedLevels: number;
  };
}

const UserSummary = memo(function UserSummary({ userSummary }: UserSummaryProps) {
  return (
    <View className="flex-row justify-between mb-8 bg-surfaceVariant/20 p-5 rounded-[32px] border border-outline/10">
      <View className="items-center flex-1 border-r border-outline/10">
        <Text className="text-primary font-black text-xl">{userSummary.totalXp}</Text>
        <Text className="text-onSurfaceVariant text-[8px] font-black uppercase tracking-widest">Total XP</Text>
      </View>
      <View className="items-center flex-1 border-r border-outline/10">
        <Text className="text-primary font-black text-xl">{userSummary.currentLevel}</Text>
        <Text className="text-onSurfaceVariant text-[8px] font-black uppercase tracking-widest">Level</Text>
      </View>
      <View className="items-center flex-1 border-r border-outline/10">
        <Text className="text-primary font-black text-xl">{userSummary.streak}</Text>
        <Text className="text-onSurfaceVariant text-[8px] font-black uppercase tracking-widest">Streak</Text>
      </View>
      <View className="items-center flex-1">
        <Text className="text-primary font-black text-xl">{userSummary.completedLevels}</Text>
        <Text className="text-onSurfaceVariant text-[8px] font-black uppercase tracking-widest">Done</Text>
      </View>
    </View>
  );
});

export default function LibraryScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const libraryData = useQuery(
    api.queries.getLibraryData,
    isSignedIn && user?.id
      ? {
          userId: user.id,
          appId: "prompt-pal",
        }
      : "skip"
  );

  if (!isLoaded || (isSignedIn && libraryData === undefined)) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text className="text-onSurface mt-4 font-black">Curating your library…</Text>
      </SafeAreaView>
    );
  }

  if (!isSignedIn || !libraryData) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Ionicons name="book-outline" size={64} color="#6B7280" />
        <Text className="text-onSurface text-xl font-black mt-4 mb-2">Library unavailable</Text>
        <Text className="text-onSurfaceVariant text-center">Sign in to view your resources.</Text>
        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          className="mt-6 bg-primary px-5 py-3 rounded-full"
        >
          <Text className="text-white font-black uppercase tracking-widest text-[10px]">
            Go To Sign In
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Fixed Header */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-primary text-[10px] font-black uppercase tracking-[4px] mb-1">Academy</Text>
            <Text className="text-onSurface text-3xl font-black">Knowledge Base</Text>
          </View>
          <View className="w-12 h-12 bg-surfaceVariant/50 rounded-full items-center justify-center">
            <Ionicons name="search" size={20} color="#6B7280" />
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <UserSummary userSummary={libraryData.userSummary} />

        {libraryData?.categories.map((cat: Category, idx: number) => (
          <CategorySection
            key={idx}
            category={cat}
            index={idx}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
