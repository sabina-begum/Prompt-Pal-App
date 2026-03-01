# Safe Mode Isolation Plan & Learnings Log

## Goal
Identify the specific startup crash cause by reintroducing `src/app` route groups into isolated router mode in controlled increments.

## Critical Constraints
1. React must stay pinned to `19.1.0` (`react`, `react-dom`, `react-test-renderer`) to match RN renderer.
2. New Architecture must remain enabled (`newArchEnabled: true`) because Reanimated 4 requires it.
3. Runtime validation on device is mandatory; build success alone is not proof.

## Confirmed Learnings
- Build 3-7: Startup crash persisted (`EXC_CRASH (SIGABRT)`, TurboModule path).
- Build 12: White screen traced to React version mismatch (`19.2.4` vs renderer `19.1.0`).
- Build 13: Gesture mode stabilized after React pinning.
- Build 14/15: Full `src/app` router mode still crashed.
- Build 16: Router isolation using `src/router-app` launched successfully.
- Build 17: Increment 1 complete. Minimal `(tabs)` shell under `src/router-app` launches successfully on device.
- Build 18: Increment 2 auth routes verified on device. Router mode still launches with auth routes present.
- Build 19: Crashed after enabling the real Library tab screen import in router isolation.
- Crash artifact received is timestamped 2026-02-22 and reports `Version 1.0.0 (15)` with the same `ObjCTurboModule::performVoidMethodInvocation` abort signature. This may be a stale export, but crash class remains unchanged.
- Build 20: Library tab moved to staged probe modes (`placeholder` / `clerk` / `convex` / `full`) for finer isolation. Router profile now defaults to `clerk` probe.
- Build 20 feedback: New artifact confirms `Version 1.0.0 (20)` and crash reproduces only when opening Library tab.
- Root-cause candidate for Build 20: router isolation tree was not wrapped in `ClerkProvider`, but Library `clerk` probe uses Clerk hooks.
- Build 21/22 feedback: Crash no longer reproduces on Library tab, but Clerk probe shows `Clerk loaded: no` and times out.
- Build 23: Confirmed crash on Library tab with `cfBundleVersion` 23 while running `convex` probe stage.
- Root-cause candidate for Build 23: `convex` probe used `useQuery` without a Convex provider in router isolation mode.
- Build 24: Provider fix validated. Library `convex` probe no longer crashes (shows query state `loading`).
- Build 25: Full Library stage no longer crashes; current behavior in isolation is signed-out fallback (`Library unavailable`).
- Build 26: Added explicit sign-in navigation from isolation Profile and Library fallback; iOS buildNumber bumped to 26.
- Build 26 feedback: Library no longer crashes, but Google OAuth sign-in fails from the auth screen (`Failed to sign in with Google`).
- Build 27: OAuth flow hardened with expanded native redirect candidates and improved Clerk SSO completion/error handling; iOS buildNumber bumped to 27.
- Build 27 feedback: Google OAuth now surfaces Clerk error `Missing external verification redirect URL for SSO flow`; router-isolation UI also lost NativeWind styles (plain text rendering).
- Build 28: Restored router-isolation global CSS import, reduced OAuth candidates to valid callback paths only, and added explicit `EXPO_PUBLIC_CLERK_OAUTH_REDIRECT_URL` in EAS profiles; iOS buildNumber bumped to 28.
- Build 30 feedback: Google OAuth still fails despite redirect allowlist updates in `clerk.promptpal.cc`.
- Root-cause found after Build 30: `router` EAS profile still used the old live key for `clerk.promptpal.expo.dev`, so app auth traffic hit a different Clerk instance than dashboard config.
- Build 31: Unified Clerk publishable key across EAS profiles to `clerk.promptpal.cc` and kept native redirect override `promptpal://sso-callback`; iOS buildNumber bumped to 31.
- Build 31 feedback: Google OAuth sign-in now succeeds after profile key unification.
- Build 32: Re-enabled full Home tab screen (`src/app/(tabs)/index.tsx`) in router isolation and bumped iOS buildNumber to 32.
- Build 32 feedback: App crashes when navigating to Home tab (`cfBundleVersion` 32).
- Build 33: Added staged Home probe modes (`placeholder` / `auth` / `store` / `convex` / `full`) and set router profile default to `EXPO_PUBLIC_HOME_ISO_STAGE=auth`; iOS buildNumber bumped to 33.
- Build 33 feedback: Home `auth` probe is stable on device (shows signed-in/user/auth-loaded state, no crash).
- Build 34: Advanced router profile Home stage to `store` and bumped iOS buildNumber to 34.
- Build 34 feedback: Home `store` probe is stable on device (shows lives/level/modules, no crash).
- Build 35: Advanced router profile Home stage to `convex` and bumped iOS buildNumber to 35.
- Build 35 feedback: Home crashes in `convex` probe stage (`cfBundleVersion` 35).
- Build 36: Narrowed Home `convex` probe to a single non-auth query (`getLevels`) and removed `getUserUsage`; iOS buildNumber bumped to 36.
- Build 36 feedback: Home `convex` probe is stable with `getLevels` only.
- Build 37: Restored Clerk token cache persistence and enforced auth-first routing in router isolation (`/` and `(tabs)` now redirect unauthenticated users to sign-in); iOS buildNumber bumped to 37.
- Build 37 feedback: Auth-first flow is validated and session persistence is restored across updates.
- Build 38: Added dedicated Home `usage` probe stage for auth-required `getUserUsage` query (with auth-ready gating), switched router profile to `EXPO_PUBLIC_HOME_ISO_STAGE=usage`, and bumped iOS buildNumber to 38.
- Build 38 feedback: Home `usage` probe is stable on device (`Signed in: yes`, `usage query: ready`, `tier: free`), so `getUserUsage` is not the active crash trigger.
- Build 39: Advanced router profile Home stage to `full` to re-enable complete Home screen path; iOS buildNumber bumped to 39.
- Build 39 feedback: Home full stage is stable on device.
- Build 40: Added router-isolation Ranking stage switch and set router profile to `EXPO_PUBLIC_RANKING_ISO_STAGE=full`; iOS buildNumber bumped to 40.
- Build 40 feedback: Ranking full stage is stable on device.
- Build 41: Added router-isolation Profile stage switch and set router profile to `EXPO_PUBLIC_PROFILE_ISO_STAGE=full`; iOS buildNumber bumped to 41.
- Build 41 feedback: Profile full stage is stable on device.
- Build 42: Router profile switched from isolation boot (`EXPO_PUBLIC_BOOT_MODE=router`) to full app boot (`EXPO_PUBLIC_BOOT_MODE=full`) with app root set to `src/app`; iOS buildNumber bumped to 42.
- Build 42 local sanity: Full-mode export resolves with `Using src/app as the root directory for Expo Router.`
- Build 42 feedback: Launch crash reproduced on app open (`cfBundleVersion` 42) with same `ObjCTurboModule::performVoidMethodInvocation` abort signature.
- Build 43: Added `full-lite` boot mode under `src/app` that keeps only known-stable tabs/auth stack and switched router profile to `EXPO_PUBLIC_BOOT_MODE=full-lite`; iOS buildNumber bumped to 43.
- Build 43 feedback: Launch is stable in `full-lite`, but app theme/token colors are incorrect.
- Build 44 (in progress): Updated `NormalRootLite` to mirror `NormalRoot` wrappers (Gesture/SafeArea/ErrorBoundary/StatusBar) and force NativeWind dark scheme at startup; iOS buildNumber bumped to 44.

## Current Status
- Stable in isolation: Safe, Clerk, Gesture, Router-isolated root, Router-isolated Tabs, Router-isolated Auth.
- Unstable area: Full `src/app` dependency graph.

## Increment Plan
1. Increment 1 (Tabs): Completed and verified in build 17.
2. Increment 2 (Auth): Completed and verified in build 18.
3. Increment 3 (Features): Completed. Full Library stage is stable and signed-in auth path is validated in router isolation (build 31).
4. Increment 4 (Features): In progress. `full-lite` launch is stable in build 43; next target is restoring expected visual theme in build 44 before continuing root-path isolation.

## Verification Loop (Per Increment)
1. Add one chunk only.
2. Run: `EXPO_PUBLIC_BOOT_MODE=router npx expo export --platform ios` (local sanity).
3. Increment `PromptPal/app.json` iOS `buildNumber`.
4. Build IPA/TestFlight.
5. Launch on device.
- If success: proceed to next increment.
- If crash: newest chunk is suspect; capture logs immediately.

## Guardrails
- Do not upgrade React family versions.
- Do not disable New Architecture.
- Keep increments small and reversible.
