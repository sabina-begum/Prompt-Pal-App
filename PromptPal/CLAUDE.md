# PromptPal

A gamified AI prompt engineering learning app built with React Native and Expo.

## Codebase Overview

PromptPal helps users learn AI prompt engineering through interactive challenges across three domains: image generation, coding, and copywriting. Users earn XP, maintain streaks, complete daily quests, and compete on global leaderboards.

**Tech Stack**: React Native, Expo Router, Zustand, Clerk Auth, **Convex Backend**, NativeWind/Tailwind
**Structure**: File-based routing with feature-based state management

## Architecture

**Backend**: Convex (convex.dev) - Serverless backend with real-time queries
**Authentication**: Clerk with JWT tokens for Convex authentication
**State Management**: Zustand for local state, Convex for server state
**AI Services**: Google Gemini API via Convex mutations

## Key Files

| Category | Location |
|----------|----------|
| App entry | `src/app/_layout.tsx` |
| Screens | `src/app/(tabs)/` |
| State stores | `src/features/*/store.ts` |
| **Convex client** | `src/lib/convex-client.ts` |
| **Convex functions** | `convex/` (queries.ts, mutations.ts, ai.ts) |
| UI components | `src/components/ui/` |
| Utilities | `src/lib/` |

## Quick Start

**Package manager**: Bun (`bun install`, `bun start`, `bun run convex:dev`)

**Adding a new screen**: Create file in `src/app/(tabs)/` or appropriate route group

**Adding state**: Create store in `src/features/{feature}/store.ts`

**Adding Convex query**: Add to `convex/queries.ts` and regenerate client

**Adding Convex mutation**: Add to `convex/mutations.ts` or `convex/ai.ts`

**Modifying auth**: See `src/lib/auth*.ts*` files and `convex/auth.config.ts`

## Migration Notes

✅ **Completed**: Migrated from proxy backend to Convex (100% complete)
- All API calls now go through `convexHttpClient`
- Legacy `api.ts` and `unified-api.ts` removed
- Authentication handled automatically via Clerk + Convex

## Documentation

For detailed architecture, module documentation, and navigation guides, see [../docs/CODEBASE_MAP.md](../docs/CODEBASE_MAP.md).

Last codebase map generated: 2026-02-17.
