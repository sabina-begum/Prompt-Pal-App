/**
 * CopyAnalysisView - Displays copywriting analysis results with metrics radar chart
 * S6 component for copywriting challenges
 * 
 * Features:
 * - Generated copy display
 * - Metrics radar chart integration
 * - Word count display
 * - Highlight matched requirements
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Card, RadarChart, Badge } from '@/components/ui';
import type { CopyScoringResult } from '@/lib/scoring/copyScoring';
import * as Clipboard from 'expo-clipboard';

export interface CopyAnalysisViewProps {
  /** The generated copy text */
  copy: string;
  /** Scoring result from CopyScoringService */
  scoringResult: CopyScoringResult | null;
  /** Brief requirements to check against */
  requirements?: string[];
  /** Loading state */
  isLoading?: boolean;
}

export function CopyAnalysisView({
  copy,
  scoringResult,
  requirements,
  isLoading = false,
}: CopyAnalysisViewProps) {
  if (isLoading) {
    return (
      <Card className="p-6 rounded-[32px]" variant="elevated">
        <Text className="text-onSurface text-center">Analyzing your copy...</Text>
      </Card>
    );
  }

  if (!copy.trim()) {
    return null;
  }

  const hasResult = scoringResult != null;
  const wordCount = scoringResult?.wordCount ?? copy.trim().split(/\s+/).length;
  const withinLimit = scoringResult?.withinLimit ?? true;
  const metrics = scoringResult?.metrics ?? [];
  const score = scoringResult?.score ?? 0;

  // Check which requirements are met
  const matchedRequirements = requirements?.filter(req => 
    copy.toLowerCase().includes(req.toLowerCase())
  ) ?? [];
  const missedRequirements = requirements?.filter(req => 
    !copy.toLowerCase().includes(req.toLowerCase())
  ) ?? [];

  return (
    <View className="px-6 pb-8">
      {/* Generated Copy Display */}
      <Card className="p-6 rounded-[32px] mb-6" variant="elevated">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-[2px]">
            Generated Copy
          </Text>
          <TouchableOpacity
            onPress={async () => {
              await Clipboard.setStringAsync(copy);
              // Could add a toast notification here
            }}
            className="px-3 py-1.5 rounded-full border border-outline/40 bg-surfaceVariant/30"
          >
            <Text className="text-onSurface text-[10px] font-bold uppercase tracking-widest">
              Copy
            </Text>
          </TouchableOpacity>
        </View>
        <View className="bg-surfaceVariant/30 rounded-2xl p-4">
          <Text className="text-onSurface text-base leading-6 font-medium">
            {copy}
          </Text>
        </View>
        
        {/* Word Count Badge */}
        <View className="flex-row items-center mt-4">
          <Badge
            label={`${wordCount} words`}
            variant={withinLimit ? 'primary' : 'surface'}
            className={`mr-2 border-0 ${withinLimit ? 'bg-success/20' : 'bg-warning/20'}`}
          />
          {!withinLimit && (
            <Text className="text-warning text-xs">
              Word count outside recommended range
            </Text>
          )}
        </View>
      </Card>

      {/* Score Overview */}
      {hasResult && (
        <Card className="p-6 rounded-[32px] mb-6" variant="elevated">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-onSurface text-lg font-black">Overall Score</Text>
            <View className="flex-row items-center">
              <Text className="text-primary text-3xl font-black mr-2">{score}%</Text>
              <View 
                className={`w-3 h-3 rounded-full ${score >= 70 ? 'bg-success' : score >= 50 ? 'bg-warning' : 'bg-error'}`} 
              />
            </View>
          </View>
          
        </Card>
      )}

      {/* Metrics Radar Chart */}
      {hasResult && metrics.length > 0 && (
        <Card className="p-6 rounded-[32px] mb-6" variant="elevated">
          <View className="items-center mb-6">
            <Text className="text-onSurface text-sm font-black uppercase tracking-[2px] mb-6">
              Copy Quality Metrics
            </Text>
            <RadarChart metrics={metrics} size={280} />
          </View>

          {/* Enhanced Metric Values Grid */}
          <View className="bg-surfaceVariant/30 rounded-2xl p-4">
            <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-widest mb-3 text-center">
              Detailed Scores
            </Text>
            <View className="flex-row flex-wrap justify-center">
              {metrics.map((metric, index) => {
                const score = Math.round(metric.value / 10);
                const isHighScore = score >= 8;
                const isMediumScore = score >= 6;
                return (
                  <View key={index} className="items-center mx-3 mb-4 min-w-[70px]">
                    <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                      isHighScore ? 'bg-success/20' : isMediumScore ? 'bg-warning/20' : 'bg-error/20'
                    }`}>
                      <Text className={`text-lg font-black ${
                        isHighScore ? 'text-success' : isMediumScore ? 'text-warning' : 'text-error'
                      }`}>
                        {score}
                      </Text>
                    </View>
                    <Text className="text-onSurfaceVariant text-[9px] font-black uppercase text-center leading-3">
                      {metric.label.replace(' ', '\n')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Card>
      )}

      {/* Requirements Check */}
      {requirements && requirements.length > 0 && (
        <Card className="p-6 rounded-[32px]" variant="elevated">
          <Text className="text-onSurface text-xs font-black uppercase tracking-[2px] mb-3">
            Requirements Check
          </Text>
          
          {/* Matched Requirements */}
          {matchedRequirements.length > 0 && (
            <View className="mb-3">
              <Text className="text-success text-[10px] font-black uppercase tracking-widest mb-2">
                ✓ Matched ({matchedRequirements.length}/{requirements.length})
              </Text>
              <View className="flex-row flex-wrap">
                {matchedRequirements.map((req, index) => (
                  <Badge
                    key={index}
                    label={req}
                    variant="primary"
                    className="bg-success/20 mr-2 mb-2 border-0"
                  />
                ))}
              </View>
            </View>
          )}
          
          {/* Missed Requirements */}
          {missedRequirements.length > 0 && (
            <View>
              <Text className="text-onSurfaceVariant text-[10px] font-black uppercase tracking-widest mb-2">
                Missing ({missedRequirements.length}/{requirements.length})
              </Text>
              <View className="flex-row flex-wrap">
                {missedRequirements.map((req, index) => (
                  <Badge
                    key={index}
                    label={req}
                    variant="surface"
                    className="bg-surfaceVariant mr-2 mb-2 border-0"
                  />
                ))}
              </View>
            </View>
          )}
        </Card>
      )}
    </View>
  );
}
