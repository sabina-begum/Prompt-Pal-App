# Safe Mode Isolation Plan

**Purpose:** Context for engineers on how we're solving the iOS startup/tab crash. Use this doc to understand the problem, the isolation strategy, what we've learned, and how to continue.

---

## The Problem

- **Symptom:** App crashes on launch or when opening certain tabs. Crash is `EXC_CRASH (SIGABRT)` in `ObjCTurboModule::performVoidMethodInvocation` (TurboModule/native bridge path).
- **When it happens:** With the **full** `src/app` dependency graph (Expo Router root at `src/app`). It does **not** happen when we boot from a reduced tree or use staged "probes" for individual tabs.
- **What we're doing:** Isolating the crash by reintroducing `src/app` in controlled increments (router isolation → tab probes → full-lite boot → eventually full app) and validating every step on device.

---

## Approach (Isolation Strategy)

1. **Router isolation** — Expo Router root pointed at `src/router-app` instead of `src/app`. We rebuilt tabs/auth there with minimal imports and staged "probes" (placeholder → auth → store → convex → full) per tab to find which dependency triggers the crash.
2. **Provider discipline** — Router-isolation tree must be wrapped with the same providers as the real app (Clerk, Convex, etc.). Missing providers (e.g. Convex or Clerk) caused crashes when a tab used hooks from those SDKs.
3. **Full app, reduced root** — Once isolation was stable, we switched the app root back to `src/app` but added a **full-lite** boot mode that uses a reduced root layout (`NormalRootLite`) and only known-stable tabs. Full `NormalRoot` (full `src/app` dependency graph) still crashes on launch; we're narrowing down what in that graph causes it.
4. **Validation** — Every change is validated on a real device with a strict checklist. Local build + device test; we do not rely on "build succeeded" alone.

---

## Key Concepts & Files

| Concept | Meaning |
|--------|----------|
| **Boot mode** (`EXPO_PUBLIC_BOOT_MODE`) | `router` = use `src/router-app` as Expo Router root. `full-lite` = use `src/app` with `NormalRootLite` (reduced wrappers, stable tabs only). `full` = use `src/app` with full `NormalRoot` (currently crashes on launch). |
| **Router profile** | EAS build profile `router` in `eas.json`; sets `EXPO_ROUTER_APP_ROOT`, `EXPO_PUBLIC_BOOT_MODE`, and per-tab stage env vars. |
| **Tab stage / probe** | Per-tab env vars (e.g. `EXPO_PUBLIC_HOME_ISO_STAGE`, `EXPO_PUBLIC_LIBRARY_ISO_STAGE`) control whether that tab loads placeholder, auth-only, store, convex, or full screen. Used to isolate which part of the tab triggers a crash. |
| **NormalRoot vs NormalRootLite** | `src/lib/NormalRoot.tsx` = full app wrappers and dependency graph (crashes on launch with `src/app`). `NormalRootLite` = minimal wrappers + dark theme, same tabs as in isolation; used in `full-lite` to keep launch stable while we compare. |
| **App root** | Set via `EXPO_ROUTER_APP_ROOT` (e.g. `src/router-app` or `src/app`). Entry layout is in that directory's `_layout.tsx`. |

---

## Root Causes We've Identified (So Far)

- **React version mismatch** — React must be pinned to `19.1.0` to match the RN renderer; `19.2.4` caused white screen.
- **Missing providers in isolation** — Using Clerk or Convex hooks in router-isolation without wrapping the tree in `ClerkProvider` / Convex provider caused crashes when opening the Library/Home tab.
- **Clerk key mismatch** — EAS profile was using a different Clerk publishable key than the dashboard; OAuth failed until all profiles used the same key (e.g. `clerk.promptpal.cc`).
- **Full `src/app` + full NormalRoot** — Something in the full `src/app` dependency graph or full `NormalRoot` triggers the TurboModule abort on launch. We have not yet isolated the exact module or import; `full-lite` avoids it by using a reduced root and stable tabs only.

---

## Critical Constraints
1. React must stay pinned to `19.1.0` (`react`, `react-dom`, `react-test-renderer`) to match RN renderer.
2. New Architecture must remain enabled (`newArchEnabled: true`) because Reanimated 4 requires it.
3. Runtime validation on device is mandatory; build success alone is not proof.
4. Use **local** EAS build for this workflow. Remote EAS builds have failed (e.g. "Unknown error" in Install dependencies); validate with `npx eas build --platform ios --profile <profile> --local --output ./build-<NN>-router.ipa`.

