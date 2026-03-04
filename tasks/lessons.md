# Lessons

## 2026-02-17
- When the user specifies a numbered step (e.g., "do number 1"), explicitly align with that step and confirm before proceeding.
- Avoid requesting Xcode-only actions when the project is Expo/RN and the user has stated they cannot open it in Xcode.

## 2026-02-24
- Before every new TestFlight/local iOS build, increment `PromptPal/app.json` -> `expo.ios.buildNumber` and verify it matches the intended build number.

## 2026-02-25
- When using `src/router-app` isolation root, always import `src/app/global.css` in `src/router-app/_layout.tsx`; otherwise NativeWind classes render as plain text.
- Keep Clerk OAuth redirect URLs deterministic (`EXPO_PUBLIC_CLERK_OAUTH_REDIRECT_URL`) and aligned with Clerk dashboard redirect URL allowlist to avoid `Missing external verification redirect URL for SSO flow`.
- Always verify the EAS profile actually used for TestFlight/local build (`router`, `production`, etc.) has the intended Clerk publishable key; profile-level key drift can route auth to a different Clerk instance than the dashboard being configured.
- Preserve Clerk token caching in production auth flows; removing `tokenCache` causes avoidable re-auth prompts across app relaunches/updates.

## 2026-03-01
- Do not bundle theme fixes with root-wrapper changes in the same build; keep visual and lifecycle/native changes isolated so regressions are attributable.
- Prefer deterministic appearance configuration (`userInterfaceStyle`) and static token mapping (`global.css`) over runtime color-scheme mutation during startup in crash-sensitive builds.

## 2026-03-03
- After a user confirms a build is stable, record that outcome immediately in `docs/safe_mode_plan.md` before moving to the next increment.
- Do not jump back to `EXPO_PUBLIC_BOOT_MODE=full` until wrapper parity is fully reintroduced and validated; full-mode shortcuts can reintroduce the same TurboModule startup abort.
- Keep `app.json` iOS `buildNumber` aligned with the actual next build to be generated; if a build number was advanced prematurely, correct it before issuing the next command.
- After SDK upgrades, ensure `package-lock.json` is regenerated with the same npm major as the EAS local build environment; otherwise `npm ci` can fail with lockfile mismatch/missing package entries.
- Avoid calling `validateEnvironment()` in production startup effects inside `NormalRootLite`; thrown effect errors bypass UI boundaries and can hard-abort launch.
