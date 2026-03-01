# TODO

## Plan
- [x] Implement a SAFE_MODE bootstrap that avoids loading Clerk/Convex/Sync/usage code
- [x] Add a minimal safe-mode screen and route guard to prevent redirects
- [x] Add an EAS build profile (or env flag) to enable SAFE_MODE for isolation
- [x] Add staged boot modes for Clerk-only and Convex-only
- [x] Add staged boot modes for GestureHandler and Router-only
- [x] Ship a SAFE_MODE build and confirm whether it launches
- [x] Re-enable subsystems one by one to identify the crashing module
- [x] Apply RNGH entry import fix and rebuild gesture mode
 
## Local Build Plan
- [x] Ensure fastlane is available on PATH for local builds
- [x] Address Node version mismatch if it blocks local build
- [x] Run local iOS build for `gesture` profile

## Review
- [x] Confirm SAFE_MODE build does not crash on launch
- [x] Identify the first subsystem re-enable that reintroduces the crash (GestureHandlerRootView)

## React Version Fix Plan
- [x] Parse device logs to identify first fatal JS exception
- [x] Confirm React/renderer mismatch (`react` 19.2.4 vs `react-native-renderer` 19.1.0)
- [x] Pin React family dependencies to 19.1.0-compatible versions
- [x] Reinstall dependencies and regenerate lockfile
- [x] Rebuild local iOS `gesture` profile and verify launch

## React Version Fix Review
- [ ] Confirm runtime no longer throws React version mismatch at startup

## Build 17 Plan
- [x] Add a minimal `(tabs)` route group under `src/router-app` with no heavy feature imports
- [x] Route router-isolation startup into the new tabs group
- [x] Sanity-check router route resolution and TypeScript for the new files

## Build 17 Review
- [x] Confirm router mode boots and shows tab shell without loading full app screens

## Build 18 Plan
- [x] Add `(auth)` route group under `src/router-app` as Increment 2
- [x] Reuse existing auth screens/layout from `src/app/(auth)` in router isolation
- [x] Sanity-check router-mode iOS export after adding auth routes

## Build 18 Review
- [x] Confirm router mode still launches on device with auth routes present

## Build 19 Plan
- [x] Start Increment 3 by enabling one real feature tab (Library) in router isolation
- [x] Sanity-check router-mode iOS export after enabling real Library tab
- [x] Validate router-mode launch on device with real Library tab enabled

## Build 19 Review
- [x] Confirm crash reproduces after enabling full Library tab screen import in router mode

## Build 20 Plan
- [x] Record Build 19 crash and correlate available crash artifact details
- [x] Replace direct full library import with staged library probe modes in router isolation
- [x] Set router profile to `EXPO_PUBLIC_LIBRARY_ISO_STAGE=clerk` for next build
- [x] Validate router-mode launch on device with library `clerk` probe

## Build 20 Review
- [x] Confirm crash reproduces when opening Library tab in build 20 (`cfBundleVersion` 20)

## Build 21 Plan
- [x] Wrap `src/router-app` layout with `ClerkProviderWrapper`
- [x] Add defensive Clerk-config fallback in Library probe route
- [x] Sanity-check router-mode iOS export
- [x] Validate router-mode launch on device and verify Library tab no longer crashes in `clerk` probe

## Build 21 Review
- [x] Confirm app opens and Library tab no longer crashes in `clerk` probe
- [x] Confirm Clerk probe still reports `Clerk loaded: no` (timeout state)

## Build 23 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 23
- [x] Move router profile library stage from `clerk` to `convex`
- [x] Sanity-check router-mode iOS export
- [x] Validate router-mode launch and Library `convex` probe behavior on device

## Build 23 Review
- [x] Confirm crash reappears when opening Library in `convex` probe stage

## Build 24 Plan
- [x] Record Build 23 crash artifacts (`cfBundleVersion` 23) and isolate likely provider gap
- [x] Add Convex provider wrapper to router isolation layout for `convex/full` stages
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 24
- [x] Sanity-check router-mode iOS export
- [x] Validate router-mode launch and Library `convex` probe behavior on device

## Build 24 Review
- [x] Confirm Library no longer crashes in `convex` stage (probe shows query state `loading`)