## Build History (Detailed Learnings)
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
- Build 44: Updated `NormalRootLite` to mirror `NormalRoot` wrappers (Gesture/SafeArea/ErrorBoundary/StatusBar) and force NativeWind dark scheme at startup; iOS buildNumber bumped to 44.
- Build 44 feedback: Launch crash on app open (`cfBundleVersion` 44), new signature `EXC_BAD_ACCESS (SIGSEGV)` with `expo-secure-store` active in stack while TurboModule exception conversion occurs.
- Build 45 (in progress): Reverted `NormalRootLite` to Build 43 launch-stable structure and moved theme correction to static CSS token defaults (`global.css`) instead of runtime color-scheme mutation; iOS buildNumber bumped to 45.
- Build 45 feedback: Launch stability restored, but theme/colors are still incorrect on device.
- Build 46 feedback: Launch remains stable, but safe-mode/boot screens still looked like debug probes and did not match normal app visual language.
- Build 47 feedback: Stable on device with improved safe-mode UI parity.
- Build 48 feedback: Stable on device after reintroducing `library/[resourceId]` route registration.
- Build 49 feedback: Stable on device (no launch or tab regressions observed).
- Build 50 (in progress): Reintroduced next `NormalRoot` route chunk into `NormalRootLite` by registering `game` in the root stack; iOS buildNumber bumped to 50.
- Build 50 feedback: Stable on device after adding `game` route registration under `full-lite`.
- Build 50 feedback: Full normal mode crash reproduced on launch in TestFlight (`Version 1.0.0 (50)`), signature remains `EXC_CRASH (SIGABRT)` in `ObjCTurboModule::performVoidMethodInvocation`.
- Build 51 feedback: Stable on device after rollback to `full-lite`.
- Build 52 feedback: Stable on device after adding `SafeAreaProvider` wrapper parity.
- Build 53 feedback: Stable on device after adding `ErrorBoundary` wrapper parity.
- Build 54 feedback: Stable on device after adding `StatusBar` (`light`) parity.
- Build 55 feedback: Launch crash reproduced on TestFlight (`Version 1.0.0 (55)`, `EXC_CRASH (SIGABRT)` in React ObjC exception path) after adding `validateEnvironment()` effect in `NormalRootLite`.
- Build 56 feedback: Stable on device after reverting `validateEnvironment()` effect from `NormalRootLite`.
- Build 57 (in progress): Restored native iOS tabs surface by switching `(tabs)` layouts back to `expo-router/unstable-native-tabs` (liquid glass behavior) while keeping auth gate logic; iOS buildNumber bumped to 57.

## Current Status

- **Stable:** Router isolation (`src/router-app`), all tab probes (Library, Home, Ranking, Profile), auth/OAuth, full-lite boot (`src/app` + `NormalRootLite`).
- **Unstable:** Full `src/app` with full `NormalRoot` still crashes on launch (reconfirmed by Build 50).

---

## If You're Picking This Up

1. **Current build:** 57. Router profile uses `EXPO_PUBLIC_BOOT_MODE=full-lite`; app root is `src/app`, entry uses `NormalRootLite`.
2. **Next step:** Validate Build 57 on device (cold launch, sign-in, native tab bar appearance/interaction, library detail, game route, relaunch/session persistence).
3. **Always:** Use **local** EAS build and device validation; see Verification Loop and Device validation checklist below.
4. **Do not:** Change React version, disable New Architecture, or add large unreversible chunks.

---

## Increment Plan
1. Increment 1 (Tabs): Completed and verified in build 17.
2. Increment 2 (Auth): Completed and verified in build 18.
3. Increment 3 (Features): Completed. Full Library stage is stable and signed-in auth path is validated in router isolation (build 31).
4. Increment 4 (Features): In progress. Build 57 focuses on tab UI parity by restoring native tabs while preserving stable boot scaffolding.

## Verification Loop (Per Increment)
1. Add one chunk only.
2. Run local export sanity (set `EXPO_PUBLIC_BOOT_MODE` to match profile: `router`, `full-lite`, or `full`): `EXPO_PUBLIC_BOOT_MODE=<mode> npx expo export --platform ios`.
3. Increment `PromptPal/app.json` iOS `buildNumber`.
4. Build IPA locally: `cd PromptPal && npx eas build --platform ios --profile <profile> --local --output ./build-<NN>-router.ipa`.
5. Install on device and run the **device validation checklist** (see below).
- If success: proceed to next increment.
- If crash: newest chunk is suspect; capture logs immediately.

### Device validation checklist (per build)
- Cold launch (signed out) → lands on sign-in.
- Google sign-in succeeds.
- Open target tab(s) and wait 30–60s; switch across all tabs repeatedly.
- Kill app and reopen → session persists, no crash.
- For full-app builds: open library resource and game route, tab-switch stress test 2–3 min.

## Guardrails

- Do not upgrade React family versions.
- Do not disable New Architecture.
- Keep increments small and reversible.

---

## Quick reference — Commands

**Export sanity (from repo root; set BOOT_MODE to match profile):**
```bash
cd PromptPal && EXPO_PUBLIC_BOOT_MODE=full-lite npx expo export --platform ios
```

**Local iOS build (router profile, output named by build number):**
```bash
cd PromptPal && npx eas build --platform ios --profile router --local --output ./build-44-router.ipa
```

**EAS profile and env:** `PromptPal/eas.json` — `router` profile sets `EXPO_ROUTER_APP_ROOT`, `EXPO_PUBLIC_BOOT_MODE`, and per-tab stage vars. Keep Clerk key and Convex URL in sync with the rest of the app.
