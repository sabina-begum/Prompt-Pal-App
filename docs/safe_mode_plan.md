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
- Build 20 (in progress): Library tab moved to staged probe modes (`placeholder` / `clerk` / `convex` / `full`) for finer isolation. Router profile now defaults to `clerk` probe.
- Build 20 feedback: New artifact confirms `Version 1.0.0 (20)` and crash reproduces only when opening Library tab.
- Root-cause candidate for Build 20: router isolation tree was not wrapped in `ClerkProvider`, but Library `clerk` probe uses Clerk hooks.
- Build 21/22 feedback: Crash no longer reproduces on Library tab, but Clerk probe shows `Clerk loaded: no` and times out.
- Build 23: Confirmed crash on Library tab with `cfBundleVersion` 23 while running `convex` probe stage.
- Root-cause candidate for Build 23: `convex` probe used `useQuery` without a Convex provider in router isolation mode.
- Build 24: Provider fix validated. Library `convex` probe no longer crashes (shows query state `loading`).
- Build 25: Full Library stage no longer crashes; current behavior in isolation is signed-out fallback (`Library unavailable`).
- Build 26 (in progress): Added explicit sign-in navigation from isolation Profile and Library fallback; iOS buildNumber bumped to 26.
- Build 26 feedback: Library no longer crashes, but Google OAuth sign-in fails from the auth screen (`Failed to sign in with Google`).
- Build 27 (in progress): OAuth flow hardened with expanded native redirect candidates and improved Clerk SSO completion/error handling; iOS buildNumber bumped to 27.
- Build 27 feedback: Google OAuth now surfaces Clerk error `Missing external verification redirect URL for SSO flow`; router-isolation UI also lost NativeWind styles (plain text rendering).
- Build 28 (in progress): Restored router-isolation global CSS import, reduced OAuth candidates to valid callback paths only, and added explicit `EXPO_PUBLIC_CLERK_OAUTH_REDIRECT_URL` in EAS profiles; iOS buildNumber bumped to 28.
- Build 30 feedback: Google OAuth still fails despite redirect allowlist updates in `clerk.promptpal.cc`.
- Root-cause found after Build 30: `router` EAS profile still used the old live key for `clerk.promptpal.expo.dev`, so app auth traffic hit a different Clerk instance than dashboard config.
- Build 31 (in progress): Unified Clerk publishable key across EAS profiles to `clerk.promptpal.cc` and kept native redirect override `promptpal://sso-callback`; iOS buildNumber bumped to 31.
- Build 31 feedback: Google OAuth sign-in now succeeds after profile key unification.
- Build 32 (in progress): Re-enabled full Home tab screen (`src/app/(tabs)/index.tsx`) in router isolation and bumped iOS buildNumber to 32.
- Build 32 feedback: App crashes when navigating to Home tab (`cfBundleVersion` 32).
- Build 33 (in progress): Added staged Home probe modes (`placeholder` / `auth` / `store` / `convex` / `full`) and set router profile default to `EXPO_PUBLIC_HOME_ISO_STAGE=auth`; iOS buildNumber bumped to 33.
- Build 33 feedback: Home `auth` probe is stable on device (shows signed-in/user/auth-loaded state, no crash).
- Build 34 (in progress): Advanced router profile Home stage to `store` and bumped iOS buildNumber to 34.
- Build 34 feedback: Home `store` probe is stable on device (shows lives/level/modules, no crash).
- Build 35 (in progress): Advanced router profile Home stage to `convex` and bumped iOS buildNumber to 35.
- Build 35 feedback: Home crashes in `convex` probe stage (`cfBundleVersion` 35).
- Build 36 (in progress): Narrowed Home `convex` probe to a single non-auth query (`getLevels`) and removed `getUserUsage`; iOS buildNumber bumped to 36.

## Current Status
- Stable in isolation: Safe, Clerk, Gesture, Router-isolated root, Router-isolated Tabs, Router-isolated Auth.
- Unstable area: Full `src/app` dependency graph.

## Increment Plan
1. Increment 1 (Tabs): Completed and verified in build 17.
2. Increment 2 (Auth): Completed and verified in build 18.
3. Increment 3 (Features): Completed. Full Library stage is stable and signed-in auth path is validated in router isolation (build 31).
4. Increment 4 (Features): In progress. Home full path regressed in build 32; current target is isolating Home crash source via staged probes.

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