## Build 25 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 25
- [x] Move router profile library stage from `convex` to `full`
- [x] Sanity-check router-mode iOS export
- [x] Build and validate full Library screen behavior on device

## Build 25 Review
- [x] Confirm full Library screen no longer crashes but falls back to signed-out state (`Library unavailable`)

## Build 26 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 26
- [x] Add direct sign-in entry in router isolation Profile tab
- [x] Add sign-in CTA to Library signed-out fallback state
- [x] Sanity-check router-mode iOS export
- [ ] Validate sign-in flow from isolation tabs and re-test Library after sign-in

## Build 26 Review
- [ ] Confirm user can sign in from isolation flow and Library loads with signed-in data
- [x] Confirm Library no longer crashes in `full` stage but Google OAuth currently fails from sign-in screen

## Build 27 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 27
- [x] Expand Clerk OAuth redirect candidate handling for native callback compatibility
- [x] Handle Clerk SSO completion states beyond top-level `createdSessionId` in sign-in/sign-up
- [x] Improve OAuth error extraction/logging for actionable on-device feedback
- [x] Sanity-check router-mode iOS export
- [ ] Validate Google OAuth sign-in on device/TestFlight and re-test Library signed-in path

## Build 27 Review
- [ ] Confirm Google OAuth sign-in succeeds in router isolation build
- [x] Confirm error is now explicit (`Missing external verification redirect URL for SSO flow`)
- [x] Confirm router-isolation build lost NativeWind styling (plain text UI)

## Build 28 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 28
- [x] Restore NativeWind CSS import in `src/router-app/_layout.tsx`
- [x] Restrict OAuth redirect candidates to valid Clerk callback paths only
- [x] Add `EXPO_PUBLIC_CLERK_OAUTH_REDIRECT_URL` to iOS build profiles in `eas.json`
- [x] Sanity-check router-mode iOS export
- [ ] Validate styled UI and Google OAuth sign-in on device/TestFlight

## Build 28 Review
- [ ] Confirm styles render correctly in router isolation auth/library screens
- [ ] Confirm Google OAuth sign-in succeeds end-to-end

## Build 31 Plan
- [x] Identify active Clerk instance mismatch by decoding EAS publishable keys per profile
- [x] Update `router` profile Clerk key from `clerk.promptpal.expo.dev` to `clerk.promptpal.cc`
- [x] Normalize Clerk key/redirect env across remaining iOS build profiles
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 31
- [x] Sanity-check router-mode iOS export
- [x] Validate Google OAuth sign-in on device/TestFlight with corrected Clerk instance

## Build 31 Review
- [x] Confirm Google OAuth no longer reports missing external verification redirect URL

## Build 32 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 32
- [x] Replace router-isolation Home placeholder with full `src/app/(tabs)/index.tsx` screen import
- [x] Keep Ranking/Profile as isolation placeholders (one-chunk change rule)
- [x] Sanity-check router-mode iOS export
- [x] Validate launch, Home tab, sign-in state, and Library tab on device/TestFlight

## Build 32 Review
- [x] Confirm router isolation is unstable after enabling full Home tab (crash on Home)

## Build 33 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 33
- [x] Replace direct Home full import with staged Home probe modes
- [x] Set router profile `EXPO_PUBLIC_HOME_ISO_STAGE=auth` for safe verification
- [x] Sanity-check router-mode iOS export
- [x] Validate Home `auth` probe on device/TestFlight (no crash)
- [x] If stable, advance Home stage to `store` in next build

## Build 33 Review
- [x] Confirm Home tab no longer crashes in `auth` probe stage

## Build 34 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 34
- [x] Move router profile `EXPO_PUBLIC_HOME_ISO_STAGE` from `auth` to `store`
- [x] Sanity-check router-mode iOS export
- [x] Validate Home `store` probe on device/TestFlight (no crash)

## Build 34 Review
- [x] Confirm Home tab remains stable in `store` probe stage

## Build 35 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 35
- [x] Move router profile `EXPO_PUBLIC_HOME_ISO_STAGE` from `store` to `convex`
- [x] Sanity-check router-mode iOS export
- [x] Validate Home `convex` probe on device/TestFlight (no crash)

