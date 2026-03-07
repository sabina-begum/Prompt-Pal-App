# PromptPal

PromptPal is a mobile app for learning prompt engineering through short, replayable game loops. The workspace is organized around the React Native app in `PromptPal/` and supporting project documentation in `docs/`.

![Status](https://img.shields.io/badge/Status-Active%20Development-yellow?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Expo%20%2B%20React%20Native-black?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square)

## Overview

The product is built around three learning tracks:

- Image prompt challenges
- Code and logic prompt challenges
- Copywriting prompt challenges

Players progress through levels, submit prompts, receive AI-assisted feedback, and improve over repeated attempts. Authentication is handled through Clerk, backend state and AI orchestration run through Convex, and the client is built with Expo Router, React Native, and TypeScript.

## Current State

The codebase already includes the main app shell, authentication flow, tab navigation, core game state, and Convex-backed AI integration. Recent work has focused on simplifying the app root, stabilizing safe mode, migrating the workspace to Bun, and restructuring scoring logic for the copy module.

## Recent Progress

Based on the latest commits on `main`, the most recent completed work includes:

- Safe mode cleanup and root simplification by removing the old `router-app` tree and consolidating app entry flow
- Migration from npm to Bun, including lockfile and script updates
- Convex schema, query, mutation, and AI updates for gameplay and level data
- Refactoring of copy scoring into `copyScoringCore.ts` and addition of `promptQuality.ts`
- Tab and game screen updates across home, library, ranking, profile, and both game flows
- Removal of the AI feedback section from active gameplay screens

Areas still likely in progress:

- Expanding level content breadth
- Hardening and validating scoring quality end to end
- Broader test coverage and release-readiness work

For the most accurate architecture reference, use [docs/CODEBASE_MAP.md](/Users/mikhail/Documents/CURSOR%20CODES/In%20Progress/Prompt%20Pal%20App/docs/CODEBASE_MAP.md).

## Workspace Structure

```text
.
├── PromptPal/            # Expo / React Native application
├── docs/                 # Project documentation and planning
├── tasks/                # Task tracking and notes
├── AGENTS.md             # Agent workflow instructions
└── README.md             # Workspace overview
```

## App Structure

```text
PromptPal/
├── src/app/              # Expo Router routes and layouts
├── src/components/       # Shared UI components
├── src/features/         # Feature domains and stores
├── src/lib/              # Shared services and utilities
├── convex/               # Backend schema, queries, and mutations
├── assets/               # Fonts, images, and static assets
├── app.json              # Expo configuration
└── package.json          # Scripts and dependencies
```

## Quick Start

1. Clone the repository and enter the app directory.
   ```bash
   git clone https://github.com/mwijanarko1/Prompt-Pal-App.git
   cd Prompt-Pal-App/PromptPal
   ```
2. Install dependencies.
   ```bash
   bun install
   ```
3. Copy the environment template and fill in the required values.
   ```bash
   cp .env.example .env
   ```
4. Start the Expo development server.
   ```bash
   bun start
   ```

## Environment

The app expects these public environment variables at minimum:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_SAFE_MODE`

Check the app-level configuration and environment helpers in `PromptPal/` before adding new variables.

## Common Commands

From `PromptPal/`:

```bash
bun start
bun run lint
```

Use the scripts defined in [PromptPal/package.json](/Users/mikhail/Documents/CURSOR%20CODES/In%20Progress/Prompt%20Pal%20App/PromptPal/package.json) as the source of truth.

## Contributing

Keep changes small, typed, and aligned with the existing architecture.

- Use Conventional Commits.
- Run linting before opening a PR.
- Review [AGENTS.md](/Users/mikhail/Documents/CURSOR%20CODES/In%20Progress/Prompt%20Pal%20App/AGENTS.md) and [docs/CODEBASE_MAP.md](/Users/mikhail/Documents/CURSOR%20CODES/In%20Progress/Prompt%20Pal%20App/docs/CODEBASE_MAP.md) before making structural changes.

## Links

- Repository: [github.com/mwijanarko1/Prompt-Pal-App](https://github.com/mwijanarko1/Prompt-Pal-App)
- Issues: [GitHub Issues](https://github.com/mwijanarko1/Prompt-Pal-App/issues)
- Discussions: [GitHub Discussions](https://github.com/mwijanarko1/Prompt-Pal-App/discussions)