## Build 35 Review
- [x] Confirm Home tab is unstable in `convex` probe stage (crash on open)

## Build 36 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 36
- [x] Narrow Home `convex` probe to single non-auth query (`getLevels`)
- [x] Remove Home `convex` probe `getUserUsage` query for isolation
- [x] Sanity-check router-mode iOS export
- [x] Validate narrowed Home `convex` probe on device/TestFlight

## Build 36 Review
- [x] Confirm Home `convex` probe no longer crashes with `getLevels` only

## Build 37 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 37
- [x] Restore Clerk token cache persistence in provider
- [x] Add router isolation auth gate to root index route (`/`)
- [x] Add router isolation auth gate to tabs layout (`/(tabs)`)
- [x] Sanity-check router-mode iOS export
- [x] Validate on device that unauthenticated users land on sign-in first
- [x] Validate session persists across app relaunch/update

## Build 37 Review
- [x] Confirm auth-first navigation and reduced forced re-sign-in behavior

## Build 38 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 38
- [x] Add a dedicated Home probe stage for auth-required usage query (`getUserUsage`) behind explicit auth readiness checks
- [x] Keep current Home `convex` (`getLevels` only) path intact as control
- [x] Set router profile Home stage to the new usage probe
- [x] Sanity-check router-mode iOS export
- [x] Validate Home usage probe on device/TestFlight

## Build 38 Review
- [x] Confirm `getUserUsage` path is stable in isolation (`usage` probe ready, no crash)

## Build 39 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 39
- [x] Move router profile `EXPO_PUBLIC_HOME_ISO_STAGE` from `usage` to `full`
- [x] Sanity-check router-mode iOS export
- [x] Validate Home full screen path on device/TestFlight

## Build 39 Review
- [x] Confirm Home remains stable after re-enabling full stage

## Build 40 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 40
- [x] Add router-isolation Ranking stage switch (`placeholder` / `full`)
- [x] Set router profile `EXPO_PUBLIC_RANKING_ISO_STAGE=full`
- [x] Sanity-check router-mode iOS export
- [x] Validate Ranking full screen path on device/TestFlight

## Build 40 Review
- [x] Confirm Ranking remains stable after re-enabling full stage

## Build 41 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 41
- [x] Add router-isolation Profile stage switch (`placeholder` / `full`)
- [x] Set router profile `EXPO_PUBLIC_PROFILE_ISO_STAGE=full`
- [x] Sanity-check router-mode iOS export
- [x] Validate Profile full screen path on device/TestFlight

## Build 41 Review
- [x] Confirm Profile remains stable after re-enabling full stage

## Build 42 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 42
- [x] Switch router profile from isolation boot (`router`) to full app boot (`full`)
- [x] Point router profile app root override to `src/app`
- [x] Sanity-check full-mode iOS export
- [x] Validate end-to-end app stability on device/TestFlight with isolation removed

## Build 42 Review
- [x] Confirm full app path is unstable without router isolation scaffolding (launch crash, `cfBundleVersion` 42)

## Build 43 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 43
- [x] Add `full-lite` boot mode that mounts only known-stable tabs/auth stack under `src/app`
- [x] Switch router profile `EXPO_PUBLIC_BOOT_MODE` to `full-lite`
- [x] Sanity-check `full-lite` iOS export on `src/app` root
- [x] Validate launch stability on device/TestFlight

## Build 43 Review
- [x] Confirm launch is stable in `full-lite` mode on `src/app` root
- [x] Confirm visual regression: theme/token colors are incorrect in `full-lite`

## Build 44 Plan
- [x] Increment `PromptPal/app.json` iOS `buildNumber` to 44
- [x] Align `NormalRootLite` wrappers with `NormalRoot` (Gesture/SafeArea/ErrorBoundary/StatusBar)
- [x] Force NativeWind dark scheme in `full-lite` startup
- [x] Sanity-check `full-lite` iOS export
- [ ] Validate launch + theme/color correctness on device/TestFlight

## Build 44 Review
- [ ] Confirm `full-lite` is stable and visual theme matches expected app styling
