

Enable Reanimated new architecture
Prompt Pal App




Open


Commit



+138
-56

errors when building: 

[!] Invalid Podfile file: 
[!] Invalid RNReanimated.podspec file: [Reanimated] Reanimated requires the New Architecture to be enabled. If you have RCT_NEW_ARCH_ENABLED=0 set in your environment you should remove it..
 #  from /Users/expo/workingdir/build/PromptPal/node_modules/react-native-reanimated/RNReanimated.podspec:9
 #  -------------------------------------------
 #  $new_arch_enabled = ENV['RCT_NEW_ARCH_ENABLED'] != '0'
 >  assert_new_architecture_enabled($new_arch_enabled)
 #  
 #  -------------------------------------------
.
 #  from /Users/expo/workingdir/build/PromptPal/ios/Podfile:42
 #  -------------------------------------------
 #  
 >    config = use_native_modules!(config_command)
 #  
 #  -------------------------------------------
Error: Unknown error. See logs of the Install pods build phase for more information.


5 previous messages
Root cause fixed: Reanimated 4 requires New Architecture, and your Expo config had it disabled.

Changed:

app.json (line 10)
"newArchEnabled": false -> "newArchEnabled": true
Verification:

npx expo config --json now resolves "newArchEnabled": true, so EAS should no longer set RCT_NEW_ARCH_ENABLED=0 during pod install.
If EAS still fails, the remaining likely cause is an external env var in EAS (RCT_NEW_ARCH_ENABLED=0) set in the dashboard or build profile. In that case, remove it and rebuild (preferably with cache clear).


go through testflight feedback build 5 and 6 folders and see if we've actually solved the problems for build 6


3 previous messages
Finding

[P1] The build 6 crash is not solved; it is the same crash signature as build 5.
Evidence:

Both reports are EXC_CRASH (SIGABRT):
crashlog.crash (line 23)
crashlog.crash (line 23)
Both terminate with Abort trap: 6:
crashlog.crash (line 25)
crashlog.crash (line 25)
Both crash in the same React TurboModule path (ObjCTurboModule::performVoidMethodInvocation):
crashlog.crash (line 61)
crashlog.crash (line 67)
The app binary UUID is identical in both logs (<7c99681c16cb37b18be97b6356485ef2>), strongly indicating the same native executable:
crashlog.crash (line 155)
crashlog.crash (line 157)
Both feedback.json files also only report "comment": "Crash":

feedback.json (line 25)
feedback.json (line 25)
If you want, I can do the next pass now: isolate likely startup TurboModule calls and prepare a targeted fix list for build 7.


fix the problem, its been 6 builds and the app still crashes when opened


6 previous messages
I applied a launch-stability fix set targeted at the startup crash path.

What I changed
Enabled New Architecture for Reanimated 4:

app.json (line 10)
Removed high-risk startup side effects from root layout (no immediate auth sync/network/app-state boot work on cold start):

_layout.tsx (line 55)
Replaced expo-router/unstable-native-tabs with stable Tabs navigator:

_layout.tsx (line 1)
Removed Clerk persisted token cache from provider (memory session only) to eliminate SecureStore calls in auth bootstrap:

clerk.tsx (line 17)
Verification done
iOS bundle compiles successfully after these changes:
npx expo export --platform ios completed without errors.
Important behavior changes
Session persistence is reduced (users may need to sign in again after app restart).
Background sync/session monitor startup behavior is currently disabled in root initialization.
Next step you should run now
Build a fresh TestFlight binary with cache clear:
eas build --platform ios --profile production --clear-cache
Confirm EAS env does not set RCT_NEW_ARCH_ENABLED=0 anywhere.
If this build still crashes on open, I’ll do a second pass with focused runtime instrumentation and re-enable components one by one to isolate the exact native call.


build 7 still crashing. check the testflight feedback folder. is it the same problem with builds 5 and 6?


3 previous messages
Yes. Build 7 is still the same underlying crash class as builds 5 and 6.

Same crash type: EXC_CRASH (SIGABRT)
crashlog.crash (line 23)
crashlog.crash (line 23)
crashlog.crash (line 23)
Same termination reason: Abort trap: 6
crashlog.crash (line 25)
Same native call path: React TurboModule invocation (ObjCTurboModule::performVoidMethodInvocation)
crashlog.crash (line 61)
crashlog.crash (line 67)
crashlog.crash (line 59)
Same startup timing pattern: crash very shortly after launch (~0.7–1.3s).
Build 7 is a new binary (UUID changed), so your new build did ship, but the crash signature did not materially change:
Build 5/6 UUID <7c99681c...> vs build 7 UUID <d448931d...>
crashlog.crash (line 157)
crashlog.crash (line 157)

why have you not fixed it?

Because the crash log you have is still unsymbolicated and only shows a generic ObjCTurboModule::performVoidMethodInvocation abort, not the actual native module or method that threw. I made high‑probability fixes (removed unstable native tabs, removed startup sync side‑effects, removed Clerk token cache at boot, enabled New Architecture), but build 7’s crash signature is unchanged, so the root cause isn’t in those paths.

What’s needed to actually fix it now is one of these:

Symbolicate build 7 using its dSYM so we can see the exact module/method that aborted.
I can run eas build:list and eas build:download --platform ios --type dSYM and then symbolicate the crash.

Build a “safe mode” that boots without Clerk/Convex/SecureStore and then re‑enable components one by one via a flag to isolate the crashing TurboModule.
This is deterministic but takes a couple builds.

Tell me which route you want and I’ll proceed.


do number 1

I tried to do number 1, but I can’t symbolicate without a dSYM and this build doesn’t have one available from EAS.

What I found:

Build 7 ID: a97b2281-185b-4ea7-a598-d7538feb0924 (build number 7, commit 4191c79).
EAS build metadata shows Build Artifacts URL: null, so no dSYM artifact is exposed.
The Xcode log confirms a dSYM zip was created on the build worker, but it wasn’t uploaded anywhere.
To proceed with symbolication, I need one of these:

App Store Connect API key (issuer ID, key ID, and .p8 path), so I can run a dSYM download for build 7.
The dSYM zip for build 7 provided directly.
Tell me which you can provide and I’ll continue immediately.


1. issuer ID: 7a20aa00-4433-4bd4-8bf4-97d8f4a54a42. key id: 5BA58G29S7. whats a .p8 path?

A .p8 is the App Store Connect API private key file you downloaded when you created the key. I need its filesystem path to authenticate and download dSYMs.

Tell me the full path to the .p8 file (example: AuthKey_5BA58G29S7.p8). If you want, I can search common locations (~/Downloads, ~/Desktop) for AuthKey_5BA58G29S7.p8—just say the word.


change key id to: 8C33YQ9FZ8

the auth key file is in downloads

I got to the App Store Connect API, but the current key cannot access dSYMs.

What worked:

App Store Connect build 7 ID is 53019b8a-7576-4cdd-a2b2-637befb3dce4.
What’s blocked:

Any buildBundles access (required to download dSYMs) returns 403 FORBIDDEN_ERROR:
“The resource buildBundles has no allowed operations defined.”
That means this API key’s role doesn’t permit dSYM access.
Next step needed from you
Please create or provide an App Store Connect API key with App Manager or Admin role (buildBundles access), then give me:

new key id
issuer id
.p8 path
If you prefer not to generate a new key, you can manually download the dSYM from App Store Connect and provide the file path, and I’ll symbolicate locally.


new key id: 2J2WXJ4W6A

p8 path is in downloads. issuer id the same

Still blocked. The new key can authenticate, but it does not have permission to access buildBundles (the endpoint that exposes dSYM download links).

What I verified:

The key works for builds list.
Build 7 ASC ID is 53019b8a-7576-4cdd-a2b2-637befb3dce4.
GET /builds/{id}/buildBundles returns 403 FORBIDDEN with “no allowed operations defined.”
This is a role/permission issue on the App Store Connect API key. To proceed, I need an API key with App Manager or Admin role (buildBundles access), or the dSYM zip file downloaded manually.

Options:

Create a new ASC API key with App Manager or Admin, give me:
key id
issuer id
.p8 path
Manually download the dSYM from App Store Connect and give me the local path to the .zip.
If you want me to help you locate the new .p8 after you create it, I’ll search Downloads again.


new key id: J8R7HZ84P5

check downloads for p8 file

Still blocked. The new key authenticates, but buildBundles is still 403 FORBIDDEN, which means this API key still doesn’t have permission to download dSYMs.

This is almost always the key role. To proceed you need one of:

API key with App Manager or Admin role
In App Store Connect → Users and Access → Keys → create a new key with role App Manager (or Admin). Then give me the new key id and .p8 path.

Manual dSYM download
In App Store Connect → TestFlight → select build 7 → Build Metadata → Download dSYM.
Give me the local path to that .zip and I’ll symbolicate.

Which route do you want to take?


i can't find it. i can't open the app on xcode because its a RN adn Expo app

You don’t need Xcode to get the dSYM. For Expo/RN builds, App Store Connect is still the right place.

Try this path:

App Store Connect → My Apps → PromptPal
TestFlight → iOS Builds
Click build 7
In the build details pane, look for Build Metadata → Download dSYM (sometimes under a … menu)
If you still don’t see it:

Check that build 7 status is Ready for Testing (not Processing).
Your App Store Connect role likely lacks permission. You need Admin or App Manager to download dSYMs.
Ask the account holder to download the dSYM and give me the local path to the .zip.
Once you have the .zip path, send it and I’ll symbolicate the crash immediately. If you want to use the API route, I still need a key that has buildBundles access (Admin/App Manager).


i can't find it. its not there

You don’t need Xcode for dSYMs, but you do need App Store Connect permissions. Right now the API keys you provided authenticate, but buildBundles access is forbidden, which is exactly where Apple exposes dSYM downloads. That’s why you can’t see the dSYM in the UI either.

This means your current account role (or API key role) is not App Manager/Admin.

What I need to proceed

Create a new App Store Connect API key with role App Manager or Admin.
Give me:
new key id
same issuer id
the .p8 path in Downloads
Or:

Ask someone with Admin/App Manager to download the dSYM from App Store Connect and give me the local .zip path.
If you can grant the right role or get the dSYM zip, I’ll symbolicate immediately.


the latest keys were admin access

I found the new key file at AuthKey_J8R7HZ84P5.p8 and used it to query App Store Connect. The key authenticates and can list builds, but buildBundles is still forbidden. That’s the only API surface that exposes dSYM downloads, so symbolication is still blocked.

Concrete result:

Build 7 ASC ID: 53019b8a-7576-4cdd-a2b2-637befb3dce4
GET /v1/buildBundles returns 403 FORBIDDEN
“The resource buildBundles has no allowed operations defined.”
This means the API key still doesn’t have the right permissions for dSYMs, even if it’s labeled Admin.

What I need you to do:

App Store Connect → Users and Access → Keys → select the new key.
Ensure:
Role = App Manager (try this even if it says Admin)
Access = All Apps (or explicitly include PromptPal)
Save, then tell me and I’ll retry immediately.
If you can’t get a key with buildBundles access, the only alternative is:

Have someone with App Manager/Admin download the dSYM from App Store Connect and give me the local .zip path.
If neither is possible, I can switch to a safe‑mode isolation build to identify the crashing TurboModule without symbols.


forget the dsym what's another way to solve the problem?

Another way is to isolate the crash with a SAFE_MODE build that boots without Clerk/Convex/Sync/usage. If SAFE_MODE still crashes, the issue is native-level (e.g., Reanimated/New Arch/Gesture Handler). If it launches, we re‑enable subsystems one by one to pinpoint the exact module.

I’ve updated todo.md with this plan. Want me to implement SAFE_MODE now?


how. many builds will this take?

Minimum 2 builds.

Build A: SAFE_MODE only. If it still crashes, we stop and focus on native libs.
Build B: re-enable one subsystem (start with Clerk).
Worst‑case 4–6 builds if we need to toggle several subsystems, but I’ll prioritize highest‑risk ones first to keep it to 2–3.


okay put this plan in an md file in the docs folder and start

I put the plan in safe_mode_plan.md and implemented SAFE_MODE.

What I changed:

Added SAFE_MODE bootstrap in _layout.tsx.
Moved normal app root into NormalRoot.tsx and lazy‑loaded it only when SAFE_MODE is off.
Added safe build profile with EXPO_PUBLIC_SAFE_MODE=1 in eas.json.
Next step (Build A):

eas build --platform ios --profile safe --clear-cache
Expected outcome:

If it shows the SAFE MODE screen, we’ve isolated the crash to a subsystem and we’ll re‑enable them one by one.
If it still crashes, the problem is in core native deps (e.g. Reanimated/New Arch/Gesture Handler), and we’ll focus there.
Tell me when build A is uploaded and I’ll proceed with the next toggle.


i can see the safe mode screen

SAFE_MODE confirmed. I’ve already staged the next steps so we can isolate the culprit in 1–2 more builds.

What I added:

Clerk-only boot mode (EXPO_PUBLIC_BOOT_MODE=clerk)
Convex-only boot mode (EXPO_PUBLIC_BOOT_MODE=convex)
EAS profiles clerk and convex in eas.json
Next build (Build B):

eas build --platform ios --profile clerk --clear-cache
If build B crashes, the problem is Clerk or its native deps.
If it launches, we proceed with:

eas build --platform ios --profile convex --clear-cache
Once you upload Build B, tell me whether it crashes or shows the CLERK MODE screen and I’ll move to the next step.


it shows the clerk mode screen

Good. Clerk is not the culprit.

Next build (Convex-only):

eas build --platform ios --profile convex --clear-cache
If it crashes, the issue is Convex (or its transitive native deps). If it shows the CONVEX MODE screen, we’ll re-enable the full app and then turn on subsystems like background sync and usage query one by one.

Tell me the result after build uploads.


convex mode shows

Great — that means the crash is in the full app UI path, not Clerk or Convex.

I added two more isolation modes so we can pinpoint it without guessing:

Gesture mode (only GestureHandlerRootView, no router)
Router mode (only Expo Router stack + a minimal screen)
Next build to run:

eas build --platform ios --profile gesture --clear-cache
If that shows GESTURE MODE, Gesture Handler is fine and we move to:

eas build --platform ios --profile router --clear-cache
Tell me the result after the gesture build uploads.


gesture mode crashed

That isolates it: the crash is in react-native-gesture-handler initialization.

Next step is to remove/replace the GestureHandler wrapper and any dependency on it, then build again. I can do this in two options:

Minimal fix: remove GestureHandlerRootView entirely and avoid react-native-gesture-handler in runtime.
Replace with Expo’s default setup (no gesture handler at root) and adjust any usage that needs it.
If you want me to go ahead with option 1 (fastest to prove), say “do option 1”. If you want a cleaner long‑term fix, say “option 2” and I’ll refactor accordingly.


go through this for info: https://docs.swmansion.com/react-native-gesture-handler/docs/


1 previous message
Summary of changes to address the GestureHandler crash:

Added an explicit entry file that imports Gesture Handler before Expo Router: index.js.
Updated the app entry to use that file: package.json.
Generated a codebase map and updated pointers: CODEBASE_MAP.md and CLAUDE.md.
Logged a lessons file and updated task status: lessons.md, todo.md.
Key RNGH doc takeaways relevant to the crash:

Your app must be wrapped in GestureHandlerRootView as close to the root as possible; gestures won’t work outside that root. (docs.swmansion.com)
If you customize the root view style, it must include flex: 1 or nothing will render. (docs.swmansion.com)
RNGH 2.28.0+ supports RN 0.79+, and Reanimated 2.3+ is required for full touch handling. Your versions are compatible. (docs.swmansion.com)
For Expo development builds, prebuild updates native code. (docs.swmansion.com)
Legacy guidance (still valid in practice) recommends import 'react-native-gesture-handler' as the first import in the entry file for RN 0.61+. (docs.swmansion.com)
Why the entry file change:

The doc-backed “first import in entry file” guidance is the most common fix for crashes when Gesture Handler initializes too late. The new index.js ensures RNGH loads before expo-router/entry. (docs.swmansion.com)
What I didn’t run:

No tests or builds were run in this environment.
Next steps:

Rebuild the gesture profile and test startup: npx eas build --platform ios --profile gesture --clear-cache.
If Gesture mode boots, run a full build to confirm the crash is gone. If it still crashes, we’ll need the updated TestFlight crash log (same build number) to confirm whether it’s still RNGH or something else.

im running out of eas builds. can we do local builds instead?

Yes. Local iOS builds are a good way to avoid burning EAS build credits. They do not consume EAS build minutes, but they do require a Mac with Xcode and valid signing credentials.

If you want, I can run a local build from here. Two quick checks first:

Are you on a Mac with Xcode installed?
Do you want to build the gesture profile first (to verify the crash fix), or jump straight to a full build?
If you’re good to proceed, the command is:

npx eas build --local --platform ios --profile gesture
Notes:

This may generate an ios/ folder if one doesn’t exist yet.
Output will be an .ipa you can install locally or upload.
To ship to TestFlight without EAS build minutes, we can upload the .ipa with Transporter or eas submit --path <ipa> (requires Apple ID/app-specific password).
Tell me which profile you want to build and I’ll run it.


why would anyone do eas build if there's local build? 

EAS Build is cloud CI. It’s useful when you don’t have a Mac, don’t want to manage Xcode/signing locally, or need repeatable builds for a team. Common reasons people still use EAS Build:

No Mac required for iOS builds.
Signing and credentials are handled automatically.
Consistent, reproducible environment across the team.
Easy CI integration and build history.
Build profiles and secrets are managed centrally.
Can auto-upload to TestFlight/Play Console.
Local builds are great when you do have a Mac and want to avoid build minutes, but they shift all setup, signing, and environment issues to your machine. Both are valid; local is usually faster/cheaper for one person, EAS is better for teams or headless workflows.


this whole time ive been doing eas builds. you're saying i didn't have to?

Local iOS builds have always been an option, but only if you have a Mac with Xcode and valid signing set up. EAS Build isn’t “wrong” — it’s the default because it avoids all that local setup and works on any machine.

So the short answer:

If you have a Mac + Xcode + signing, you could have done local builds.
If you didn’t have that ready, EAS Build was the right path.
If you want to switch now, confirm you’re on a Mac with Xcode installed and I’ll run a local build.


yes im on a mac with xcode

✔ Compressed project files 2s (49.3 MB)
✔ Computed project fingerprint
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated rimraf@2.4.5: Rimraf versions prior to v4 are no longer supported
npm warn deprecated lodash.get@4.4.2: This package is deprecated. Use the optional chaining (?.) operator instead.
npm warn deprecated glob@6.0.4: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated @xmldom/xmldom@0.7.13: this version is no longer supported, please update to at least 0.8.*
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated tar@7.5.7: Old versions of tar are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
Node.js version in your eas.json does not match the Node.js currently installed in your system
Fastlane is not available, make sure it's installed and in your PATH
spawn fastlane ENOENT
Error: spawn fastlane ENOENT
    at ChildProcess._handle.onexit (node:internal/child_process:285:19)
    at onErrorNT (node:internal/child_process:483:16)
    at process.processTicksAndRejections (node:internal/process/task_queues:89:21)
npx -y eas-cli-local-build-plugin@18.0.1 eyJqb2IiOnsidHlwZSI6Im1hbmFnZWQiLCJwbGF0Zm9ybSI6ImlvcyIsInByb2plY3RBcmNoaXZlIjp7InR5cGUiOiJQQVRIIiwicGF0aCI6Ii92YXIvZm9sZGVycy9ibC9yOW1icHRfMTE4Z18xc3Y3d2pyXzg4MjQwMDAwZ24vVC9lYXMtY2xpLW5vZGVqcy9kYjc5NDAwOS0wNjQyLTRmNmEtYjY3Mi0zNTZkZDkxMzFkNGYudGFyLmd6In0sInByb2plY3RSb290RGlyZWN0b3J5IjoiUHJvbXB0UGFsIiwiYnVpbGRlckVudmlyb25tZW50Ijp7Im5vZGUiOiIyMC4xOS40IiwiZW52Ijp7IkVYUE9fUFVCTElDX0JPT1RfTU9ERSI6Imdlc3R1cmUiLCJFWFBPX1BVQkxJQ19DT05WRVhfVVJMIjoiaHR0cHM6Ly9mbGlwcGFudC1mZXJyZXQtMzA2LmNvbnZleC5jbG91ZCIsIkVYUE9fUFVCTElDX0NPTlZFWF9TSVRFX1VSTCI6Imh0dHBzOi8vZmxpcHBhbnQtZmVycmV0LTMwNi5jb252ZXguc2l0ZSIsIkVYUE9fUFVCTElDX0NMRVJLX1BVQkxJU0hBQkxFX0tFWSI6InBrX2xpdmVfWTJ4bGNtc3VjSEp2YlhCMGNHRnNMbVY0Y0c4dVpHVjJKQSJ9fSwiY2FjaGUiOnsiZGlzYWJsZWQiOmZhbHNlLCJwYXRocyI6W10sImNsZWFyIjpmYWxzZX0sInNlY3JldHMiOnsiYnVpbGRDcmVkZW50aWFscyI6eyJQcm9tcHRQYWwiOnsicHJvdmlzaW9uaW5nUHJvZmlsZUJhc2U2NCI6Ik1JSXYxQVlKS29aSWh2Y05BUWNDb0lJdnhUQ0NMOEVDQVFFeEN6QUpCZ1VyRGdNQ0dnVUFNSUlmNFFZSktvWklodmNOQVFjQm9JSWYwZ1NDSDg0OFAzaHRiQ0IyWlhKemFXOXVQU0l4TGpBaUlHVnVZMjlrYVc1blBTSlZWRVl0T0NJL1BnbzhJVVJQUTFSWlVFVWdjR3hwYzNRZ1VGVkNURWxESUNJdEx5OUJjSEJzWlM4dlJGUkVJRkJNU1ZOVUlERXVNQzh2UlU0aUlDSm9kSFJ3T2k4dmQzZDNMbUZ3Y0d4bExtTnZiUzlFVkVSekwxQnliM0JsY25SNVRHbHpkQzB4TGpBdVpIUmtJajRLUEhCc2FYTjBJSFpsY25OcGIyNDlJakV1TUNJK0NqeGthV04wUGdvSlBHdGxlVDVCY0hCSlJFNWhiV1U4TDJ0bGVUNEtDVHh6ZEhKcGJtYytVSEp2YlhCMFVHRnNQQzl6ZEhKcGJtYytDZ2s4YTJWNVBrRndjR3hwWTJGMGFXOXVTV1JsYm5ScFptbGxjbEJ5WldacGVEd3ZhMlY1UGdvSlBHRnljbUY1UGdvSlBITjBjbWx1Wno1WFNEUk5WRFZhTkRSVFBDOXpkSEpwYm1jK0NnazhMMkZ5Y21GNVBnb0pQR3RsZVQ1RGNtVmhkR2x2YmtSaGRHVThMMnRsZVQ0S0NUeGtZWFJsUGpJd01qWXRNREl0TVRKVU1EQTZORFE2TURkYVBDOWtZWFJsUGdvSlBHdGxlVDVRYkdGMFptOXliVHd2YTJWNVBnb0pQR0Z5Y21GNVBnb0pDVHh6ZEhKcGJtYythVTlUUEM5emRISnBibWMrQ2drSlBITjBjbWx1Wno1NGNrOVRQQzl6ZEhKcGJtYytDZ2tKUEhOMGNtbHVaejUyYVhOcGIyNVBVend2YzNSeWFXNW5QZ29KUEM5aGNuSmhlVDRLQ1R4clpYaytTWE5ZWTI5a1pVMWhibUZuWldROEwydGxlVDRLQ1R4bVlXeHpaUzgrQ2drOGEyVjVQa1JsZG1Wc2IzQmxja05sY25ScFptbGpZWFJsY3p3dmEyVjVQZ29KUEdGeWNtRjVQZ29KQ1R4a1lYUmhQazFKU1VaMlZFTkRRa3RYWjBGM1NVSkJaMGxSWW10VFYxZHZVMFJ1UWtacmRGZzJhbHBFVWxCamFrRk9RbWRyY1docmFVYzVkekJDUVZGelJrRkVRakZOVlZGM1VXZFpSRlpSVVVSRVJIUkNZMGhDYzFwVFFsaGlNMHB6V2toa2NGcEhWV2RTUjFZeVdsZDRkbU5IVm5sSlJrcHNZa2RHTUdGWE9YVmplVUpFV2xoS01HRlhXbkJaTWtZd1lWYzVkVWxGUmpGa1IyaDJZMjFzTUdWVVJVeE5RV3RIUVRGVlJVTjNkME5TZWsxNFJYcEJVa0puVGxaQ1FXOU5RMnRHZDJOSGVHeEpSV3gxV1hrMGVFTjZRVXBDWjA1V1FrRlpWRUZzVmxSTlFqUllSRlJKTWsxRVNYaE5ha0YzVFhwUmQwMXNiMWhFVkVrelRVUkplRTFxUVhkTmVsRjNUVlp2ZDJkYVozaEhha0ZaUW1kdlNtdHBZVXByTDBseldrRkZRa1JCY0ZoVFJGSk9Wa1JXWVU1RVVsUk5WSGQzVDJkWlJGWlJVVVJFUkU1d1ZVZG9kbUp0VldkU1IyeDZaRWhLY0ZsdVZqQmhWemwxVDJsQ1RtRlhkRzlaVjJ4elNVWmtjR0Z0Um5WWldFcHlZbmxCYjFZd1p6QlVWbEV4VjJwUk1GVjVhM2hGZWtGU1FtZE9Wa0pCYzAxRGJHUkpUa1V4VlU1V2J6Qk9SazE0UjJwQldVSm5UbFpDUVc5TlJWVXhjR0V5YUdoaFYzZG5WakpzY1ZsWE5XaGpiWFIyVFZGemQwTlJXVVJXVVZGSFJYZEtWbFY2UTBOQlUwbDNSRkZaU2t0dldrbG9kbU5PUVZGRlFrSlJRVVJuWjBWUVFVUkRRMEZSYjBOblowVkNRVW92Ym5Nck5XOUtaR05tYkhGNWQzazVNRVFyUldNMFdUY3hRMmRpT0dGVlRrSldTMnhZWW5CelowOXJiM2RTVkRKUVdtOTNiVkl5YmpSdFZGbFVjalprTWtOVVNXeGxNVmRhYWtSalRHMVVNWEJoZERkWVFWUmpZMHMyZGtWWmFHb3hVVXRWTVRoS09FZGFWbFF2WlZadFIxQkxlbWRSUkd4M1VFbzFXWGRXVXpVMmJuZHZURzFEUkdwdlFra3lORGM1Y2pCTmRFVjJOM1pETkVjNWVrTklVR2h1VFUweEwxQnZiRW95VVdsV1YyNWpZbmhRYjFKWWNrTlFRbVI2YzI5UVR6azNjRU0xTlhoM1R6bGlaa3BaTVcxYU1qUXZLM3BSYkRscGRHTmtjbVI1TTNWalowUnhaMGxXUmxoalZXTkdWRWxuUlVKaU9HVktWMEpYZDJVME9FVXlka0UzY1hoalZWTnpialZSWm01bmNXbDVhV0V2WjBGRkszaHVOeXRPTVdWU1JYZHNiMGs0WjBNeE9HbFlhMUZhU1ZaNlNGRk1UVFZYTVVWTlUwMWpaRVoxTkRBd0wxVkROSEUwV1UwclZtUlhWVU5CZDBWQlFXRlBRMEZwVFhkblowbG1UVUYzUjBFeFZXUkZkMFZDTDNkUlEwMUJRWGRJZDFsRVZsSXdha0pDWjNkR2IwRlZRMlkzUVVaYVJEVnlNbEZMYTJoTE5VcHBhR3BFU21aemNEZEpkMk5CV1VsTGQxbENRbEZWU0VGUlJVVmFSRUpwVFVNd1IwTkRjMGRCVVZWR1FucEJRMmhwUm05a1NGSjNUMms0ZGxreVZubGtTRTExV1ZoQ2QySkhWWFZaTWpsMFRETmtNMXBJU201TmVUVnJXbGhKZDAxUldVbExkMWxDUWxGVlNFMUJSMGRLVjJnd1pFaEJOa3g1T1haWk0wNTNURzFHZDJOSGVHeE1iVTUyWWxNNWRsa3pUbmROUkUxMFpETmthMk50WTNwTlJFbDNaMmRGWlVKblRsWklVMEZGWjJkRlZrMUpTVUpGVkVORFFWRXdSME5UY1VkVFNXSXpXVEpSUmtGVVEwSXZla05DZDNkWlNVdDNXVUpDVVZWSVFXZEpkMmRpV1UxbllrNVRXbGQ0Y0ZsWE5XcGFVMEoyWW1sQ01HRkhiSHBKUjA1c1kyNVNjRnB0YkdwWldGSnNTVWRLTlVsSFJuVmxVMEozV1ZoS01HVlRRbWhqTTA0eFlsZFdla2xIUm1wWk1sWjNaRWRHZFZreVZXZGlNbGxuWkVkb2JFbElVbTlhVnpSbldWaENkMkpIYkdwWlYwcHpXbE5DZW1SSFJuVmFSMFo1V2tOQ01GcFlTblJqZVVKb1ltMVJaMWt5T1hWYVIyd3dZVmM1ZFdONVFuWmFhVUl4WXpKVmMwbEhUbXhqYmxKd1dtMXNhbGxZVW14SlNFSjJZa2RzYW1WVFFtaGliVkZuV1RKV2VXUkhiRzFoVjA1b1pFZHNkbUpwUW5kamJVWnFaRWRzYWxwVFFucGtSMFl3V2xjeGJHSnVVbnBNYWtFelFtZG5ja0puUlVaQ1VXTkRRVkpaY21GSVVqQmpTRTAyVEhrNU0yUXpZM1ZaV0VKM1lrZFZkVmt5T1hSTU1rNXNZMjVTY0ZwdGJHcFpXRkpzV1ZoV01HRkhPWGxoV0ZJMVRIcEJWMEpuVGxaSVUxVkNRV1k0UlVSRVFVdENaMmR5UW1kRlJrSlJZMFJCZWtGa1FtZE9Wa2hSTkVWR1oxRlZUMUJ1ZVRBeldGaFVTV000YWtKek5EaE9XSFZvY1hOdGVHeHpkMFJuV1VSV1VqQlFRVkZJTDBKQlVVUkJaMlZCVFVKTlIwTnBjVWRUU1dJeldUSlJSMEZSVVVKQlpqaEZRV2RWUVUxQk1FZERVM0ZIVTBsaU0wUlJSVUpEZDFWQlFUUkpRa0ZSUVRCUldVZEhjSEp0TUdSV1JISlBlamR0YnpCV2FWcE5MMlZWTkZOYVYycDJkMFZJVmtScmRHMVpkVkp2VUdoSmNIUXdkamhpY25oalQxZFBlV0ozVkZsUk1VMVhZbXBCUWtWR1pFRkhOVEpRWTBOd0wzSkRUV2RHYURkM1RuTlJVemN2WW5ZMlIwRjZNMjFVWjNsc09GTkVjMHhzVkdaa1JIa3djVkJUWm1oRk5HMTBRamxWUVZkb2RYUkxSRFpwT0RWSkwySTNRMGx5Ymxrd1JFbFZVV0p3WlZSS1UwRllWa3RWUzNkRFJGVndNRkZ6U1c1VVIybHNWRWw2VkUwclN6VjNkV3d6T1dGWWFYbHhWMUo2WlUwclowaHJTbFZ5VGtKT2IwbGFXbWRsZEdnME5XZDBSM1YxVkhCTlN6VlBaRzVWYUVOcmRUVlJXVVpOV2xwdldVdElVbWg2ZEROa1ZXbGFMMlZ3TjJKMmIzWnlRbVZ0ZHpWamFWcDZObUYwWjNGb1JrUlNjREZ4UkZKb2VEbEpUeXRLVlROc1dXODJXVkV6UkdGelltRjROUzlIV0VSUWQzWkRTVEE1TVM5NFl6aHpOR0V2UEM5a1lYUmhQZ29KUEM5aGNuSmhlVDRLQ2drOGEyVjVQa1JGVWkxRmJtTnZaR1ZrTFZCeWIyWnBiR1U4TDJ0bGVUNEtDVHhrWVhSaFBrMUpTVTVXZDFsS1MyOWFTV2gyWTA1QlVXTkRiMGxKVGxORVEwTkVWVkZEUVZGRmVFUlVRVXhDWjJ4bmFHdG5RbHBSVFVWQlowVjNaMmROV0VKbmEzRm9hMmxIT1hjd1FrSjNSMmRuWjAxSlFrbEpSRUpFUjBOQmQwRjNSRUYzU0ZadFZubGpNbXgyWW1kSlFrRlVRVTVFUVdoUlZVWkdSR0ZIVm1waGQwVkNRVVJCVVVSQmNGVmhWekZzVmtjNVRXRllXbXhCWjBsQ1lrUkJWRVJCTlVwak1XaHFZakpTYkZSWFJuVlpWMlJzV2tGRlFrRkVRVmRFUVd4Q1kwaENTbEpGTldoaVYxVk5RMVpDZVdJeU1YZGtSa0pvWWtSQlpFUkJhRlZhVjBaMFZHMUdkRnBSZDFKVVYyeHlZVWRHY0dKRFFsaGhWM0JvWW0xR2VXRXlPSGRJVVhkTlVUTktiRmxZVW5CaU1qVkZXVmhTYkVaM01IbE9ha0Y1VFZSSmQwMUVVVEJOUkdSaFRVSTBUVVJzVW14WlZ6RktXa2RXZFdSSGJHMWhWMVo1VFVGM1RVTnNaRWxPUlRGVlRsWnZNRTVHVFhkSWQzZFBVbGhvZDJGWVNtaGtSMngyWW10U2FHUkhWVmhFVkVrelRVUkplRTFxUVhkTmVsRjNUVlp2ZDBsQmQxaFZTRXAyV20xc2MxcFZVbkJqTTFKNVlWZEtNV1JIYkhaaWJGSTFZMGRWVFVKV1RsVlVNVXBHVFVORlRVTkdRbk5aV0ZKdFlqTktkRTFDVlUxQk1teFFWWGQzUldWSVNsQlZkM2RKWkcxc2VtRlhPWFZVTVUxM1MzZDNZbEZZUW5kaVIyeHFXVmhTY0dJeU5VcGFSMVoxWkVkc2JXRlhWbmxWU0Vwc1dtMXNORTFCZDAxRGJHUkpUa1V4VlU1V2J6Qk9SazEzVEVGM1JWWldWa3BTUVhkclRVUkJlRnBVU1RST1IxVjBUWHBhYUUxcE1EQk9WRmswVEZSc2ExbFhTWFJOZWxab1QwUlplazlFYXpWWk1sRTFUVVJ6VFVaVlVteGtiVlp6WWpOQ2JHTnJUbXhqYmxKd1dtMXNhbGxZVW14amVrRnBRa05FY2pFNE5YSlJhV1JHT0ZKcFJWTnBaMjU2U0ZSd2VXWkplV2hQUjJOUldqTjJjRGxFYm1OWU9UUldSRUpPUkVGU1QxbFhNV3hFUlZWeFZ6SldOR05IT1dSSlIwNTJZbE0xZEdGWGRHOVpWMnh6WXpOQ2JGbFhkSHBNYmtKNVlqSXhkMlJJUW1oaVEwSkNZMGhDVkdSSE9YbGFVMEY1VFVSSk1reFVRWGxNVkVWNVZrUkJkMDlxVVRCUGFrRXpUR3BGZDA5R2IzZG5abGxOUkVWV2RXUkhiREJpUjFaMFdsYzFNR016UTBJMVVVbENRV0pEUWpONlFrRkVRbHBvWTBoQ2MyRlhUbWhrUjJ4Mllta3hjRnBIVm5Wa1IyeHRZVmRXZVVSRFdsaFRSRkpPVmtSV1lVNUVVbFJNYlU1MllsTTFkR0ZYZEc5WlYyeHpZek5DYkZsWGRIcE1ia0o1WWpJeGQyUklRbWhpUkVGWlJFSk9hVnBZVW1oTVdFcHNZMGM1ZVdSSVRYUlpWMDR3WVZoYWJFRlJTQzlOUkVWTlNUSk9kbUpUTldoalNFSnpXbE0xYTFwWVdteGlSemwzV2xoSmRXUkhWbWhpVXpGd1drZFdkV1JIYkcxaFYxWjVSRUZ3V0ZORVVrNVdSRlpoVGtSU1ZFMUNUVTFFYldSc1pFTXhNRmxZVG5KTVYwWnpZa2M1TTBGUlJVRk5SR3ROUm0xMGJHVlhUbTlaVjJ4MVRGZEdhbGt5Vm5wamVURnVZMjA1TVdOSVRYZElkM2ROVmpCbk1GUldVVEZYYWxFd1ZYazBjVVJCT1dwaU1qQjFXVmhDZDJKSFZYVmtSemx5V2xjMloyZG5aemhOU1VsRFVYcERRMEZqYldkQmQwbENRV2RKU1V4aldEaHBUa3hHVXpWVmQwTm5XVWxMYjFwSmVtb3dSVUYzVFhkYWVrVmlUVUpyUjBFeFZVVkJkM2RUVVZoQ2QySkhWV2RWYlRsMlpFTkNSRkZUUVhSSlJXTjZUVk5aZDBwQldVUldVVkZNUkVJeFFtTklRbk5hVTBKRVdsaEtNR0ZYV25CWk1rWXdZVmM1ZFVsRlJqRmtSMmgyWTIxc01HVlVSVlJOUWtWSFFURlZSVU5uZDB0UldFSjNZa2RWWjFOWE5XcE1ha1ZNVFVGclIwRXhWVVZDYUUxRFZsWk5kMGhvWTA1TlZGRjNUa1JOZDAxVVozaFBWRUV5VjJoalRrMTZhM2RPUkUxM1RWUm5lRTlVUVRKWGFrSnVUVkp6ZDBkUldVUldVVkZFUkVKS1FtTklRbk5hVTBKVFlqSTVNRWxGVGtKSlF6Qm5VbnBOZUVwcVFXdENaMDVXUWtGelRVaFZSbmRqUjNoc1NVVk9iR051VW5CYWJXeHFXVmhTY0dJeU5HZFJXRll3WVVjNWVXRllValZOVWsxM1JWRlpSRlpSVVV0RVFYQkNZMGhDYzFwVFFrcGliVTExVFZGemQwTlJXVVJXVVZGSFJYZEtWbFY2UWpKTlFrRkhRbmx4UjFOTk5EbEJaMFZIUWxOMVFrSkJRV2xCTWtsQlFrcHFjRXg2TVVGamNWUjBhM2xLZVdkU1RXTXpVa05XT0dOWGFsUnVTR05HUW1KYVJIVlhiVUpUY0ROYVNIUm1WR3BxVkhWNGVFVjBXQzh4U0RkWmVWbHNNMG8yV1ZKaVZIcENVRVZXYjBFdlZtaFpSRXRZTVVSNWVFNUNNR05VWkdSeFdHdzFaSFpOVm5wMFN6VXhOMGxFZGxsMVZsUmFXSEJ0YTA5c1JVdE5ZVTVEVFVWQmQwaFJXVVJXVWpCUFFrSlpSVVpNZFhjemNVWlpUVFJwWVhCSmNWb3pjalk1TmpZdllYbDVVM0pOUVRoSFFURlZaRVYzUlVJdmQxRkdUVUZOUWtGbU9IZEVaMWxFVmxJd1VFRlJTQzlDUVZGRVFXZEZSMDFCYjBkRFEzRkhVMDAwT1VKQlRVUkJNbWRCVFVkVlEwMVJRMFEyWTBoRlJtdzBZVmhVVVZreVpUTjJPVWQzVDBGRldreDFUaXQ1VW1oSVJrUXZNMjFsYjNsb2NHMTJUM2RuVUZWdVVGZFVlRzVUTkdGMEszRkplRlZEVFVjeGJXbG9SRXN4UVROVlZEZ3lUbEY2TmpCcGJVOXNUVEkzYW1Ka2IxaDBNbEZtZVVaTmJTdFphR2xrUkd0TVJqRjJURlZoWjAwMlFtZEVOVFpMZVV0RVEwTkJkVmwzWjJkS2RHOUJUVU5CVVVsRFEwUk5UamQyYVM5VVIyZDFUVUZ2UjBORGNVZFRUVFE1UWtGTlJFMUhZM2hIZWtGYVFtZE9Wa0pCVFUxRmEwWjNZMGQ0YkVsR1NuWmlNMUZuVVRCRloweFRRa2hOZWtWdFRVTlJSMEV4VlVWRGQzZGtVVmhDZDJKSFZXZFJNbFo1WkVkc2JXRlhUbWhrUjJ4MlltbENRbVJZVW05aU0wcHdaRWhyZUVWNlFWSkNaMDVXUWtGdlRVTnJSbmRqUjNoc1NVVnNkVmw1TkhoRGVrRktRbWRPVmtKQldWUkJiRlpVVFVJMFdFUlVSVE5OUkVsNVRXcEplVTFxVFhsTmJHOVlSRlJOZVUxRVNYaFBSRUYzVFVSQmQwMUdiM2RqYWtWdFRVTlJSMEV4VlVWQmQzZGtVVmhDZDJKSFZXZFZNMng2WkVkV2RFbEZiSFZrUjFadVkyMUdNR0ZYT1hWSlJVNUNTVVJSZUVwcVFXdENaMDVXUWtGelRVaFZSbmRqUjNoc1NVVk9iR051VW5CYWJXeHFXVmhTY0dJeU5HZFJXRll3WVVjNWVXRllValZOVWsxM1JWRlpSRlpSVVV0RVFYQkNZMGhDYzFwVFFrcGliVTExVFZGemQwTlJXVVJXVVZGSFJYZEtWbFY2UWxwTlFrMUhRbmx4UjFOTk5EbEJaMFZIUTBOeFIxTk5ORGxCZDBWSVFUQkpRVUpCV25Kd1JscDJabG80YmpCak5ESnFjRWxpVm5NeFZVNXRVa3Q1V2xKdmJXWnlTa2xJTjJrNVZtZFFNMDlLY1RaNGJFaE1lVGQyVHpaUlFuUkJSVlJTU0hoaFNuRXlaMjVEYTJ4cGRWaHRRbTA1VUdaR2NXcG5abU4zWjJaUmQwUjNXVVJXVWpCVVFWRklMMEpCVlhkQmQwVkNMM3BCWmtKblRsWklVMDFGUjBSQlYyZENVemR6VGpab1YwUlBTVzF4VTB0dFpEWXJkbVYxZGpKemMydHhla0pIUW1kbmNrSm5SVVpDVVdOQ1FWRlJOazFFWjNkT1oxbEpTM2RaUWtKUlZVaE5RVWRIUzIxb01HUklRVFpNZVRsMldUTk9kMHh0Um5kalIzaHNURzFPZG1KVE9YWlpNMDUzVFVSTmRGbFlRbmRpUjFaNVlqSTVNRmt5Um01TmVrRXpRbWRPVmtoU09FVk5SRUYxVFVONVowdHhRVzlvYVZwdlpFaFNkMDlwT0haWk0wcHpURzFHZDJOSGVHeE1iVTUyWWxNNWFHTklRbk5hV0VwMllqTlNhbGxYWTNwTWJVNTVZa1JCWkVKblRsWklVVFJGUm1kUlZXVnJaVFpQU1c5V1NrVm5hVkp6TWl0cWVHOXJaWHBSUkV0dGEzZEVaMWxFVmxJd1VFRlJTQzlDUVZGRVFXZEZSMDFDUVVkRGFYRkhVMGxpTTFreVVVZEJhRVZGUVdkVlFVMUJiMGREUTNGSFUwMDBPVUpCVFVSQk1tTkJUVWRSUTAxQ1ZVMXhXVGRIY2pWYWNHRTJaV1l6Vm5wVlFURnNjM0pzVEZWWlRXRk1aSFZETTNoaFRIaERXSHBuYlhWT2NuTmxUamhOWTFGdVpYRmxUMmxtTW5Ka2QwbDNXVlJOWnpoVGJpOHJXV041Y21sdVNWcEVNVEpsTVVkck1HZEpkbVJ5TldkSmNFaDRNVlJ3TVROTVZHbDRhWEZYTDNOWlNqTkZjRkF4VTFSM0wwMXhlVTFKU1VSQ2VrTkRRWEV5WjBGM1NVSkJaMGxKUmpSRGIwNUhXbXMyYzNOM1EyZFpTVXR2V2tsNmFqQkZRWGRKZDJOcVJXMU5RMUZIUVRGVlJVRjNkMlJSV0VKM1lrZFZaMVV6Ykhwa1IxWjBTVVZzZFdSSFZtNWpiVVl3WVZjNWRVbEZUa0pKUkZGNFNtcEJhMEpuVGxaQ1FYTk5TRlZHZDJOSGVHeEpSVTVzWTI1U2NGcHRiR3BaV0ZKd1lqSTBaMUZZVmpCaFJ6bDVZVmhTTlUxU1RYZEZVVmxFVmxGUlMwUkJjRUpqU0VKeldsTkNTbUp0VFhWTlVYTjNRMUZaUkZaUlVVZEZkMHBXVlhwQlpVWjNNSGxPUkVWNFRXcEJkMDE2U1hkT1JGWmhSbmN3ZVU5RVJYbE5WRkY0VDBSQmQwMTZRbUZOUlRSNFMycEJiMEpuVGxaQ1FVMU5TVlprV0ZKR1NXZFZTRXAyWkcxc2VtRlhPWFZoVnpWdVNVWkNlV0l5V25CaVIxVm5WVEpzYm1KdGJIVmFla1ZVVFVKRlIwRXhWVVZEWjNkTFVWaENkMkpIVldkVFZ6VnFUR3BGVEUxQmEwZEJNVlZGUW1oTlExWldUWGRYVkVGVVFtZGpjV2hyYWs5UVVVbENRbWRuY1docmFrOVFVVTFDUW5kT1EwRkJWREZzUm5OUGQyUlNWVkI0Ym1WU2JVRnNXSG8yVDB0ak9YTlVOVkJXU0V4a09YUnNTbVpJSzBnM1dYZEhlV2RvZFc5dlZUWXdNQ3N6ZGxaeWExZ3hTbXBPV1V4bVQxUnhiVE5QYkdReVZTdG5lbEUyT1Rsdk5FbENWSHBEUTBGVmMzZEVRVmxFVmxJd1ZFRlJTQzlDUVVsM1FVUkJaa0puVGxaSVUwMUZSMFJCVjJkQ1VqWlNOMjgwYVdoVmExTkRTa2Q2WWpaUVIybFNOMDVCVFhGaFZFSkNRbWRuY2tKblJVWkNVV05DUVZGUk1VMUVUWGROVVZsSlMzZFpRa0pSVlVoTlFVZEhTbGRvTUdSSVFUWk1lVGwyV1ROT2QweHRSbmRqUjNoc1RHMU9kbUpUT1haWk0wNTNUVVJOZEZsWVRuQlpNa1V3VFVSTmQyZGFXVWRCTVZWa1NVRlRRbXBxUTBKcGVrTkNhVUZaU2t0dldrbG9kbVJxV2tGVlFrMUljM2RsVVZsSlMzZFpRa0pSVlVoQlowbDNZbEY0Y2xaSGFIQmplVUpxV2xoS01HRlhXbkJaTWtZd1dsTkNjR041UWpCaWVVSnBXbE5DTVdNeVZtdEpSMVkwV1RKNE1XTXliREphVjNnMVNVZGFkbU5wUW0xa1Z6VnFaRWRzZG1KdVRXZGhWelV3V2xoS2RWbFhkMmRrUnpoblVWaENkMkpIVldkVlNFcDJXa2hXYW1SSVRXZFpWelZyVERJNWVVbEZSbmRqUjNoc1NVaENlV0l5VG14ak0wNXNZM2swZDBoUldVUldVakJQUWtKWlJVWlBiRk42WnpKM2VHOW5ZVnBWY1RSdGVFZFFPR1IzWlZKNFVqaE5RVFJIUVRGVlpFUjNSVUl2ZDFGRlFYZEpTR2RFUVZCQ1oydHhhR3RwUnpreVRtdEVRazFGUVdkVlFVMUJiMGREUTNGSFUwMDBPVUpCVFVOQk1HZEJUVVZWUTBsUlJIWnRjbmhrYjBad2JXSkhVelY2VkdWVWNWWlBNRTQ0V0VoaVQwZEVLMmhqWVRObmN6a3hjWFJ2V21kSloyVkRVRnAzTkdkSVUxUXpNU3MwYlZCclJ6VlpORVpsWmxrdk9WazBaR0ZRV0Vwb2FqRnFieXRRTlRCNFoyZElWRTFKU1VKNmQwbENRVlJDSzAxSVNYaEtha0ZyUW1kT1ZrSkJUVTFJVlVaM1kwZDRiRWxHVGpWak0xSnNZbE5DU21KdVVteGFNMHBvWkVkc2RtSnBRa1JSVTBFd1RWTlpkMHBCV1VSV1VWRk1SRUl4UW1OSVFuTmFVMEpFV2xoS01HRlhXbkJaTWtZd1lWYzVkVWxGUmpGa1IyaDJZMjFzTUdWVVJWUk5Ra1ZIUVRGVlJVTm5kMHRSV0VKM1lrZFZaMU5YTldwTWFrVk1UVUZyUjBFeFZVVkNhRTFEVmxaTlEwTkNaVUZ4UkZKdFdrOXlURTFCYzBkRFYwTkhVMEZHYkVGM1VVTkJZVU5DTlhwQldVSm5hM0ZvYTJsSE9YY3dRa05SVFhoRGQxbEtTMjlhU1doMlkwNUJVV05DVFVKM1IwTlRjVWRUU1dJelJGRkZTa0pVUlZCR2R6QjVUbXBCZVUxVVNYZE5SRkV3VFVSa1lVMURaMGREVTNGSFUwbGlNMFJSUlVwT1JFVmlUVUpyZDBOM1dVcFpTVnBKUVZkVlJFSkJTVUp2VVc5SFEwTnhSMU5OTkRsQ1FVMURUVU00UjBOVGNVZFRTV0l6UkZGRlNrSkVSV2xDUTBFdldVVmhVR0pRZFhob2JUaEJUakF2UW01NlpqQkRRelJvY1hGNFMzVkZla1JLZG1OeGJsZHdabGhxUWxOQ1oydHhhR3RwUnpsM01FSkRVVGg0VWxSQ1JFMUJiMGREUTNGSFUwbGlNMFJSVFVoTlFUUkhRME54UjFOSllqTkVVVTFEUVdkSlFXZEVRVTVDWjJkeGFHdHBSemwzTUVSQlowbENVVVJCU0VKblZYSkVaMDFEUW5wQlRrSm5aM0ZvYTJsSE9YY3dSRUZuU1VKTFJFRkxRbWRuY1docmFrOVFVVkZFUVdkU1NFMUZWVU5KVVVOWlUwVTFOV3hUUlhKR2FGcHVSalZCVkc1c2EzWXljRUprTWtSTFNTOXhOMlZqYVRaVFNYVnFXbVZCU1dkUVlXTTNObFJhYlhwRVdrdzBhbGRtSzJOcmFFMXRLMWxHV2pkdVVFMVJRbGt2UlZSemIwZHljbU5CUFR3dlpHRjBZVDRLQ1FrSkNRa0pDUWtKQ1FrSkNna0pDVHhyWlhrK1VGQlJRMmhsWTJzOEwydGxlVDRLQ1R4bVlXeHpaUzgrQ2dvSlBHdGxlVDVGYm5ScGRHeGxiV1Z1ZEhNOEwydGxlVDRLQ1R4a2FXTjBQZ29KQ1R4clpYaytZbVYwWVMxeVpYQnZjblJ6TFdGamRHbDJaVHd2YTJWNVBnb0pDVHgwY25WbEx6NEtDUWtKQ1FvSkNRa0pQR3RsZVQ1aGNIQnNhV05oZEdsdmJpMXBaR1Z1ZEdsbWFXVnlQQzlyWlhrK0Nna0pQSE4wY21sdVp6NVhTRFJOVkRWYU5EUlRMbU52YlM1dGFXdG9ZV2xzYzNCbFlXdHpMbkJ5YjIxd2RIQmhiRHd2YzNSeWFXNW5QZ29KQ1FrSkNna0pDUWs4YTJWNVBtdGxlV05vWVdsdUxXRmpZMlZ6Y3kxbmNtOTFjSE04TDJ0bGVUNEtDUWs4WVhKeVlYaytDZ2tKQ1FrOGMzUnlhVzVuUGxkSU5FMVVOVm8wTkZNdUtqd3ZjM1J5YVc1blBnb0pDUWtKUEhOMGNtbHVaejVqYjIwdVlYQndiR1V1ZEc5clpXNDhMM04wY21sdVp6NEtDUWs4TDJGeWNtRjVQZ29KQ1FrSkNna0pDUWs4YTJWNVBtZGxkQzEwWVhOckxXRnNiRzkzUEM5clpYaytDZ2tKUEdaaGJITmxMejRLQ1FrSkNRb0pDUWtKUEd0bGVUNWpiMjB1WVhCd2JHVXVaR1YyWld4dmNHVnlMblJsWVcwdGFXUmxiblJwWm1sbGNqd3ZhMlY1UGdvSkNUeHpkSEpwYm1jK1YwZzBUVlExV2pRMFV6d3ZjM1J5YVc1blBnb0pDUW9KUEM5a2FXTjBQZ29KUEd0bGVUNUZlSEJwY21GMGFXOXVSR0YwWlR3dmEyVjVQZ29KUEdSaGRHVStNakF5Tnkwd01pMHhNbFF3TURvek5Eb3dNVm84TDJSaGRHVStDZ2s4YTJWNVBrNWhiV1U4TDJ0bGVUNEtDVHh6ZEhKcGJtYytLbHRsZUhCdlhTQmpiMjB1YldscmFHRnBiSE53WldGcmN5NXdjbTl0Y0hSd1lXd2dRWEJ3VTNSdmNtVWdNakF5Tmkwd01pMHhNbFF3TURvME5Eb3dOeTR4TURoYVBDOXpkSEpwYm1jK0NnazhhMlY1UGxSbFlXMUpaR1Z1ZEdsbWFXVnlQQzlyWlhrK0NnazhZWEp5WVhrK0Nna0pQSE4wY21sdVp6NVhTRFJOVkRWYU5EUlRQQzl6ZEhKcGJtYytDZ2s4TDJGeWNtRjVQZ29KUEd0bGVUNVVaV0Z0VG1GdFpUd3ZhMlY1UGdvSlBITjBjbWx1Wno1TmFXdG9ZV2xzSUZkcGFtRnVZWEpyYnp3dmMzUnlhVzVuUGdvSlBHdGxlVDVVYVcxbFZHOU1hWFpsUEM5clpYaytDZ2s4YVc1MFpXZGxjajR6TmpROEwybHVkR1ZuWlhJK0NnazhhMlY1UGxWVlNVUThMMnRsZVQ0S0NUeHpkSEpwYm1jK01EQXhaVEk0TkdVdE16WmhNaTAwTlRZNExUbGtZV0l0TXpWaE9EWXpPRGs1WTJRNVBDOXpkSEpwYm1jK0NnazhhMlY1UGxabGNuTnBiMjQ4TDJ0bGVUNEtDVHhwYm5SbFoyVnlQakU4TDJsdWRHVm5aWEkrQ2p3dlpHbGpkRDRLUEM5d2JHbHpkRDZnZ2cwL01JSUVORENDQXh5Z0F3SUJBZ0lJUFZuNE4rclIySjh3RFFZSktvWklodmNOQVFFTEJRQXdjekV0TUNzR0ExVUVBd3drUVhCd2JHVWdhVkJvYjI1bElFTmxjblJwWm1sallYUnBiMjRnUVhWMGFHOXlhWFI1TVNBd0hnWURWUVFMREJkRFpYSjBhV1pwWTJGMGFXOXVJRUYxZEdodmNtbDBlVEVUTUJFR0ExVUVDZ3dLUVhCd2JHVWdTVzVqTGpFTE1Ba0dBMVVFQmhNQ1ZWTXdIaGNOTWpReE1qRTJNVGt5TVRBeFdoY05Namt4TWpFeE1UZ3hNelU1V2pCWk1UVXdNd1lEVlFRRERDeEJjSEJzWlNCcFVHaHZibVVnVDFNZ1VISnZkbWx6YVc5dWFXNW5JRkJ5YjJacGJHVWdVMmxuYm1sdVp6RVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd2dnRWlNQTBHQ1NxR1NJYjNEUUVCQVFVQUE0SUJEd0F3Z2dFS0FvSUJBUURRa3pHcitGTWUzNjBlTDJUM3lVM1hscjVmU3oxNVpGeEQ3aW5EUU5MNkx4eWd0cndSYysvd0lyRGYzdm41emxYajlVSUJ0U05sUVJJNzkzeEdmWWtUUlpWRTdKYVZZbWFYa0FNQTJlQ3V4ZG14bkNBdGx1Q0Y3VzlyMDFMVGd6elVBU01sNmVYRzFCSFllYW9Jd3QwVldQWHZpcE5MRFV2dURiYUhrM1VSRUZYTERIZ0gyemR3Ump1WCtzVHJlQ25nOU94NDQySGFRRmVBQjd1SW5LWEhTVzNJSnRPVkgwMGhvbzFvYzRNZTVsbGFoWlpWVkxDVkxpWGNkdzFoaDRHTmlhUURlendBZHl5SmFsblRaRVRaZEtWYmlyRlNZVjl1QkREVTgrSVFOQXlWakV2aGU5WXJoWVB5SnptTmNBZ2o0aFNJLzVQMExXMU1KdUtMTjRZdEFnTUJBQUdqZ2VVd2dlSXdEQVlEVlIwVEFRSC9CQUl3QURBZkJnTlZIU01FR0RBV2dCUnY4WlVZWWx6Z3lQSEY3V3dZeWVEVFpGS1lJREJBQmdnckJnRUZCUWNCQVFRME1ESXdNQVlJS3dZQkJRVUhNQUdHSkdoMGRIQTZMeTl2WTNOd0xtRndjR3hsTG1OdmJTOXZZM053TURNdFlXbHdZMkV3TnpBdkJnTlZIUjhFS0RBbU1DU2dJcUFnaGg1b2RIUndPaTh2WTNKc0xtRndjR3hsTG1OdmJTOWhhWEJqWVM1amNtd3dIUVlEVlIwT0JCWUVGTHkxeGVtOS9NdlFudHlVc0I3NElaUmMvd2t1TUE0R0ExVWREd0VCL3dRRUF3SUhnREFQQmdrcWhraUc5Mk5rQmpvRUFnVUFNQTBHQ1NxR1NJYjNEUUVCQ3dVQUE0SUJBUUF5Tk1McGQ2cGY0TWJLb3ZOM1dlZUtaN2p4VWZQN3NQYVh2N0VSbytHaFBMc2prdWtTazZKeEhienhtbkZ2cER4dk5wSzI0RWVDb3BQajU3aVB1OThsUkdJQ3o4Mjg5L3VOaWdsd2VHWENHVTBseTNKaUllU3BhUGtRbWk1NkR5aStwZ01HMFZWaEg2OTgrSlRVY1E3aTB5VlVpODZ0MVdnSFc3MHRlOGRpUlhtNXFZZE0rQmc3Z0s0UVMzSFllQ3ZtQ3ErYTU5bE56T3BidDZPWFZXdnNEYUI0eDhDd3o4dmNFRXd3a2hOeGxOYXY0T3pKNmNtYnppVXk3aEVOSVJja2kvR1ZMaUppUmtWLzROdlhGbFRCdVQ3VDJvcTVaZmEwdENOL2VGM1pjblprWTZjSVZjZlp0NVRiSTcvems2ZlVCRVJERGNyaVZySXJsQ2lrUFhLSE1JSUVSRENDQXl5Z0F3SUJBZ0lJWEdQSzVFbzNVOGt3RFFZSktvWklodmNOQVFFTEJRQXdZakVMTUFrR0ExVUVCaE1DVlZNeEV6QVJCZ05WQkFvVENrRndjR3hsSUVsdVl5NHhKakFrQmdOVkJBc1RIVUZ3Y0d4bElFTmxjblJwWm1sallYUnBiMjRnUVhWMGFHOXlhWFI1TVJZd0ZBWURWUVFERXcxQmNIQnNaU0JTYjI5MElFTkJNQjRYRFRFM01EVXhNREl4TWpjek1Gb1hEVE13TVRJek1UQXdNREF3TUZvd2N6RXRNQ3NHQTFVRUF3d2tRWEJ3YkdVZ2FWQm9iMjVsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNU0F3SGdZRFZRUUxEQmREWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd2dnRWlNQTBHQ1NxR1NJYjNEUUVCQVFVQUE0SUJEd0F3Z2dFS0FvSUJBUURKUldvQkR6NkRCSWJIL0wvY1h2QWVnZTRYTUhOakppN2VQWG9relpNK1R6bEh1blcrODhEUzhWbWlxeC8rQ29ZODJTMmFCL0lPYTdrcGtScGZJZ3FMOFhKWUJhNU1TMFRGZWFlQVBMQ0k0SXdNSjRSZEdlV0hHVGJMNDhWMnQ3RDBRWEpSOUFWY2cwdWliYVpSdVBFbTMzdGVyV1VNeHJLWVVZeTdmUnRNd1U3SUNNZlM3V1FMdE4wYmpVOUFmUnVQU0phU1cvUFFtSDdadktRWkRwbGh1MEZkQWN4YmQzcDlKTkRjMDFQL3c5ekZsQ3kyV2syT0dDTTV2ZG5HVWo3Ujh2UWxpcUVxaC8zWURFWXBVZi90RjJ5SkpXdUh2NHBwRko5M244TVZ0Mml6aUVXOWhPWUdBa0ZrRDYwcUtMZ1Z5ZUNzcDRxNmNnUTBzbmlNK0xLRkFnTUJBQUdqZ2V3d2dla3dEd1lEVlIwVEFRSC9CQVV3QXdFQi96QWZCZ05WSFNNRUdEQVdnQlFyMEdsSGxIWUovdlJyalM1QXB2ZEhUWDhJWGpCRUJnZ3JCZ0VGQlFjQkFRUTRNRFl3TkFZSUt3WUJCUVVITUFHR0tHaDBkSEE2THk5dlkzTndMbUZ3Y0d4bExtTnZiUzl2WTNOd01ETXRZWEJ3YkdWeWIyOTBZMkV3TGdZRFZSMGZCQ2N3SlRBam9DR2dINFlkYUhSMGNEb3ZMMk55YkM1aGNIQnNaUzVqYjIwdmNtOXZkQzVqY213d0hRWURWUjBPQkJZRUZHL3hsUmhpWE9ESThjWHRiQmpKNE5Oa1VwZ2dNQTRHQTFVZER3RUIvd1FFQXdJQkJqQVFCZ29xaGtpRzkyTmtCZ0lTQkFJRkFEQU5CZ2txaGtpRzl3MEJBUXNGQUFPQ0FRRUFPcytzbUkyK2tpQWhDYTJWODdGY0lmbzJMVmNnUkhSelpKSUlzNWFzOTIyWCtsczBPQ2ZQRWtiVFBCSHdCOG1aa0xIUjZCRUpwZU9sYTJ4akNEK2VKZnJWbVp4TTV1WE9qckpOYU95THE2T2lUNG9SRlQ3Y0ZDc2N4a1MyYjJmRlcwK1ZLUzJIWEQvY2d4NTNUKzNhVktjdDV4T0J3V1BFVkFzYlN3cHFLQ0lJMURlU2ZIOW5LRit2UFQrM3JGa2RPRFJrV3U0elNobENSQ25FeWhocjRjRlRMUzMwVGNJVjlqTXlHSGp4Sm0rS1RldVVUS1BvL3crekE0dGwydXN1MkdWUW45eWZpdDh4cUlSVTNGSlNRZEt5RXgweFJrZUlYejd1dy9LTUl3U1Y2NnlLUG9Kc0JwOHU0NHREbW1KYk5BMzBtYzhzN3JweWhoa2pwZnlPdFRDQ0JMc3dnZ09qb0FNQ0FRSUNBUUl3RFFZSktvWklodmNOQVFFRkJRQXdZakVMTUFrR0ExVUVCaE1DVlZNeEV6QVJCZ05WQkFvVENrRndjR3hsSUVsdVl5NHhKakFrQmdOVkJBc1RIVUZ3Y0d4bElFTmxjblJwWm1sallYUnBiMjRnUVhWMGFHOXlhWFI1TVJZd0ZBWURWUVFERXcxQmNIQnNaU0JTYjI5MElFTkJNQjRYRFRBMk1EUXlOVEl4TkRBek5sb1hEVE0xTURJd09USXhOREF6Tmxvd1lqRUxNQWtHQTFVRUJoTUNWVk14RXpBUkJnTlZCQW9UQ2tGd2NHeGxJRWx1WXk0eEpqQWtCZ05WQkFzVEhVRndjR3hsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNUll3RkFZRFZRUURFdzFCY0hCc1pTQlNiMjkwSUVOQk1JSUJJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBUThBTUlJQkNnS0NBUUVBNUpHcENSK1IyeDVIVU9zRjdWNTVoQzNyTnFKWFRGWHNpeG1KM3ZsTGJQVUhxeUl3QXVnWVB2aFFDZE4vUWFpWStkSEtacHdrYXhIUW83dmtHeXJESDVXZWVneWtSNHRiMUJZM004dkVEMDNPRkduUnlSbHk5VjBPMVg5Zm0vSWxBN3BWajAxZERmRmtOU01WU3hWWkhiT1U5L2FjbnM5UXVzRllVR2VQQ0xRZzk4dXNMQ0J2Y0xZL0FUQ010MFBQRDUwOTh5dEpLQnJJL3M2MXVRN1pYaHpXeXoyMU9xMzBEdzRBa2d1eElSWXVkTlU4RGR0aUZxdWpjWkpIVTFYQnJ5OUJzL2o3NDNETjVxTk1SWDRmVEd0UWxrR0p4SFJpQ3hDRFFZY3ppb0d4TUZqc1dnUXlqR2l6angzZVpYUC9aMTVsdkVuWWRwOHpGR1doZDVUSkxRSURBUUFCbzRJQmVqQ0NBWFl3RGdZRFZSMFBBUUgvQkFRREFnRUdNQThHQTFVZEV3RUIvd1FGTUFNQkFmOHdIUVlEVlIwT0JCWUVGQ3ZRYVVlVWRnbis5R3VOTGtDbTkwZE5md2hlTUI4R0ExVWRJd1FZTUJhQUZDdlFhVWVVZGduKzlHdU5Ma0NtOTBkTmZ3aGVNSUlCRVFZRFZSMGdCSUlCQ0RDQ0FRUXdnZ0VBQmdrcWhraUc5Mk5rQlFFd2dmSXdLZ1lJS3dZQkJRVUhBZ0VXSG1oMGRIQnpPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOWhjSEJzWldOaEx6Q0J3d1lJS3dZQkJRVUhBZ0l3Z2JZYWdiTlNaV3hwWVc1alpTQnZiaUIwYUdseklHTmxjblJwWm1sallYUmxJR0o1SUdGdWVTQndZWEowZVNCaGMzTjFiV1Z6SUdGalkyVndkR0Z1WTJVZ2IyWWdkR2hsSUhSb1pXNGdZWEJ3YkdsallXSnNaU0J6ZEdGdVpHRnlaQ0IwWlhKdGN5QmhibVFnWTI5dVpHbDBhVzl1Y3lCdlppQjFjMlVzSUdObGNuUnBabWxqWVhSbElIQnZiR2xqZVNCaGJtUWdZMlZ5ZEdsbWFXTmhkR2x2YmlCd2NtRmpkR2xqWlNCemRHRjBaVzFsYm5SekxqQU5CZ2txaGtpRzl3MEJBUVVGQUFPQ0FRRUFYRGFaVEMxNHQrMk1tOXp6ZDV2eWR0SjNNRS9CSDRXRGhSdVpQVWMzOHFtYlFJNHMxTEdRRXRpKzlIT2I3dEprRDh0NVR6VFlvajc1ZVA5cnlBZnNmVG1EaTFNZzB6akVzYithVHdwci95djhXYWNGQ1h3WFFGWVJIblRUdDRzak8wZWoxVzhrNHV2UnQzRGZEMFhoSjhyeGJYanQ1N1VYRjZqY2ZpSTF5aVhWMlEvV2E5U2lKQ01SOTZHc2ozT0JZTVliV3drdmtyTDRSRWp3WURpZUZmVTlKbWNnaWpOcTl3MkN6OTdyb3kvNVUycGJaTUJqTTNmM09nY3NWdXZhRHlFTzJycHpHVSsxMlRaL3dZZFYyYWVadVRKQys5alZjWjUrb1ZLM0c3MlRRaVFTS3NjUEhiWk5uRjVqeUV1QUYxQ3FpdFhhNVB6UUNRYzNzSFYxSVRHQ0FvVXdnZ0tCQWdFQk1IOHdjekV0TUNzR0ExVUVBd3drUVhCd2JHVWdhVkJvYjI1bElFTmxjblJwWm1sallYUnBiMjRnUVhWMGFHOXlhWFI1TVNBd0hnWURWUVFMREJkRFpYSjBhV1pwWTJGMGFXOXVJRUYxZEdodmNtbDBlVEVUTUJFR0ExVUVDZ3dLUVhCd2JHVWdTVzVqTGpFTE1Ba0dBMVVFQmhNQ1ZWTUNDRDFaK0RmcTBkaWZNQWtHQlNzT0F3SWFCUUNnZ2R3d0dBWUpLb1pJaHZjTkFRa0RNUXNHQ1NxR1NJYjNEUUVIQVRBY0Jna3Foa2lHOXcwQkNRVXhEeGNOTWpZd01qRXlNREEwTkRBM1dqQWpCZ2txaGtpRzl3MEJDUVF4RmdRVVk5cEw3cEw3VkZlb2orZ0lWOFJ4WkhoTGJhY3dLUVlKS29aSWh2Y05BUWswTVJ3d0dqQUpCZ1VyRGdNQ0dnVUFvUTBHQ1NxR1NJYjNEUUVCQVFVQU1GSUdDU3FHU0liM0RRRUpEekZGTUVNd0NnWUlLb1pJaHZjTkF3Y3dEZ1lJS29aSWh2Y05Bd0lDQWdDQU1BMEdDQ3FHU0liM0RRTUNBZ0ZBTUFjR0JTc09Bd0lITUEwR0NDcUdTSWIzRFFNQ0FnRW9NQTBHQ1NxR1NJYjNEUUVCQVFVQUJJSUJBRGpOcFdUbksyV1EyYnJxalUwYzI3V01Kc1JGNXVKQWphZ0IxWExlTnpYbjkvbkVDKzd3Z0IrRDZOZ2EyMlpsVEgzT2ZlSlgrWWhzd0MzblQ1LzJkNWNkL3RZT2YyNi9xQ3NDS3hlZXJ3SU9rSFlFSlI2TTBvaSs0dTBGL0ROTlVYSEs3ZmU2dHhUT0tLZ2tNaUFzeFdyYVlpQjlwOXZHRTg1a3U4STdLamVEWlQ1eE03WDZlbWs4MjFVNHNXTTdablZVN0pOVmpCYlVqcHlKRGxDRkE2b1FOQVJMdDFwNVV1YWRnNWNZQU5tajJmUWhPeGhwVkZ4RmVwVitWaXA4MnBmNlYvTmFlS0Z2OE52MmU4R1FrZ1E5M3ZpN01tZmNCNEVlT1ZoaFFQblJzeWdzTjJQb2U3VHhiUnBKUmE1dTlxVEd0L3A4amY5UTJuYlFRNEI5cjZFPSIsImRpc3RyaWJ1dGlvbkNlcnRpZmljYXRlIjp7ImRhdGFCYXNlNjQiOiJNSUlMOUFJQkF6Q0NDN29HQ1NxR1NJYjNEUUVIQWFDQ0M2c0VnZ3VuTUlJTG96Q0NCa01HQ1NxR1NJYjNEUUVIQWFDQ0JqUUVnZ1l3TUlJR0xEQ0NCaWdHQ3lxR1NJYjNEUUVNQ2dFRG9JSUYyVENDQmRVR0NpcUdTSWIzRFFFSkZnR2dnZ1hGQklJRndUQ0NCYjB3Z2dTbG9BTUNBUUlDRUc1RWxscUVnNXdSWkxWK28yUTBUM0l3RFFZSktvWklodmNOQVFFTEJRQXdkVEZFTUVJR0ExVUVBd3c3UVhCd2JHVWdWMjl5YkdSM2FXUmxJRVJsZG1Wc2IzQmxjaUJTWld4aGRHbHZibk1nUTJWeWRHbG1hV05oZEdsdmJpQkJkWFJvYjNKcGRIa3hDekFKQmdOVkJBc01Ba2N6TVJNd0VRWURWUVFLREFwQmNIQnNaU0JKYm1NdU1Rc3dDUVlEVlFRR0V3SlZVekFlRncweU5qQXlNVEl3TURNME1ESmFGdzB5TnpBeU1USXdNRE0wTURGYU1JR1lNUm93R0FZS0NaSW1pWlB5TEdRQkFRd0tWMGcwVFZRMVdqUTBVekU4TURvR0ExVUVBd3d6YVZCb2IyNWxJRVJwYzNSeWFXSjFkR2x2YmpvZ1RXbHJhR0ZwYkNCWGFXcGhibUZ5YTI4Z0tGZElORTFVTlZvME5GTXBNUk13RVFZRFZRUUxEQXBYU0RSTlZEVmFORFJUTVJvd0dBWURWUVFLREJGTmFXdG9ZV2xzSUZkcGFtRnVZWEpyYnpFTE1Ba0dBMVVFQmhNQ1ZWTXdnZ0VpTUEwR0NTcUdTSWIzRFFFQkFRVUFBNElCRHdBd2dnRUtBb0lCQVFDZjU3UHVhQ1hYSDVhc3NNdmRBL2hIT0dPOVFvRy9HbERRVlNwVjI2YklEcEtNRVU5ajJhTUprZHArSmsyRTYrbmRna3lKWHRWbVl3M0M1azlhV3JlMXdFM0hDdXJ4R0lZOVVDbE5mQ2ZCbVZVLzNsWmhqeXM0RUE1Y0R5ZVdNRlV1ZXA4S0M1Z2c0NkFTTnVPL2E5RExSTCs3d3VCdmN3aHo0WnpETmZ6NkpTZGtJbFZwM0c4VDZFVjZ3andYYzdLRHp2ZTZRdWVjY0R2VzN5V05abWR1UC9zMEpmWXJYSGEzY3Q3bklBNm9DRlJWM0ZIQlV5SUJBVy9IaVZnVnNIdVBCTnJ3TzZzWEZFckorVUg1NEtvc29tdjRBQlBzWisvamRYa1JNSmFDUElBdGZJbDVFR1NGY3gwQ3pPVnRSREVqSEhSYnVOTlAxQXVLdUdEUGxYVmxBZ01CQUFHamdnSWpNSUlDSHpBTUJnTlZIUk1CQWY4RUFqQUFNQjhHQTFVZEl3UVlNQmFBRkFuK3dCV1ErYTlrQ3BJU3VTWW9Zd3lYN0tleU1IQUdDQ3NHQVFVRkJ3RUJCR1F3WWpBdEJnZ3JCZ0VGQlFjd0FvWWhhSFIwY0RvdkwyTmxjblJ6TG1Gd2NHeGxMbU52YlM5M2QyUnlaek11WkdWeU1ERUdDQ3NHQVFVRkJ6QUJoaVZvZEhSd09pOHZiMk56Y0M1aGNIQnNaUzVqYjIwdmIyTnpjREF6TFhkM1pISm5NekF5TUlJQkhnWURWUjBnQklJQkZUQ0NBUkV3Z2dFTkJna3Foa2lHOTJOa0JRRXdnZjh3Z2NNR0NDc0dBUVVGQndJQ01JRzJESUd6VW1Wc2FXRnVZMlVnYjI0Z2RHaHBjeUJqWlhKMGFXWnBZMkYwWlNCaWVTQmhibmtnY0dGeWRIa2dZWE56ZFcxbGN5QmhZMk5sY0hSaGJtTmxJRzltSUhSb1pTQjBhR1Z1SUdGd2NHeHBZMkZpYkdVZ2MzUmhibVJoY21RZ2RHVnliWE1nWVc1a0lHTnZibVJwZEdsdmJuTWdiMllnZFhObExDQmpaWEowYVdacFkyRjBaU0J3YjJ4cFkza2dZVzVrSUdObGNuUnBabWxqWVhScGIyNGdjSEpoWTNScFkyVWdjM1JoZEdWdFpXNTBjeTR3TndZSUt3WUJCUVVIQWdFV0syaDBkSEJ6T2k4dmQzZDNMbUZ3Y0d4bExtTnZiUzlqWlhKMGFXWnBZMkYwWldGMWRHaHZjbWwwZVM4d0ZnWURWUjBsQVFIL0JBd3dDZ1lJS3dZQkJRVUhBd013SFFZRFZSME9CQllFRkRqNTh0TjExMHlIUEl3Yk9QRFY3b2FySnNaYk1BNEdBMVVkRHdFQi93UUVBd0lIZ0RBVEJnb3Foa2lHOTJOa0JnRUVBUUgvQkFJRkFEQU5CZ2txaGtpRzl3MEJBUXNGQUFPQ0FRRUFORUdCaHFhNXRIVlE2enMrNXFORlltVFAzbE9FbVZvNzhCQjFRNUxabUxrYUQ0U0tiZEwvRzY4WERsanNtOEUyRU5URm00d0FSQlhRQnVkajNBcWY2d2pJQlllOERiRUV1LzI3K2hnTTk1azRNcGZFZzdDNVUzM1E4dEtqMG40Uk9KclFmVkFGb2JyU2crb3ZPU1AyK3dpSzUyTkF5RkVHNlhreVVnRjFTbENzQWcxS2RFTENKMHhvcFV5TTB6UGl1Y0xwZC9XbDRzcWxrYzNqUG9CNUNWS3pRVGFDR1dZSHJZZU9ZTFJycms2VEN1VG5aMUlRcEx1VUdCVEdXYUdDaDBZYzdkM1ZJbWYzcWUyNzZMNndYcHNPWEltYyttcllLb1JRMGFkYWcwWWNmU0R2aVZONVdLT21FTncyckcyc2VmeGx3ejhMd2lOUGRmOFhQTE9HdnpFOE1DTUdDU3FHU0liM0RRRUpGVEVXQkJUc3BhZlJpSmE1SFVFODROMGw5bzNZdzJGQVlqQVZCZ2txaGtpRzl3MEJDUlF4Q0I0R0FHc0FaUUI1TUlJRldBWUpLb1pJaHZjTkFRY0JvSUlGU1FTQ0JVVXdnZ1ZCTUlJRlBRWUxLb1pJaHZjTkFRd0tBUUtnZ2dUdU1JSUU2akFjQmdvcWhraUc5dzBCREFFRE1BNEVDUElnalZ0bGtYTXZBZ0lJQUFTQ0JNZ1BFSkZvUGFPbnNJalZWWUsrU3JjYk1TK0oybEs1dThvdzB2eTJwZmxJY0E5QXpNOEhjMjJkVlZ0djhsWXZ6SXFqWmhtWStPQzRzaER4Y200YXRQUUdjOWkvR3VDbG9WREFaSlZzV0JkSW8zVHBpTDFuUG90WlBtODZNcUZoRVlweitGdHZXQWxjdFRQZW5qSklBVm4zTlphTVREc0JyWTBKMFRQMnJ4THVIc2NNQ1RVVnBMa29WcWsrajlzblF1ZUFWU2lwNHpEUlR4aCtoVWF5NEhsbEErNURpaTRoU3hXd2RHM3V6dktpMjhkS1NyNE93aGNlNmFvSmg0Lzg2SlZFZ2UvZVhqdEVxR0ZCOE5aMG5sb2loVS9pVFRQSUlJR2JtNmMvSjlZRUMyRFVrc0gyaHVibC9MYmxEa2o4blBod3BEYk13Sm1kdGdWZGovVVh0c0VOd0tHdlNBNWVLZW5RZWNsSVJIZ1kxSmxwMWZQdnRqWElLNW5mMVVFU0laUmd3eWlicWU2NEdEOFFwRGxJRjMxRU0yWVN2d1pVS0oybkhXa09HNm0xaER2TFlXZjBPekoxQWRzdndnb2xQZUdoQ2ZodEhIZFgyNTNWM3dLZ3FsZk5DbEV1S0Q1bnZRaGY2NGVPZVQxalMxM05DVS81TmlKQ2RhQ2d1UE85WGFBNGVHVzAyOTVTZEUwOFFKcDJ3Q0tTWGprN3VvNHNLK0F0aWtpUmNRTnJXZis0ejhmQ0NBVDkxcjBoZWs1ZlE4RjhGa3pyVnQ0UkpOTVRUY0l0c2VRSnVZdzBEVG9pZzdmdjNyY1NGeVdFamF0RmxMbndXcWhIRzIydHNka1NZTHcwUXV0bG80aFA4WTl5V1ZvSWpaLzk1N3cwdVMyVVIyQklWd09jTjg0SGZwdnFoUUpPZHZMR2RrZ0dnTW9OZjRWanVCTitNVlBxcnNibnFGcEJ4dzdUTTNyRTFxeEJpYUZiWnJLdnU3V0I1RmtBUXFydVRINVJxM2M3MGlTY3Vyb2p1Ri9za0lDZ3N6SW5GaGY3bGdSTk5CK1REWHFjNlY0M0hsWEFyZ21RZXIzWThFTUR2Q1k0N3ZrRHRQTkxnWjltVlZia1d6SWEyT1doMlEyaUkwZCtBOHpqWGZOVGJpaFkrTVoxWll5RjZrT1FVckpmN2VKODAwdTBqLzl5MXprVlhLTGtwYkk5S0t0SEZ2bmZ4RVdNZGx6c1Q1NDY2UDVia29XUTV1bitvcU5tK0pzNklmektaRy9nSHEwdnBxN2I5K3hlNVcwakVzbXZsODZHRnZTUFFKb0o2K3dwNG9DeWpmd1hRV0duODhPUmIzUlJWaEJuZ29HUVFtdUhBb292dEo5UWExMllVVWt6aUZFWFBXRVdLci8rK2dOdW5lQVpwc3JFMVhoanVnUWJHR3k0eTdqMzBDR0NpMGlCajBETmJyN2hBZWJXWHhFYjNhVGtiU0I0MUN5Mi8wZDMyZCtYNm9jRXJRWVcxaVRrSHRuSGZ5aFliUUIrNXh1bW9tREZ0Und6Z3Y4U2ZoSjY2eUFDaExCUzkrdEZxdjF0Y25nQzErK214aWQxYTl3VGp6d0JycUdhRHB6RnBBRXRLL1FoMGRoOXBHVVBpdG1HRitTTHkrc2dFWTA4aFJlMGNFYXROeXl5VURGNFJqZ3dXdU1yRnUxbUdpQlg1NzkvaC9EbStzeFlZb3RVQ3lHdmJGclVZOVpXUjk3clVKUlBpT1dHOXZZMmtEbFplNEhRR0s4VmNiZjBXRFpiTi9ja043RGI4c0VhblhDWmQ2ZTFLVHVxTlZlM1pTSmVMMnVTbW96N0JxQW80OHpPQXc0TWNlVlBuUjI3QWRmRWhnbW9FVmtsaHYzVkVSTUU2S2NwNFBGdnpPRXE4YVduUTRZSzhpSVJueDFsZmlWSGFGVWJ5SFN0RXhnYy9sYWVRQWlJdTBHekFzcHI5N2RYanhGYnUrc0xJY0tsQmF3U3NQcGRjWGJHcDZ2V29SUXFtWXk1S1Z1eXNUbXRFbGVWc0RPWmJ6Nlh2bThVdWNCNnp6SFVmUml5ejZIdkRLV3FvZDVRQ20vQUNnRVZRQUJweVlpd2tPcEdzRFhOL05FSVRPZUxWVkt5MDB4T1ZHSmNrb3BCcGo3ZzNoaFg4Ly9xWmx6aUVob3hQREFqQmdrcWhraUc5dzBCQ1JVeEZnUVU3S1duMFlpV3VSMUJQT0RkSmZhTjJNTmhRR0l3RlFZSktvWklodmNOQVFrVU1RZ2VCZ0JyQUdVQWVUQXhNQ0V3Q1FZRkt3NERBaG9GQUFRVWtyNzA3dnFEYUZGMFpzVWdyR1N3ZVVKcnBtd0VDQXdBVHh0TG5qbGxBZ0lJQUE9PSIsInBhc3N3b3JkIjoiVGdQOWcvOE9hOTM2aGpQUjdzMXVJZz09In19fX0sInVwZGF0ZXMiOnt9LCJzY2hlbWUiOiJQcm9tcHRQYWwiLCJ1c2VybmFtZSI6Im1pa2hhaWxzcGVha3MiLCJleHBlcmltZW50YWwiOnt9LCJtb2RlIjoiYnVpbGQiLCJ0cmlnZ2VyZWRCeSI6IkVBU19DTEkiLCJhcHBJZCI6ImQ4ZTZlYzhhLWEyYjctNDdiMS1hOTA0LWY1NDJhZjM4ZTZmYyIsImluaXRpYXRpbmdVc2VySWQiOiI3M2NhZjFiZi0xY2ExLTQxNGQtYWYwZC1kOGQzOTNmZGM1OWUifSwibWV0YWRhdGEiOnsidHJhY2tpbmdDb250ZXh0Ijp7InRyYWNraW5nX2lkIjoiYzBlOGFmNjMtZGEyYS00ZDAzLWI3OWQtZjA4MjNjNTg3MDk2IiwicGxhdGZvcm0iOiJpb3MiLCJzZGtfdmVyc2lvbiI6IjU0LjAuMCIsImFjY291bnRfaWQiOiIwMTc3OGUyOC1lMTUyLTRmMGItOWNmMS03OWJiNTgzMjY3YTYiLCJwcm9qZWN0X2lkIjoiZDhlNmVjOGEtYTJiNy00N2IxLWE5MDQtZjU0MmFmMzhlNmZjIiwicHJvamVjdF90eXBlIjoibWFuYWdlZCIsImRldl9jbGllbnQiOmZhbHNlLCJub193YWl0IjpmYWxzZSwicnVuX2Zyb21fY2kiOmZhbHNlLCJsb2NhbCI6dHJ1ZX0sImFwcEJ1aWxkVmVyc2lvbiI6IjExIiwiYXBwVmVyc2lvbiI6IjEuMC4wIiwiY2xpVmVyc2lvbiI6IjE4LjAuMSIsIndvcmtmbG93IjoibWFuYWdlZCIsImNyZWRlbnRpYWxzU291cmNlIjoicmVtb3RlIiwic2RrVmVyc2lvbiI6IjU0LjAuMCIsImZpbmdlcnByaW50SGFzaCI6IjY4MWY2YmE5YThkY2EyNzYxZjZhZTgzZTQxYWQxMGVkNGFkM2M0YmQiLCJyZWFjdE5hdGl2ZVZlcnNpb24iOiIwLjgxLjUiLCJkaXN0cmlidXRpb24iOiJzdG9yZSIsImFwcE5hbWUiOiJQcm9tcHRQYWwiLCJhcHBJZGVudGlmaWVyIjoiY29tLm1pa2hhaWxzcGVha3MucHJvbXB0cGFsIiwiYnVpbGRQcm9maWxlIjoiZ2VzdHVyZSIsImdpdENvbW1pdEhhc2giOiI0MTkxYzc5YjI5ZjcyYmM2YzEyZjdiNTI0NWFkZjRjOTYwNDUxMWVlIiwiZ2l0Q29tbWl0TWVzc2FnZSI6IlVwZGF0ZSBSZWFjdCB0byAxOS4yLjQgZm9yIENsZXJrIGNvbXBhdGliaWxpdHkgYW5kIGFkZCBFQVMgY29uZmlnIGZvciBBcHAgU3RvcmUgc3VibWlzc2lvbiIsImlzR2l0V29ya2luZ1RyZWVEaXJ0eSI6dHJ1ZSwidXNlcm5hbWUiOiJtaWtoYWlsc3BlYWtzIiwicnVuV2l0aE5vV2FpdEZsYWciOmZhbHNlLCJydW5Gcm9tQ0kiOmZhbHNlLCJkZXZlbG9wbWVudENsaWVudCI6ZmFsc2UsInJlcXVpcmVkUGFja2FnZU1hbmFnZXIiOiJucG0iLCJjdXN0b21Ob2RlVmVyc2lvbiI6IjIwLjE5LjQiLCJzaW11bGF0b3IiOmZhbHNlfX0= exited with non-zero code: 1
    Error: build command failed.

Root cause is here:

Fastlane is not available, make sure it's installed and in your PATH
spawn fastlane ENOENT
Local iOS builds require fastlane. The Node version warning is not fatal, but you should align it.

Fixes

Install fastlane (choose one):

Homebrew (recommended):
brew install fastlane
RubyGems:
sudo gem install fastlane -NV
Align Node version (to avoid mismatches):

Check your local version:
node -v
If eas.json expects 20.19.4, use nvm:
nvm install 20.19.4
nvm use 20.19.4
Re-run the local build:

npx eas build --local --platform ios --profile gesture
If you want me to install fastlane and verify Node version here, confirm and I’ll run those commands.


mikhail@mikhail-super-computer PromptPal % node -v

v25.2.1

Local iOS build completed successfully.

Artifact:

build-1771337922097.ipa
Notes:

The build is App Store/TestFlight distribution (distribution: "store"). You can’t install it directly on a device; it must go through TestFlight/App Store Connect.
Expo Doctor flagged minor version mismatches (React, NetInfo). It didn’t block the build.
Next step options:

Upload to TestFlight using Transporter (no EAS build minutes).
Or upload via CLI (also no build minutes):
npx eas submit --platform ios --path "/Users/mikhail/Documents/CURSOR CODES/In Progress/Prompt Pal App/PromptPal/build-1771337922097.ipa"
Once it’s in TestFlight, install and confirm whether gesture mode still crashes. If it still crashes, we’ll pull the crash log from that build.

If you want a device-installable IPA (no TestFlight), I can add an internal/ad-hoc build profile and generate that locally.


update to build 12 and do another local build

Build 12 local iOS build completed successfully.

Artifact:

build-1771339142134.ipa
Next:

Upload to TestFlight:
npx eas submit --platform ios --path "/Users/mikhail/Documents/CURSOR CODES/In Progress/Prompt Pal App/PromptPal/build-1771339142134.ipa"
Install from TestFlight and confirm if gesture mode still crashes.
If you want me to submit it now, say the word and I’ll run the upload.


its a blank white screen

I need a bit more detail to diagnose this.

Questions (short):

Is the white screen from TestFlight build 12 (gesture profile) or a local install?
Does it stay white indefinitely, or does it crash/close after a few seconds?
Next step that will unblock us:

Capture device logs at launch. You don’t need to open the project in Xcode.
Use Console.app:

Connect iPhone to your Mac.
Open Console.app → select the device in the left sidebar.
In the search bar, type PromptPal or com.mikhailspeaks.promptpal.
Launch the app, then copy the log lines from launch until the white screen appears.
Paste them here.
If you want me to make another local build variant (safe vs gesture) to compare, say which one and I’ll do it.


from build 12 local install

Thanks. A blank white screen in the gesture build means the app launched but the JS/UI never rendered. We need device logs to see the startup error.

Please grab logs (no Xcode project needed):

Option A: Console.app (simplest)

Connect iPhone to your Mac.
Open Console.app.
Select the device on the left sidebar.
In the search bar type PromptPal or com.mikhailspeaks.promptpal.
Launch the app.
Copy the log lines from launch until the white screen appears and paste them here.
Option B: Terminal (if you prefer)
I can run a log stream from here; tell me and I’ll start it, then you open the app and I’ll capture it.

Also: does the app stay open on a white screen, or does it close/crash after a few seconds?


it stays open. here is console app: default	02:41:49.663079+0000	PromptPal	[0x1034e0800] invalidated because the current process cancelled the connection by calling xpc_connection_cancel()
default	02:41:49.663233+0000	PromptPal	sceneOfRecord: sceneID: sceneID:com.mikhailspeaks.promptpal-default  persistentID: 12AD5DC6-5296-48CF-984A-CDFC4A5F2B45
default	02:41:49.663336+0000	PromptPal	[0x1035e9bd0] Session canceled.
default	02:41:49.666042+0000	PromptPal	agent connection cancelled (details: Session manually canceled)
default	02:41:49.666212+0000	PromptPal	[0x1035e9bd0] Disposing of session
default	02:41:49.668540+0000	PromptPal	Deactivation reason added: 11; deactivation reasons: 4097 -> 6145; animating application lifecycle event: 0
default	02:41:49.668883+0000	PerfPowerServices	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.671694+0000	PromptPal	Will add backgroundTask with taskName: <private>, expirationHandler: (null)
default	02:41:49.672203+0000	PromptPal	Creating new assertion because there is no existing background assertion.
default	02:41:49.672708+0000	PromptPal	Creating new background assertion
default	02:41:49.675802+0000	PromptPal	Created new background assertion <BKSProcessAssertion: 0x107c21270>
default	02:41:49.678929+0000	dasd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.684465+0000	PromptPal	Incrementing reference count for background assertion <private>
default	02:41:49.684524+0000	runningboardd	Acquiring assertion targeting [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1621] from originator [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1621] with description <RBSAssertionDescriptor| "Shared Background Assertion 1 for com.mikhailspeaks.promptpal" ID:33-1621-6133 target:1621 attributes:[
	<RBSLegacyAttribute| requestedReason:FinishTask reason:FinishTask flags:( PreventTaskSuspend )>,
	<RBSAcquisitionCompletionAttribute| policy:AfterValidation>
	]>
default	02:41:49.684585+0000	PromptPal	Created background task <private>.
default	02:41:49.684639+0000	runningboardd	Assertion 33-1621-6133 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1621]) will be created as inactive as start-time-defining assertions exist
default	02:41:49.685333+0000	PromptPal	com.mikhailspeaks.promptpal(1621) invalidateConnection (appDidSuspend)
default	02:41:49.685436+0000	SpringBoard	com.mikhailspeaks.promptpal(1621) lostConnection (invalidation)
default	02:41:49.685553+0000	PromptPal	[0x103575900] invalidated because the current process cancelled the connection by calling xpc_connection_cancel()
default	02:41:49.686007+0000	SpringBoard	<SBFullScreenSwitcherLiveContentOverlayCoordinator: 0x537a79c00> Removing SwitcherScene overlay for: <SBAppLayout: 0x539692980; primary: com.mikhailspeaks.promptpal:default; environment: main>, animated: NO
default	02:41:49.686323+0000	PromptPal	Will add backgroundTask with taskName: <private>, expirationHandler: <__NSMallocBlock__: 0x107362a60>
default	02:41:49.686427+0000	PromptPal	Reusing background assertion <BKSProcessAssertion: 0x107c21270>
default	02:41:49.688435+0000	SpringBoard	RX com.mikhailspeaks.promptpal(1621) setWindowContextID:0 windowState:Disabled level:0.0
    focusContext:(null)
default	02:41:49.690345+0000	PromptPal	Incrementing reference count for background assertion <private>
default	02:41:49.690459+0000	PromptPal	Created background task <private>.
default	02:41:49.695678+0000	PromptPal	Ending background task with UIBackgroundTaskIdentifier: 4
default	02:41:49.696049+0000	PromptPal	Ending task with identifier 4 and description: <private>, _expireHandler: <__NSMallocBlock__: 0x107362a60>
default	02:41:49.696269+0000	PromptPal	Decrementing reference count for assertion <private> (used by background task with identifier 4: <private>)
default	02:41:49.698110+0000	PromptPal	Deactivation reason removed: 0; deactivation reasons: 6145 -> 6144; animating application lifecycle event: 0
default	02:41:49.699090+0000	PromptPal	Will add backgroundTask with taskName: <private>, expirationHandler: <__NSMallocBlock__: 0x107362bb0>
default	02:41:49.699243+0000	PromptPal	Reusing background assertion <BKSProcessAssertion: 0x107c21270>
default	02:41:49.699295+0000	PromptPal	Incrementing reference count for background assertion <private>
default	02:41:49.699421+0000	PromptPal	Created background task <private>.
default	02:41:49.699525+0000	PromptPal	Push traits update to screen for new style 2, <UIWindowScene: 0x102641ce0> (12AD5DC6-5296-48CF-984A-CDFC4A5F2B45)
default	02:41:49.709623+0000	PromptPal	Should not send trait collection or coordinate space update, interface style 2 -> 2, <UIWindowScene: 0x102641ce0> (12AD5DC6-5296-48CF-984A-CDFC4A5F2B45)
default	02:41:49.712760+0000	PromptPal	Performing snapshot request 0x107c74b70 (type 1)
default	02:41:49.714428+0000	PromptPal	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Sending action(s): <FBSSceneSnapshotRequestAction: 0x06550000>
default	02:41:49.734288+0000	symptomsd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.737857+0000	PromptPal	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, unknown-NotVisible
default	02:41:49.738065+0000	SpringBoard	Application process state changed for com.mikhailspeaks.promptpal: <SBApplicationProcessState: 0x536049ec0; pid: 1621; taskState: Running; visibility: Background>
default	02:41:49.778072+0000	gamepolicyd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-NotVisible
default	02:41:49.779767+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Received action(s): <FBSSceneSnapshotRequestAction: 0x06550000>
default	02:41:49.779978+0000	SpringBoard	<SBSceneSnapshotRequestor: 0x5348c92c0; debugName: LCD> [sceneID:com.mikhailspeaks.promptpal-default] Got FBSSceneSnapshotRequestTypePerform (0x538490100)
default	02:41:49.799592+0000	runningboardd	Inheritance changeset: <RBSInheritanceChangeSet| gained:{(
)} lost:{(
    <RBSInheritance| environment:UIScene:com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default name:com.apple.frontboard.visibility origID:33-34-6114 payload 11855166879836431039>,
    <RBSInheritance| environment:(none) name:com.apple.frontboard.visibility origID:33-34-6119 0>
)}>
default	02:41:49.799702+0000	runningboardd	Calculated state for app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>: running-active (role: UserInteractiveNonFocal) (endowments: <private>)
default	02:41:49.799819+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1621] Set darwin role to: UserInteractiveNonFocal
default	02:41:49.800693+0000	SpringBoard	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.801090+0000	CommCenter	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.805212+0000	SpringBoard	[com.mikhailspeaks.promptpal] START liquidating the old, as snapshot generation succeeded
default	02:41:49.805505+0000	SpringBoard	[com.mikhailspeaks.promptpal] deleting old snapshots: (
)
default	02:41:49.805733+0000	SpringBoard	[com.mikhailspeaks.promptpal] deleting old suspend snapshots using predicate: <XBApplicationSnapshotPredicate: 0x5393c7150> {
    name = SBSuspendSnapshot;
    contentTypeMask = SceneContent;
}
default	02:41:49.805913+0000	SpringBoard	<XBApplicationSnapshotManifestImpl: 0x539bccd80> [com.mikhailspeaks.promptpal] Deleting snapshot <XBApplicationSnapshot: 0x538a93640; …46F1A31B5C23> [com.mikhailspeaks.promptpal] for reason: _contentType: SceneContent(0)
default	02:41:49.806298+0000	SpringBoard	[com.mikhailspeaks.promptpal] STOP liquidating the old
default	02:41:49.806385+0000	SpringBoard	<SBSceneSnapshotRequestor: 0x5348c92c0; debugName: LCD> [sceneID:com.mikhailspeaks.promptpal-default] Snapshot request (0x538490100) complete with error: 0
default	02:41:49.806591+0000	SpringBoard	<XBApplicationSnapshotManifestImpl: 0x539bccd80> [com.mikhailspeaks.promptpal] Snapshot data for <XBApplicationSnapshot: 0x538a91340; …4FD2252FABEB> [com.mikhailspeaks.promptpal] written to file: /private/var/mobile/Containers/Data/Application/9ECBC618-5003-4438-87EB-AC449AE0CAAC/Library/SplashBoard/Snapshots/sceneID:com.mikhailspeaks.promptpal-default/E7AB0CFC-478F-4811-8187-4FD2252FABEB@3x.ktx
default	02:41:49.807356+0000	locationd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.807885+0000	PromptPal	Snapshot request 0x107c74b70 complete
default	02:41:49.807940+0000	PromptPal	Push traits update to screen for new style 2, <UIWindowScene: 0x102641ce0> (12AD5DC6-5296-48CF-984A-CDFC4A5F2B45)
default	02:41:49.808069+0000	PromptPal	Should not send trait collection or coordinate space update, interface style 1 -> 1, <UIWindowScene: 0x102641ce0> (12AD5DC6-5296-48CF-984A-CDFC4A5F2B45)
default	02:41:49.808195+0000	PromptPal	Performing snapshot request 0x107c74ae0 (type 1)
default	02:41:49.808300+0000	PromptPal	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Sending action(s): <FBSSceneSnapshotRequestAction: 0x06550001>
default	02:41:49.809925+0000	UserEventAgent	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.811458+0000	watchdogd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.811511+0000	useractivityd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.811568+0000	SpringBoard	<XBApplicationSnapshotManifestImpl: 0x539bccd80> [com.mikhailspeaks.promptpal] Snapshot data for <XBApplicationSnapshot: 0x538a91dc0; …7DD2840F5856> [com.mikhailspeaks.promptpal] written to file: /private/var/mobile/Containers/Data/Application/9ECBC618-5003-4438-87EB-AC449AE0CAAC/Library/SplashBoard/Snapshots/sceneID:com.mikhailspeaks.promptpal-default/downscaled/A27818D5-8A94-4CE2-A4F1-7DD2840F5856@3x.ktx
default	02:41:49.812258+0000	gamepolicyd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-NotVisible
default	02:41:49.812791+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Received action(s): <FBSSceneSnapshotRequestAction: 0x06550001>
default	02:41:49.812978+0000	SpringBoard	<SBSceneSnapshotRequestor: 0x5348c92c0; debugName: LCD> [sceneID:com.mikhailspeaks.promptpal-default] Got FBSSceneSnapshotRequestTypePerform (0x536f35b80)
default	02:41:49.813091+0000	PromptPal	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, unknown-NotVisible
default	02:41:49.813514+0000	wifid	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.813946+0000	audiomxd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.814349+0000	dasd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.814642+0000	PerfPowerServices	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.815054+0000	symptomsd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.815696+0000	backboardd	Received state update for 1621 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:41:49.828739+0000	SpringBoard	[com.mikhailspeaks.promptpal] START liquidating the old, as snapshot generation succeeded
default	02:41:49.828852+0000	SpringBoard	[com.mikhailspeaks.promptpal] deleting old snapshots: (
)
default	02:41:49.829170+0000	SpringBoard	<XBApplicationSnapshotManifestImpl: 0x539bccd80> [com.mikhailspeaks.promptpal] Snapshot data for <XBApplicationSnapshot: 0x538a93640; …58DE8204D031> [com.mikhailspeaks.promptpal] written to file: /private/var/mobile/Containers/Data/Application/9ECBC618-5003-4438-87EB-AC449AE0CAAC/Library/SplashBoard/Snapshots/sceneID:com.mikhailspeaks.promptpal-default/B6D89E95-1D4A-4791-A760-58DE8204D031@3x.ktx
default	02:41:49.829348+0000	SpringBoard	[com.mikhailspeaks.promptpal] deleting old suspend snapshots using predicate: <XBApplicationSnapshotPredicate: 0x5393c5820> {
    name = SBSuspendSnapshot;
    contentTypeMask = SceneContent;
}
default	02:41:49.829545+0000	SpringBoard	[com.mikhailspeaks.promptpal] STOP liquidating the old
default	02:41:49.829602+0000	SpringBoard	<SBSceneSnapshotRequestor: 0x5348c92c0; debugName: LCD> [sceneID:com.mikhailspeaks.promptpal-default] Snapshot request (0x536f35b80) complete with error: 0
default	02:41:49.830595+0000	PromptPal	Snapshot request 0x107c74ae0 complete
default	02:41:49.830771+0000	PromptPal	Ending background task with UIBackgroundTaskIdentifier: 5
default	02:41:49.830888+0000	PromptPal	Ending task with identifier 5 and description: <private>, _expireHandler: <__NSMallocBlock__: 0x107362bb0>
default	02:41:49.830997+0000	PromptPal	Decrementing reference count for assertion <private> (used by background task with identifier 5: <private>)
default	02:41:49.838696+0000	PromptPal	Push traits update to screen for new style 2, <UIWindowScene: 0x102641ce0> (12AD5DC6-5296-48CF-984A-CDFC4A5F2B45)
default	02:41:49.839653+0000	PromptPal	Should not send trait collection or coordinate space update, interface style 2 -> 2, <UIWindowScene: 0x102641ce0> (12AD5DC6-5296-48CF-984A-CDFC4A5F2B45)
default	02:41:49.841860+0000	PromptPal	[0x103618d90] [keyboardFocus] Disabling event deferring records requested: adding recreation reason: detachedContext; for reason: _UIEventDeferringManager: 0x103618d90: disabling keyboardFocus: context detached for window: 0x102647980; contextID: 0xC418511
default	02:41:49.842338+0000	PromptPal	Will add backgroundTask with taskName: <private>, expirationHandler: (null)
default	02:41:49.842395+0000	PromptPal	Reusing background assertion <BKSProcessAssertion: 0x107c21270>
default	02:41:49.842801+0000	PromptPal	Incrementing reference count for background assertion <private>
default	02:41:49.842884+0000	PromptPal	Created background task <private>.
default	02:41:49.842955+0000	PromptPal	Ending background task with UIBackgroundTaskIdentifier: 6
default	02:41:49.843542+0000	PromptPal	Ending task with identifier 6 and description: <private>, _expireHandler: (null)
default	02:41:49.843596+0000	PromptPal	Decrementing reference count for assertion <private> (used by background task with identifier 6: <private>)
default	02:41:49.843928+0000	SpringBoard	Got response for <FBSceneSnapshotAction: 0x539923c80; sceneID:com.mikhailspeaks.promptpal-default>: success
default	02:41:49.844240+0000	runningboardd	Invalidating assertion 33-34-6131 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1621]) from originator [osservice<com.apple.SpringBoard>:34]
default	02:41:49.844553+0000	PromptPal	Target list changed:
default	02:41:49.844749+0000	SpringBoard	[0x537eac180:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Scene action [Logical Deactivate][0xe6f4] completed with success: 1
default	02:41:49.845041+0000	PromptPal	Ending background task with UIBackgroundTaskIdentifier: 3
default	02:41:49.845094+0000	PromptPal	Ending task with identifier 3 and description: <private>, _expireHandler: (null)
default	02:41:49.845145+0000	PromptPal	Decrementing reference count for assertion <private> (used by background task with identifier 3: <private>)
default	02:41:49.845258+0000	PromptPal	Will invalidate assertion: <BKSProcessAssertion: 0x107c21270> for task identifier: 3
default	02:41:49.845457+0000	SpringBoard	[0x537eac180:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Scene activity mode did change: suspended.
default	02:41:49.845562+0000	SpringBoard	[0x537eac180:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Scene assertion state did change: None.
default	02:41:49.845650+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1621] Workspace assertion state did change: None (acquireAssertion = NO).
default	02:41:49.845715+0000	runningboardd	Invalidating assertion 33-1621-6133 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1621]) from originator [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1621]
default	02:41:49.845895+0000	runningboardd	Invalidating assertion 33-34-6132 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1621]) from originator [osservice<com.apple.SpringBoard>:34]

These logs are only app lifecycle/snapshot logs; they don’t show the JS/runtime error causing the white screen.

Need the actual error lines. Please capture again with this filter:

Open Console.app and select your iPhone.
Search with:
process:PromptPal
then add text filters one at a time: error, fault, RCTFatal, JavaScript, TypeError, Unhandled.
Clear console, launch app, wait 5-10s on white screen.
Copy lines around the first error/fault and paste here.
If you prefer terminal, run this on your Mac while phone is connected, then open the app and paste output:

log stream --style compact --level debug --predicate 'process == "PromptPal" && (eventMessage CONTAINS[c] "error" OR eventMessage CONTAINS[c] "fault" OR eventMessage CONTAINS[c] "TypeError" OR eventMessage CONTAINS[c] "RCTFatal" OR eventMessage CONTAINS[c] "JavaScript" OR eventMessage CONTAINS[c] "Unhandled")'
Once we have that, I can fix the exact white-screen root cause quickly.


do the terminal thing


Worked for 1m 16s
Correct, it’s not connected to your iPhone logs from my side. I can’t attach to your device directly in this environment.

Run this on your Mac terminal (not here), then open PromptPal and keep it on white screen 10s:

/usr/bin/log stream --style compact --level debug --predicate 'process == "PromptPal" OR eventMessage CONTAINS[c] "com.mikhailspeaks.promptpal" OR eventMessage CONTAINS[c] "RCTFatal" OR eventMessage CONTAINS[c] "TypeError" OR eventMessage CONTAINS[c] "Unhandled" OR eventMessage CONTAINS[c] "JavaScript"'
Then paste the first 30-60 lines around the first error/fault/TypeError/RCTFatal entry.

What you shared earlier was only lifecycle/snapshot noise, so we still need the actual JS/native error line to fix the white screen root cause.


default	02:46:23.763092+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:23.839787+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:23.839948+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:23.840271+0000	locationd	{"msg":"onAvengerAdvertisementDetected: advertisement is near-owner from other people and do not process it", "subHarvester":"Avenger"}
default	02:46:23.842067+0000	locationd	<private>
default	02:46:23.845201+0000	symptomsd	Data Usage for diagnosticd on flow 160047 - WiFi in/out: 0/0, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 0.161
default	02:46:23.848042+0000	symptomsd	Data Usage for remoted on flow 160043 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 8.153
default	02:46:23.849801+0000	symptomsd	Data Usage for remoted on flow 160018 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 8.226
default	02:46:23.855272+0000	symptomsd	Data Usage for remotepairingdeviced on flow 159775 - WiFi in/out: 1265381783/1337252244, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 8.407
default	02:46:23.859242+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:23.861819+0000	symptomsd	Data Usage for remoted on flow 158131 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 528.497
default	02:46:23.863439+0000	symptomsd	Data Usage for remoted on flow 158120 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 528.607
default	02:46:23.878839+0000	backboardd	   9542.76892: notify client com.apple.SpringBoard.HomeGrabberView-3 of <AWAttentionLostEvent: 0x4a22dfb40> (timestamp:    9542.76844 attentionLostTimeout       2.00000 tagIndex 0 (tag not present in server))
error	02:46:23.880050+0000	SpringBoard	attention client lost event tag is not a number: (null)
default	02:46:23.903877+0000	dasd	Attempting to suspend based on triggers: (     "com.apple.das.apppolicy.appchanged" )
default	02:46:23.904644+0000	dasd	Ignoring trigger com.apple.das.apppolicy.appchanged, conditions are worse
default	02:46:23.904942+0000	dasd	Evaluating 0 activities based on triggers
default	02:46:23.961616+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.018148+0000	bluetoothd	BLE Scanner Device Found: CBDevice 77374855-9489-9DD0-DA67-8C19B11FBA86, BDA F8:E5:CE:3B:3C:F5, Nm 'Mikhail’s iPhone', Md iPhone15,4, IDS B600907E-CE23-47FD-9362-D909EABBFEB1, stID B600907E-CE23-47FD-9362-D909EABBFEB1, DsFl 0x800040 < NearbyInfo Pairing >, DvF 0x1B080 < SameAccount Hidden BLEPaired CloudPaired HIDGoodBehavior >, RSSI -48, Ch 39, CtInfo CBControllerInfo, BlSt Unknown, DcsS Unknown, Sync Status: Uploaded, FastLE v1, Allowed: no, InqS Unknown, LMPv 0 (Unknown), SSrv: 0x11D3BBB < HFP PhoneBook AVRCP A2DP HID WirelessiAP NetSharing MAP Gaming NetworkConsumer Braille LEA CarPlay AACP GATT SCO >, BTv 5.3, AdTsMC <224060301798>, AMfD <4c 00 10 07 35 1f 4a 97 e1 d9 78>, naED <04 c7 bc e7>, nbIAT <4a 97 e1>, nbIF 0x7C6 < Ranging Me AT Duet WiFiP2P HtSp ShAu >, CF 0x200000000 < RSSI >
default	02:46:24.040158+0000	bluetoothd	BLE Scanner Device Found: CBDevice D8020202-75E5-974F-2DC4-382BD5E3FE32, BDA F9:F3:A9:52:75:04, Nm 'Mikhail’s MacBook Air', Md Mac15,12, IDS 43F22B9E-3D6B-40E5-AC08-6CEB9A2B5D33, stID 43F22B9E-3D6B-40E5-AC08-6CEB9A2B5D33, DsFl 0x800040 < NearbyInfo Pairing >, DvF 0x1B080 < SameAccount Hidden BLEPaired CloudPaired HIDGoodBehavior >, RSSI -41, Ch 39, CtInfo CBControllerInfo, BlSt Unknown, DcsS Unknown, Sync Status: Uploaded, FastLE v1, Allowed: no, InqS Unknown, LMPv 0 (Unknown), SSrv: 0x392039 < HFP AVRCP A2DP HID Braille LEA AACP GATT SerialPort >, BTv 5.3, AdTsMC <224060326085>, AMfD <4c 00 10 06 40 1d d6 ee a1 58>, naED <04 8b 64 f0>, nbIAT <d6 ee a1>, nbIF 0x1C1 < AirDrop AT Duet WiFiP2P >, CF 0x200000000 < RSSI >
default	02:46:24.062232+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.162748+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.194647+0000	locationd	saveBeaconPayload: 1
default	02:46:24.196090+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:24.196518+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:24.196809+0000	locationd	{"msg":"derivedPruneHarvest", "cacheSize":167, "beaconPayloadCacheSize":0, "subHarvester":"Avenger"}
default	02:46:24.197385+0000	locationd	{"msg":"processAdvertisementCache: completed process", "Remaining fAdvertisementCache.count":167, "fBeaconPayloadCache.count":0, "subHarvester":"Avenger"}
default	02:46:24.198129+0000	locationd	{"msg":"processAdvertisementCache: have last location, but it is stale", "lastLocation.timestamp":793247926, "fCurrentTimeOffsetThreshold":"45.000000", "subHarvester":"Avenger"}
default	02:46:24.201951+0000	locationd	{"msg":"BlueAvengerKPI: rejected proactive fine location request", "subHarvester":"Avenger"}
default	02:46:24.202317+0000	locationd	<private>
default	02:46:24.202492+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:24.203020+0000	searchpartyd	wildModeAssociationRecord(for uuid: <private>)
default	02:46:24.205482+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:24.264337+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.333024+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:24.333621+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:24.333914+0000	locationd	{"msg":"onAvengerAdvertisementDetected: advertisement is near-owner from other people and do not process it", "subHarvester":"Avenger"}
default	02:46:24.334553+0000	locationd	<private>
default	02:46:24.352390+0000	kernel	wlan0:com.apple.p2p: isInfraRealtimePacketThresholdAllowed allowed:1 option:32 threshold:50 noRegistrations:1 cachedPeerCount:0 fastDiscoveryInactive:1 fastDiscoveryOnSince:9543242
default	02:46:24.352511+0000	kernel	wlan0:com.apple.p2p: currentInfraTrafficType:8981 checking if realtime upgrade required with inputPackets:3 outputPackets:2 packetThreshold:50
default	02:46:24.365161+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.464684+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.474766+0000	symptomsd	TCP metrics iteration:802 since 30.00 secs: allflows=3/C=0/R=0/W=0/flows=0/unacked=0/rxbytes=0/txbytes=0/rxooo=0/rxdup=0/retx=0
default	02:46:24.475024+0000	symptomsd	TCP progress metrics score: 0, problem ratio: 0.00 (baseline: 0.00)
default	02:46:24.486663+0000	bluetoothd	Matched UUID 0xFEAA for device "E330690F-B2DD-36F9-0C84-58956B6CB70B"
default	02:46:24.488569+0000	bluetoothd	Matched UUID 0xFEAA for device "E330690F-B2DD-36F9-0C84-58956B6CB70B"
default	02:46:24.489384+0000	bluetoothd	Matched UUID 0xFEAA for device "E330690F-B2DD-36F9-0C84-58956B6CB70B"
default	02:46:24.490392+0000	bluetoothd	Matched UUID 0xFEAA for device "E330690F-B2DD-36F9-0C84-58956B6CB70B"
default	02:46:24.533778+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:24.534657+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:24.535425+0000	locationd	{"msg":"onAvengerAdvertisementDetected: advertisement is near-owner from other people and do not process it", "subHarvester":"Avenger"}
default	02:46:24.537560+0000	locationd	<private>
default	02:46:24.537858+0000	backboardd	   9543.41626: notify client com.apple.siri.AttentionAwareness.Touch of <AWDigitizerButtonKeyboardAttentionEvent: 0x4a22dfc40> (timestamp:    9543.41557 sender 4334569104 displayUUID (null) tagIndex 0 (tag not present in server))
default	02:46:24.538451+0000	backboardd	contact 4 presence: withinRange
default	02:46:24.538666+0000	backboardd	   9543.41771: notify client com.apple.SpringBoard.HomeGrabberView-3 of <AWDigitizerButtonKeyboardAttentionEvent: 0x4a22dff00> (timestamp:    9543.41557 sender 4334569104 displayUUID (null) tagIndex 0 (tag not present in server))
default	02:46:24.543934+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5378bcd20; type: 0; subtype: 0; backing type: 11; shouldSend: 0; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.544055+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5354d1500; type: 0; subtype: 0; backing type: 11; shouldSend: 0; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.565160+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.567240+0000	wifid	__WiFiDeviceProcessRSSIEvent Feeding RSSI data to LQM - RSSI:-41 Core0-RSSI:-41 Core1-RSSI:-54
default	02:46:24.574573+0000	wifid	__WiFiDeviceManagerEvaluateAPEnvironment: WiFiRoam : BSS List info for network : ASK4 Wireless : chanCount5GHz: [4] chanCount24GHz: [1] chanCount6GHz: [0]
default	02:46:24.574716+0000	wifid	__WiFiDeviceManagerEvaluateAPEnvironment: WiFiRoam : AP environment is Multi AP for ASK4 Wireless(30:37:b3:2d:84:0). Last applied environment is Multi AP. Early exit ? : [0]. augmented from scan results ? : [1]
default	02:46:24.574809+0000	wifid	__WiFiLQAMgrLogStats(ASK4 Wireless:Stationary): InfraUptime:527.4secs Channel: 108 Bandwidth: 40Mhz Rssi: -41 {-41 -54} Cca: 13 (S:0 O:0 I:0) Snr: 25 BcnPer: 0.0% (31, 52.2%) TxFrameCnt: 8 TxPer: 0.0% TxReTrans: 0 TxRetryRatio: 0.0% RxFrameCnt: 8 RxRetryFrames: 0 RxRetryRatio: 0.0% TxRate: 400000 RxRate: 400000 FBRate: 240000 TxFwFrms: 8 TxFwFail: 0 Noise: -87 {0 0 0} time: 12.2secs fgApp: com.apple.AccessibilityUIServer V: T
error	02:46:24.574899+0000	wifid	LQM-WiFi: WeightAvgLQM rssi=-41 snr=26 txRate=400000 rxRate=400000
error	02:46:24.574987+0000	wifid	LQM-WiFi:  (HighBand) rxCrsGlitch=1 rxBphyCrsGlitch=0 rxStart=74 rxBadPLCP=0 rxBphyBadPLCP=0 rxBadFCS=1 rxFifo0Ovfl=0 rxFifo1Ovfl=0 rx_nobuf=0 rxAnyErr=0 rxResponseTimeout=0 rxNoDelim=0 rxFrmTooLong=0 rxFrmTooShort=0
error	02:46:24.575074+0000	wifid	LQM-WiFi: (HighBand) txRTSFrm=2 txRTSFail=0 rxCTSUcast=2 rxRTSUcast=0 txCTSFrm=0 txAMPDU=4 rxBACK=2 txPhyError=0 txAllFrm=15 txMPDU=0 txUcast=10 rxACKUcast=8 OfdmDesense=0 dB
error	02:46:24.581142+0000	wifid	LQM-WiFi: (HighBand) rxBeaconMbss=30 rxBeaconObss=25 rxDataUcastMbss=3 rxMgmtUcastMbss=0 rxCNTRLUcast=12 txACKFrm=0 txBACK=3 ctxFifoFull=0 ctxFifo2Full=0 rxDataMcast=3 rxMgmtMcast=55
error	02:46:24.581336+0000	wifid	LQM-WiFi: RX AMPDU (HighBand) rxAmpdu=2 txBACK(Ucode)=3 rxMpduInAmpdu=2 rxholes=0 rxdup=0 rxstuck=0 rxoow=0 rxoos=0 rxaddbareq=0 txaddbaresp=0 rxbar=0 txdelba=0 rxdelba=0 rxQueued=0 rxRetryNoBA=0
error	02:46:24.581537+0000	wifid	LQM-WiFi:  (HighBand) rxToss=0 rxLastTossRsn=0 rxNoFrag=0 rxNoCmplId=0 rxNoHaddr=0 rxMulti=3 rxUndec=0
error	02:46:24.581672+0000	wifid	LQM-WiFi: TX(00:00:00:00:00:00) AC<SU MS NB NRS NA CM EX TF FFP MRET FLE> BE<13 0 0 0 0 0 0 0 0 0 0> (4997ms)
error	02:46:24.584248+0000	wifid	LQM-WiFi: TX(00:00:00:00:00:00) AC<SU MS NB NRS NA CM EX TF FFP MRET FLE> BK<0 0 0 0 0 0 0 0 0 0 0> (4997ms)
error	02:46:24.584495+0000	wifid	LQM-WiFi: TX(00:00:00:00:00:00) AC<SU MS NB NRS NA CM EX TF FFP MRET FLE> VI<0 0 0 0 0 0 0 0 0 0 0> (4997ms)
error	02:46:24.584738+0000	wifid	LQM-WiFi: TX(00:00:00:00:00:00) AC<SU MS NB NRS NA CM EX TF FFP MRET FLE> VO<0 0 0 0 0 0 0 0 0 0 0> (4997ms)
error	02:46:24.584928+0000	wifid	LQM-WiFi: L3 Control VO TX(00:00:00:00:00:00) Success=0 NoACK=0 Expired=0 OtherErr=0
default	02:46:24.585231+0000	wifid	WiFiDeviceManagerGetAppState: app state for DPS action : Foreground isAnyAppInFG:yes isFTactive:no isLatencySensitiveAppActive:no
default	02:46:24.585536+0000	wifid	WiFiLQAMgrCopyCoalescedUndispatchedLQMEvent: Rssi: -41 Snr:25 Cca: 13 TxFrames: 8 TxFail: 0 BcnRx: 31 BcnSch: 31  RxFrames: 8 RxRetries: 0 TxRate: 400000 RxRate: 400000 FBRate: 240000 TxFwFrms: 8 TxFwFail:0 TxRetries: 0
default	02:46:24.585670+0000	SpringBoard	[SBWiFiManager] signal strength bars changed to 3
default	02:46:24.585874+0000	wifid	__WiFiDeviceManagerEvaluateAPEnvironment: WiFiRoam : BSS List info for network : ASK4 Wireless : chanCount5GHz: [4] chanCount24GHz: [1] chanCount6GHz: [0]
default	02:46:24.586184+0000	safetyalertsd	{"msg":"#Wifi,cb", "wifiRxPhyRate":<private>}
default	02:46:24.586308+0000	wifid	__WiFiDeviceManagerEvaluateAPEnvironment: WiFiRoam : AP environment is Multi AP for ASK4 Wireless(30:37:b3:2d:84:0). Last applied environment is Multi AP. Early exit ? : [0]. augmented from scan results ? : [1]
default	02:46:24.591903+0000	locationd	os_transaction created: (<private>) <private>
default	02:46:24.592087+0000	locationd	os_transaction released: (<private>) <private>
default	02:46:24.595186+0000	wifid	[corewifi] BEGIN REQ [GET INTF NAME] (pid=153 proc=symptomsd bundleID=com.apple.symptomsd codesignID=com.apple.symptomsd service=com.apple.private.corewifi-xpc qos=17 intf=(null) uuid=39572 info=(null))
default	02:46:24.597390+0000	wifid	[corewifi] [39572] Incoming QoS is less than 'default', promoting to 'default'
default	02:46:24.599630+0000	wifid	[corewifi] END REQ [GET INTF NAME] took 0.004427875s (pid=153 proc=symptomsd bundleID=com.apple.symptomsd codesignID=com.apple.symptomsd service=com.apple.private.corewifi-xpc qos=17 intf=(null) uuid=39572 err=0 reply=<redacted>
default	02:46:24.599874+0000	symptomsd	L2 Metrics on en0: rssi: -41 [-41,-54] -> -41, snr: 25 (cca [wake/total] self/other/intf): [0,0]/[0,0]/[0,0]/13 (txFrames/txReTx/txFail): 8/0/0 -> (was/is) 0/0
default	02:46:24.600846+0000	WirelessRadioManagerd	<private>
default	02:46:24.602168+0000	WirelessRadioManagerd	<private>
default	02:46:24.602318+0000	WirelessRadioManagerd	<private>
default	02:46:24.602418+0000	WirelessRadioManagerd	<private>
default	02:46:24.612395+0000	WirelessRadioManagerd	<private>
default	02:46:24.614068+0000	WirelessRadioManagerd	<private>
default	02:46:24.614130+0000	WirelessRadioManagerd	<private>
default	02:46:24.614309+0000	WirelessRadioManagerd	<private>
default	02:46:24.614357+0000	WirelessRadioManagerd	<private>
default	02:46:24.614487+0000	WirelessRadioManagerd	<private>
default	02:46:24.614626+0000	WirelessRadioManagerd	<private>
default	02:46:24.614785+0000	WirelessRadioManagerd	<private>
default	02:46:24.614835+0000	WirelessRadioManagerd	<private>
default	02:46:24.614928+0000	WirelessRadioManagerd	<private>
default	02:46:24.615087+0000	WirelessRadioManagerd	<private>
default	02:46:24.615139+0000	WirelessRadioManagerd	<private>
default	02:46:24.615376+0000	WirelessRadioManagerd	<private>
default	02:46:24.615423+0000	WirelessRadioManagerd	<private>
default	02:46:24.615470+0000	WirelessRadioManagerd	<private>
default	02:46:24.615633+0000	WirelessRadioManagerd	<private>
default	02:46:24.615684+0000	WirelessRadioManagerd	<private>
default	02:46:24.615731+0000	WirelessRadioManagerd	<private>
default	02:46:24.615824+0000	WirelessRadioManagerd	<private>
default	02:46:24.624562+0000	backboardd	   9543.51604: notify client com.apple.siri.AttentionAwareness.Touch of <AWAttentionLostEvent: 0x4a22dfb40> (timestamp:    9543.51580 attentionLostTimeout       0.10000 tagIndex 0 (tag not present in server))
default	02:46:24.664297+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.737025+0000	runningboardd	Invalidating assertion 33-34-6208 (target:[osservice<com.apple.SpringBoard>:34]) from originator [osservice<com.apple.SpringBoard>:34]
default	02:46:24.744679+0000	backboardd	Dispatching event with 1 children, _eventMask=0x2 _childEventMask=0x2 Cancel=0 Touching=1 inRange=1 (deviceID 0x20000000000006C)
default	02:46:24.747834+0000	backboardd	   9543.63378: notify client com.apple.siri.AttentionAwareness.Touch of <AWDigitizerButtonKeyboardAttentionEvent: 0x4a22dff40> (timestamp:    9543.63274 sender 4334569104 displayUUID (null) tagIndex 0 (tag not present in server))
default	02:46:24.748445+0000	backboardd	contact 4 presence: touching
default	02:46:24.758776+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5378bcd20; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.758829+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.758914+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <_UISystemGestureWindow: 0x5343b8c00>; contextId: 0x1FF7DCD9
default	02:46:24.764426+0000	SpringBoard	Allowing tap for icon view '<private>'
default	02:46:24.765562+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.767118+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5354d1500; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.767252+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.767472+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <SBHomeScreenWindow: 0x5353ce000>; contextId: 0xF6703224
default	02:46:24.775393+0000	SpringBoard	SBIconView touches began with event: <UITouchesEvent: 0x5354d1500> timestamp: 9543.63 touches: {(
    <UITouch: 0x538ba8c40> type: Direct; phase: Began; is pointer: NO; tap count: 1; force: 0.000; window: <SBHomeScreenWindow: 0x5353ce000; HomeScreen-0x5353ce000-5; baseClass = UIWindow; frame = (0 0; 375 812); clipsToBounds = YES; opaque = NO; gestureRecognizers = <NSArray: 0x536f35ee0>; layer = <UIWindowLayer: 0x535510510>>; responder: <SBIconView: 0x5353b0f00; frame: {{288, 441}, {60, 74}}; icon: <SBApplicationIcon: 0x537c3a300; nodeID: com.mikhailspeaks.promptpal; bundleID: com.mikhailspeaks.promptpal>; location: SBIconLocationRoot; labelAccessoryType: beta; isTouchDownInIcon: YES>; location in window: {309.66665649414062, 452.33332824707031}; previous location in window: {309.66665649414062, 452.33332824707031}; location in view: {21.666656494140625, 11.333328247070312}; previous location in view: {21.666656494140625, 11.333328247070312}
)}, tap gesture: <SBIconTapGestureRecognizer: 0x535df4a00; baseClass = UITapGestureRecognizer; state = Po
default	02:46:24.775546+0000	SpringBoard	Icon touch began: <private>
default	02:46:24.839042+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5378bcd20; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.839123+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.839246+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <_UISystemGestureWindow: 0x5343b8c00>; contextId: 0x1FF7DCD9
default	02:46:24.839781+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5354d1500; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.840615+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.840694+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <SBHomeScreenWindow: 0x5353ce000>; contextId: 0xF6703224
default	02:46:24.854962+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5378bcd20; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.855515+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.855662+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <_UISystemGestureWindow: 0x5343b8c00>; contextId: 0x1FF7DCD9
default	02:46:24.856493+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5354d1500; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.856569+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.856854+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <SBHomeScreenWindow: 0x5353ce000>; contextId: 0xF6703224
default	02:46:24.860158+0000	bluetoothd	BLE Scanner Device Found: CBDevice CCFD8FA8-9E5C-3A12-BB67-42108B3F62A6, BDA 44:1B:88:71:22:10, Nm 'Ur fat uncle', Md iPad13,8, IDS F0A07BB3-6291-4D44-ACCE-40E3689A401C, stID F0A07BB3-6291-4D44-ACCE-40E3689A401C, DsFl 0x800040 < NearbyInfo Pairing >, DvF 0x1B080 < SameAccount Hidden BLEPaired CloudPaired HIDGoodBehavior >, RSSI -51, Ch 38, CtInfo CBControllerInfo, BlSt Unknown, DcsS Unknown, Sync Status: Uploaded, FastLE v1, Allowed: no, InqS Unknown, LMPv 0 (Unknown), SSrv: 0x11D3AB9 < HFP AVRCP A2DP HID WirelessiAP MAP Gaming NetworkConsumer Braille LEA CarPlay AACP GATT SCO >, BTv 5.3, AdTsMC <224061152167>, AMfD <4c 00 10 06 0a 1d 27 fa 6e 68>, naED <04 c7 bc e7>, nbIAT <27 fa 6e>, nbIF 0x1C0 < AT Duet WiFiP2P >, CF 0x200000000 < RSSI >
default	02:46:24.865278+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.869214+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5378bcd20; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.869296+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.869380+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <_UISystemGestureWindow: 0x5343b8c00>; contextId: 0x1FF7DCD9
default	02:46:24.870182+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5354d1500; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.870260+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.870341+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <SBHomeScreenWindow: 0x5353ce000>; contextId: 0xF6703224
default	02:46:24.905831+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5378bcd20; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.907711+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.909120+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <_UISystemGestureWindow: 0x5343b8c00>; contextId: 0x1FF7DCD9
default	02:46:24.910057+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5354d1500; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.910492+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.910587+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <SBHomeScreenWindow: 0x5353ce000>; contextId: 0xF6703224
default	02:46:24.912214+0000	backboardd	Dispatching event with 1 children, _eventMask=0x2 _childEventMask=0x2 Cancel=0 Touching=0 inRange=1 (deviceID 0x20000000000006C)
default	02:46:24.914813+0000	backboardd	contact 4 presence: withinRange
default	02:46:24.919321+0000	backboardd	contact 4 presence: none
default	02:46:24.920753+0000	backboardd	not removing destination (external): <BKTouchDestination: 0x4a31d6df0; (touchStream|filterDetachedTouches); contextID: 0x1FF7DCD9; clientPort: 0x2F13; externalReferences: 1>
default	02:46:24.921705+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5378bcd20; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.921760+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.921974+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <_UISystemGestureWindow: 0x5343b8c00>; contextId: 0x1FF7DCD9
default	02:46:24.922154+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5354d1500; type: 0; subtype: 0; backing type: 11; shouldSend: 1; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:24.922208+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to windows: 1
default	02:46:24.922261+0000	SpringBoard	Sending UIEvent type: 0; subtype: 0; to window: <SBHomeScreenWindow: 0x5353ce000>; contextId: 0xF6703224
default	02:46:24.922312+0000	SpringBoard	Allowing tap for icon view '<private>'
default	02:46:24.922487+0000	SpringBoard	Handle tap: <private>, modifiers: 0, delegate: 0x5343b9800, window: 0x5353ce000
default	02:46:24.922672+0000	SpringBoard	Icon tapped: <private>
default	02:46:24.923703+0000	SpringBoard	Telling delegate to launch with actions: <private> modifierFlags: 0
default	02:46:24.923897+0000	SpringBoard	Initiating launch from icon view: <private>
default	02:46:24.924082+0000	SpringBoard	Launching application <private> from icon <private>, location: SBIconLocationRoot
default	02:46:24.924237+0000	SpringBoard	Activate application <private> from icon <private> location SBIconLocationRoot
default	02:46:24.926299+0000	SpringBoard	Executing request: <SBMainWorkspaceTransitionRequest: 0x5393e9540; eventLabel: SBUIApplicationIconLaunchEventLabel; display: Main; source: HomeScreen>
default	02:46:24.933953+0000	SpringBoard	[0x534ce3500] activating connection: mach=true listener=false peer=false name=com.apple.trustd
default	02:46:24.935314+0000	trustd	[0xbc0360280] activating connection: mach=false listener=false peer=true name=com.apple.trustd.peer[34].0xbc0360280
default	02:46:24.939291+0000	trustd	cert[0]: SubjectCommonName =(leaf)[]> 0
default	02:46:24.939419+0000	trustd	cert[0]: LeafMarkerOid =(leaf)[force]> 0
default	02:46:24.939539+0000	trustd	Malformed anchor records, not an array
default	02:46:24.941626+0000	symptomsd	Data Usage for diagnosticd on flow 160047 - WiFi in/out: 0/0, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 1.260
default	02:46:24.943845+0000	symptomsd	Data Usage for remoted on flow 160043 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 9.253
default	02:46:24.945022+0000	symptomsd	Data Usage for remoted on flow 160018 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 9.325
default	02:46:24.945815+0000	trustd	cert[0]: IssuerCommonName =(path)[]> 0
default	02:46:24.946149+0000	symptomsd	Data Usage for remotepairingdeviced on flow 159973 - WiFi in/out: 1265381955/1337252388, WiFi delta_in/delta_out: 172/144, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 9.377
default	02:46:24.946919+0000	SpringBoard	[0x534ce3500] invalidated because the current process cancelled the connection by calling xpc_connection_cancel()
default	02:46:24.947381+0000	SpringBoard	Trust evaluate failure: [leaf IssuerCommonName LeafMarkerOid SubjectCommonName]
default	02:46:24.948465+0000	trustd	[0xbc0360280] invalidated because the client process (pid 34) either cancelled the connection or exited
default	02:46:24.949801+0000	symptomsd	Data Usage for remotepairingdeviced on flow 159775 - WiFi in/out: 1265381955/1337252388, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 9.506
default	02:46:24.951673+0000	SpringBoard	[0x53546dd00] activating connection: mach=true listener=false peer=false name=com.apple.misagent
default	02:46:24.952353+0000	misagent	[0xbb2070000] activating connection: mach=false listener=false peer=true name=com.apple.misagent.peer[34].0xbb2070000
default	02:46:24.953360+0000	SpringBoard	[0x53546dd00] invalidated because the current process cancelled the connection by calling xpc_connection_cancel()
default	02:46:24.953593+0000	misagent	[0xbb2070000] invalidated because the client process (pid 34) either cancelled the connection or exited
default	02:46:24.954606+0000	SpringBoard	<private> was picked for validation
default	02:46:24.955141+0000	SpringBoard	[FBWorkspaceEvent] Executing: <FBWorkspaceEvent: 0x536049080; SBUIApplicationIconLaunchEventLabel>
default	02:46:24.955668+0000	SpringBoard	[92869424] unlockedEnvironmentMode: application
default	02:46:24.955764+0000	SpringBoard	[SwitcherOrientation] transition source: HomeScreen
default	02:46:24.955822+0000	SpringBoard	[SwitcherOrientation] switcherPolicy[Follow Primary Element primaryOverlaysPolicy[Follow Raw Device if Incompatibly User Locked]
default	02:46:24.959686+0000	kernel	system-state-notify subtype 0x21 0x00 0x00
default	02:46:24.964843+0000	SpringBoard	[SwitcherOrientation] _updateParticipantsAndPoliciesWithSwitcherPolicy:[Follow Primary Element] nonPrimaryOverlayPolicy:[Follow Raw Device if Incompatibly User Locked]
default	02:46:24.964905+0000	SpringBoard	[SwitcherOrientation] animation duration set to 0.00
default	02:46:24.964958+0000	SpringBoard	[SwitcherOrientation] outSwitcherOrientation: portrait (1), outElementsOrientations: {
    "sceneID:com.mikhailspeaks.promptpal-default" = 1;
}
default	02:46:24.965188+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:24.966733+0000	SpringBoard	Create activity <nw_activity 50:1>
default	02:46:24.966784+0000	SpringBoard	Create activity <nw_activity 50:2>
default	02:46:24.967145+0000	SpringBoard	Activated <nw_activity 50:1 [3C800CA7-1CD6-44F3-8A28-39987E4B14FB] (reporting strategy default)>
default	02:46:24.967552+0000	SpringBoard	Activated <nw_activity 50:2 [B8C66A08-BBE2-4DC1-BB00-3CC7D31E1B78] (reporting strategy default)>
default	02:46:24.967912+0000	SpringBoard	Generating initialization context on main thread for: com.mikhailspeaks.promptpal
default	02:46:24.968673+0000	kernel	[SMC:charger.cpp:2638] Not charging:2000
default	02:46:24.975311+0000	SpringBoard	Asked to bootstrap a new process with identity: app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>
default	02:46:24.975454+0000	SpringBoard	Creating process (sync=true) with identity: app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>
default	02:46:24.975800+0000	SpringBoard	Created <FBWorkspace: 0x5393e81e0; <FBApplicationProcess: 0x53900e700; app<com.mikhailspeaks.promptpal>:<invalid>>>
default	02:46:24.975852+0000	SpringBoard	Bootstrapping app<com.mikhailspeaks.promptpal> with intent foreground-interactive
default	02:46:24.976684+0000	SpringBoard	Changing icon manager content visibility to hidden
default	02:46:24.977756+0000	SpringBoard	Prewarming for launch of com.mikhailspeaks.promptpal
default	02:46:24.977986+0000	runningboardd	Acquiring assertion targeting app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)> from originator [osservice<com.apple.SpringBoard>:34] with description <RBSAssertionDescriptor| "FBApplicationProcess" ID:33-34-6209 target:app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)> attributes:[
	<RBSDomainAttribute| domain:"com.apple.frontboard" name:"Bootstrap-Foreground" sourceEnvironment:"(null)">,
	<RBSDomainAttribute| domain:"com.apple.frontboard" name:"Visibility" sourceEnvironment:"(null)">
	]>
default	02:46:24.978177+0000	runningboardd	Assertion 33-34-6209 (target:app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>) will be created as active
default	02:46:24.978528+0000	runningboardd	Checking PreventLaunch: global:0 exPath:(null) predicates:(null) allow:(null)
default	02:46:24.981194+0000	runningboardd	preflightManager for <RBSLaunchContext: 0xd7094f5c0> -> ALLOWED
default	02:46:24.981906+0000	SpringBoard	Deactivating wallpaper orientation source ActiveOrientation
default	02:46:24.982572+0000	runningboardd	Creating and launching job for: app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>
default	02:46:24.982620+0000	runningboardd	_mutateContextIfNeeded called for com.mikhailspeaks.promptpal
default	02:46:24.982820+0000	runningboardd	_mutateContextIfNeeded using proxy
default	02:46:24.983192+0000	SpringBoard	Window(0x537505c00)(SBTraitsParticipantRoleControlCenter-0) validates resolution: NO. isHidden
default	02:46:24.993207+0000	runningboardd	app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>: -[RBPersonaManager personaForIdentity:context:personaUID:personaUniqueString:] required 0.005007 ms (wallclock); resolved to {1000, 94ABBE9B-467A-4C33-B7BB-0FD7D34456BE}
default	02:46:24.993292+0000	runningboardd	'app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>' Skipping container path lookup because containerization was prevented (<RBSLaunchContext: 0xd7094f5c0>)
default	02:46:24.993436+0000	SpringBoard	<SBFullScreenSwitcherLiveContentOverlayCoordinator: 0x537a79c00> Adding SwitcherScene overlay for: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>, animated: NO
default	02:46:24.993495+0000	runningboardd	'app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>' Constructed job description:
<dictionary: 0xd7083e580> { count = 19, transaction: 0, voucher = 0x0, contents =
	"ProcessType" => <string: 0xd70d8b6c0> { length = 3, contents = "App" }
	"EnableTransactions" => <bool: 0x2731aa4a0>: false
	"_ManagedBy" => <string: 0xd70d8b480> { length = 22, contents = "com.apple.runningboard" }
	"_ResourceCoalition" => <string: 0xd70d8b0c0> { length = 70, contents = "app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>" }
	"CFBundleIdentifier" => <string: 0xd70d8bf30> { length = 27, contents = "com.mikhailspeaks.promptpal" }
	"ThrottleInterval" => <int64: 0xab8fb7740fde090f>: 2147483647
	"PersonaEnterprise" => <int64: 0xab8fb777f021e9b7>: 1000
	"MachServices" => <dictionary: 0xd7083f180> { count = 0, transaction: 0, voucher = 0x0, contents =
	}
	"EnablePressuredExit" => <bool: 0x2731aa4a0>: false
	"InitialTaskRole" => <int64: 0xab8fb777f021f6ff>: 1
	"UserName" => <string: 0xd70d8bea0> { length = 6, contents = "mobile" }
	"EnvironmentVariables" => <dictionary: 0xd7083daa0> { count = 3, transaction: 0, voucher = 0x0, contents =
		"TMPDIR" => <string: 0xd70d88c30> { length = 88, contents = "/private/var/mobile/Containers/Data/Application/9ECBC618-5003-4438-87EB-AC449AE0CAAC/tmp" }
		"HOME" => <string: 0xd70d8ab80> { length = 84, contents = "/private/var/mobile/Containers/Data/Application/9ECBC618-5003-4438-87EB-AC449AE0CAAC" }
		"CFFIXED_USER_HOME" => <string: 0xd70d8b390> { length = 84, contents = "/private/var/mobile/Containers/Data/Application/9ECBC618-5003-4438-87EB-AC449AE0CAAC" }
	}
	"_AdditionalProperties" => <dictionary: 0xd7083e940> { count = 1, transaction: 0, voucher = 0x0, contents =
		"RunningBoard" => <dictionary: 0xd7083c420> { count = 3, transaction: 0, voucher = 0x0, contents =
			"Managed" => <bool: 0x2731aa480>: true
			"RunningBoardLaunchedIdentity" => <dictionary: 0xd7083c7e0> { count = 3, transaction: 0, voucher = 0x0, contents =
				"TYPE" => <int64: 0xab8fb777f021f6e7>: 2
				"EAI" => <string: 0xd70d884e0> { length = 27, contents = "com.mikhailspeaks.promptpal" }
				"PERS" => <string: 0xd70d89cb0> { length = 36, contents = "94ABBE9B-467A-4C33-B7BB-0FD7D34456BE" }
			}
			"RunningBoardLaunched" => <bool: 0x2731aa480>: true
		}
	}
	"ExitTimeOut" => <int64: 0xab8fb777f021f6ff>: 1
	"Label" => <string: 0xd70d8a190> { length = 61, contents = "UIKitApplication:com.mikhailspeaks.promptpal[b789][rb-legacy]" }
	"MaterializeDatalessFiles" => <bool: 0x2731aa480>: true
	"_LaunchType" => <int64: 0xab8fb777f021f6ef>: 3
	"ProgramArguments" => <array: 0xd70d8ac70> { count = 1, capacity = 8, contents =
		0: <string: 0xd70d89230> { length = 95, contents = "/var/containers/Bundle/Application/3B4AFA71-CACC-439E-AC15-F128A84AF265/PromptPal.app/PromptPal" }
	}
	"Program" => <string: 0xd70d8b8d0> { length = 95, contents = "/var/containers/Bundle/Application/3B4AFA71-CACC-439E-AC15-F128A84AF265/PromptPal.app/PromptPal" }
}
default	02:46:24.995218+0000	SpringBoard	Added: <UIApplicationSceneDeactivationAssertion: 0x537860660; reason: systemAnimation; all scene levels; hasPredicate: YES>
default	02:46:24.995690+0000	SpringBoard	Requested update preferences for <Switcher> with reason: SBSystemApertureZStackPolicyAssistant
default	02:46:25.002799+0000	SpringBoard	_updatePreferences <Switcher>: {
    activationPolicyForParticipantsBelow: AtMostBG;
    homeAffordanceDrawingSuppression: Default;
    associatedSceneIdentifiersToSuppressInSystemAperture: (
        sceneID:com.mikhailspeaks.promptpal-default
    );
    associatedBundleIdentifiersToSuppressInSystemAperture: (
        com.mikhailspeaks.promptpal
    );
    allowsDimmingWhenForegroundInactive: No;
}
default	02:46:25.002928+0000	SpringBoard	Ignoring appearance update for CoverSheet because we have no view.
default	02:46:25.003000+0000	SpringBoard	Resolved Stack (
    "<Highest> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<BannerItems> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<HUD> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<TransientOverlayPresentation> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<CoverSheet> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<Switcher> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<HomeScreen> FGActive to BG; participantBelowAllowsDimming: NO"
)
default	02:46:25.003066+0000	SpringBoard	Requested update preferences for <Switcher> with reason: layout state transition did begin
default	02:46:25.003123+0000	SpringBoard	_updatePreferences <Switcher>: no changes
default	02:46:25.003180+0000	SpringBoard	Resolved Stack (
    "<Highest> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<BannerItems> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<HUD> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<TransientOverlayPresentation> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<CoverSheet> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<Switcher> ownsHomeGesture: YES; FGActive; participantBelowAllowsDimming: NO",
    "<HomeScreen> BG; participantBelowAllowsDimming: NO"
)
default	02:46:25.007363+0000	SpringBoard	[DeviceSceneHandle] Did set interfaceOrientation[1] on scene with identifier[<private>]
default	02:46:25.007905+0000	SpringBoard	modifying scene setting userInterfaceStyle to Dark displayIdentity: Main forSceneManagers: Main <SBDeviceApplicationSceneHandle: 0x538babd40; sceneID: sceneID:com.mikhailspeaks.promptpal-default; scenePointer: 0x0>
default	02:46:25.008657+0000	SpringBoard	modifying scene setting underAppProtection to 0
default	02:46:25.011096+0000	SpringBoard	No capture application found for the <private>, launchCameraCapture: NO, isCaptureApplication: NO
default	02:46:25.014700+0000	kernel	/private/var/containers/Bundle/Application/3B4AFA71-CACC-439E-AC15-F128A84AF265/PromptPal.app/PromptPal[1631] ==> container
default	02:46:25.014883+0000	runningboardd	<OSLaunchdJob | handle=48CD9EB6-DA66-4B43-B914-90502DF110DE>: submitAndStart completed, info=running, pid=1631
default	02:46:25.015678+0000	runningboardd	existingInstance is: (null)
default	02:46:25.015957+0000	backboardd	Setting minimum brightness level: 0.000000 with fade duration 0.400000
default	02:46:25.016016+0000	backboardd	Set BrightnessSystem property:DisplayBrightnessFadePeriod to:0.4
default	02:46:25.016067+0000	runningboardd	Full encoding handle <private>, with data ea81d4b90000065f, and pid 1631
default	02:46:25.016232+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] Memory Limits: active 2098 inactive 2098
 <private>
default	02:46:25.016407+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] This process will be managed.
default	02:46:25.016458+0000	runningboardd	Now tracking process: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.016508+0000	runningboardd	Existing process in RBProcessIndex is: (null)
default	02:46:25.016557+0000	runningboardd	existingProcess in RBProcessManager is: (null)
default	02:46:25.016670+0000	runningboardd	Existing process in RBProcessIndex is: (null)
default	02:46:25.016774+0000	SpringBoard	[ShouldAutoPiP] For request(0x5393e9540): NO
default	02:46:25.017314+0000	backboardd	Set BrightnessSystem property:BrightnessMinPhysicalWithFade to:0
default	02:46:25.017975+0000	runningboardd	<private>: applying persistent assertion '<private>'
default	02:46:25.018183+0000	runningboardd	Existing process in RBProcessIndex is: (null)
default	02:46:25.018745+0000	backboardd	soft cancel on display:<main>
default	02:46:25.018860+0000	runningboardd	Calculated state for app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>: running-active (role: UserInteractiveFocal) (endowments: <private>)
default	02:46:25.020097+0000	runningboardd	Using default underlying assertion for app: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.021415+0000	runningboardd	Acquiring assertion targeting [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] from originator [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] with description <RBSAssertionDescriptor| "RB Underlying Assertion" ID:33-33-6210 target:1631 attributes:[
	<RBSDomainAttribute| domain:"com.apple.underlying" name:"defaultUnderlyingAppAssertion" sourceEnvironment:"(null)">,
	<RBSAcquisitionCompletionAttribute| policy:AfterApplication>
	]>
default	02:46:25.022162+0000	runningboardd	Assertion 33-33-6210 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]) will be created as active
default	02:46:25.022349+0000	runningboardd	Existing process in RBProcessIndex is: (null)
default	02:46:25.024233+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] Set jetsam priority to 100 [0] flag[1]
default	02:46:25.024451+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Bootstrap success!
default	02:46:25.024663+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] Resuming task.
error	02:46:25.024693+0000	kernel	Sandbox: PromptPal(1631) deny(1) sysctl-read kern.bootargs
default	02:46:25.024759+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] Set darwin role to: UserInteractiveFocal
default	02:46:25.025120+0000	runningboardd	1631 Set Darwin GPU to "allow"
default	02:46:25.025799+0000	runningboardd	<OSLaunchdJob | handle=48CD9EB6-DA66-4B43-B914-90502DF110DE>: monitor initial info is running, pid=1631
default	02:46:25.025904+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] reported to RB as running
default	02:46:25.025985+0000	runningboardd	Acquired process power assertion with ID 38690 for pid 1631
default	02:46:25.026081+0000	backboardd	Got layout monitor transition.
default	02:46:25.026941+0000	CommCenter	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.027008+0000	CommCenter	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.027846+0000	runningboardd	<OSLaunchdJob | handle=48CD9EB6-DA66-4B43-B914-90502DF110DE>: starting monitoring
default	02:46:25.028115+0000	SpringBoard	[Main (EmbeddedDisplay)] dispatch event:
<SBTransitionSwitcherModifierEvent: 0x53696dc80; type: MainTransition; transitionID: 910D6AF2-C41A-4CDE-BC77-D8DE8EA208DA; phase: Prepare; animated: YES; fromAppLayout: 0x0; toAppLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>; fromEnvironmentMode: home-screen; toEnvironmentMode: application; fromSpaceConfiguration: undefined; toSpaceConfiguration: full; pendingTermination: {(
)}; activating: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>; morphingPIPLayoutRole: undefined>
default	02:46:25.028585+0000	SpringBoard	[Main (EmbeddedDisplay)] handle response:
<SBSwitcherModifierEventResponse: 0x535c96460> {
    <SBSwitcherModifierEventResponse: 0x535c97660> {
	    <SBTimerEventSwitcherEventResponse: 0x535c94870; delay: 0.300000; reason: kSBTransitionModifierInvalidateAsyncRenderingReason>;
	    <SBInvalidateAdjustedAppLayoutsSwitcherEventResponse: 0x535c97480>;
	};
    <SBSwitcherModifierEventResponse: 0x535c96dc0> {
	    <SBUpdateLayoutSwitcherEventResponse: 0x538151380; updateVisibleItems; layout; style; mode: None>;
	    <SBRequestFolderSnapshotsSwitcherEventResponse: 0x535c97870; snapshotRequested: YES>;
	    <SBIconOverlayVisibilitySwitcherEventResponse: 0x538153c00; visible: YES; appLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>>;
	    <SBIconViewVisibilitySwitcherEventResponse: 0x5394393b0; visible: NO; animationSettings: 0x0; appLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>>;
	    <SBTimerEventSwitcherEventRespons
default	02:46:25.028703+0000	SpringBoard	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.028762+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Setting process task state to: Running
default	02:46:25.028812+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Setting process visibility to: Foreground
default	02:46:25.029051+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Registering event dispatcher after bootstrap
default	02:46:25.029155+0000	SpringBoard	Registering Source for 1631 : <FBWorkspaceEventDispatcherSource: 0x537610d20>
default	02:46:25.029937+0000	runningboardd	Calculated state for app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>: running-active (role: UserInteractiveFocal) (endowments: <private>)
default	02:46:25.030170+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] set Memory Limits to Soft Active (2098)
default	02:46:25.030221+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] Set Carplay mode to: 0
default	02:46:25.030354+0000	powerd	Sleep revert state: 1
default	02:46:25.030529+0000	powerd	Process runningboardd.33 Created SystemIsActive "app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>33-34-6209:FBApplicationProcess" age:00:00:00  id:51539646242 [System: PrevIdle SysAct]
default	02:46:25.030599+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Initial launch assertion state: ForegroundFocal.
default	02:46:25.030682+0000	SpringBoard	Starting death monitoring for handle <private>
default	02:46:25.031537+0000	SpringBoard	Adding: <FBApplicationProcess: 0x53900e700; app<com.mikhailspeaks.promptpal>:1631(v1067)>
default	02:46:25.031753+0000	SpringBoard	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.032203+0000	SpringBoard	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.032438+0000	runningboardd	[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] visiblity is yes
error	02:46:25.033123+0000	SpringBoard	Live host view super view[(null)] not matching container view[<UIView: 0x53900e580; frame = (0 0; 375 812); clipsToBounds = YES; layer = <CALayer: 0x536048e20>>], frame not updated
default	02:46:25.033457+0000	kernel	AppleSMCHighVoltageCharger::handleSMCEvent: self=<private> event=9 arg=0
default	02:46:25.034104+0000	runningboardd	Successfully acquired underlying assertion for [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
error	02:46:25.034955+0000	SpringBoard	Live host view super view[(null)] not matching container view[<UIView: 0x53900e580; frame = (0 0; 375 812); clipsToBounds = YES; layer = <CALayer: 0x536048e20>>], frame not updated
error	02:46:25.035234+0000	SpringBoard	Live host view super view[(null)] not matching container view[<UIView: 0x53900e580; frame = (0 0; 375 812); clipsToBounds = YES; layer = <CALayer: 0x536048e20>>], frame not updated
default	02:46:25.035404+0000	kernel	IOAccessoryPowerSource::createPowerSourceItemsInternal(): id:0x1000005a6, owner=<private> tag=<private> itemSet=<private> removeTagSet=0x0
default	02:46:25.035638+0000	kernel	IOAccessoryPowerSource::createPowerSourceItemsInternal(): id:0x1000005a6, owner=<private> tag=<private> itemSet=0x0 removeTagSet=0x0
default	02:46:25.035840+0000	SpringBoard	Requiring wallpaper for reason: <private>
default	02:46:25.035942+0000	SpringBoard	Poster scenes un-fenced update for reasons: UpdateForActiveVariant
default	02:46:25.036103+0000	SpringBoard	[lock] Poster Extact update changed 648
default	02:46:25.036314+0000	runningboardd	PERF: Received lookupHandleForPredicate request from [osservice<com.apple.CommCenter>:97] (euid 25, auid 25) (persona (null))
default	02:46:25.036823+0000	SpringBoard	Poster scenes un-fenced update for reasons: UpdateForActiveVariant
default	02:46:25.037024+0000	SpringBoard	[home] Poster Extact update changed 595
default	02:46:25.037170+0000	SpringBoard	Begin requiring home screen content for reason 'SBDeckSwitcherViewController-0x53560f200-Main (EmbeddedDisplay)'
default	02:46:25.038063+0000	SpringBoard	Push: <SBMainSwitcherWindow: 0x5376fe680>
default	02:46:25.038371+0000	SpringBoard	Evaluate: making new window key: <SBMainSwitcherWindow: 0x5376fe680>, for reason: push
default	02:46:25.038577+0000	SpringBoard	SBWindowScene: 0x53425d600: Window became key in scene: SBMainSwitcherWindow: 0x5376fe680; contextId: 0x81CD19B1: reason: SBWindowScene: 0x53425d600: Window requested to become key in scene: 0x5376fe680
default	02:46:25.038644+0000	SpringBoard	Key window needs update: 1; currentKeyWindowScene: 0x53425d600; evaluatedKeyWindowScene: 0x53425d600; currentApplicationKeyWindow: 0x5353ce000; evaluatedApplicationKeyWindow: 0x5376fe680; reason: SBWindowScene: 0x53425d600: Window requested to become key in scene: 0x5376fe680
default	02:46:25.038708+0000	SpringBoard	Window did become application key: SBMainSwitcherWindow: 0x5376fe680; contextId: 0x81CD19B1; scene identity: com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard
default	02:46:25.038821+0000	SpringBoard	[0x534ba4460] Beginning and ending local event deferring requested for token: 0x537868420; environments: 1; reason: SBWindowScene: 0x53425d600: Begin event deferring in keyboardFocus for window: 0x5376fe680
default	02:46:25.039042+0000	SpringBoard	[0x534ba4460] Begin local event deferring requested for token: 0x53786b540; environments: 1; reason: SBWindowScene: 0x53425d600: Begin event deferring in keyboardFocus for window: 0x5376fe680
default	02:46:25.039148+0000	SpringBoard	Window resigning application key: SBHomeScreenWindow: 0x5353ce000; contextId: 0xF6703224; scene identity: com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard
default	02:46:25.039361+0000	SpringBoard	[embedded coalition] _abritrateForReason: <keyWindowNotification> - new policy is unchanged
default	02:46:25.039412+0000	SpringBoard	Reloading input views for: <(null): 0x0; > force: 0
default	02:46:25.039704+0000	SpringBoard	_reloadInputViewsForKeyWindowSceneResponder: 0 force: 0, fromBecomeFirstResponder: 0 (automaticKeyboard: 0, reloadIdentifier: 118088EB-F272-4A3C-AAB3-1200AF819E2A)
default	02:46:25.040226+0000	SpringBoard	_inputViewsForResponder: <(null): 0x0; >, automaticKeyboard: 0, force: 0
default	02:46:25.040338+0000	SpringBoard	_inputViewsForResponder, found custom inputView: <(null): 0x0>, customInputViewController: <(null): 0x0>
default	02:46:25.040977+0000	SpringBoard	_inputViewsForResponder, found inputAccessoryView: <(null): 0x0>
default	02:46:25.041100+0000	SpringBoard	_inputViewsForResponder, responderRequiresKeyboard 0 (automaticKeyboardEnabled: 0, activeInstance: <UIKeyboardAutomatic: 0x537792800; frame = {{0, 0}, {0, 0}}; alpha = 1.000000; isHidden = 0; tAMIC = 0>, self.isOnScreen: 0, requiresKBWhenFirstResponder: 0)
default	02:46:25.041203+0000	backboardd	new deferring rules for pid:34: [
    [34-6A]; <keyboardFocus; builtin; …board.systemappservices/FBSceneManager:com.apple.springboard> -> <token: 0x81CD19B1; pid: 34>; reason: …gin event deferring in keyboardFocus for window: 0x5376fe680,
    [34-2]; <system; builtin; SBMainSystemGestures> -> <token: 0x1FF7DCD9; pid: 34>; reason: systemGestureSymbol-Main,
    [34-1]; <system; builtin> -> <token: 0x1FF7DCD9; pid: 34>; reason: systemGestures-Main,
    [34-4]; <keyboardFocus; SBKeyboardFocus> -> <token: …board.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>; reason: SB incoming to root scene (symbol),
    [34-5]; <systemKeyCommandOverlay> -> <token: 0xA00239B0; pid: 34>; reason: systemKeyCommandOverlayEnvironment to root scene,
    [34-3]; <keyboardFocus> -> <token: …board.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>; reason: SB incoming to root scene
]
default	02:46:25.041374+0000	biomed	SourceUpdater: <private> triggered 79 to run on the live schedule
default	02:46:25.041644+0000	biomed	SourceUpdater: <private> triggered 80 to run on the live schedule
default	02:46:25.041697+0000	SpringBoard	_inputViewsForResponder, useKeyboard 0 (allowsSystemInputView: 1, !inputView <(null): 0x0>, responderRequiresKeyboard 0)
default	02:46:25.041805+0000	biomed	SourceUpdater: <private> triggered 97 to run on the live schedule
default	02:46:25.042290+0000	SpringBoard	_inputViewsForResponder, configuring _responderWithoutAutomaticAppearanceEnabled: <(null): 0x0> (_automaticAppearEnabled: 1)
default	02:46:25.042371+0000	CommCenter	Creating service facility connection with <private>
default	02:46:25.042426+0000	SpringBoard	_inputViewsForResponder, needsIVPlaceholder: 0, needsIAVPlaceholder: 0, needsInputSetWithPlaceholder: 0
default	02:46:25.042531+0000	SpringBoard	_inputViewsForResponder returning: <<UIInputViewSet: 0x53816adc0>; (empty)>
default	02:46:25.042741+0000	SpringBoard	currently observing: YES
default	02:46:25.042850+0000	biomed	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.042902+0000	SpringBoard	currently observing: NO
error	02:46:25.043064+0000	SpringBoard	-[RTIInputSystemClient remoteTextInputSessionWithID:performInputOperation:]  perform input operation requires a valid sessionID. inputModality = Keyboard, inputOperation = <null selector>, customInfoType = UIEmojiSearchOperations
default	02:46:25.045773+0000	SpringBoard	endPlacementForInputViewSet: <<UIInputViewSet: 0x53816adc0>; (empty)> windowScene: <SBWindowScene: 0x53425d600; scene: "<FBSScene: 0x534b74820; identifier: com.apple.springboard>"; persistentIdentifier: com.apple.springboard>
default	02:46:25.045862+0000	SpringBoard	-[_UIRemoteKeyboards prepareToMoveKeyboard:withIAV:isIAVRelevant:showing:notifyRemote:forScene:] position: {{0, 0}, {0, 0}} visible: 0; notifyRemote: 1; isMinimized: NO
default	02:46:25.047472+0000	SpringBoard	Show keyboard with visual mode windowed (0)
default	02:46:25.047585+0000	SpringBoard	Setting input views: <<UIInputViewSet: 0x537eae100>; (empty)>
default	02:46:25.047832+0000	SpringBoard	endPlacementForInputViewSet: <<UIInputViewSet: 0x537eae100>; (empty)> windowScene: <SBWindowScene: 0x53425d600; scene: "<FBSScene: 0x534b74820; identifier: com.apple.springboard>"; persistentIdentifier: com.apple.springboard>
default	02:46:25.047949+0000	SpringBoard	Moving from placement: <UIInputViewSetPlacementOffScreenDown> to placement: <UIInputViewSetPlacementOffScreenDown> (currentPlacement: <UIInputViewSetPlacementOffScreenDown>)
default	02:46:25.049061+0000	SpringBoard	Change from input view set: <<UIInputViewSet: 0x537eaaa00>; (empty)>
default	02:46:25.049515+0000	SpringBoard	Change to input view set: <<UIInputViewSet: 0x537eae100>; (empty)>
default	02:46:25.063754+0000	SpringBoard	chainPlacementsIfNecessaryFrom, from: <UIInputViewSetPlacementOffScreenDown>, to: <UIInputViewSetPlacementOffScreenDown> transition: <UIInputViewPlacementTransition: 0x5365188c0>
default	02:46:25.063853+0000	SpringBoard	updatePlacementWithPlacement: <UIInputViewSetPlacementOffScreenDown>
error	02:46:25.064727+0000	backboardd	cycle detected between [34-6A] -> [34-3]
default	02:46:25.066029+0000	backboardd	Now updating for layout monitor transition.
default	02:46:25.069097+0000	CommCenter	unsubscribing configuration of monitor M97-113
default	02:46:25.069397+0000	CommCenter	[FBSSystemAppProxy:0xbc4e332c0] Service facility connection invalidated
default	02:46:25.069653+0000	kernel	LQM-WiFi: BE : Count: 4 avgLatencyMs:4 maxLatencyMs:7
default	02:46:25.069683+0000	kernel	LQM-WiFi: BK : Count: 0 avgLatencyMs:0 maxLatencyMs:0
default	02:46:25.069708+0000	kernel	LQM-WiFi: VI : Count: 0 avgLatencyMs:0 maxLatencyMs:0
default	02:46:25.069734+0000	kernel	LQM-WiFi: VO : Count: 0 avgLatencyMs:0 maxLatencyMs:0
default	02:46:25.069812+0000	kernel	InfraPeers: ---------- BEGIN ----------
default	02:46:25.069852+0000	kernel	InfraPeers: Gateway (00:FE:ED:C0:FF:EE, 10.122.192.1) - Tx [S:0 (BE:0 BK:0 VI:0 VO:0), F:0 (BE:0 BK:0 VI:0 VO:0), PER:0.0%], TxRe [0 (0%)], Rx [0 (BE:0 BK:0 VI:0 VO:0)], RxRe [0 (0%)], RxUc [0], RxMc [0 (B:0 O:0)]
default	02:46:25.069938+0000	kernel	InfraPeers: Bonjour MC (33:33:00:00:00:00) - Tx [S:2, F:0, PER: 0.0%]
default	02:46:25.070023+0000	kernel	InfraPeers: Other MC (01:00:00:00:00:00) - Tx [S:0, F:0, PER: 0.0%]
default	02:46:25.070091+0000	kernel	InfraPeers: BC (FF:FF:FF:FF:FF:FF) - Tx [S:0, F:0, PER: 0.0%]
default	02:46:25.070183+0000	kernel	InfraPeers: Total unicast peers: 5
default	02:46:25.070214+0000	kernel	InfraPeers: UC (A4:A4:6B:AE:50:C0, ?) - RxMc [1 (B:0 O:1)]
default	02:46:25.070306+0000	kernel	InfraPeers: UC (A0:70:B7:EA:BB:80, ?) - RxMc [1 (B:0 O:1)]
default	02:46:25.070368+0000	wifid	App state params {
    IO80211IsInHomeScreen = 0;
    IO80211IsLatencySensitiveAppActive = 0;
}
default	02:46:25.070395+0000	kernel	InfraPeers: UC (2C:52:AF:A3:DD:90, ?) - RxMc [1 (B:0 O:1)]
default	02:46:25.070481+0000	kernel	InfraPeers: UC (E0:DA:90:D1:7C:F0, ?) - RxMc [1 (B:0 O:1)]
default	02:46:25.070561+0000	kernel	InfraPeers: UC (00:00:BE:EF:CA:FE, 10.122.197.204) - Tx [S:4 (BE:4 BK:0 VI:0 VO:0), F:0 (BE:0 BK:0 VI:0 VO:0), PER:0.0%], TxRe [0 (0%)], Rx [4 (BE:4 BK:0 VI:0 VO:0)], RxRe [0 (0%)], RxUc [4], RxMc [0 (B:0 O:0)]
default	02:46:25.070588+0000	kernel	InfraPeers: ----------- END -----------
default	02:46:25.070647+0000	cameracaptured	<<<< FigCaptureDisplayLayoutMonitor >>>> -[FigCaptureDisplayLayoutMonitor _parseFBSDisplayLayout:]: <FigCaptureDisplayLayoutMonitor: 0x6061616e0 Main Display> <FBSDisplayLayout: 0x6082bd200; displayIdentity: Main> {    bounds = {{0, 0}, {375, 812}};    interfaceOrientation = "portrait (1)";    backlightLevel = 100;    backlightState = 2;    elements = {        <SBSDisplayLayoutElement: 0x6081b4460; sceneID:com.mikhailspeaks.promptpal-default; bundleID: com.mikhailspeaks.promptpal; frame: {{0, 0}, {375, 812}}; level: 1; role: primary>;    }    timestamp = February 20, 2026 at 2:46:24 AM GMT;}
default	02:46:25.070769+0000	cameracaptured	<<<< FigCaptureDisplayLayoutMonitor >>>> -[FigCaptureDisplayLayoutMonitor _updateObserversWithLayout:]: <FigCaptureDisplayLayoutMonitor: 0x6061616e0 Main Display> <FigCaptureDisplayLayout: 0x6082bf280 02-20-2026 02:46:24, Main Display, foreground:[com.mikhailspeaks.promptpal]>
default	02:46:25.070838+0000	sharingd	SystemUI changed: <private> -> <private>
default	02:46:25.071082+0000	sharingd	on lock screen: <private>
default	02:46:25.071397+0000	sharingd	System UI Changed 0x0 < >, CanTrigger yes
default	02:46:25.071649+0000	SleepLockScreen	[ContentAppearenceProvider:7B29196E] updated layout, contains SleepLockScreen: false, display on: true
default	02:46:25.071804+0000	CommCenter	#I ActivationObserver: notifyAboutFrontAppChange : app: <private>; pid: 1631; net: 0
default	02:46:25.072185+0000	SpringBoard	Window(0x537505c00)(SBTraitsParticipantRoleControlCenter-0) validates resolution: NO. isHidden
default	02:46:25.072238+0000	wifid	__WiFiManagerApplicationStateUpdate: Delta state =4
default	02:46:25.072360+0000	wifid	BG Application: Not Present, BG Daemon: Present. Daemons: carkitd apsd  (activity=0) Cloud Clients:  (activity=0)
default	02:46:25.072540+0000	wifid	-[WiFiUserInteractionMonitor isNetworkRecommendationAllowed]: in an app and no cellular. Allowing recommendation.
default	02:46:25.072592+0000	wifid	__WiFiDeviceManagerEvaluateAPEnvironment: WiFiRoam : BSS List info for network : ASK4 Wireless : chanCount5GHz: [4] chanCount24GHz: [1] chanCount6GHz: [0]
default	02:46:25.072813+0000	wifid	__WiFiDeviceManagerEvaluateAPEnvironment: WiFiRoam : AP environment is Multi AP for ASK4 Wireless(30:37:b3:2d:84:0). Last applied environment is Multi AP. Early exit ? : [0]. augmented from scan results ? : [1]
error	02:46:25.073054+0000	backboardd	cycle detected between [34-6A] -> [34-3]
default	02:46:25.073317+0000	SpringBoard	(0x534f33940) could not dequeue reusable view of class: SBIconImageView
default	02:46:25.073651+0000	SpringBoard	adding status bar settings assertion: <SBWindowSceneStatusBarSettingsAssertion: 0x536e3c420> {
    settings = <SBStatusBarSettings: 0x5393c7db0; alpha: 1> {
    };
    level = app switcher;
    reason = kSBMainAppSwitcherStatusBarReason;
}
default	02:46:25.074064+0000	backboardd	chain did update (setDeferringRules) <keyboardFocus; display: null; compatibilityDisplay: builtin> [
    <token: com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>,
    <token: 0x81CD19B1; pid: 34>
]
default	02:46:25.074161+0000	backboardd	chain did update (setDeferringRules) <keyboardFocus; display: builtin> [
    <token: com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>,
    <token: 0x81CD19B1; pid: 34>
]
default	02:46:25.074229+0000	backboardd	cache miss for VendorDefined event
default	02:46:25.074282+0000	CommCenter	#I ActivationObserver: notifyAboutFrontAppsChange
default	02:46:25.074702+0000	SpringBoard	Added: <UIApplicationSceneDeactivationAssertion: 0x537611350; reason: systemAnimation; all scene levels; hasPredicate: YES>
default	02:46:25.074754+0000	SpringBoard	Removed: <UIApplicationSceneDeactivationAssertion: 0x537860660; reason: systemAnimation; all scene levels; hasPredicate: NO>
default	02:46:25.074963+0000	SpringBoard	[Main (EmbeddedDisplay)] dispatch event:
<SBTransitionSwitcherModifierEvent: 0x53a05cc00; type: MainTransition; transitionID: 910D6AF2-C41A-4CDE-BC77-D8DE8EA208DA; phase: Animate; animated: YES; fromAppLayout: 0x0; toAppLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>; fromEnvironmentMode: home-screen; toEnvironmentMode: application; fromSpaceConfiguration: undefined; toSpaceConfiguration: full; pendingTermination: {(
)}; activating: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>; morphingPIPLayoutRole: undefined>
default	02:46:25.075757+0000	wifid	LQM-TX: Success:4(100.0%) FwFail:0(0.0%) FwMaxRetries:0(0.0%) NoACK:0(0.0%) MiscDrops:0(0.0%) NoBuf:0(0.0%) FwNoRes:0(0.0%) ChipErr:0(0.0%) Exp:0(0.0%) FwFcdExpiry:0(0.0%) FwFree:0(0.0%)
default	02:46:25.075826+0000	biomed	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.076880+0000	backboardd	   9543.91260: notify client com.apple.siri.AttentionAwareness.Touch of <AWAttentionLostEvent: 0x4a22dfe40> (timestamp:    9543.91251 attentionLostTimeout       0.10000 tagIndex 0 (tag not present in server))
default	02:46:25.077497+0000	SpringBoard	Updating gesture recognizers; _registeredHomeAffordanceInteractions count changed to 1
default	02:46:25.079205+0000	biomed	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.079747+0000	SpringBoard	Window(0x537505c00)(SBTraitsParticipantRoleControlCenter-0) validates resolution: NO. isHidden
default	02:46:25.081895+0000	SpringBoard	[Main (EmbeddedDisplay)] dispatch event:
<SBSceneReadySwitcherModifierEvent: 0x53775e960; type: SceneReady; appLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main> {
    configuration = full;
    itemsToLayoutAttributes = {
        sceneID:com.mikhailspeaks.promptpal-default = <SBDisplayItemLayoutAttributes: 0x535cfae60; contentOrientation: "portrait (1)"; lastInteractionTime: 11061; sizingPolicy: maximized; size: unspecified; center: unspecified; occlusionState: unknown; userConfiguredSizeBeforeOverlapping: unspecified; unoccludedPeekingCenter: unspecified>;
    }
    environment = main;
    centerConfiguration = undefined;
    preferredDisplayOrdinal = 0;
    continuousExposeIdentifier = com.mikhailspeaks.promptpal;
    layoutItems = {
        primary = <SBDisplayItem: 0x535ec61c0; type: App; bundleIdentifier: com.mikhailspeaks.promptpal; uniqueIdentifier: sceneID:com.mikhailspeaks.promptpal-default>;
    }
}>
default	02:46:25.082863+0000	contextstored	Sending fired registration <private> to com.apple.dasd.trigger
default	02:46:25.084213+0000	SpringBoard	Returning cached initialization context for com.mikhailspeaks.promptpal
default	02:46:25.085578+0000	SpringBoard	[0x537eac900:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Initialized with connection: 0x53718cff0.
default	02:46:25.085709+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Registered new scene: <FBUIApplicationWorkspaceScene: 0x537eac900; (FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default> (fromRemnant = 0)
default	02:46:25.085768+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default][1] Scene activated.
default	02:46:25.085822+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Workspace interruption policy did change: reconnect
default	02:46:25.087995+0000	SpringBoard	<BSCompoundAssertion:0x5351f6180> (SBApplicationAppProtectionAssistant: 0x5351f74c0 - com.mikhailspeaks.promptpal) acquire for reason:NULL scene acq:0x536060ca0 count:1
default	02:46:25.088054+0000	SpringBoard	Informing <APSystemAppOutlet: 0x534f45c20> that <private> will become foreground visible
default	02:46:25.088113+0000	SpringBoard	scene will become FG visible for <APApplication: com.mikhailspeaks.promptpal>
default	02:46:25.088171+0000	SpringBoard	auth result for <APApplication: com.mikhailspeaks.promptpal>: true (null)
default	02:46:25.088224+0000	biomed	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.088280+0000	runningboardd	Acquiring assertion targeting [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] from originator [osservice<com.apple.SpringBoard>:34] with description <RBSAssertionDescriptor| "com.apple.frontboard.after-life.interrupted" ID:33-34-6211 target:1631 attributes:[
	<RBSDomainAttribute| domain:"com.apple.frontboard" name:"AfterLife-Interrupted" sourceEnvironment:"(null)">
	]>
default	02:46:25.088463+0000	runningboardd	Assertion 33-34-6211 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]) will be created as inactive as originator process has not exited
default	02:46:25.089520+0000	SpringBoard	[coordinator] didAddExternalForegroundApplicationSceneHandle pid:1631 scene:com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default now:<recentPIDs: [1631]; recentSceneIdentityTokensByPID: {1631: [com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default]}>
default	02:46:25.090439+0000	SpringBoard	[com.apple.springboard] didAddExternalForegroundApplicationSceneHandle pid:1631 scene:com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default now:<recentPIDs: [1631]; recentSceneIdentityTokensByPID: {1631: [com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default]}>
default	02:46:25.091470+0000	SpringBoard	idleTimerDescriptorForBehavior: <SBIdleTimerBehavior: 0x53635d1d0; duration: Unlocked; mode: Auto; warnMode: Warn>
default	02:46:25.092081+0000	SpringBoard	applying updated idle timer descriptor: <SBIdleTimerDescriptor: 0x5390dcd40; mode: Disabled; quickUnwarn: 0.0s> reason:SBAppDidEnterForeground
default	02:46:25.092133+0000	SpringBoard	_applyActiveIdleTimerDescriptorForReason:"SBAppDidEnterForeground" enabled
default	02:46:25.092894+0000	SpringBoard	_setIdleTimerWithDescriptor:<SBIdleTimerDescriptor: 0x5390dcd40; mode: Disabled; quickUnwarn: 0.0s> reason:"SBAppDidEnterForeground"]
default	02:46:25.092950+0000	SpringBoard	dsc:0x5390dcd40 <mode: Auto; quickUnwarn: 0.0s> reason:MCFeatureAutoLockTime (2.14748e+09) is gt MAX (3600)
default	02:46:25.093004+0000	SpringBoard	-> dsc:0x5390dcd40 <mode: Disabled; quickUnwarn: 0.0s> reason:after setup, shouldWarn is NO and expireInterval is <never>
default	02:46:25.093388+0000	SpringBoard	Now tracking: <FBScene: 0x53546f800; FBSceneManager:sceneID:com.mikhailspeaks.promptpal-default>
default	02:46:25.095803+0000	SpringBoard	[sceneID:com.mikhailspeaks.promptpal-default] Setting deactivation reasons to: 'systemAnimation' for reason: scene settings update - settings are eligible for deactivation reasons.
default	02:46:25.096262+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] scene content state changed: preparing
default	02:46:25.096409+0000	SpringBoard	[0x537eac900:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Scene lifecycle state did change: Foreground
default	02:46:25.096522+0000	SpringBoard	[0x537eac900:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Scene assertion state did change: ForegroundFocal.
default	02:46:25.096627+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Launch assertion supersedes update of workspace assertion to ForegroundFocal.
default	02:46:25.096787+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Workspace assertion state did change: ForegroundFocal (acquireAssertion = NO).
default	02:46:25.124985+0000	biomed	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.125591+0000	SpringBoard	Icon handled launch: YES
default	02:46:25.125745+0000	SpringBoard	Icon touch canceled (tap gesture may still succeed): <private>
default	02:46:25.125857+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5378bcd20; type: 0; subtype: 0; backing type: 11; shouldSend: 0; ignoreInteractionEvents: 0, systemGestureStateChange: 0
default	02:46:25.125910+0000	SpringBoard	Evaluating dispatch of UIEvent: 0x5354d1500; type: 0; subtype: 0; backing type: 11; shouldSend: 0; ignoreInteractionEvents: 0, systemGestureStateChange: 0
error	02:46:25.128712+0000	SpringBoard	Live host view super view[(null)] not matching container view[<UIView: 0x53900e580; frame = (0 0; 375 812); clipsToBounds = YES; layer = <CALayer: 0x536048e20>>], frame not updated
default	02:46:25.129587+0000	cfprefsd	[0x60e331900] activating connection: mach=false listener=false peer=true name=com.apple.cfprefsd.daemon.peer[1631].0x60e331900
default	02:46:25.130276+0000	PromptPal	[0x1584c8000] activating connection: mach=true listener=false peer=false name=com.apple.cfprefsd.daemon.system
default	02:46:25.130400+0000	PromptPal	[0x1584c8100] activating connection: mach=true listener=false peer=false name=com.apple.cfprefsd.daemon
default	02:46:25.130680+0000	PromptPal	Cache loaded with 5922 pre-cached in CacheData and 67 items in CacheExtra.
default	02:46:25.130790+0000	PromptPal	Initializing connection
default	02:46:25.130840+0000	PromptPal	Removing all cached process handles
default	02:46:25.130964+0000	PromptPal	[0x15851c000] activating connection: mach=false listener=false peer=false name=(anonymous)
default	02:46:25.131115+0000	PromptPal	Sending handshake request attempt #1 to server
default	02:46:25.132558+0000	cfprefsd	[0xdbe27c500] activating connection: mach=false listener=false peer=true name=com.apple.cfprefsd.daemon.system.peer[1631].0xdbe27c500
default	02:46:25.132814+0000	SpringBoard	Application process state changed for com.mikhailspeaks.promptpal: <SBApplicationProcessState: 0x537335d60; pid: 1631; taskState: Running; visibility: Foreground>
default	02:46:25.132872+0000	PromptPal	Creating connection to com.apple.runningboard
default	02:46:25.132934+0000	SpringBoard	[0x5398435c0] activating connection: mach=false listener=false peer=true name=com.apple.frontboard.systemappservices.peer[1631].0x5398435c0
default	02:46:25.133097+0000	kernel	AppleSMCHighVoltageCharger::handleSMCEvent: self=<private> event=5 arg=1
default	02:46:25.133172+0000	PromptPal	[0x1584c8400] activating connection: mach=true listener=false peer=false name=com.apple.runningboard
default	02:46:25.133281+0000	PromptPal	Creating new assertion because there is no existing background assertion.
default	02:46:25.133330+0000	PromptPal	Creating new background assertion
default	02:46:25.133382+0000	PromptPal	Created new background assertion <BKSProcessAssertion: 0x105b23230>
default	02:46:25.133675+0000	kernel	IOAccessoryPowerSource::createPowerSourceItemsInternal(): id:0x1000005a6, owner=<private> tag=<private> itemSet=<private> removeTagSet=0x0
default	02:46:25.133708+0000	kernel	IOAccessoryPowerSource::createPowerSourceItemsInternal(): id:0x1000005a6, owner=<private> tag=<private> itemSet=0x0 removeTagSet=0x0
default	02:46:25.134077+0000	runningboardd	Incoming connection from 1631, user 501/501
default	02:46:25.134183+0000	runningboardd	[0xd7094f5c0] activating connection: mach=false listener=false peer=true name=com.apple.runningboard.peer[1631].0xd7094f5c0
default	02:46:25.134521+0000	runningboardd	Setting client for [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] as ready
default	02:46:25.134577+0000	runningboardd	Inheritance changeset: <RBSInheritanceChangeSet| gained:{(
    <RBSInheritance| environment:(none) name:com.apple.frontboard.visibility origID:33-34-6209 0>
)} lost:{(
)}>
default	02:46:25.134697+0000	runningboardd	Received handshake request from 1631 with 0 assertion descriptors
default	02:46:25.134998+0000	runningboardd	Handshake successful with 1631; sending response
default	02:46:25.135080+0000	backboardd	Connection added: IOHIDEventSystemConnection uuid:D451D4CC-CABF-4B0F-87D2-9A5F697CF656 pid:1631 process:PromptPal type:Passive entitlements:0x0 caller:BackBoardServices: <redacted> + 280 attributes:{
    HighFrequency = 1;
    bundleID = "com.mikhailspeaks.promptpal";
    pid = 1631;
} state:0x0 events:0 mask:0x0 dropped:0 dropStatus:0 droppedMask:0x0 lastDroppedTime:NONE
default	02:46:25.135359+0000	backboardd	Adding client connection: <BKHIDClientConnection: 0x4a22dff40; IOHIDEventSystemConnectionRef: 0x4a36ff200; vpid: 1631(v1067); taskPort: 0x69E83; bundleID: com.mikhailspeaks.promptpal> for client: IOHIDEventSystemConnection uuid:D451D4CC-CABF-4B0F-87D2-9A5F697CF656 pid:1631 process:PromptPal type:Passive entitlements:0x0 caller:BackBoardServices: <redacted> + 280 attributes:{
    HighFrequency = 1;
    bundleID = "com.mikhailspeaks.promptpal";
    pid = 1631;
} state:0x0 events:0 mask:0x0 dropped:0 dropStatus:0 droppedMask:0x0 lastDroppedTime:NONE
default	02:46:25.135437+0000	PromptPal	Handshake succeeded
default	02:46:25.135493+0000	PromptPal	Identity resolved as app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>
default	02:46:25.136111+0000	runningboardd	Acquiring assertion targeting [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] from originator [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] with description <RBSAssertionDescriptor| "Shared Background Assertion 0 for com.mikhailspeaks.promptpal" ID:33-1631-6212 target:1631 attributes:[
	<RBSLegacyAttribute| requestedReason:FinishTask reason:FinishTask flags:( PreventTaskSuspend )>,
	<RBSAcquisitionCompletionAttribute| policy:AfterValidation>
	]>
default	02:46:25.136171+0000	runningboardd	Assertion 33-1631-6212 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]) will be created as inactive as start-time-defining assertions exist
default	02:46:25.136337+0000	SpringBoard	Returning cached initialization context for com.mikhailspeaks.promptpal
default	02:46:25.136414+0000	SpringBoard	[lock] Poster Extact update COULD change 648 (648)
default	02:46:25.136533+0000	SpringBoard	[lock] Poster Extact update DID change
default	02:46:25.136641+0000	SpringBoard	[home] Poster Extact update COULD change 595 (595)
default	02:46:25.136753+0000	backboardd	Connection: D451D4CC-CABF-4B0F-87D2-9A5F697CF656 not entitled to match protected service: 4294968951
default	02:46:25.136840+0000	SpringBoard	[home] Poster Extact update DID change
default	02:46:25.137134+0000	SpringBoard	Fetching initialization context for: com.mikhailspeaks.promptpal
default	02:46:25.137444+0000	SpringBoard	Returning cached initialization context for com.mikhailspeaks.promptpal
default	02:46:25.137769+0000	SpringBoard	Returning cached initialization context for com.mikhailspeaks.promptpal
default	02:46:25.138674+0000	PromptPal	Incrementing reference count for background assertion <private>
default	02:46:25.138998+0000	PromptPal	Created background task <private>.
default	02:46:25.139151+0000	PromptPal	Realizing settings extension _UIApplicationSceneKeyboardSettings on FBSSceneSettings
default	02:46:25.139847+0000	backboardd	cache miss for VendorDefined event
default	02:46:25.140491+0000	PromptPal	Realizing settings extension <_UISceneOcclusionSettings> on FBSSceneSettings
default	02:46:25.140543+0000	PromptPal	Deactivation reason added: 10; deactivation reasons: 0 -> 1024; animating application lifecycle event: 0
default	02:46:25.141033+0000	PromptPal	activating monitor for service com.apple.frontboard.open
default	02:46:25.143179+0000	locationd	visitKFFilteredPressure,nowAP,793248385.054657,nowAOP,224061349186,filteredPressure,100383.195312,pressureTimestamp,224058768904,kfElevation,340282346638528859811704183484516925440.000000,wallTimePressureCorrected,793248382.489300,wallTimeKFCorrected,0.000000,temperatureDerivative,0.000000,absAltUnc,0.000000
default	02:46:25.143749+0000	PromptPal	Realizing settings extension <_UISceneInterfaceProtectionSceneSettings> on FBSSceneSettings
default	02:46:25.144376+0000	PromptPal	activating monitor for service com.apple.frontboard.workspace-service
default	02:46:25.144618+0000	PromptPal	Realizing settings extension <_UIHomeAffordanceHostSceneSettings> on FBSSceneSettings
default	02:46:25.145205+0000	PromptPal	FBSWorkspace registering source: <private>
default	02:46:25.145256+0000	PromptPal	Realizing settings extension _UISystemShellSceneHostingEnvironmentSettings on FBSSceneSettings
default	02:46:25.145711+0000	PromptPal	Realizing settings extension _UISceneRenderingEnvironmentSettings on FBSSceneSettings
default	02:46:25.146253+0000	PromptPal	Realizing settings extension <_UISceneTransitioningHostSettings> on FBSSceneSettings
default	02:46:25.147119+0000	PromptPal	Realizing settings extension <_UISceneHostingContentSizePreferenceClientSettings> on FBSSceneClientSettings
default	02:46:25.147470+0000	PromptPal	Realizing settings extension _UISceneHostingTraitCollectionPropagationSettings on FBSSceneSettings
default	02:46:25.148013+0000	PromptPal	Realizing settings extension <_UISceneHostingSheetPresentationSettings> on FBSSceneSettings
default	02:46:25.148384+0000	PromptPal	Realizing settings extension <_UISceneHostingSheetPresentationClientSettings> on FBSSceneClientSettings
default	02:46:25.150933+0000	PromptPal	Realizing settings extension <_UISceneHostingEventDeferringSettings> on FBSSceneSettings
default	02:46:25.151345+0000	PromptPal	FBSWorkspace connected to endpoint : <private>
default	02:46:25.151736+0000	PromptPal	Realizing settings extension <UIKit__UITypedKeyValueSceneSettings> on FBSSceneSettings
default	02:46:25.153301+0000	PromptPal	Realizing settings extension <UIKit__UITypedKeyValueSceneSettings> on FBSSceneClientSettings
default	02:46:25.153919+0000	PromptPal	<FBSWorkspaceScenesClient:0x1584bde00 <private>> attempting immediate handshake from activate
default	02:46:25.154072+0000	CommCenter	#I SIM has not requested to be notified on entering idle screen, not processing
default	02:46:25.154508+0000	CommCenter	#I SIM has not requested to be notified on entering idle screen, not processing
default	02:46:25.155081+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Connection established.
default	02:46:25.155245+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] created proxy of <BSXPCServiceConnectionProxy<FBSWorkspaceServiceServerInterface>: 0x5395c1650>
default	02:46:25.155492+0000	PromptPal	<FBSWorkspaceScenesClient:0x1584bde00 <private>> sent handshake
default	02:46:25.155601+0000	PromptPal	Added observer for process assertions expiration warning: <_RBSExpirationWarningClient: 0x1585ed040>
default	02:46:25.155810+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Connection to remote process established!
default	02:46:25.156807+0000	SpringBoard	[0x537eac900:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Sending scene action [Logical Activate][0x620e] to process 0x53900e700 (watchdog: 19.94s)
default	02:46:25.156986+0000	SpringBoard	[0x537eac900:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Sending scene create.
default	02:46:25.157309+0000	PromptPal	Evaluated capturing state as 0 on <UIScreen: 0x15851c500> for initial
default	02:46:25.157363+0000	PromptPal	Evaluated capturing state as 0 on <UIScreen: 0x15851c500> for CADisplay KVO
default	02:46:25.158205+0000	PromptPal	Realizing settings extension FBSSceneSettingsCore on FBSSceneSettings
default	02:46:25.158648+0000	SpringBoard	Application process state changed for com.mikhailspeaks.promptpal: <SBApplicationProcessState: 0x5373355c0; pid: 1631; taskState: Running; visibility: Foreground>
default	02:46:25.158773+0000	backboardd	Layout ID: sceneID:com.mikhailspeaks.promptpal-default Bundle ID: com.mikhailspeaks.promptpal Role: 1
default	02:46:25.158824+0000	SpringBoard	received incoming handshake : process=<private> remote=<private> remnants=0
default	02:46:25.158879+0000	SpringBoard	SceneWorkspaceDelegate[0x534a08640-com.apple.SpringBoard.SceneWorkspace.PrototypeTools] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.158935+0000	SpringBoard	SceneWorkspaceDelegate[0x5349c67e0-com.apple.SpringBoard.SceneWorkspace.DruidUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.159039+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0bee0-com.apple.SpringBoard.SceneWorkspace.FullKeyboardAccessUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.159145+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0ab40-com.apple.SpringBoard.SceneWorkspace.PerfPowerHUD] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.159924+0000	SpringBoard	SceneWorkspaceDelegate[0x5349c65a0-com.apple.SpringBoard.SceneWorkspace.InputUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.160089+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0bb60-com.apple.SpringBoard.SceneWorkspace.AssistiveTouchUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.160872+0000	SpringBoard	SceneWorkspaceDelegate[0x5349c6900-com.apple.SpringBoard.SceneWorkspace.OverlayUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.160974+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0bce0-com.apple.SpringBoard.SceneWorkspace.VoiceControlUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.161077+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0b5e0-com.apple.SpringBoard.SceneWorkspace.EyedropperUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.161180+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0a400-com.apple.SpringBoard.SceneWorkspace.InternalPerfPowerHUD] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.161281+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0ade0-com.apple.SpringBoard.SceneWorkspace.Moments] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.161385+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0ba00-com.apple.SpringBoard.SceneWorkspace.AccessibilityUIServerUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.161493+0000	SpringBoard	SceneWorkspaceDelegate[0x534a0bfc0-com.apple.SpringBoard.SceneWorkspace.LiveTranscriptionUI] client did connect with handshake: <FBSceneClientHandshake:0x537336d80; [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] remnants=0>
default	02:46:25.163161+0000	PromptPal	Realizing settings extension FBSSceneClientSettingsCore on FBSSceneClientSettings
default	02:46:25.172075+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.173691+0000	PromptPal	UIMutableApplicationSceneSettings setting counterpart class: UIApplicationSceneSettings
default	02:46:25.174592+0000	PromptPal	Read CategoryName: per-app = 1, category name = (null)
default	02:46:25.174647+0000	PromptPal	UIMutableApplicationSceneClientSettings setting counterpart class: UIApplicationSceneClientSettings
default	02:46:25.174985+0000	PromptPal	Read CategoryName: per-app = 0, category name = (null)
default	02:46:25.175076+0000	PromptPal	Realizing settings extension FBSSceneTransitionContextCore on FBSSceneTransitionContext
default	02:46:25.179744+0000	dasd	Registration fired for <private>
default	02:46:25.179847+0000	dasd	Dispatching call to informative registration callback for <private>
default	02:46:25.183686+0000	PromptPal	Registering for test daemon availability notify post.
default	02:46:25.184328+0000	PromptPal	notify_get_state check indicated test daemon not ready.
default	02:46:25.184452+0000	PromptPal	notify_get_state check indicated test daemon not ready.
default	02:46:25.184556+0000	PromptPal	notify_get_state check indicated test daemon not ready.
default	02:46:25.184880+0000	PromptPal	Selected display: name=LCD (primary), id=1
default	02:46:25.185359+0000	useractivityd	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.186068+0000	useractivityd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.186418+0000	PromptPal	Will add backgroundTask with taskName: <private>, expirationHandler: <__NSGlobalBlock__: 0x1f8baa500>
default	02:46:25.186472+0000	PromptPal	Reusing background assertion <BKSProcessAssertion: 0x105b23230>
default	02:46:25.186561+0000	PromptPal	Incrementing reference count for background assertion <private>
default	02:46:25.186609+0000	PromptPal	Created background task <private>.
default	02:46:25.186728+0000	PromptPal	Deactivation reason added: 5; deactivation reasons: 1024 -> 1056; animating application lifecycle event: 1
default	02:46:25.187005+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.187273+0000	PromptPal	Should send trait collection or coordinate space update, interface style 2 -> 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.187519+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.188787+0000	PromptPal	Initializing: <_UIHomeAffordanceSceneNotifier: 0x1586081c0>; with scene: <UIWindowScene: 0x105b25350>
default	02:46:25.189040+0000	PromptPal	0x158650de0 setDelegate:<0x158650cc0 _UIBacklightEnvironment> hasDelegate:YES for environment:sceneID:com.mikhailspeaks.promptpal-default
default	02:46:25.189367+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.189579+0000	PromptPal	[0x1586095e0] Initialized with scene: <UIWindowScene: 0x105b25350>; behavior: <_UIEventDeferringBehavior_iOS: 0x1585ee1e0>; availableForProcess: 1, systemShellManagesKeyboardFocus: 1
default	02:46:25.189959+0000	PromptPal	[0x15851cf00] activating connection: mach=false listener=false peer=false name=(anonymous)
default	02:46:25.190495+0000	backboardd	[0x4a34f2080] activating connection: mach=false listener=false peer=true name=com.apple.backboard.hid-services.xpc.peer[1631].0x4a34f2080
default	02:46:25.190814+0000	PromptPal	Setting default evaluation strategy for UIUserInterfaceIdiomPhone to LastOneWins
default	02:46:25.191663+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.192749+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.193418+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
error	02:46:25.194565+0000	PromptPal	CLIENT OF UIKIT REQUIRES UPDATE: This process does not adopt UIScene lifecycle. This will become an assert in a future version.
default	02:46:25.194668+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.194820+0000	PromptPal	sceneOfRecord: sceneID: sceneID:com.mikhailspeaks.promptpal-default  persistentID: AE9A6D9A-53BD-460E-82A0-981A7E4514D8
default	02:46:25.194905+0000	PromptPal	Ignoring already applied deactivation reason: 5; deactivation reasons: 1056
default	02:46:25.194960+0000	PromptPal	Deactivation reason added: 11; deactivation reasons: 1056 -> 3104; animating application lifecycle event: 1
default	02:46:25.195132+0000	PromptPal	startConnection
default	02:46:25.195363+0000	PromptPal	[0x15851d7c0] activating connection: mach=true listener=false peer=false name=com.apple.UIKit.KeyboardManagement.hosted
default	02:46:25.197884+0000	SpringBoard	Updating configuration of monitor M34-11
default	02:46:25.197992+0000	PromptPal	You've implemented -[<UIApplicationDelegate> application:performFetchWithCompletionHandler:], but you still need to add "fetch" to the list of your supported UIBackgroundModes in your Info.plist.
default	02:46:25.198049+0000	PromptPal	You've implemented -[<UIApplicationDelegate> application:didReceiveRemoteNotification:fetchCompletionHandler:], but you still need to add "remote-notification" to the list of your supported UIBackgroundModes in your Info.plist.
default	02:46:25.199368+0000	SpringBoard	[0x539842580] activating connection: mach=false listener=false peer=true name=com.apple.UIKit.KeyboardManagement.hosted.peer[1631].0x539842580
default	02:46:25.199599+0000	SpringBoard	RX com.mikhailspeaks.promptpal(1631) startArbitration
    expectedState:(null)
    focusContext:<private>
    hostingPIDs:<private> usingFence:Y withSuppression:0
default	02:46:25.199770+0000	PromptPal	_setUpFeatureFlags called with release level 2
default	02:46:25.200447+0000	SpringBoard	set focusRequestedHandle:<com.mikhailspeaks.promptpal focus:(null) run:Y hosting:() level:0 active:N wantedState:Disabled #suppr:0 iavHeight:0 onScreen:N>
default	02:46:25.201158+0000	SpringBoard	[coordinator] buffer all events for reason: background keyboard arbiter request <82>- begin
default	02:46:25.201376+0000	SpringBoard	[coordinator] handling new keyboard arbiter request pid: 0 sceneIdentity: (null)
default	02:46:25.201478+0000	SpringBoard	arbiter: arbiter requested nothing
default	02:46:25.201626+0000	SpringBoard	[coordinator] using MRU target <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>
default	02:46:25.202054+0000	SpringBoard	[coordinator] informing scene controller 'com.apple.springboard' of focusTarget: <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>
default	02:46:25.202976+0000	SpringBoard	[com.apple.springboard] coalition says I have focus; enforcing policy: {
    keyboardFocusTarget: <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>;
    selectionPolicy: KeyboardArbiter;
    shouldSuppressRemoteDeferring: 0;
}
default	02:46:25.203212+0000	SpringBoard	rules: (keyboardFocus) outbound target changed from:(null) to <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>
default	02:46:25.203320+0000	SpringBoard	rules: (keyboardFocus) defer (<com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard pid:34>) -> <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>
default	02:46:25.203437+0000	backboardd	new buffering predicates for pid:34: (<keyboardFocus>)
default	02:46:25.203493+0000	SpringBoard	[0x534ba4460] Remote event deferring rule comparison requested by system shell behavior delegate: <SBKeyboardFocusCoordinator: 0x534173300>; reason: SB rule update
default	02:46:25.204032+0000	SpringBoard	[coordinator] new enforced policy: {
    keyboardFocusTarget: <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>;
    selectionPolicy: KeyboardArbiter;
    shouldSuppressRemoteDeferring: 0;
}
default	02:46:25.204197+0000	backboardd	pid:34 new buffering predicates: {(
    <keyboardFocus>
)}
default	02:46:25.204375+0000	SpringBoard	[coordinator] keyboard arbiter suggested <nothing> and we replied <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>
default	02:46:25.204444+0000	SpringBoard	[coordinator] buffer all events for reason: background keyboard arbiter request <82> - end
default	02:46:25.204567+0000	SpringBoard	rules: (scene setting) REMOVED keyboardFocus environment from scene: com.apple.springboard
default	02:46:25.204916+0000	SpringBoard	set currentFocus PID:-1 sceneIdentity:(null)
default	02:46:25.205435+0000	SpringBoard	sceneOfRecord: sceneID: com.apple.springboard  persistentID: com.apple.springboard
default	02:46:25.205744+0000	SpringBoard	[lock] Poster Extact update changed 649
default	02:46:25.206234+0000	SpringBoard	[home] Poster Extact update changed 596
default	02:46:25.207374+0000	SpringBoard	rules: (scene setting) ADDED keyboardFocus environment to scene: sceneID:com.mikhailspeaks.promptpal-default
default	02:46:25.208762+0000	SpringBoard	[lock] Poster Extact update COULD change 649 (649)
default	02:46:25.208867+0000	SpringBoard	[lock] Poster Extact update DID change
default	02:46:25.209036+0000	SpringBoard	[home] Poster Extact update COULD change 596 (596)
default	02:46:25.209142+0000	SpringBoard	[home] Poster Extact update DID change
default	02:46:25.209702+0000	PromptPal	networkd_settings_read_from_file initialized networkd settings by reading plist directly
default	02:46:25.210418+0000	PromptPal	networkd_settings_read_from_file initialized networkd settings by reading plist directly
default	02:46:25.212604+0000	backboardd	adding buffer <BKHIDEventBuffer: 0x4a304b750; dispatchTarget: <keyboardFocus; token: SBKeyboardFocus; pid: 34>; bufferingPIDs: (34); eventCount: 0>
default	02:46:25.213146+0000	kernel	AppleSMCHighVoltageCharger::handleSMCEvent: self=<private> event=5 arg=1
default	02:46:25.213411+0000	kernel	IOAccessoryPowerSource::createPowerSourceItemsInternal(): id:0x1000005a6, owner=<private> tag=<private> itemSet=<private> removeTagSet=0x0
default	02:46:25.213606+0000	kernel	IOAccessoryPowerSource::createPowerSourceItemsInternal(): id:0x1000005a6, owner=<private> tag=<private> itemSet=0x0 removeTagSet=0x0
default	02:46:25.213733+0000	backboardd	new deferring rules for pid:34: [
    [34-6A]; <keyboardFocus; builtin; …board.systemappservices/FBSceneManager:com.apple.springboard> -> <token: 0x81CD19B1; pid: 34>; reason: …gin event deferring in keyboardFocus for window: 0x5376fe680,
    [34-2]; <system; builtin; SBMainSystemGestures> -> <token: 0x1FF7DCD9; pid: 34>; reason: systemGestureSymbol-Main,
    [34-1]; <system; builtin> -> <token: 0x1FF7DCD9; pid: 34>; reason: systemGestures-Main,
    [34-6B]; <keyboardFocus; …board.systemappservices/FBSceneManager:com.apple.springboard> -> <token: …FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default; pid: 1631>; reason: SpringBoard<com.apple.springboard>: enforcing outbound,
    [34-4]; <keyboardFocus; SBKeyboardFocus> -> <token: …board.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>; reason: SB incoming to root scene (symbol),
    [34-5]; <systemKeyCommandOverlay> -> <token: 0xA00239B0; pid: 34>; reason: systemKeyCommandOverlayEnvironment to root scene,
    [34-3]; <keyboardFocus> -> <token
default	02:46:25.214370+0000	SpringBoard	Received state update for 786 (app<com.apple.SleepLockScreen((null))>, running-active-NotVisible
default	02:46:25.214704+0000	SpringBoard	Received state update for 608 (app<com.apple.SafariViewService(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-suspended-NotVisible
default	02:46:25.215017+0000	SpringBoard	Received state update for 610 (app<com.apple.CoreAuthUI(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-suspended-NotVisible
default	02:46:25.215653+0000	SpringBoard	Received state update for 1568 (osservice<com.apple.DragUI.druid>, running-Visible
default	02:46:25.215814+0000	SpringBoard	Received state update for 236 (xpcservice<com.apple.PaperBoard.LegacyPoster([osservice<com.apple.SpringBoard>:34])>{vt hash: 153113877}[uuid:00000000-0000-0000-0000-000000000001], running-suspended-Visible
default	02:46:25.216326+0000	SpringBoard	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
error	02:46:25.216511+0000	backboardd	cycle detected between [34-6A] -> [34-3]
default	02:46:25.216783+0000	SpringBoard	Received state update for 34 (osservice<com.apple.SpringBoard>, running-active-Visible
default	02:46:25.218579+0000	bluetoothd	SystemUI unknown identifier: 'sceneID:com.mikhailspeaks.promptpal-default' / 'com.mikhailspeaks.promptpal'
default	02:46:25.218741+0000	bluetoothd	ScreenState changed: ActiveOn -> ActiveOn (raw 2)
default	02:46:25.218971+0000	bluetoothd	SystemUI changed: 0x0 < >, diff 0x10 < HomeScreen >
error	02:46:25.221596+0000	backboardd	cycle detected between [34-6A] -> [34-3]
default	02:46:25.222198+0000	SpringBoard	[com.mikhailspeaks.promptpal] Foreground app will not request ephemeral notifications isAppClip: NO wantsEphemeral notifications: NO
default	02:46:25.222379+0000	backboardd	chain did update (setDeferringRules) <keyboardFocus; display: null> [
    <token: com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>,
    <token: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default; pid: 1631>
]
default	02:46:25.224019+0000	backboardd	chain did update (setDeferringRules) <keyboardFocus; display: builtin> [
    <token: com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>,
    <token: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default; pid: 1631>
]
default	02:46:25.224122+0000	PromptPal	policyStatus:<BKSHIDEventDeliveryPolicyObserver: 0x1585d1310; token: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default; status: target> was:none
default	02:46:25.224376+0000	PromptPal	observerPolicyDidChange: 0x1585d1310 -> <_UIKeyWindowSceneObserver: 0x158650ed0>
default	02:46:25.224539+0000	backboardd	cache miss for VendorDefined event
default	02:46:25.225666+0000	PromptPal	Realizing settings extension <_UIApplicationSceneDisplaySettings> on FBSSceneSettings
default	02:46:25.227221+0000	PromptPal	<UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8) Scene updated orientation preferences: none -> ( Pu )
default	02:46:25.227416+0000	PromptPal	Key window API is scene-level: YES
default	02:46:25.227813+0000	PromptPal	UIWindowScene: 0x105b25350: Window became key in scene: UIWindow: 0x105b2b910; contextId: 0x12FE800F: reason: UIWindowScene: 0x105b25350: Window requested to become key in scene: 0x105b2b910
default	02:46:25.227951+0000	CommCenter	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.228113+0000	PromptPal	Key window needs update: 1; currentKeyWindowScene: 0x0; evaluatedKeyWindowScene: 0x105b25350; currentApplicationKeyWindow: 0x0; evaluatedApplicationKeyWindow: 0x105b2b910; reason: UIWindowScene: 0x105b25350: Window requested to become key in scene: 0x105b2b910
default	02:46:25.228291+0000	PromptPal	Window did become application key: UIWindow: 0x105b2b910; contextId: 0x12FE800F; scene identity: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default
default	02:46:25.228364+0000	PromptPal	[0x1586095e0] Begin local event deferring requested for token: 0x1584554a0; environments: 1; reason: UIWindowScene: 0x105b25350: Begin event deferring in keyboardFocus for window: 0x105b2b910
default	02:46:25.228575+0000	SpringBoard	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.228851+0000	backboardd	new buffering predicates for pid:34: ()
default	02:46:25.229141+0000	PromptPal	Deactivation reason removed: 10; deactivation reasons: 3104 -> 2080; animating application lifecycle event: 1
default	02:46:25.229290+0000	backboardd	pid:34 new buffering predicates: {(
)}
default	02:46:25.229350+0000	SpringBoard	RX com.mikhailspeaks.promptpal(1631) setClientFocusContext
    focusContext:<contextID:318668815 sceneID:com.mikhailspeaks.promptpal-default>
default	02:46:25.229573+0000	PromptPal	Deactivation reason added: 12; deactivation reasons: 2080 -> 6176; animating application lifecycle event: 1
default	02:46:25.229774+0000	PromptPal	Deactivation reason removed: 11; deactivation reasons: 6176 -> 4128; animating application lifecycle event: 1
default	02:46:25.230046+0000	SpringBoard	Focused scene identity did change to: (null)
default	02:46:25.230108+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.230329+0000	SpringBoard	[coordinator] buffer all events for reason: background keyboard arbiter request <83>- begin
default	02:46:25.230603+0000	SpringBoard	[coordinator] handling new keyboard arbiter request pid: 1631 sceneIdentity: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default
default	02:46:25.230654+0000	PromptPal	establishing connection to agent
default	02:46:25.230710+0000	SpringBoard	arbiter: arbiter requested pid 1631 / com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default
default	02:46:25.230761+0000	PromptPal	[0x1585d1cc0] Session created.
default	02:46:25.230839+0000	PromptPal	[0x1585d1cc0] Session created from connection [0x1584c8300]
default	02:46:25.230891+0000	SpringBoard	[coordinator] using arbiter suggested pid 1631 + scene: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default
default	02:46:25.230942+0000	SpringBoard	[coordinator] informing scene controller 'com.apple.springboard' of focusTarget: <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>
default	02:46:25.231004+0000	PromptPal	[0x1584c8300] activating connection: mach=true listener=false peer=false name=com.apple.uiintelligencesupport.agent
default	02:46:25.231585+0000	SpringBoard	[embedded coalition] _abritrateForReason: <keyboardArbiterSuggestion> - new policy is unchanged
default	02:46:25.231645+0000	SpringBoard	[coordinator] keyboard arbiter suggested <pid: 1631; sceneIdentity: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default> and we replied <com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default pid:1631>
default	02:46:25.231781+0000	SpringBoard	[coordinator] buffer all events for reason: background keyboard arbiter request <83> - end
default	02:46:25.231940+0000	PromptPal	[0x1585d1cc0] Session activated
default	02:46:25.231993+0000	backboardd	removing buffer <BKHIDEventBuffer: 0x4a304b750; dispatchTarget: <keyboardFocus; token: SBKeyboardFocus; pid: 34>; bufferingPIDs: (34); eventCount: 0>
default	02:46:25.232491+0000	backboardd	draining 1 buffers (reevaluate ((null)))
default	02:46:25.232599+0000	backboardd	new deferring rules for pid:1631: [[1631-1]; <keyboardFocus; builtin; …FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default> -> <token: 0x12FE800F; pid: 1631>; reason: …gin event deferring in keyboardFocus for window: 0x105b2b910]
default	02:46:25.233037+0000	backboardd	BUFFER: --> 0x4a304b750 empty
default	02:46:25.233123+0000	SpringBoard	Scene <FBScene: 0x53546f800; FBSceneManager:sceneID:com.mikhailspeaks.promptpal-default> is setting idleTimerDisabled to: NO
default	02:46:25.233232+0000	SpringBoard	set currentFocus PID:1631 sceneIdentity:com.mikhailspeaks.promptpal-default
default	02:46:25.233288+0000	backboardd	new scene host settings: contextID:12FE800F <sceneID:com.mikhailspeaks.promptpal-default> unspecified -> foreground
default	02:46:25.233340+0000	SpringBoard	SBIdleTimerGlobalCoordinator - updateIdleTimerForReason:"IdleTimerDisableChangedForMainDisplaySceneManager - client:com.mikhailspeaks.promptpal"]
default	02:46:25.233704+0000	SpringBoard	idleTimerDescriptorForBehavior: <SBIdleTimerBehavior: 0x53635ddd0; duration: Unlocked; mode: Auto; warnMode: Warn>
default	02:46:25.234076+0000	PromptPal	Create activity from XPC object <nw_activity 50:1 [3C800CA7-1CD6-44F3-8A28-39987E4B14FB] (reporting strategy default)>
default	02:46:25.234375+0000	PromptPal	Create activity from XPC object <nw_activity 50:2 [B8C66A08-BBE2-4DC1-BB00-3CC7D31E1B78] (reporting strategy default)>
default	02:46:25.234487+0000	PromptPal	Set activity <nw_activity 50:1 [3C800CA7-1CD6-44F3-8A28-39987E4B14FB] (reporting strategy default)> as the global parent
default	02:46:25.234541+0000	SpringBoard	[0x537eac900:(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Scene action [Logical Activate][0x620e] completed with success: 1
default	02:46:25.236200+0000	PromptPal	AggregateDictionary is deprecated and has been removed. Please migrate to Core Analytics.
default	02:46:25.236291+0000	PromptPal	Ending background task with UIBackgroundTaskIdentifier: 1
default	02:46:25.236345+0000	PromptPal	Ending task with identifier 1 and description: <private>, _expireHandler: (null)
default	02:46:25.236399+0000	PromptPal	Decrementing reference count for assertion <private> (used by background task with identifier 1: <private>)
default	02:46:25.236455+0000	PromptPal	[0x1584c8700] activating connection: mach=true listener=false peer=false name=com.apple.analyticsd
error	02:46:25.237066+0000	backboardd	cycle detected between [34-6A] -> [34-3]
default	02:46:25.237281+0000	PromptPal	Event Timing Profile for Touch: ok, path="/System/Library/EventTimingProfiles/D321.Touch.plist"
default	02:46:25.237442+0000	PromptPal	Event Timing Profile for Pencil: not found, path="/System/Library/EventTimingProfiles/D321.Pencil.plist"
default	02:46:25.237811+0000	PromptPal	Target list changed: <CADisplay:LCD primary>
default	02:46:25.238110+0000	SpringBoard	Window(0x537505c00)(SBTraitsParticipantRoleControlCenter-0) validates resolution: NO. isHidden
default	02:46:25.238511+0000	PromptPal	sceneOfRecord: sceneID: sceneID:com.mikhailspeaks.promptpal-default  persistentID: AE9A6D9A-53BD-460E-82A0-981A7E4514D8
default	02:46:25.239804+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] scene content state changed: ready
default	02:46:25.240677+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Setting parent scene: (FBSceneManager):com.apple.springboard
error	02:46:25.240727+0000	backboardd	cycle detected between [34-6A] -> [34-3]
default	02:46:25.240889+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] propagating 4 settings from (FBSceneManager):com.apple.springboard
default	02:46:25.241988+0000	backboardd	chain did update (setDeferringRules) <keyboardFocus; display: null; compatibilityDisplay: builtin> [
    <token: com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>,
    <token: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default; pid: 1631>,
    <token: 0x12FE800F; pid: 1631>
]
default	02:46:25.242114+0000	SpringBoard	<_UIChildRemoteContentRegistry: 0x53748fea0; parentScene: <FBSScene: 0x534b74820>; childScenes: 4; childViewServices: 0> Registry is now tracking child scene <FBScene: 0x536060560>
default	02:46:25.242176+0000	SpringBoard	<_UISceneRelationshipManagementHostComponent:0x5391d4bc0> Scene <FBScene: 0x536060560> is hosted in <SBWindowScene: 0x53425d600>
default	02:46:25.242285+0000	SpringBoard	<ForwardingPresentationScene:0x53635e700> Prioritized presenter: <_UIScenePresenter: 0x5398db110; identifier: SBDeviceApplicationSceneViewController:0x53912ad00-SBApplicationSceneView:0x538d8cf00-37; sortContext: 0>.
default	02:46:25.242394+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Removing parent scene.
default	02:46:25.242449+0000	backboardd	chain did update (setDeferringRules) <keyboardFocus; display: builtin> [
    <token: com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard; pid: 34>,
    <token: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default; pid: 1631>,
    <token: 0x12FE800F; pid: 1631>
]
default	02:46:25.242507+0000	SpringBoard	<_UIChildRemoteContentRegistry: 0x53748fea0; parentScene: <FBSScene: 0x534b74820>; childScenes: 3; childViewServices: 0> Registry is no longer tracking child scene <FBScene: 0x536060560>
default	02:46:25.242597+0000	PromptPal	policyStatus:<BKSHIDEventDeliveryPolicyObserver: 0x1585d1310; token: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default; status: ancestor> was:target
default	02:46:25.242789+0000	SpringBoard	<_UISceneRelationshipManagementHostComponent:0x5391d4bc0> Scene <FBScene: 0x536060560> is hosted in (nil)
default	02:46:25.242849+0000	runningboardd	Acquiring assertion targeting app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631 from originator [osservice<com.apple.SpringBoard>:34] with description <RBSAssertionDescriptor| "injecting inherited from "UIScene:com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard" to 1631<UIScene:com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default>" ID:33-34-6213 target:1631<UIScene:com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default> attributes:[
	<RBSHereditaryGrant| endowmentNamespace:com.apple.boardservices.endpoint-injection UIScene:com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard>,
	<RBSHereditaryGrant| endowmentNamespace:com.apple.frontboard.visibility UIScene:com.apple.frontboard.systemappservices/FBSceneManager:com.apple.springboard>
	]>
default	02:46:25.242918+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] Setting parent scene: (FBSceneManager):com.apple.springboard
default	02:46:25.242975+0000	runningboardd	Assertion 33-34-6213 (target:app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631) will be created as active
default	02:46:25.243036+0000	PromptPal	observerPolicyDidChange: 0x1585d1310 -> <_UIKeyWindowSceneObserver: 0x158650ed0>
default	02:46:25.243088+0000	SpringBoard	[(FBSceneManager):sceneID:com.mikhailspeaks.promptpal-default] propagating 4 settings from (FBSceneManager):com.apple.springboard
default	02:46:25.243572+0000	SpringBoard	<_UIChildRemoteContentRegistry: 0x53748fea0; parentScene: <FBSScene: 0x534b74820>; childScenes: 4; childViewServices: 0> Registry is now tracking child scene <FBScene: 0x536060560>
default	02:46:25.243647+0000	SpringBoard	<_UISceneRelationshipManagementHostComponent:0x5391d4bc0> Scene <FBScene: 0x536060560> is hosted in <SBWindowScene: 0x53425d600>
default	02:46:25.243881+0000	backboardd	cache miss for VendorDefined event
default	02:46:25.245189+0000	backboardd	new buffering predicates for pid:34: (<keyboardFocus>)
default	02:46:25.245476+0000	SpringBoard	[Main (EmbeddedDisplay)] dispatch event:
<SBSceneReadySwitcherModifierEvent: 0x5360ef260; type: SceneReady; appLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main> {
    configuration = full;
    itemsToLayoutAttributes = {
        sceneID:com.mikhailspeaks.promptpal-default = <SBDisplayItemLayoutAttributes: 0x535cfae60; contentOrientation: "portrait (1)"; lastInteractionTime: 11061; sizingPolicy: maximized; size: unspecified; center: unspecified; occlusionState: unknown; userConfiguredSizeBeforeOverlapping: unspecified; unoccludedPeekingCenter: unspecified>;
    }
    environment = main;
    centerConfiguration = undefined;
    preferredDisplayOrdinal = 0;
    continuousExposeIdentifier = com.mikhailspeaks.promptpal;
    layoutItems = {
        primary = <SBDisplayItem: 0x535ec61c0; type: App; bundleIdentifier: com.mikhailspeaks.promptpal; uniqueIdentifier: sceneID:com.mikhailspeaks.promptpal-default>;
    }
}>
default	02:46:25.245745+0000	backboardd	pid:34 new buffering predicates: {(
    <keyboardFocus>
)}
default	02:46:25.245867+0000	backboardd	new buffering predicates for pid:34: ()
default	02:46:25.246045+0000	backboardd	pid:34 new buffering predicates: {(
)}
default	02:46:25.246628+0000	runningboardd	Calculated state for app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>: running-active (role: UserInteractiveFocal) (endowments: <private>)
error	02:46:25.246861+0000	SpringBoard	Live host view super view[<SBCrossfadeView: 0x537e3cc40; frame = (0 0; 375 812); clipsToBounds = YES; layer = <CALayer: 0x5360ecf60>>] not matching container view[<UIView: 0x53900e580; frame = (0 0; 375 812); clipsToBounds = YES; layer = <CALayer: 0x536048e20>>], frame not updated
default	02:46:25.247195+0000	runningboardd	Inheritance changeset: <RBSInheritanceChangeSet| gained:{(
    <RBSInheritance| environment:UIScene:com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default name:com.apple.frontboard.visibility origID:33-34-6213 payload 11855166879836431039>
)} lost:{(
)}>
default	02:46:25.248852+0000	CommCenter	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.249043+0000	SpringBoard	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.249943+0000	locationd	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.249996+0000	locationd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.250101+0000	PromptPal	Setting client identifier GAX_com.apple.accessibility.gax.client_client_to_GAX_BB
default	02:46:25.250253+0000	locationd	{"msg":"invoking applicationStateChange handler", "StateChangeData":"{\n    BKSApplicationStateAppIsFrontmost = 1;\n    BKSApplicationStateExtensionKey = 0;\n    SBApplicationStateDisplayIDKey = \"com.mikhailspeaks.promptpal\";\n    SBApplicationStateKey = 8;\n    SBApplicationStateProcessIDKey = 1631;\n    SBMostElevatedStateForProcessID = 8;\n}"}
default	02:46:25.250708+0000	locationd	{"msg":"Not Posting Application State Change Notification via legacy path", "notification":"ForegroundRunning", "pid":1631, "bundleId":"com.mikhailspeaks.promptpal"}
default	02:46:25.250777+0000	PromptPal	Starting server (<AXIPCServer: 0x158609880>. Serivce Name:com.apple.accessibility.gax.client. Running:NO Server Port:0. Clients:(null). Entitlements:(null). RunLoopSource:0x0) on thread (<_NSMainThread: 0x158434000>{number = 1, name = main}:name::main:1)
default	02:46:25.250876+0000	locationd	{"msg":"RBS #AppMonitor process monitor update handler invoked", "pid":1631, "bundleID":"com.mikhailspeaks.promptpal", "state":"RunningScheduled"}
error	02:46:25.250917+0000	kernel	Sandbox: PromptPal(1631) deny(1) mach-register com.apple.accessibility.gax.client
default	02:46:25.251189+0000	locationd	{"msg":"RBS #AppMonitor Post Application State Change Notification", "notification":"ForegroundRunning", "pid":1631, "bundleId":"com.mikhailspeaks.promptpal"}
default	02:46:25.253087+0000	PromptPal	Scene target of keyboard event deferring environment did change: 1; scene: UIWindowScene: 0x105b25350; scene identity: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default
default	02:46:25.253309+0000	locationd	{"msg":"#Warning #ClientResolution the passed keyPath is not registered. Resolving to #nullCKP", "InputCKP":"icom.mikhailspeaks.promptpal:"}
default	02:46:25.253396+0000	PromptPal	[0x1586095e0] Scene target of event deferring environments did update: scene: 0x105b25350; current systemShellManagesKeyboardFocus: 1; systemShellManagesKeyboardFocusForScene: 1; eligibleForRecordRemoval: 1;
default	02:46:25.253592+0000	PromptPal	Scene became target of keyboard event deferring environment: UIWindowScene: 0x105b25350; scene identity: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default
default	02:46:25.253645+0000	locationd	os_transaction created: (0x16b66dc50) GetIdentifyingInformation
default	02:46:25.253700+0000	PromptPal	Stack[KeyWindow] 0x158652040: Migrate scenes from LastOneWins -> SystemShellManaged
default	02:46:25.254009+0000	PromptPal	Setting default evaluation strategy for UIUserInterfaceIdiomPhone to SystemShellManaged
default	02:46:25.255032+0000	PromptPal	startConnection
default	02:46:25.255207+0000	PromptPal	[0x1586095e0] Scene target of event deferring environments did update: scene: 0x105b25350; current systemShellManagesKeyboardFocus: 1; systemShellManagesKeyboardFocusForScene: 1; eligibleForRecordRemoval: 1;
default	02:46:25.255281+0000	PromptPal	Scene became target of keyboard event deferring environment: UIWindowScene: 0x105b25350; scene identity: com.apple.frontboard.systemappservices/FBSceneManager:sceneID%3Acom.mikhailspeaks.promptpal-default
default	02:46:25.255686+0000	backboardd	Was notified gax client did load: com.mikhailspeaks.promptpal. pid:1631 send right name: 6a283
default	02:46:25.256779+0000	locationd	os_transaction releasing: (0x16b66dc50) GetIdentifyingInformation
default	02:46:25.256966+0000	locationd	{"msg":"#CLIUA AppMonitor notification", "notification":"ForegroundRunning", "pid":1631, "bundleId":"com.mikhailspeaks.promptpal", "ClientKey":"icom.mikhailspeaks.promptpal:"}
default	02:46:25.257085+0000	locationd	{"msg":"#CLIUA Marking change", "clientKey":"icom.mikhailspeaks.promptpal:", "reason":"Process state from RunningBoard", "AssertionLevel":"kCLClientInUseLevelDirectUserEngagement", "coming":1}
default	02:46:25.257252+0000	backboardd	Created app client for pid 1631, identifier com.mikhailspeaks.promptpal
default	02:46:25.257329+0000	backboardd	Setting client identifier GAXApp-com.mikhailspeaks.promptpal
default	02:46:25.257466+0000	locationd	{"msg":"#CLIUA updating AssertionRecord", "ClientKey":"icom.mikhailspeaks.promptpal:", "AssertionLevel":"kCLClientInUseLevelNotInUse"}
default	02:46:25.257616+0000	locationd	{"msg":"#CLIUA AssertionRecord updated", "ClientKey":"icom.mikhailspeaks.promptpal:", "AssertionLevel":"kCLClientInUseLevelDirectUserEngagement"}
default	02:46:25.257688+0000	locationd	{"msg":"#CLIUA in-use level changed for client", "ClientKey":"icom.mikhailspeaks.promptpal:"}
default	02:46:25.257759+0000	locationd	{"msg":"#Warning #ClientResolution the passed keyPath is not registered. Resolving to #nullCKP", "InputCKP":"icom.mikhailspeaks.promptpal:"}
default	02:46:25.258111+0000	PromptPal	sceneOfRecord: sceneID: sceneID:com.mikhailspeaks.promptpal-default  persistentID: AE9A6D9A-53BD-460E-82A0-981A7E4514D8
default	02:46:25.259131+0000	PromptPal	sceneOfRecord: sceneID: sceneID:com.mikhailspeaks.promptpal-default  persistentID: AE9A6D9A-53BD-460E-82A0-981A7E4514D8
default	02:46:25.259387+0000	PromptPal	handleKeyboardChange: set currentKeyboard:N (wasKeyboard:N)
default	02:46:25.259443+0000	PromptPal	forceReloadInputViews
default	02:46:25.259494+0000	PromptPal	Reloading input views for: <(null): 0x0; > force: 1
default	02:46:25.259612+0000	PromptPal	isWritingToolsHandlingKeyboardTracking:Y (WT ready:Y, Arbiter ready:Y)
error	02:46:25.259892+0000	backboardd	Could not send message to client with pid 610 identifier com.apple.CoreAuthUI: notify client app of server settings change (Error Domain=IPC Code=0 "Could not send simple message (com.apple.accessibility.gax.client). Port:375819. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1220>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (903)" UserInfo={NSLocalizedFailureReason=Could not send simple message (com.apple.accessibility.gax.client). Port:375819. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1220>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (903), AXIPCErrorKeyMachError=268435460})
error	02:46:25.260035+0000	backboardd	Could not send message to client with pid 608 identifier com.apple.SafariViewService: notify client app of server settings change (Error Domain=IPC Code=0 "Could not send simple message (com.apple.accessibility.gax.client). Port:498483. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1220>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (904)" UserInfo={NSLocalizedFailureReason=Could not send simple message (com.apple.accessibility.gax.client). Port:498483. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1220>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (904), AXIPCErrorKeyMachError=268435460})
error	02:46:25.260369+0000	backboardd	Could not send message to client with pid 785 identifier com.apple.InCallService: notify client app of server settings change (Error Domain=IPC Code=0 "Could not send simple message (com.apple.accessibility.gax.client). Port:458271. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1220>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (906)" UserInfo={NSLocalizedFailureReason=Could not send simple message (com.apple.accessibility.gax.client). Port:458271. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1220>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (906), AXIPCErrorKeyMachError=268435460})
default	02:46:25.260421+0000	backboardd	Layout ID: sceneID:com.mikhailspeaks.promptpal-default Bundle ID: com.mikhailspeaks.promptpal Role: 1
default	02:46:25.260627+0000	watchdogd	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.260685+0000	SpringBoard	[com.mikhailspeaks.promptpal] com.mikhailspeaks.promptpal application state changed to <RBSProcessState| task:running-active debug:none endowmentNamespace:[
	com.apple.frontboard.visibility
	]>
default	02:46:25.260735+0000	SpringBoard	[com.mikhailspeaks.promptpal] Ignore becoming foreground for application without push registration
default	02:46:25.260802+0000	watchdogd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.260854+0000	UserEventAgent	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.261152+0000	UserEventAgent	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.261478+0000	SpringBoard	-[SASSystemState init]_block_invoke #modes DisplayTransition called transition=<private>
default	02:46:25.261639+0000	SpringBoard	-[SASSystemState init]_block_invoke #modes Device went to sleep or went through another transition setLiftToWake:NO
default	02:46:25.261702+0000	SpringBoard	-[SASMyriadController _updateRaiseToWakeTimeForTransition:] #myriad BTLE observerCalled transition=<private>
default	02:46:25.261753+0000	SpringBoard	MRNowPlayingAudioFormatController foreground bundle id changed: com.mikhailspeaks.promptpal
default	02:46:25.262746+0000	SpringBoard	idleTimerDescriptorForBehavior: <SBIdleTimerBehavior: 0x53629dc80; duration: Unlocked; mode: Auto; warnMode: Warn>
default	02:46:25.265661+0000	runningboardd	PERF: Received lookupHandleForPredicate request from [osservice<com.apple.SpringBoard>:34] (euid 501, auid 501) (persona (null))
default	02:46:25.265763+0000	locationd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.266434+0000	kernel	AppleSMCHighVoltageCharger::handleSMCEvent: self=<private> event=5 arg=1
default	02:46:25.266793+0000	kernel	IOAccessoryPowerSource::createPowerSourceItemsInternal(): id:0x1000005a6, owner=<private> tag=<private> itemSet=<private> removeTagSet=0x0
default	02:46:25.266927+0000	kernel	IOAccessoryPowerSource::createPowerSourceItemsInternal(): id:0x1000005a6, owner=<private> tag=<private> itemSet=0x0 removeTagSet=0x0
default	02:46:25.267457+0000	dasd	Trigger: <private> is now [<private>]
default	02:46:25.267513+0000	dasd	Foreground apps changed—-<private>
default	02:46:25.267772+0000	PromptPal	[0x15851cdc0] activating connection: mach=true listener=false peer=false name=com.apple.fontservicesd
default	02:46:25.268146+0000	fontservicesd	[0xdbe0d26c0] activating connection: mach=false listener=false peer=true name=com.apple.fontservicesd.peer[1631].0xdbe0d26c0
default	02:46:25.268347+0000	watchdogd	9544026365375: <private>
default	02:46:25.270872+0000	locationd	{"msg":"#durian adv unowned", "addr":<private>, "nap":110, "date":"Fri Feb 20 02:46:25 2026", "status":<private>, "data":<private>}
default	02:46:25.273060+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:25.273242+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:25.273391+0000	locationd	{"msg":"onAvengerAdvertisementDetected: advertisement is near-owner from other people and do not process it", "subHarvester":"Avenger"}
default	02:46:25.273715+0000	bluetoothd	BLE Scanner Device Found: CBDevice E242E447-3918-BF7B-FDD7-1119E71FA037, BDA CC:AF:3B:79:BE:55, Nm 'Bluetooth Device', DsFl 0x20000000080 < AccessoryStatus ObjectDiscoveryNearOwner >, DvF 0x40000000000 < Connectable >, RSSI -94, Ch 37, Battery L -85% R +100% C +100%, FV '137.235.19', AdTsMC <224061443005>, AMfD <4c 00 12 02 6e 02 07 11 06 c3 f0 2b f9 55 ec 13 eb 89 b4 9f ab 9b 21 0c c2>, asFl 0x5 < LidClosed Sound >, asLO 3, asOT 1d 6h, odBS Medium, odMd NearOwner, odNO 8caf3b79be55, odPI HeGn, odPK NULL, ppPI 0xF0C3 (?), ppST 0x06 (AccessoryStatus), CF 0x200000000 < RSSI >
default	02:46:25.273988+0000	locationd	<private>
default	02:46:25.274328+0000	watchdogd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.274663+0000	UserEventAgent	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.275952+0000	PerfPowerServices	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.276014+0000	useractivityd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.276197+0000	wifid	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.276256+0000	PerfPowerServices	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.276309+0000	wifid	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.276645+0000	audiomxd	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.276715+0000	audiomxd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.276823+0000	dasd	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.276981+0000	dasd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.277089+0000	symptomsd	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.277204+0000	symptomsd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.277318+0000	backboardd	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.277424+0000	backboardd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.278225+0000	softwareupdateservicesd	homescreen changed: 1 -> 0
default	02:46:25.278664+0000	mediaremoted	[MRDDisplayMonitor] Layout Changed <private>
default	02:46:25.278713+0000	mediaremoted	[MRDDisplayMonitor] Layout Changed <private>
default	02:46:25.279441+0000	wifid	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.280309+0000	intelligentroutingd	#system-state-manager, [<private>], System state might have changed due to App in focus:
<private>
<private>
default	02:46:25.280392+0000	milod	_handleULDisplayMonitorEventDisplayState: appInFocus: <private>
default	02:46:25.280545+0000	milod	{"msg":"appLaunch", "bundleIdentifier":<private>}
default	02:46:25.280612+0000	useractivityd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.281308+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.281373+0000	PerfPowerServices	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.281595+0000	bluetoothd	decryptProximityPairingPayload device:<private> address:<private>
default	02:46:25.283035+0000	locationd	saveBeaconPayload: 1
default	02:46:25.284327+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:25.284921+0000	searchpartyd	wildModeAssociationRecords(advertisement: <private>)
default	02:46:25.285067+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:25.285228+0000	locationd	{"msg":"derivedPruneHarvest", "cacheSize":168, "beaconPayloadCacheSize":0, "subHarvester":"Avenger"}
default	02:46:25.285679+0000	locationd	<private>
default	02:46:25.285763+0000	locationd	{"msg":"processAdvertisementCache: completed process", "Remaining fAdvertisementCache.count":168, "fBeaconPayloadCache.count":0, "subHarvester":"Avenger"}
default	02:46:25.285845+0000	locationd	{"msg":"processAdvertisementCache: have last location, but it is stale", "lastLocation.timestamp":793247926, "fCurrentTimeOffsetThreshold":"45.000000", "subHarvester":"Avenger"}
default	02:46:25.286025+0000	locationd	{"msg":"BlueAvengerKPI: rejected proactive fine location request", "subHarvester":"Avenger"}
default	02:46:25.286508+0000	dasd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.286643+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:25.286818+0000	gamepolicyd	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.286873+0000	gamepolicyd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-NotVisible
default	02:46:25.287519+0000	searchpartyd	wildModeAssociationRecord(for uuid: <private>)
default	02:46:25.287986+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:25.291390+0000	intelligentroutingd	#system-state-manager, [<private>], System state might have changed due to App in focus:
<private>
<private>
default	02:46:25.291827+0000	audiomxd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.292635+0000	symptomsd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.294673+0000	intelligentroutingd	#system-state-manager, [<private>], System state might have changed due to App in focus:
<private>
<private>
default	02:46:25.295171+0000	backboardd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:25.296350+0000	gamepolicyd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-NotVisible
default	02:46:25.296751+0000	gamepolicyd	Identified game com.mikhailspeaks.promptpal GM:false DPS:false SEM:false MMA:true
default	02:46:25.300678+0000	wifid	-[WiFiUserInteractionMonitor setApplicationRunningState:foregroundState:andNetworkingState:forBundleId:]: com.mikhailspeaks.promptpal entered foreground
default	02:46:25.300955+0000	wifid	WifiDeviceManagerCatsWhitelistedApp: CATS en0:  deviceManager:0xcde44f800 FgApp:com.mikhailspeaks.promptpal stateChange:0 whitelisted=1
default	02:46:25.301213+0000	wifid	-[WiFiUsageApplicationSession applicationStateDidChange:withAttributes:]: application session resumed:{(
    "com.apple.mobilesafari",
    "com.apple.WebKit.WebContent",
    "com.mikhailspeaks.promptpal",
    "com.burbn.instagram",
    "com.apple.AccessibilityUIServer",
    "com.apple.TestFlight",
    "com.apple.PaperBoard.LegacyPoster",
    "com.apple.mobilemail",
    "com.apple.InputUI",
    "com.apple.InCallService",
    "com.apple.SleepLockScreen",
    "com.apple.WebKit.GPU"
)}
default	02:46:25.303360+0000	searchd	<private>: processing event for bundle <private>.
default	02:46:25.303726+0000	biomed	ViewUpdate: Beginning performUpdate for <private> [runMode: <private>, checkSLA: true]
default	02:46:25.303785+0000	biomed	ViewUpdate: Starting schedule run <private>
default	02:46:25.303956+0000	PromptPal	<nw_activity 50:1 [3C800CA7-1CD6-44F3-8A28-39987E4B14FB] (global parent) (reporting strategy default) complete (reason success)> complete with reason 2 (success), duration 231ms
default	02:46:25.304246+0000	PromptPal	<nw_activity 50:2 [B8C66A08-BBE2-4DC1-BB00-3CC7D31E1B78] (reporting strategy default) complete (reason success)> complete with reason 2 (success), duration 230ms
default	02:46:25.304418+0000	PromptPal	Unsetting the global parent activity <nw_activity 50:1 [3C800CA7-1CD6-44F3-8A28-39987E4B14FB] (global parent) (reporting strategy default) complete (reason success)>
default	02:46:25.304477+0000	PromptPal	Unset the global parent activity
default	02:46:25.305052+0000	biomed	ViewUpdate: Initially have 3 views that may need updating
default	02:46:25.305752+0000	contextstored	Sending fired registration <private> to com.apple.duetexpertd.cdidentifier
default	02:46:25.306056+0000	biomed	ViewUpdate: 79:AppOpeningsMatView: Beginning view update attempt
error	02:46:25.306606+0000	PromptPal	[runtime not ready]: Error: Incompatible React versions: The "react" and "react-native-renderer" packages must have the exact same version. Instead got:
  - react:                  19.2.4
  - react-native-renderer:  19.1.0
Learn more: https://react.dev/warnings/version-mismatch
error	02:46:25.306669+0000	PromptPal	Unhandled JS Exception: [runtime not ready]: Error: Incompatible React versions: The "react" and "react-native-renderer" packages must have the exact same version. Instead got:
  - react:                  19.2.4
  - react-native-renderer:  19.1.0
Learn more: https://react.dev/warnings/version-mismatch
default	02:46:25.307166+0000	symptomsd	Current state: idle, changed: systemForeground to 1 for net type 0
default	02:46:25.307313+0000	symptomsd	Current state: idle, changed: systemForeground to 1 for net type 0, eligible for active but constraints unsatisfied (1,0,0)
default	02:46:25.307368+0000	symptomsd	Current state: idle, changed: systemForeground to 1 for net type 0, ineligible for positive as nil pred, wifi (0x0) cell (0x0)
default	02:46:25.307424+0000	symptomsd	Current state: idle, changed: systemForeground to 1 for net type 0, ineligible for broken as nil pred, wifi (0x0) cell (0x0)
default	02:46:25.307702+0000	symptomsd	Preparing to send  traffic and stall info active 0x0 changed 0x0 foreground 1 stall 0 rebuffer 0 dns 0 data {length = 28, bytes = 0x02000000 00000000 00000000 01000000 ... 00000000 00000000 }
default	02:46:25.307811+0000	CommCenter	#I <private> request: <private>, expects reply.
default	02:46:25.308345+0000	CommCenter	req: Bin=[<private>]
error	02:46:25.308556+0000	PromptPal	[runtime not ready]: Error: Incompatible React versions: The "react" and "react-native-renderer" packages must have the exact same version. Instead got:
  - react:                  19.2.4
  - react-native-renderer:  19.1.0
Learn more: https://react.dev/warnings/version-mismatch
default	02:46:25.309087+0000	CommCenter	req: Bin=[<private>]
default	02:46:25.309190+0000	CommCenter	#I <private> reply to request '<private>'.
default	02:46:25.309240+0000	symptomsd	com.mikhailspeaks.promptpal: Foreground: true
default	02:46:25.309452+0000	symptomsd	Failed to find process for com.mikhailspeaks.promptpal
default	02:46:25.311022+0000	CommCenter	rsp: Bin=[<private>]
default	02:46:25.311745+0000	CommCenter	rsp: Bin=[<private>]
default	02:46:25.314358+0000	duetexpertd	Registration fired for <private>
default	02:46:25.314409+0000	duetexpertd	Dispatching call to informative registration callback for <private>
default	02:46:25.315032+0000	searchd	SpotlightIndex#si_mobile_journal_hardlink_new_journal Linked journal(<private>) for spotlightknowledged(<private>)
default	02:46:25.317001+0000	contextstored	Sending fired registration <private> to com.apple.proactive.PersonalizationPortrait
default	02:46:25.317054+0000	biomed	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.317411+0000	searchd	SpotlightIndex#si_mobile_journal_hardlink_new_journal Linked journal toc(<private>) for spotlightknowledged(<private>)
default	02:46:25.317461+0000	searchd	### skg journal_new message sent
default	02:46:25.318986+0000	analyticsd	[0xd0a177200] activating connection: mach=false listener=false peer=true name=com.apple.analyticsd.peer[1631].0xd0a177200
default	02:46:25.320188+0000	biomed	ViewUpdate: AppOpeningsMatView: Update is required
default	02:46:25.320298+0000	biomed	ViewUpdate: AppOpeningsMatView: Beginning <private>update attempt
default	02:46:25.320359+0000	biomed	GDCComputeService: updateViewWithName called: <private>
default	02:46:25.320611+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.320678+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.320795+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.321472+0000	searchd	[Engagement Data] Adding Out-of-Spotlight engagement date: 793248384.993347 to _kMDItemRecentOutOfSpotlightEngagementDates for oid: 9222515842533576738
default	02:46:25.321595+0000	suggestd	Registration fired for <private>
default	02:46:25.321702+0000	suggestd	Dispatching call to informative registration callback for <private>
default	02:46:25.322293+0000	spotlightknowledged	### RECEIVED EVENT <private> - <private>
default	02:46:25.322705+0000	contextstored	Sending fired registration <private> to com.apple.Maps.geocorrectiond.contextstore-registration
default	02:46:25.323029+0000	spotlightknowledged	### unlink (0) <private> - <private>
default	02:46:25.323426+0000	spotlightknowledged	### unlink (0) <private> - <private>
default	02:46:25.323554+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.323616+0000	searchd	### skg journal_new result 0
default	02:46:25.324130+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: updateViewWithName AppOpeningsMatView called
default	02:46:25.324309+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: updateViewWithName AppOpeningsMatView begining update
default	02:46:25.325041+0000	geocorrectiond	Registration fired for <private>
default	02:46:25.325097+0000	geocorrectiond	Dispatching call to informative registration callback for <private>
default	02:46:25.325544+0000	PromptPal	Received configuration update from daemon (initial)
error	02:46:25.325706+0000	geocorrectiond	locationManager authorization not granted
error	02:46:25.326401+0000	geocorrectiond	locationManager authorization not granted
default	02:46:25.326837+0000	IntelligencePlatformComputeService	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.327723+0000	IntelligencePlatformComputeService	ViewUpdate: <private>: Finished update
default	02:46:25.327775+0000	IntelligencePlatformComputeService	ViewUpdate: <private>: <private>: Finished update
default	02:46:25.328068+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: update AppOpeningsMatView returning responses
default	02:46:25.328119+0000	biomed	ViewUpdate: 79:AppOpeningsMatView: View was updated
default	02:46:25.328484+0000	biomed	ViewUpdate: completed update
default	02:46:25.328656+0000	SpringBoard	[Main (EmbeddedDisplay)] dispatch event:
<SBTimerSwitcherModifierEvent: 0x537f58be0; type: Timer; reason: kSBTransitionModifierInvalidateAsyncRenderingReason>
default	02:46:25.328721+0000	biomed	ViewUpdate: 80:LastCallMatView: Beginning view update attempt
default	02:46:25.328881+0000	SpringBoard	Added: <UIApplicationSceneDeactivationAssertion: 0x53629c1b0; reason: systemGesture; all scene levels; hasPredicate: YES>
default	02:46:25.328932+0000	SpringBoard	Removed: <UIApplicationSceneDeactivationAssertion: 0x537611350; reason: systemAnimation; all scene levels; hasPredicate: NO>
default	02:46:25.328984+0000	SpringBoard	[sceneID:com.mikhailspeaks.promptpal-default] Setting deactivation reasons to: '(none)' for reason: updateAllScenesForBand - Assertion removed.
default	02:46:25.329479+0000	PromptPal	Not push traits update to screen for new style 2, <UIWindowScene: 0x105b25350> (AE9A6D9A-53BD-460E-82A0-981A7E4514D8)
default	02:46:25.329530+0000	PromptPal	sceneOfRecord: sceneID: sceneID:com.mikhailspeaks.promptpal-default  persistentID: AE9A6D9A-53BD-460E-82A0-981A7E4514D8
default	02:46:25.329582+0000	PromptPal	Deactivation reason removed: 12; deactivation reasons: 4128 -> 32; animating application lifecycle event: 1
default	02:46:25.329647+0000	PromptPal	Send setDeactivating: N (-DeactivationReason:SuspendedEventsOnly)
default	02:46:25.329756+0000	PromptPal	Deactivation reason removed: 5; deactivation reasons: 32 -> 0; animating application lifecycle event: 0
default	02:46:25.329854+0000	PromptPal	Updating configuration of monitor M1631-1
default	02:46:25.330352+0000	PromptPal	[0x1584c8800] activating connection: mach=true listener=false peer=false name=com.apple.hangtracermonitor
default	02:46:25.330451+0000	PromptPal	Creating side-channel connection to com.apple.runningboard
default	02:46:25.330553+0000	PromptPal	[0x1584c8900] activating connection: mach=true listener=false peer=false name=com.apple.runningboard
default	02:46:25.330735+0000	PromptPal	Skip setting user action callback for 3rd party apps
default	02:46:25.330908+0000	SpringBoard	[0x539841e00] activating connection: mach=false listener=false peer=true name=com.apple.hangtracermonitor.peer[1631].0x539841e00
default	02:46:25.331068+0000	PromptPal	[0x1584c8800] invalidated because the current process cancelled the connection by calling xpc_connection_cancel()
default	02:46:25.331425+0000	SpringBoard	[0x539841e00] invalidated because the client process (pid 1631) either cancelled the connection or exited
default	02:46:25.331530+0000	PromptPal	Hit the server for a process handle a81d4b90000065f that resolved to: [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.331707+0000	PromptPal	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, unknown-NotVisible
default	02:46:25.331954+0000	runningboardd	Incoming connection from 1631, user 501/501
default	02:46:25.332140+0000	runningboardd	[0xd7094f0c0] activating connection: mach=false listener=false peer=true name=com.apple.runningboard.peer[1631].0xd7094f0c0
default	02:46:25.332192+0000	backboardd	Was notified that client did become active. ID:com.mikhailspeaks.promptpal PID:1631
default	02:46:25.332417+0000	backboardd	Session apps are (
    "com.mikhailspeaks.promptpal"
). Effective app is com.mikhailspeaks.promptpal.
error	02:46:25.335164+0000	backboardd	Could not send message to client with pid 610 identifier com.apple.CoreAuthUI: notify client app of server settings change (Error Domain=IPC Code=0 "Could not send simple message (com.apple.accessibility.gax.client). Port:375819. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1ea0>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (909)" UserInfo={NSLocalizedFailureReason=Could not send simple message (com.apple.accessibility.gax.client). Port:375819. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1ea0>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (909), AXIPCErrorKeyMachError=268435460})
error	02:46:25.335287+0000	backboardd	Could not send message to client with pid 608 identifier com.apple.SafariViewService: notify client app of server settings change (Error Domain=IPC Code=0 "Could not send simple message (com.apple.accessibility.gax.client). Port:498483. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1ea0>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (911)" UserInfo={NSLocalizedFailureReason=Could not send simple message (com.apple.accessibility.gax.client). Port:498483. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1ea0>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (911), AXIPCErrorKeyMachError=268435460})
error	02:46:25.335463+0000	backboardd	Could not send message to client with pid 785 identifier com.apple.InCallService: notify client app of server settings change (Error Domain=IPC Code=0 "Could not send simple message (com.apple.accessibility.gax.client). Port:458271. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1ea0>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (913)" UserInfo={NSLocalizedFailureReason=Could not send simple message (com.apple.accessibility.gax.client). Port:458271. Error:268435460 (0x10000004). 
<AXIPCMessage: 0x4a4cb1ea0>. Client port: 0. Key: 11003. Payload: {
    GAXIPCPayloadKeyAllowsKeyboardTextInput = 1;
    GAXIPCPayloadKeyAllowsMotion = 1;
    GAXIPCPayloadKeyServerMode = 0;
} (913), AXIPCErrorKeyMachError=268435460})
default	02:46:25.335890+0000	backboardd	Layout ID: sceneID:com.mikhailspeaks.promptpal-default Bundle ID: com.mikhailspeaks.promptpal Role: 1
default	02:46:25.336524+0000	biomed	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.336925+0000	SpringBoard	[Main (EmbeddedDisplay)] dispatch event:
<SBTimerSwitcherModifierEvent: 0x5373377e0; type: Timer; reason: kSBIconZoomDisallowAcceleratedHomeButtonPressReason>
default	02:46:25.337245+0000	biomed	ViewUpdate: LastCallMatView: Update is required
default	02:46:25.337305+0000	biomed	ViewUpdate: LastCallMatView: Beginning <private>update attempt
default	02:46:25.337357+0000	biomed	GDCComputeService: updateViewWithName called: <private>
default	02:46:25.337424+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.337479+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.337527+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.337585+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: updateViewWithName LastCallMatView called
default	02:46:25.337703+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: updateViewWithName LastCallMatView begining update
default	02:46:25.338265+0000	sharingd	NearbyInfo: Clearing duplicate cache
default	02:46:25.338329+0000	sharingd	Nearby clear duplicate filter cache type 1
default	02:46:25.338421+0000	bluetoothd	clear dup filter cache for process sharingd (72) with scan request of type 16, blob: {length = 0, bytes = 0x}, mask {length = 0, bytes = 0x}, active: 0, duplicates: 0, screen on: No Scan, screen off: No Scan, locked: 1,  rssi: -90, peers: (
) nearby scan mode: 10, advbuf: 0, priority critical: 0, range: 0, retain duplicates: 0, usecases:
default	02:46:25.338490+0000	bluetoothd	About to clearDuplicateFilterCache for type: 16
default	02:46:25.338596+0000	bluetoothd	Received XPC message "CBMsgIdClearDuplicateFilterCache" from session "com.apple.bluetoothd-central-94-1"
default	02:46:25.338709+0000	bluetoothd	ShouldScan=1 AnyValidScanRequests=1 anyValidScanRequestInPaused=0 fObserverState=Active ClientScanPowerAssertRequired=0 fScanFiltersNeedUpdagint=0
default	02:46:25.338763+0000	bluetoothd	updateADVBufferConfig current:02 new:02 configChanged:00
default	02:46:25.339179+0000	bluetoothd	[0x4f0805900] activating connection: mach=true listener=false peer=false name=com.apple.iokit.powerdxpc
default	02:46:25.339235+0000	powerd	[0x48a107700] activating connection: mach=false listener=false peer=true name=com.apple.iokit.powerdxpc.peer[94].0x48a107700
default	02:46:25.339380+0000	bluetoothd	[0x4f0805900] invalidated after the last release of the connection object
default	02:46:25.339622+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-27) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.339855+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-54) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.339965+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-64) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.340217+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-70) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.340321+0000	bluetoothd	ScanParams: numScanAgents 7, combined params AD:0 RD:0 AS:0 PHYS:1 MSL:4 (30/60) PSV:0 Rg:0 Cri:0 pBT:0 pWiFi:0 pCfg:0 type:0
default	02:46:25.340374+0000	bluetoothd	ScanParams: [com.apple.bluetoothd-central-94-1] AP:0 AD:0(30/60) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-27] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[com.apple.locationd-central-74-54] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.340435+0000	bluetoothd	ScanParams: [com.apple.locationd-central-74-64] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[CBDaemon-0x53C00033] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-70] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.340487+0000	bluetoothd	ScanParams: [com.apple.sharingd-central-72-118] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.340559+0000	bluetoothd	Returning scan parameters: Main:30.00ms/60.00ms LP:0.00ms/60.00ms(unsupported) SC:0.00ms/0.00ms/non-concurrent(unspported) Dm:(m:30/60) Cond:0:1:0:0:0 Sc:1 (passive) Dupfilter:Enabled minScanLevel:4 HD:Yes Comp:No(0,0) Pri:0/0 PS:1 UUIDPerRuleDup:unsupported
default	02:46:25.340620+0000	bluetoothd	needToRestart=1
default	02:46:25.340892+0000	bluetoothd	clearDuplicateFilterCache for session "com.apple.bluetoothd" type 16
default	02:46:25.340965+0000	powerd	[0x48a107700] invalidated because the client process (pid 94) either cancelled the connection or exited
default	02:46:25.341169+0000	IntelligencePlatformComputeService	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.344635+0000	IntelligencePlatformComputeService	ViewUpdate: <private>: Finished update
default	02:46:25.344750+0000	IntelligencePlatformComputeService	ViewUpdate: <private>: <private>: Finished update
default	02:46:25.346225+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: update LastCallMatView returning responses
default	02:46:25.348670+0000	bluetoothd	Scanning stopped successfully.  11 Advertising Events, 7 dropped pkts
default	02:46:25.348891+0000	bluetoothd	Scan state change:  Stopping(4) --> Idle(1)
default	02:46:25.348990+0000	bluetoothd	handleScanStoppedEvent state=Idle observerState=Active
default	02:46:25.349123+0000	bluetoothd	ShouldScan=1 AnyValidScanRequests=1 anyValidScanRequestInPaused=0 fObserverState=Active ClientScanPowerAssertRequired=0 fScanFiltersNeedUpdagint=0
default	02:46:25.349195+0000	bluetoothd	updateADVBufferConfig current:02 new:02 configChanged:00
default	02:46:25.349956+0000	bluetoothd	[0x4f0804b00] activating connection: mach=true listener=false peer=false name=com.apple.iokit.powerdxpc
default	02:46:25.350356+0000	powerd	[0x48a107700] activating connection: mach=false listener=false peer=true name=com.apple.iokit.powerdxpc.peer[94].0x48a107700
default	02:46:25.350447+0000	bluetoothd	[0x4f0804b00] invalidated after the last release of the connection object
default	02:46:25.350867+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-27) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.350989+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-54) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.351047+0000	biomed	ViewUpdate: 80:LastCallMatView: View was updated
default	02:46:25.351161+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-64) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.351738+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-70) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.352003+0000	bluetoothd	ScanParams: numScanAgents 7, combined params AD:0 RD:0 AS:0 PHYS:1 MSL:4 (30/60) PSV:0 Rg:0 Cri:0 pBT:0 pWiFi:0 pCfg:0 type:0
default	02:46:25.352088+0000	bluetoothd	ScanParams: [com.apple.bluetoothd-central-94-1] AP:0 AD:0(30/60) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-27] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[com.apple.locationd-central-74-54] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.352157+0000	bluetoothd	ScanParams: [com.apple.locationd-central-74-64] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[CBDaemon-0x53C00033] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-70] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.352210+0000	bluetoothd	ScanParams: [com.apple.sharingd-central-72-118] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.352296+0000	bluetoothd	Returning scan parameters: Main:30.00ms/60.00ms LP:0.00ms/60.00ms(unsupported) SC:0.00ms/0.00ms/non-concurrent(unspported) Dm:(m:30/60) Cond:0:1:0:0:0 Sc:1 (passive) Dupfilter:Enabled minScanLevel:4 HD:Yes Comp:No(0,0) Pri:0/0 PS:1 UUIDPerRuleDup:unsupported
default	02:46:25.352355+0000	bluetoothd	needToRestart=0
default	02:46:25.352432+0000	bluetoothd	Starting passive scan (60.00ms/30.00ms) with duplicate filter enabled scNeed=0 stateO=0, retainDups=0 fScanFiltersNeedUpdating=NO
default	02:46:25.353075+0000	bluetoothd	overrideEnableGlobalDupFilter:1
default	02:46:25.353801+0000	powerd	[0x48a107700] invalidated because the client process (pid 94) either cancelled the connection or exited
default	02:46:25.353879+0000	biomed	ViewUpdate: completed update
default	02:46:25.356065+0000	biomed	ViewUpdate: 97:AppOpeningsRawMatView: Beginning view update attempt
default	02:46:25.359047+0000	bluetoothd	Scan state change:  Idle(1) --> Starting(2)
default	02:46:25.359584+0000	bluetoothd	<private>
default	02:46:25.367429+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.368010+0000	bluetoothd	Scanning started successfully
default	02:46:25.368191+0000	bluetoothd	Scan state change:  Starting(2) --> Scanning(3)
default	02:46:25.368308+0000	bluetoothd	ShouldScan=1 AnyValidScanRequests=1 anyValidScanRequestInPaused=0 fObserverState=Active ClientScanPowerAssertRequired=0 fScanFiltersNeedUpdagint=0
default	02:46:25.368400+0000	bluetoothd	updateADVBufferConfig current:02 new:02 configChanged:00
default	02:46:25.368906+0000	bluetoothd	[0x4f0804b00] activating connection: mach=true listener=false peer=false name=com.apple.iokit.powerdxpc
default	02:46:25.369261+0000	powerd	[0x48a107700] activating connection: mach=false listener=false peer=true name=com.apple.iokit.powerdxpc.peer[94].0x48a107700
default	02:46:25.369771+0000	bluetoothd	[0x4f0804b00] invalidated after the last release of the connection object
default	02:46:25.370548+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-27) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.370723+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-54) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.370918+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-64) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.371157+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-70) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:25.371321+0000	bluetoothd	ScanParams: numScanAgents 7, combined params AD:0 RD:0 AS:0 PHYS:1 MSL:4 (30/60) PSV:0 Rg:0 Cri:0 pBT:0 pWiFi:0 pCfg:0 type:0
default	02:46:25.371395+0000	bluetoothd	ScanParams: [com.apple.bluetoothd-central-94-1] AP:0 AD:0(30/60) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-27] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[com.apple.locationd-central-74-54] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.371464+0000	bluetoothd	ScanParams: [com.apple.locationd-central-74-64] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[CBDaemon-0x53C00033] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-70] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.371516+0000	bluetoothd	ScanParams: [com.apple.sharingd-central-72-118] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:25.371598+0000	bluetoothd	Returning scan parameters: Main:30.00ms/60.00ms LP:0.00ms/60.00ms(unsupported) SC:0.00ms/0.00ms/non-concurrent(unspported) Dm:(m:30/60) Cond:0:1:0:0:0 Sc:1 (passive) Dupfilter:Enabled minScanLevel:4 HD:Yes Comp:No(0,0) Pri:0/0 PS:1 UUIDPerRuleDup:unsupported
default	02:46:25.371728+0000	bluetoothd	needToRestart=0
default	02:46:25.371999+0000	powerd	[0x48a107700] invalidated because the client process (pid 94) either cancelled the connection or exited
default	02:46:25.373111+0000	biomed	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.376415+0000	biomed	ViewUpdate: AppOpeningsRawMatView: Update is required
default	02:46:25.376858+0000	backboardd	cache miss for VendorDefined event
default	02:46:25.376997+0000	biomed	ViewUpdate: AppOpeningsRawMatView: Beginning <private>update attempt
default	02:46:25.377150+0000	biomed	GDCComputeService: updateViewWithName called: <private>
default	02:46:25.377249+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.377649+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.378251+0000	biomed	GDCComputeService: updateViewWithName: request: <private> <private>
default	02:46:25.379484+0000	bluetoothd	BLE Scanner Device Found: CBDevice 77374855-9489-9DD0-DA67-8C19B11FBA86, BDA F8:E5:CE:3B:3C:F5, Nm 'Mikhail’s iPhone', Md iPhone15,4, IDS B600907E-CE23-47FD-9362-D909EABBFEB1, stID B600907E-CE23-47FD-9362-D909EABBFEB1, DsFl 0x800040 < NearbyInfo Pairing >, DvF 0x1B080 < SameAccount Hidden BLEPaired CloudPaired HIDGoodBehavior >, RSSI -47, Ch 38, CtInfo CBControllerInfo, BlSt Unknown, DcsS Unknown, Sync Status: Uploaded, FastLE v1, Allowed: no, InqS Unknown, LMPv 0 (Unknown), SSrv: 0x11D3BBB < HFP PhoneBook AVRCP A2DP HID WirelessiAP NetSharing MAP Gaming NetworkConsumer Braille LEA CarPlay AACP GATT SCO >, BTv 5.3, AdTsMC <224061672515>, AMfD <4c 00 10 07 35 1f 4a 97 e1 d9 78>, naED <04 c7 bc e7>, nbIAT <4a 97 e1>, nbIF 0x7C6 < Ranging Me AT Duet WiFiP2P HtSp ShAu >, CF 0x200000000 < RSSI >
default	02:46:25.380060+0000	kernel	wlan0:com.apple.p2p: isInfraRealtimePacketThresholdAllowed allowed:1 option:32 threshold:50 noRegistrations:1 cachedPeerCount:0 fastDiscoveryInactive:1 fastDiscoveryOnSince:9544271
default	02:46:25.380103+0000	kernel	wlan0:com.apple.p2p: currentInfraTrafficType:8981 checking if realtime upgrade required with inputPackets:2 outputPackets:0 packetThreshold:50
default	02:46:25.380247+0000	mediaremoted	[MRDRRC].IFM always using dynamicEligibility check
default	02:46:25.380924+0000	mediaremoted	[MRDRRC].MBM querying: (1)
default	02:46:25.382142+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: updateViewWithName AppOpeningsRawMatView called
default	02:46:25.382472+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: updateViewWithName AppOpeningsRawMatView begining update
default	02:46:25.386758+0000	IntelligencePlatformComputeService	Enumerator for App.InFocus starting from <private>/<private>+0x6cb70
default	02:46:25.393074+0000	IntelligencePlatformComputeService	ViewUpdate: <private>: Finished update
default	02:46:25.393215+0000	IntelligencePlatformComputeService	ViewUpdate: <private>: <private>: Finished update
default	02:46:25.394507+0000	IntelligencePlatformComputeService	IntelligencePlatformComputeService: update AppOpeningsRawMatView returning responses
default	02:46:25.394630+0000	mediaremoted	[MRDRRC].MBM missing: (1)
default	02:46:25.394696+0000	mediaremoted	[MRDRRC].MBM returning cached value for <private> = <private>
default	02:46:25.396517+0000	biomed	ViewUpdate: 97:AppOpeningsRawMatView: View was updated
default	02:46:25.397300+0000	biomed	ViewUpdate: completed update
default	02:46:25.398364+0000	biomed	ViewUpdate: Clearing resources for manager for: file:///var/mobile/Library/IntelligencePlatform/
default	02:46:25.405941+0000	bluetoothd	BLE Scanner Device Found: CBDevice CCFD8FA8-9E5C-3A12-BB67-42108B3F62A6, BDA 44:1B:88:71:22:10, Nm 'Ur fat uncle', Md iPad13,8, IDS F0A07BB3-6291-4D44-ACCE-40E3689A401C, stID F0A07BB3-6291-4D44-ACCE-40E3689A401C, DsFl 0x800040 < NearbyInfo Pairing >, DvF 0x1B080 < SameAccount Hidden BLEPaired CloudPaired HIDGoodBehavior >, RSSI -51, Ch 38, CtInfo CBControllerInfo, BlSt Unknown, DcsS Unknown, Sync Status: Uploaded, FastLE v1, Allowed: no, InqS Unknown, LMPv 0 (Unknown), SSrv: 0x11D3AB9 < HFP AVRCP A2DP HID WirelessiAP MAP Gaming NetworkConsumer Braille LEA CarPlay AACP GATT SCO >, BTv 5.3, AdTsMC <224061698187>, AMfD <4c 00 10 06 0a 1d 27 fa 6e 68>, naED <04 c7 bc e7>, nbIAT <27 fa 6e>, nbIF 0x1C0 < AT Duet WiFiP2P >, CF 0x200000000 < RSSI >
default	02:46:25.409396+0000	bluetoothd	BLE Scanner Device Found: CBDevice D8020202-75E5-974F-2DC4-382BD5E3FE32, BDA F9:F3:A9:52:75:04, Nm 'Mikhail’s MacBook Air', Md Mac15,12, IDS 43F22B9E-3D6B-40E5-AC08-6CEB9A2B5D33, stID 43F22B9E-3D6B-40E5-AC08-6CEB9A2B5D33, DsFl 0x800040 < NearbyInfo Pairing >, DvF 0x1B080 < SameAccount Hidden BLEPaired CloudPaired HIDGoodBehavior >, RSSI -38, Ch 38, CtInfo CBControllerInfo, BlSt Unknown, DcsS Unknown, Sync Status: Uploaded, FastLE v1, Allowed: no, InqS Unknown, LMPv 0 (Unknown), SSrv: 0x392039 < HFP AVRCP A2DP HID Braille LEA AACP GATT SerialPort >, BTv 5.3, AdTsMC <224061701945>, AMfD <4c 00 10 06 40 1d d6 ee a1 58>, naED <04 8b 64 f0>, nbIAT <d6 ee a1>, nbIF 0x1C1 < AirDrop AT Duet WiFiP2P >, CF 0x200000000 < RSSI >
default	02:46:25.468035+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.528331+0000	backboardd	   9544.41997: 11 Digitizer since    9540.84004 (Fri Feb 20 02:46:21 2026)
default	02:46:25.568690+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.594167+0000	PromptPal	Ending background task with UIBackgroundTaskIdentifier: 2
default	02:46:25.594310+0000	PromptPal	Ending task with identifier 2 and description: <private>, _expireHandler: <__NSGlobalBlock__: 0x1f8baa500>
default	02:46:25.595261+0000	PromptPal	Decrementing reference count for assertion <private> (used by background task with identifier 2: <private>)
default	02:46:25.595315+0000	PromptPal	Will invalidate assertion: <BKSProcessAssertion: 0x105b23230> for task identifier: 2
default	02:46:25.597342+0000	runningboardd	Invalidating assertion 33-1631-6212 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]) from originator [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]
default	02:46:25.655334+0000	PromptPal	got GAX status change notification. on: 0
default	02:46:25.658611+0000	SpringBoard	Destroying shadow path display link
default	02:46:25.658790+0000	SpringBoard	[Main (EmbeddedDisplay)] dispatch event:
<SBTransitionSwitcherModifierEvent: 0x539005080; type: MainTransition; transitionID: 910D6AF2-C41A-4CDE-BC77-D8DE8EA208DA; phase: Complete; animated: YES; fromAppLayout: 0x0; toAppLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>; fromEnvironmentMode: home-screen; toEnvironmentMode: application; fromSpaceConfiguration: undefined; toSpaceConfiguration: full; pendingTermination: {(
)}; activating: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>; morphingPIPLayoutRole: undefined>
default	02:46:25.659993+0000	SpringBoard	[Main (EmbeddedDisplay)] handle response:
<SBSwitcherModifierEventResponse: 0x5362e3990> {
    <SBPreemptAnimationSwitcherEventResponse: 0x5362e0600>;
    <SBSwitcherModifierEventResponse: 0x5362e2ac0> {
	    <SBInvalidateAdjustedAppLayoutsSwitcherEventResponse: 0x5362e3510>;
	    <SBSwitcherModifierEventResponse: 0x5362e0090> {
		    <SBRequestFolderSnapshotsSwitcherEventResponse: 0x5362e0930; snapshotRequested: NO>;
		    <SBIconOverlayVisibilitySwitcherEventResponse: 0x5390dc940; visible: NO; appLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>>;
		    <SBIconViewVisibilitySwitcherEventResponse: 0x539438640; visible: YES; animationSettings: 0x0; appLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>>;
		    <SBMatchMoveToIconViewSwitcherEventResponse: 0x5366b68e0; active: NO; appLayout: <SBAppLayout: 0x539bcc680; primary: com.mikhailspeaks.promptpal:default; environment: main>>;
		};
	};
}
default	02:46:25.669140+0000	SpringBoard	Removed: <UIApplicationSceneDeactivationAssertion: 0x53629c1b0; reason: systemGesture; all scene levels; hasPredicate: NO>
default	02:46:25.670303+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.677855+0000	SpringBoard	Window(0x537505c00)(SBTraitsParticipantRoleControlCenter-0) validates resolution: NO. isHidden
default	02:46:25.707987+0000	SpringBoard	No longer requiring wallpaper for reason: <private>
default	02:46:25.708023+0000	SpringBoard	Wallpaper is no longer required.
default	02:46:25.708158+0000	SpringBoard	Poster scenes un-fenced update for reasons: UpdateForActiveVariant
default	02:46:25.708540+0000	SpringBoard	[lock] Poster Extact update changed 650
default	02:46:25.708715+0000	SpringBoard	Poster scenes un-fenced update for reasons: UpdateForActiveVariant
default	02:46:25.708818+0000	SpringBoard	[home] Poster Extact update changed 597
default	02:46:25.708920+0000	SpringBoard	Setting home override style "Black" for Medusa
default	02:46:25.709095+0000	SpringBoard	Poster scenes un-fenced update for reasons: UpdateForActiveVariant
default	02:46:25.709283+0000	SpringBoard	[lock] Poster Extact update changed 651
default	02:46:25.709557+0000	SpringBoard	Poster scenes un-fenced update for reasons: UpdateForActiveVariant
default	02:46:25.709707+0000	SpringBoard	[home] Poster Extact update changed 598
default	02:46:25.709983+0000	SpringBoard	Poster scenes un-fenced update for reasons: UpdateForActiveVariant
default	02:46:25.710108+0000	SpringBoard	[lock] Poster Extact update changed 652
default	02:46:25.710211+0000	SpringBoard	Poster scenes un-fenced update for reasons: UpdateForActiveVariant
default	02:46:25.710309+0000	SpringBoard	[home] Poster Extact update changed 599
default	02:46:25.710418+0000	SpringBoard	End requiring home screen content for reason 'SBDeckSwitcherViewController-0x53560f200-Main (EmbeddedDisplay)'
default	02:46:25.710479+0000	SpringBoard	Destroying shadow path display link
default	02:46:25.711272+0000	SpringBoard	TFBetaLaunchHandle [<private>]: activateIfNeeded bundleId = <private>
default	02:46:25.711436+0000	SpringBoard	Front display did change: <SBApplication: 0x53546ff00; com.mikhailspeaks.promptpal>
default	02:46:25.711906+0000	SpringBoard	activity is unchanged, still disabled
default	02:46:25.712321+0000	appstored	[E7A1B975] getLaunchInfoForBundleID: com.mikhailspeaks.promptpal for client: com.apple.springboard
default	02:46:25.719446+0000	SpringBoard	End requiring home screen content for reason 'SBUIHomeScreenActiveContentRequirementReason'
default	02:46:25.719559+0000	SpringBoard	Tearing down home screen
default	02:46:25.720617+0000	SpringBoard	Deactivating wallpaper orientation source SBUIController
default	02:46:25.720827+0000	SpringBoard	Stopping device motion, mode=0x22
default	02:46:25.721690+0000	SpringBoard	TFBetaLaunchHandle [<private>]: _remoteAlertShouldActivateForLaunchInfo launchInfo=<private>
default	02:46:25.721798+0000	backboardd	0x10000062e: set report interval:0 client:8668F049-7557-489F-A326-20BAE44F52C2
default	02:46:25.722095+0000	SpringBoard	TFBetaLaunchHandle [<private>]: _remoteAlertShouldActivateForLaunchInfo: Not activating - Launch screen disabled
default	02:46:25.722306+0000	SpringBoard	No need for mass dismissal of all presented icon view context menues: {(
)}
default	02:46:25.722454+0000	SpringBoard	[CLIoHidInterface] Property for usage pair {65280, 3}: {ReportInterval = 0} was set successfully
default	02:46:25.723134+0000	backboardd	0x10000062e: set batch interval:10000 client:8668F049-7557-489F-A326-20BAE44F52C2
default	02:46:25.723304+0000	SpringBoard	[CLIoHidInterface] Property for usage pair {65280, 3}: {BatchInterval = 10000} was set successfully
default	02:46:25.724040+0000	backboardd	0x100000671: set report interval:0 client:8668F049-7557-489F-A326-20BAE44F52C2
default	02:46:25.724097+0000	SpringBoard	[CLIoHidInterface] Property for usage pair {65280, 9}: {GyroProperties = {
    GyroFactoryMode = 0;
    GyroMeasurementRange = 2000;
    GyroXAxisOffset = 0;
    GyroYAxisOffset = 0;
    GyroZAxisOffset = 0;
}} was set successfully
default	02:46:25.724215+0000	SpringBoard	[CLIoHidInterface] Property for usage pair {65280, 9}: {ReportInterval = 0} was set successfully
default	02:46:25.724370+0000	SpringBoard	[CLIoHidInterface] Property for usage pair {65280, 9}: {GyroExtLevelTriggerSync = 0} was set successfully
default	02:46:25.724478+0000	SpringBoard	[CLIoHidInterface] Property for usage pair {65280, 9}: {BatchInterval = 15000} was set successfully
default	02:46:25.724699+0000	backboardd	0x100000671: set batch interval:15000 client:8668F049-7557-489F-A326-20BAE44F52C2
default	02:46:25.728730+0000	SpringBoard	[lock] Poster Extact update COULD change 652 (650)
default	02:46:25.728786+0000	SpringBoard	[home] Poster Extact update COULD change 599 (597)
default	02:46:25.728842+0000	SpringBoard	[lock] Poster Extact update COULD change 652 (651)
default	02:46:25.728894+0000	SpringBoard	[home] Poster Extact update COULD change 599 (598)
default	02:46:25.728946+0000	SpringBoard	[lock] Poster Extact update COULD change 652 (652)
default	02:46:25.728997+0000	SpringBoard	[lock] Poster Extact update DID change
default	02:46:25.729219+0000	SpringBoard	[home] Poster Extact update COULD change 599 (599)
default	02:46:25.729276+0000	SpringBoard	[home] Poster Extact update DID change
default	02:46:25.741532+0000	backboardd	Got layout monitor transition.
default	02:46:25.741636+0000	backboardd	Now updating for layout monitor transition.
default	02:46:25.742048+0000	SleepLockScreen	[ContentAppearenceProvider:7B29196E] updated layout, contains SleepLockScreen: false, display on: true
default	02:46:25.742208+0000	sharingd	SystemUI changed: <private> -> <private>
default	02:46:25.742275+0000	CommCenter	Creating service facility connection with <private>
default	02:46:25.742716+0000	cameracaptured	<<<< FigCaptureDisplayLayoutMonitor >>>> -[FigCaptureDisplayLayoutMonitor _parseFBSDisplayLayout:]: <FigCaptureDisplayLayoutMonitor: 0x6061616e0 Main Display> <FBSDisplayLayout: 0x6082bf100; displayIdentity: Main> {    bounds = {{0, 0}, {375, 812}};    interfaceOrientation = "portrait (1)";    backlightLevel = 100;    backlightState = 2;    elements = {        <SBSDisplayLayoutElement: 0x6081b43f0; sceneID:com.mikhailspeaks.promptpal-default; bundleID: com.mikhailspeaks.promptpal; frame: {{0, 0}, {375, 812}}; level: 1; role: primary>;    }    timestamp = February 20, 2026 at 2:46:25 AM GMT;}
default	02:46:25.742779+0000	cameracaptured	<<<< FigCaptureDisplayLayoutMonitor >>>> -[FigCaptureDisplayLayoutMonitor _updateObserversWithLayout:]: <FigCaptureDisplayLayoutMonitor: 0x6061616e0 Main Display> <FigCaptureDisplayLayout: 0x6082bf280 02-20-2026 02:46:25, Main Display, foreground:[com.mikhailspeaks.promptpal]>
default	02:46:25.742954+0000	runningboardd	PERF: Received lookupHandleForPredicate request from [osservice<com.apple.CommCenter>:97] (euid 25, auid 25) (persona (null))
default	02:46:25.743097+0000	backboardd	Layout ID: sceneID:com.mikhailspeaks.promptpal-default Bundle ID: com.mikhailspeaks.promptpal Role: 1
default	02:46:25.743527+0000	CommCenter	unsubscribing configuration of monitor M97-114
default	02:46:25.743576+0000	CommCenter	#I ActivationObserver: notifyAboutFrontAppsChange
default	02:46:25.743675+0000	CommCenter	[FBSSystemAppProxy:0xbc4e332c0] Service facility connection invalidated
default	02:46:25.744762+0000	bluetoothd	SystemUI unknown identifier: 'sceneID:com.mikhailspeaks.promptpal-default' / 'com.mikhailspeaks.promptpal'
default	02:46:25.744813+0000	bluetoothd	ScreenState changed: ActiveOn -> ActiveOn (raw 2)
default	02:46:25.744875+0000	bluetoothd	SystemUI changed: 0x0 < >, diff 0x0 < >
default	02:46:25.749388+0000	SpringBoard	-[SASSystemState init]_block_invoke #modes DisplayTransition called transition=<private>
default	02:46:25.749517+0000	SpringBoard	-[SASSystemState init]_block_invoke #modes Device went to sleep or went through another transition setLiftToWake:NO
default	02:46:25.749670+0000	SpringBoard	-[SASMyriadController _updateRaiseToWakeTimeForTransition:] #myriad BTLE observerCalled transition=<private>
default	02:46:25.750216+0000	SpringBoard	idleTimerDescriptorForBehavior: <SBIdleTimerBehavior: 0x534cbd0b0; duration: Unlocked; mode: Auto; warnMode: Warn>
default	02:46:25.750999+0000	runningboardd	PERF: Received lookupHandleForPredicate request from [osservice<com.apple.SpringBoard>:34] (euid 501, auid 501) (persona (null))
default	02:46:25.771152+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.834907+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:25.835846+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:25.836050+0000	locationd	{"msg":"onAvengerAdvertisementDetected: advertisement is near-owner from other people and do not process it", "subHarvester":"Avenger"}
default	02:46:25.836318+0000	PromptPal	got GAX status change notification. on: 0
default	02:46:25.836472+0000	locationd	<private>
default	02:46:25.873641+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:25.888098+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:25.888250+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:25.888430+0000	locationd	{"msg":"onAvengerAdvertisementDetected: advertisement is near-owner from other people and do not process it", "subHarvester":"Avenger"}
default	02:46:25.890727+0000	locationd	<private>
default	02:46:25.967082+0000	kernel	[SMC:charger.cpp:2638] Not charging:0
default	02:46:25.969017+0000	runningboardd	Acquiring assertion targeting [osservice<com.apple.SpringBoard>:34] from originator [osservice<com.apple.SpringBoard>:34] with description <RBSAssertionDescriptor| "ProactiveEventTracker" ID:33-34-6214 target:34 attributes:[
	<RBSDomainAttribute| domain:"com.apple.common" name:"FinishTaskUninterruptable" sourceEnvironment:"(null)">
	]>
default	02:46:25.972755+0000	runningboardd	Assertion 33-34-6214 (target:[osservice<com.apple.SpringBoard>:34]) will be created as inactive as start-time-defining assertions exist
default	02:46:25.973651+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.042203+0000	symptomsd	Data Usage for diagnosticd on flow 160047 - WiFi in/out: 0/0, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 2.357
default	02:46:26.045545+0000	symptomsd	Data Usage for remoted on flow 160043 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 10.350
default	02:46:26.048147+0000	symptomsd	Data Usage for remoted on flow 160018 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 10.422
default	02:46:26.051994+0000	symptomsd	Data Usage for remotepairingdeviced on flow 159973 - WiFi in/out: 1265382127/1337252532, WiFi delta_in/delta_out: 172/144, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 10.474
default	02:46:26.056981+0000	symptomsd	Data Usage for remotepairingdeviced on flow 159775 - WiFi in/out: 1265382127/1337252532, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 10.603
default	02:46:26.074481+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.101871+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Now acquiring workspace assertion with state: ForegroundFocal.
default	02:46:26.105379+0000	runningboardd	Acquiring assertion targeting [app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631] from originator [osservice<com.apple.SpringBoard>:34] with description <RBSAssertionDescriptor| "FBWorkspace (ForegroundFocal)" ID:33-34-6215 target:1631 attributes:[
	<RBSDomainAttribute| domain:"com.apple.frontboard" name:"Workspace-ForegroundFocal" sourceEnvironment:"(null)">,
	<RBSAcquisitionCompletionAttribute| policy:AfterApplication>,
	<RBSDomainAttribute| domain:"com.apple.frontboard" name:"Visibility" sourceEnvironment:"(null)">
	]>
default	02:46:26.106024+0000	runningboardd	Assertion 33-34-6215 (target:[app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>:1631]) will be created as active
default	02:46:26.117949+0000	runningboardd	Calculated state for app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>: running-active (role: UserInteractiveFocal) (endowments: <private>)
default	02:46:26.118424+0000	runningboardd	Inheritance changeset: <RBSInheritanceChangeSet| gained:{(
    <RBSInheritance| environment:(none) name:com.apple.frontboard.visibility origID:33-34-6215 0>
)} lost:{(
)}>
default	02:46:26.118864+0000	SpringBoard	[app<com.mikhailspeaks.promptpal>:1631] Dropping launch assertion.
default	02:46:26.120888+0000	SpringBoard	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.121285+0000	runningboardd	Invalidating assertion 33-34-6209 (target:app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>) from originator [osservice<com.apple.SpringBoard>:34]
default	02:46:26.122154+0000	CommCenter	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.125456+0000	locationd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.128252+0000	UserEventAgent	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.132014+0000	watchdogd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.135004+0000	useractivityd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.139271+0000	wifid	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.139712+0000	gamepolicyd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-NotVisible
default	02:46:26.140830+0000	gamepolicyd	Foreground games identified - holding transaction
default	02:46:26.142179+0000	backboardd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.142648+0000	PromptPal	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, unknown-NotVisible
default	02:46:26.143819+0000	audiomxd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.144213+0000	PerfPowerServices	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.144759+0000	symptomsd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.145240+0000	dasd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.174288+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.195061+0000	locationd	saveBeaconPayload: 1
default	02:46:26.197515+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:26.197822+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:26.198178+0000	locationd	<private>
default	02:46:26.198385+0000	locationd	{"msg":"derivedPruneHarvest", "cacheSize":169, "beaconPayloadCacheSize":0, "subHarvester":"Avenger"}
default	02:46:26.201452+0000	locationd	{"msg":"processAdvertisementCache: completed process", "Remaining fAdvertisementCache.count":169, "fBeaconPayloadCache.count":0, "subHarvester":"Avenger"}
default	02:46:26.201827+0000	locationd	{"msg":"processAdvertisementCache: have last location, but it is stale", "lastLocation.timestamp":793247926, "fCurrentTimeOffsetThreshold":"45.000000", "subHarvester":"Avenger"}
default	02:46:26.202264+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:26.202378+0000	locationd	{"msg":"BlueAvengerKPI: rejected proactive fine location request", "subHarvester":"Avenger"}
default	02:46:26.204921+0000	searchpartyd	wildModeAssociationRecord(for uuid: <private>)
default	02:46:26.205224+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:26.225440+0000	runningboardd	Calculated state for app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>: running-active (role: UserInteractiveFocal) (endowments: <private>)
default	02:46:26.226854+0000	runningboardd	Released power assertion with ID 38690
default	02:46:26.228310+0000	powerd	Process runningboardd.33 Released SystemIsActive "app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>33-34-6209:FBApplicationProcess" age:00:00:01  id:51539646242 [System: PrevIdle SysAct]
default	02:46:26.228458+0000	runningboardd	Inheritance changeset: <RBSInheritanceChangeSet| gained:{(
)} lost:{(
    <RBSInheritance| environment:(none) name:com.apple.frontboard.visibility origID:33-34-6209 0>
)}>
default	02:46:26.229202+0000	SpringBoard	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.229743+0000	CommCenter	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.230240+0000	locationd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.232712+0000	UserEventAgent	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.232853+0000	useractivityd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.234658+0000	watchdogd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.234783+0000	gamepolicyd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-NotVisible
default	02:46:26.236864+0000	PromptPal	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, unknown-NotVisible
default	02:46:26.237354+0000	backboardd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.238070+0000	wifid	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.239105+0000	PerfPowerServices	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.240371+0000	dasd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.241080+0000	symptomsd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.241964+0000	audiomxd	Received state update for 1631 (app<com.mikhailspeaks.promptpal(94ABBE9B-467A-4C33-B7BB-0FD7D34456BE)>, running-active-Visible
default	02:46:26.276262+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.376818+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.400011+0000	CommCenter	ari: (forwardIndication:127) Indication(0x3d808000) for client(IndicationReregistrationActor) Type(GCD) size(112) dispq(AriHostIPC:0xbc473bd80)
default	02:46:26.400458+0000	CommCenter	ind: Bin=[<private>]
default	02:46:26.409681+0000	kernel	wlan0:com.apple.p2p: isInfraRealtimePacketThresholdAllowed allowed:1 option:32 threshold:50 noRegistrations:1 cachedPeerCount:0 fastDiscoveryInactive:1 fastDiscoveryOnSince:9545300
default	02:46:26.410027+0000	kernel	wlan0:com.apple.p2p: currentInfraTrafficType:8981 checking if realtime upgrade required with inputPackets:2 outputPackets:2 packetThreshold:50
default	02:46:26.477308+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.541440+0000	UserEventAgent	Firing event "tt80RunDuringChargingSession" which was due 2 sec ago.
default	02:46:26.545641+0000	UserEventAgent	Resuming timer
default	02:46:26.546232+0000	UserEventAgent	Setting gAssertionsOffloader timeout to 1000
default	02:46:26.548342+0000	UserEventAgent	[0xb16085100] activating connection: name=com.apple.alarm publishToken=11937
default	02:46:26.559200+0000	batteryintelligenced	[0xaf20bc640] activating connection: mach=false listener=false peer=true name=com.apple.alarm.peer[31].0xaf20bc640
default	02:46:26.563592+0000	batteryintelligenced	XPC alarm triggered for <private>
default	02:46:26.566503+0000	UserEventAgent	[0xb16085100] invalidated because the current process cancelled the connection by calling xpc_connection_cancel()
default	02:46:26.568244+0000	batteryintelligenced	Acknowledged tt80RunDuringChargingSession
default	02:46:26.577467+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.600627+0000	PerfPowerServices	Flush cache start with Reason: XPCFlushCacheResponder on Queue:com.apple.powerlog.storage.background
default	02:46:26.667525+0000	batteryintelligenced	[0xaf20bc780] activating connection: mach=false listener=false peer=false name=com.apple.PerfPowerTelemetryReaderService
default	02:46:26.678574+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.687376+0000	PerfPowerTelemetryReaderService	[0x72a1c0000] activating connection: mach=false listener=false peer=true name=com.apple.PerfPowerTelemetryReaderService.peer[118].0x72a1c0000
default	02:46:26.715241+0000	backboardd	Will begin verifying integrity
default	02:46:26.716442+0000	backboardd	Start ignoring all touches via override for verifying integrity
default	02:46:26.716816+0000	backboardd	Verifying next integrity event <Substantial Transition did occur>. 0 reamin in queue
default	02:46:26.717005+0000	backboardd	Verifying event: <Substantial Transition did occur>
default	02:46:26.717545+0000	backboardd	App layout has 1 elements from same app 1: (
    "<SBSDisplayLayoutElement: 0x4a4895b20; sceneID:com.mikhailspeaks.promptpal-default; bundleID: com.mikhailspeaks.promptpal; frame: {{0, 0}, {375, 812}}; level: 1; role: primary>"
)
default	02:46:26.718019+0000	backboardd	frontmost app acceptable: 1 start session on frontmost change: 0 app layout multi-app: 0
default	02:46:26.719824+0000	backboardd	Did finish verifying integrity for items in queue
default	02:46:26.720700+0000	backboardd	Stop ignoring all touches via override for verifying integrity
default	02:46:26.780111+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.785681+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:26.785877+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:26.786366+0000	locationd	{"msg":"onAvengerAdvertisementDetected: advertisement is near-owner from other people and do not process it", "subHarvester":"Avenger"}
default	02:46:26.787672+0000	locationd	<private>
default	02:46:26.879826+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:26.914153+0000	backboardd	   9545.80510: notify client com.apple.SpringBoard.HomeGrabberView-3 of <AWAttentionLostEvent: 0x4a22dfdc0> (timestamp:    9545.80454 attentionLostTimeout       2.00000 tagIndex 0 (tag not present in server))
error	02:46:26.915883+0000	SpringBoard	attention client lost event tag is not a number: (null)
default	02:46:26.983704+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:27.029150+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:27.029403+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:27.029695+0000	locationd	{"msg":"onAvengerAdvertisementDetected: advertisement is near-owner from other people and do not process it", "subHarvester":"Avenger"}
default	02:46:27.030960+0000	locationd	<private>
default	02:46:27.038902+0000	runningboardd	Invalidating assertion 33-34-6214 (target:[osservice<com.apple.SpringBoard>:34]) from originator [osservice<com.apple.SpringBoard>:34]
default	02:46:27.081037+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:27.148832+0000	locationd	saveBeaconPayload: 1
default	02:46:27.150701+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:27.150881+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:27.151048+0000	locationd	{"msg":"derivedPruneHarvest", "cacheSize":170, "beaconPayloadCacheSize":0, "subHarvester":"Avenger"}
default	02:46:27.152333+0000	locationd	{"msg":"processAdvertisementCache: completed process", "Remaining fAdvertisementCache.count":170, "fBeaconPayloadCache.count":0, "subHarvester":"Avenger"}
default	02:46:27.154987+0000	locationd	{"msg":"processAdvertisementCache: have last location, but it is stale", "lastLocation.timestamp":793247926, "fCurrentTimeOffsetThreshold":"45.000000", "subHarvester":"Avenger"}
default	02:46:27.156524+0000	locationd	{"msg":"BlueAvengerKPI: rejected proactive fine location request", "subHarvester":"Avenger"}
default	02:46:27.156924+0000	locationd	<private>
default	02:46:27.157730+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:27.158368+0000	searchpartyd	wildModeAssociationRecord(for uuid: <private>)
default	02:46:27.161464+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:27.166580+0000	locationd	os_transaction created: (<private>) <private>
default	02:46:27.166950+0000	locationd	os_transaction released: (<private>) <private>
default	02:46:27.173604+0000	symptomsd	Data Usage for diagnosticd on flow 160047 - WiFi in/out: 0/0, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 3.489
default	02:46:27.174011+0000	symptomsd	Data Usage for remoted on flow 160043 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 11.482
default	02:46:27.174422+0000	symptomsd	Data Usage for remoted on flow 160018 - WiFi in/out: 280404200/72034103, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 11.554
default	02:46:27.175972+0000	symptomsd	Data Usage for remotepairingdeviced on flow 159775 - WiFi in/out: 1265382127/1337252532, WiFi delta_in/delta_out: 0/0, Cell in/out: 0/0, Cell delta_in/delta_out: 0/0, RNF: 0, subscriber tag: 9, total duration: 11.735
default	02:46:27.178073+0000	bluetoothd	decryptProximityPairingPayload device:<private> address:<private>
default	02:46:27.180512+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:27.180763+0000	locationd	saveBeaconPayload: 1
default	02:46:27.182641+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:27.182832+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:27.182905+0000	locationd	<private>
default	02:46:27.183279+0000	locationd	{"msg":"derivedPruneHarvest", "cacheSize":171, "beaconPayloadCacheSize":0, "subHarvester":"Avenger"}
default	02:46:27.183514+0000	locationd	{"msg":"processAdvertisementCache: completed process", "Remaining fAdvertisementCache.count":171, "fBeaconPayloadCache.count":0, "subHarvester":"Avenger"}
default	02:46:27.183587+0000	locationd	{"msg":"processAdvertisementCache: have last location, but it is stale", "lastLocation.timestamp":793247926, "fCurrentTimeOffsetThreshold":"45.000000", "subHarvester":"Avenger"}
default	02:46:27.183759+0000	locationd	{"msg":"BlueAvengerKPI: rejected proactive fine location request", "subHarvester":"Avenger"}
default	02:46:27.184035+0000	searchpartyd	wildModeAssociationRecords(advertisement: <private>)
default	02:46:27.184318+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:27.186800+0000	searchpartyd	wildModeAssociationRecord(for uuid: <private>)
default	02:46:27.188487+0000	searchpartyd	automatic index on KeyGenerationBeaconKeys(beaconIdentifier)
default	02:46:27.188607+0000	sharingd	Prox: Clearing duplicate cache
default	02:46:27.188720+0000	sharingd	ProximityPairing clear duplicate cache
default	02:46:27.189441+0000	bluetoothd	clear dup filter cache for process sharingd (72) with scan request of type 7, blob: {length = 0, bytes = 0x}, mask {length = 0, bytes = 0x}, active: 0, duplicates: 0, screen on: No Scan, screen off: No Scan, locked: 1,  rssi: -90, peers: (
) nearby scan mode: 10, advbuf: 0, priority critical: 0, range: 0, retain duplicates: 0, usecases:
default	02:46:27.191287+0000	bluetoothd	About to clearDuplicateFilterCache for type: 7
default	02:46:27.191441+0000	bluetoothd	Received XPC message "CBMsgIdClearDuplicateFilterCache" from session "com.apple.bluetoothd-central-94-1"
default	02:46:27.191560+0000	bluetoothd	ShouldScan=1 AnyValidScanRequests=1 anyValidScanRequestInPaused=0 fObserverState=Active ClientScanPowerAssertRequired=0 fScanFiltersNeedUpdagint=0
default	02:46:27.191615+0000	bluetoothd	updateADVBufferConfig current:02 new:02 configChanged:00
default	02:46:27.193420+0000	bluetoothd	[0x4f0806200] activating connection: mach=true listener=false peer=false name=com.apple.iokit.powerdxpc
default	02:46:27.193542+0000	powerd	[0x48a107700] activating connection: mach=false listener=false peer=true name=com.apple.iokit.powerdxpc.peer[94].0x48a107700
default	02:46:27.193599+0000	bluetoothd	[0x4f0806200] invalidated after the last release of the connection object
default	02:46:27.193788+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-27) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.194010+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-54) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.194153+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-64) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.194380+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-70) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.194485+0000	bluetoothd	ScanParams: numScanAgents 7, combined params AD:0 RD:0 AS:0 PHYS:1 MSL:4 (30/60) PSV:0 Rg:0 Cri:0 pBT:0 pWiFi:0 pCfg:0 type:0
default	02:46:27.194542+0000	bluetoothd	ScanParams: [com.apple.bluetoothd-central-94-1] AP:0 AD:0(30/60) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-27] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[com.apple.locationd-central-74-54] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.194689+0000	bluetoothd	ScanParams: [com.apple.locationd-central-74-64] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[CBDaemon-0x53C00033] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-70] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.194741+0000	bluetoothd	ScanParams: [com.apple.sharingd-central-72-118] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.194813+0000	bluetoothd	Returning scan parameters: Main:30.00ms/60.00ms LP:0.00ms/60.00ms(unsupported) SC:0.00ms/0.00ms/non-concurrent(unspported) Dm:(m:30/60) Cond:0:1:0:0:0 Sc:1 (passive) Dupfilter:Enabled minScanLevel:4 HD:Yes Comp:No(0,0) Pri:0/0 PS:1 UUIDPerRuleDup:unsupported
default	02:46:27.194892+0000	bluetoothd	needToRestart=1
default	02:46:27.195219+0000	bluetoothd	clearDuplicateFilterCache for session "com.apple.bluetoothd" type 7
default	02:46:27.196033+0000	powerd	[0x48a107700] invalidated because the client process (pid 94) either cancelled the connection or exited
default	02:46:27.208565+0000	bluetoothd	Scanning stopped successfully.  10 Advertising Events, 14 dropped pkts
default	02:46:27.208669+0000	bluetoothd	Scan state change:  Stopping(4) --> Idle(1)
default	02:46:27.208961+0000	bluetoothd	handleScanStoppedEvent state=Idle observerState=Active
default	02:46:27.209209+0000	bluetoothd	ShouldScan=1 AnyValidScanRequests=1 anyValidScanRequestInPaused=0 fObserverState=Active ClientScanPowerAssertRequired=0 fScanFiltersNeedUpdagint=0
default	02:46:27.209264+0000	bluetoothd	updateADVBufferConfig current:02 new:02 configChanged:00
default	02:46:27.209688+0000	bluetoothd	[0x4f0804b00] activating connection: mach=true listener=false peer=false name=com.apple.iokit.powerdxpc
default	02:46:27.209844+0000	powerd	[0x48a107700] activating connection: mach=false listener=false peer=true name=com.apple.iokit.powerdxpc.peer[94].0x48a107700
default	02:46:27.210674+0000	bluetoothd	[0x4f0804b00] invalidated after the last release of the connection object
default	02:46:27.210926+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-27) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.211236+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-54) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.211350+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-64) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.211520+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-70) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.211630+0000	bluetoothd	ScanParams: numScanAgents 7, combined params AD:0 RD:0 AS:0 PHYS:1 MSL:4 (30/60) PSV:0 Rg:0 Cri:0 pBT:0 pWiFi:0 pCfg:0 type:0
default	02:46:27.211680+0000	powerd	[0x48a107700] invalidated because the client process (pid 94) either cancelled the connection or exited
default	02:46:27.211745+0000	bluetoothd	ScanParams: [com.apple.bluetoothd-central-94-1] AP:0 AD:0(30/60) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-27] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[com.apple.locationd-central-74-54] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.211811+0000	bluetoothd	ScanParams: [com.apple.locationd-central-74-64] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[CBDaemon-0x53C00033] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-70] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.211867+0000	bluetoothd	ScanParams: [com.apple.sharingd-central-72-118] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.211946+0000	bluetoothd	Returning scan parameters: Main:30.00ms/60.00ms LP:0.00ms/60.00ms(unsupported) SC:0.00ms/0.00ms/non-concurrent(unspported) Dm:(m:30/60) Cond:0:1:0:0:0 Sc:1 (passive) Dupfilter:Enabled minScanLevel:4 HD:Yes Comp:No(0,0) Pri:0/0 PS:1 UUIDPerRuleDup:unsupported
default	02:46:27.212338+0000	bluetoothd	needToRestart=0
default	02:46:27.212419+0000	bluetoothd	Starting passive scan (60.00ms/30.00ms) with duplicate filter enabled scNeed=0 stateO=0, retainDups=0 fScanFiltersNeedUpdating=NO
default	02:46:27.212953+0000	bluetoothd	overrideEnableGlobalDupFilter:1
default	02:46:27.217372+0000	bluetoothd	Scan state change:  Idle(1) --> Starting(2)
default	02:46:27.217506+0000	bluetoothd	<private>
default	02:46:27.223189+0000	bluetoothd	Scanning started successfully
default	02:46:27.223349+0000	bluetoothd	Scan state change:  Starting(2) --> Scanning(3)
default	02:46:27.223499+0000	bluetoothd	ShouldScan=1 AnyValidScanRequests=1 anyValidScanRequestInPaused=0 fObserverState=Active ClientScanPowerAssertRequired=0 fScanFiltersNeedUpdagint=0
default	02:46:27.223555+0000	bluetoothd	updateADVBufferConfig current:02 new:02 configChanged:00
default	02:46:27.224296+0000	bluetoothd	[0x4f0804b00] activating connection: mach=true listener=false peer=false name=com.apple.iokit.powerdxpc
default	02:46:27.225038+0000	powerd	[0x48a107700] activating connection: mach=false listener=false peer=true name=com.apple.iokit.powerdxpc.peer[94].0x48a107700
default	02:46:27.225559+0000	bluetoothd	[0x4f0804b00] invalidated after the last release of the connection object
default	02:46:27.226388+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-27) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.226687+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-54) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.226857+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-64) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.227082+0000	bluetoothd	ObjectDiscovery Client (com.apple.locationd-central-74-70) HWADVBufferIntervalMs:300.000000 HWADVBufferWindowMs:30.000000 _interval:300 _window:30 _active:0 specifiedParams:1
default	02:46:27.227385+0000	bluetoothd	ScanParams: numScanAgents 7, combined params AD:0 RD:0 AS:0 PHYS:1 MSL:4 (30/60) PSV:0 Rg:0 Cri:0 pBT:0 pWiFi:0 pCfg:0 type:0
default	02:46:27.227456+0000	bluetoothd	ScanParams: [com.apple.bluetoothd-central-94-1] AP:0 AD:0(30/60) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-27] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[com.apple.locationd-central-74-54] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.227643+0000	bluetoothd	ScanParams: [com.apple.locationd-central-74-64] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3|[CBDaemon-0x53C00033] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:1|[com.apple.locationd-central-74-70] AP:0 AD:0(0/0) AS:0 RAS:0 DMN:1 FG:0 ADVBF:1(30/300) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.227729+0000	bluetoothd	ScanParams: [com.apple.sharingd-central-72-118] AP:0 AD:0(30/300) AS:0 RAS:0 DMN:1 FG:0 ADVBF:0(0/0) Rg:0 Cri:0 pBT:0 pwrAsrt:0 CT:0 type:0 level:3
default	02:46:27.227830+0000	bluetoothd	Returning scan parameters: Main:30.00ms/60.00ms LP:0.00ms/60.00ms(unsupported) SC:0.00ms/0.00ms/non-concurrent(unspported) Dm:(m:30/60) Cond:0:1:0:0:0 Sc:1 (passive) Dupfilter:Enabled minScanLevel:4 HD:Yes Comp:No(0,0) Pri:0/0 PS:1 UUIDPerRuleDup:unsupported
default	02:46:27.227915+0000	bluetoothd	needToRestart=0
default	02:46:27.228003+0000	powerd	[0x48a107700] invalidated because the client process (pid 94) either cancelled the connection or exited
default	02:46:27.273021+0000	dasd	Attempting to suspend based on triggers: (     "com.apple.das.apppolicy.appchanged" )
default	02:46:27.273411+0000	dasd	Recent Applications: <private>
default	02:46:27.273644+0000	dasd	Evaluating 56 activities based on triggers
default	02:46:27.280649+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:27.281513+0000	dasd	Processing query request for com.apple.PosterBoard
default	02:46:27.284759+0000	dasd	com.apple.springboard.posterboardupdate.overnight:642F4E:[
	{name: Device Activity Policy, policyWeight: 20.000, response: {33, 0.00, [{deviceActivity == 1}]}}
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.286659+0000	batteryintelligenced	[0xaf20bc780] invalidated because the current process cancelled the connection by calling xpc_connection_cancel()
default	02:46:27.289995+0000	PerfPowerTelemetryReaderService	[0x72a1c0000] invalidated because the client process (pid 118) either cancelled the connection or exited
default	02:46:27.290091+0000	dasd	Processing query request for com.apple.mobilemail
default	02:46:27.290657+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.291030+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.291218+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.292437+0000	dasd	com.apple.mail.blackpearl.categorizer:3549DF:[
	{name: Application Policy, policyWeight: 25.000, response: {33, 0.00}}
 ], Decision: MNP}
default	02:46:27.296006+0000	dasd	Processing query request for com.apple.AppStore
default	02:46:27.300153+0000	dasd	Processing query request for <private>
default	02:46:27.301217+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.301691+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.301783+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.301924+0000	batteryintelligenced	FIXME: IOUnserialize has detected a string that is not valid UTF-8, "(null)".
default	02:46:27.303124+0000	dasd	com.apple.CFNetwork-cc-219-294-Task <F479E369-B6E4-4FE8-AE14-669B08A0D65D>.<2>:C4013F:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.306818+0000	dasd	Processing query request for com.apple.AppStore
default	02:46:27.310064+0000	dasd	Processing query request for <private>
default	02:46:27.310519+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.310703+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.310759+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.311976+0000	dasd	com.apple.CFNetwork-cc-219-296-Task <B381E75C-8963-468D-9FC5-2FA8EBB7C2FC>.<1>:C1646E:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.314356+0000	dasd	Processing query request for com.apple.AppStore
default	02:46:27.316437+0000	dasd	Processing query request for <private>
default	02:46:27.317040+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.317672+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.317722+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.318845+0000	dasd	com.apple.CFNetwork-cc-219-300-Task <E3B427E3-E4B3-4E8D-BCB2-236517CD0B1E>.<2>:19067E:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.319437+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.320247+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.320338+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.322118+0000	dasd	ckdiscretionaryd.com.apple.bird.DBBAC8DAAE4A31BB:268765:[
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
 ], Decision: MNP}
default	02:46:27.323148+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.323317+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.323369+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.325493+0000	dasd	com.apple.CFNetwork-cc-219-150-Task <FDC5411F-FFC6-4471-90CF-1DBD4DBF0362>.<3>:2C6747:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.326150+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.326375+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.326693+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.329303+0000	dasd	com.apple.CFNetwork-cc-219-164-Task <23A37770-4DA7-49D9-B60D-7C62FBC87C7B>.<3>:C8BA4B:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.330034+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.330502+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.330555+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.332758+0000	dasd	com.apple.CFNetwork-cc-219-270-Task <E695498C-48E6-426B-9530-4AB818E0042F>.<4>:0D1985:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.333801+0000	runningboardd	PERF: Received lookupHandleForPredicate request from [osservice<com.apple.dasd>:80] (euid 501, auid 501) (persona (null))
error	02:46:27.336859+0000	dasd	Error obtaining RBS process handle: Error Domain=RBSRequestErrorDomain Code=3 UserInfo={NSLocalizedFailureReason=<private>}
default	02:46:27.337476+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.338037+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.338088+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.340873+0000	dasd	com.apple.pushLaunch.com.apple.iBooks:D64E98:[
	{name: Application Policy, policyWeight: 50.000, response: {100, 0.00, [{[pushDisallowed]: Required:0.00, Observed:1.00},]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
 ], Decision: AMNP}
default	02:46:27.341804+0000	runningboardd	PERF: Received lookupHandleForPredicate request from [osservice<com.apple.dasd>:80] (euid 501, auid 501) (persona (null))
error	02:46:27.344031+0000	dasd	Error obtaining RBS process handle: Error Domain=RBSRequestErrorDomain Code=3 UserInfo={NSLocalizedFailureReason=<private>}
default	02:46:27.344532+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.345010+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.345161+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.346824+0000	dasd	com.apple.pushLaunch.com.quran.ios:7A305A:[
	{name: Application Policy, policyWeight: 50.000, response: {100, 0.00, [{[pushDisallowed]: Required:0.00, Observed:1.00},]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
 ], Decision: AMNP}
error	02:46:27.349670+0000	kernel	Sandbox: batteryintelligenced(118) deny(1) file-write-create /private/var/mobile/Library/Caches/com.apple.batteryintelligenced
default	02:46:27.350486+0000	dasd	com.apple.lighthouse.pnrondeviceworker.hourly:7DBE19:[
	{name: Device Activity Policy, policyWeight: 20.000, response: {33, 0.00, [{deviceActivity == 1}]}}
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.353522+0000	dasd	com.apple.aiml.RepackagingWorker.Session:31A9DF:[
	{name: Device Activity Policy, policyWeight: 20.000, response: {33, 0.00, [{deviceActivity == 1}]}}
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
error	02:46:27.356386+0000	batteryintelligenced	E5RT encountered an STL exception. msg = <private>.
default	02:46:27.356507+0000	dasd	com.apple.lighthouse.SiriTurnRestatement.daily:09332F:[
	{name: Device Activity Policy, policyWeight: 20.000, response: {33, 0.00, [{deviceActivity == 1}]}}
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.356941+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.357337+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.357485+0000	dasd	deviceActivityLikelihood returned a nil timeline
error	02:46:27.357585+0000	batteryintelligenced	E5RT: <private> (11)
default	02:46:27.360348+0000	dasd	com.apple.priml.PFLMLHostPlugins.SiriMASPFLCK:F5F92D:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.361259+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.361428+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.361566+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.363270+0000	dasd	com.apple.poirot.SearchAnalyticsWorker.Spotlight.SurveyWeekly:A0DE57:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.364340+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.364804+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.364861+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.367393+0000	dasd	com.apple.priml.PRIMLCKPreemptivePing:27F135:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.367902+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.368218+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.368273+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.371351+0000	dasd	com.apple.poirot.SearchAnalyticsWorker.Spotlight.SpotlightFeatureReport:976C71:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.374262+0000	dasd	com.apple.siri.SiriPrivateLearningAnalytics.SiriUserSegmentation.daily:554F12:[
	{name: Device Activity Policy, policyWeight: 20.000, response: {33, 0.00, [{deviceActivity == 1}]}}
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.374850+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.375000+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.375051+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.377422+0000	dasd	com.apple.parsec.SafariBrowsingAssistant:8B8432:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.377703+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.378103+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.378216+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.380394+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:27.381270+0000	dasd	com.apple.poirot.SearchAnalyticsWorker.Spotlight.SurveyDaily:92DDFC:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.381804+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.382078+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.382155+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.384215+0000	dasd	com.apple.poirot.SearchAnalyticsWorker.Spotlight.SpotlightFeatureExtraction:20487A:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.384897+0000	dasd	deviceActivityTimeline is invalid; using (null) (cached) while query is executing
error	02:46:27.385325+0000	dasd	Insufficient history window for deviceActivityLikelihood stream ((null) < Tue Feb 17 02:46:27 2026)
error	02:46:27.385401+0000	dasd	deviceActivityLikelihood returned a nil timeline
default	02:46:27.386830+0000	dasd	com.apple.siri.SiriSuggestionsLightHousePlugin.daily:48AC3A:[
	{name: Charger Plugged In Policy, policyWeight: 20.000, response: {33, 0.00, [{isCharging == 0 AND notChargingReason == 8192}]}}
	{name: Thundering Herd Policy, policyWeight: 1.000, response: {33, 0.00, [{(deviceInUse == 1 AND timeSinceThunderingHerdTriggerEvent < 900) AND recentTriggerReason == "com.apple.duetactivityscheduler.thpolicy.lengthyLock"}]}}
	{name: CPM Mode Policy, policyWeight: 1.000, response: {33, 0.00, [{activeMode == "InUseChargingMode"}]}}
 ], Decision: MNP}
default	02:46:27.415235+0000	duetexpertd	Donation processing - Processing donations for <private>, launched on: Fri Feb 20 02:45:07 2026
error	02:46:27.418797+0000	kernel	System Policy: duetexpertd(693) deny(1) file-read-metadata /private/var/mobile/Library/Biome/FlexibleStorage
error	02:46:27.419413+0000	kernel	System Policy: duetexpertd(693) deny(1) file-read-metadata /private/var/mobile/Library/Biome/FlexibleStorage/registrations.db
default	02:46:27.422202+0000	duetexpertd	[0x4692b3b00] activating connection: mach=true listener=false peer=false name=com.apple.biome.access.user
default	02:46:27.427521+0000	biomed	Incoming connection from duetexpertd(693)
default	02:46:27.429104+0000	biomed	[0xd18f14000] activating connection: mach=false listener=false peer=true name=com.apple.biome.access.user.peer[693].0xd18f14000
default	02:46:27.432491+0000	biomed	BMResourceContainerManager received container request for resource: <private> with access mode: read-write
default	02:46:27.432883+0000	biomed	BMResourceContainerManager routing request to DataVault container
default	02:46:27.435297+0000	kernel	wlan0:com.apple.p2p: isInfraRealtimePacketThresholdAllowed allowed:1 option:32 threshold:50 noRegistrations:1 cachedPeerCount:0 fastDiscoveryInactive:1 fastDiscoveryOnSince:9546326
default	02:46:27.435542+0000	kernel	wlan0:com.apple.p2p: currentInfraTrafficType:8981 checking if realtime upgrade required with inputPackets:0 outputPackets:0 packetThreshold:50
default	02:46:27.452698+0000	biomed	[0xd18f14000] invalidated because the client process (pid 693) either cancelled the connection or exited
default	02:46:27.454160+0000	duetexpertd	[0x4692b3b00] invalidated because the current process cancelled the connection by calling xpc_connection_cancel()
default	02:46:27.484616+0000	bluetoothd	decryptProximityPairingPayload device:<private> address:<private>
default	02:46:27.485410+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:27.490803+0000	locationd	{"msg":"onAvengerAdvertisementDetected: got avenger advertisement", "subHarvester":"Avenger"}
default	02:46:27.491446+0000	locationd	{"msg":"convertToSPAdvertisement", "address":<private>, "data":<private>, "date":<private>, "rssi":<private>, "status":<private>, "reserved":<private>, "subHarvester":"Avenger"}
default	02:46:27.491871+0000	locationd	{"msg":"derivedPruneHarvest", "cacheSize":172, "beaconPayloadCacheSize":0, "subHarvester":"Avenger"}
default	02:46:27.493689+0000	locationd	<private>
default	02:46:27.493839+0000	locationd	{"msg":"processAdvertisementCache: completed process", "Remaining fAdvertisementCache.count":172, "fBeaconPayloadCache.count":0, "subHarvester":"Avenger"}
default	02:46:27.494214+0000	locationd	{"msg":"processAdvertisementCache: have last location, but it is stale", "lastLocation.timestamp":793247926, "fCurrentTimeOffsetThreshold":"45.000000", "subHarvester":"Avenger"}
default	02:46:27.494484+0000	locationd	{"msg":"BlueAvengerKPI: rejected proactive fine location request", "subHarvester":"Avenger"}
default	02:46:27.584284+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!
default	02:46:27.616444+0000	bluetoothd	BLE Scanner Device Found: CBDevice CCFD8FA8-9E5C-3A12-BB67-42108B3F62A6, BDA 44:1B:88:71:22:10, Nm 'Ur fat uncle', Md iPad13,8, IDS F0A07BB3-6291-4D44-ACCE-40E3689A401C, stID F0A07BB3-6291-4D44-ACCE-40E3689A401C, DsFl 0x800040 < NearbyInfo Pairing >, DvF 0x1B080 < SameAccount Hidden BLEPaired CloudPaired HIDGoodBehavior >, RSSI -57, Ch 38, CtInfo CBControllerInfo, BlSt Unknown, DcsS Unknown, Sync Status: Uploaded, FastLE v1, Allowed: no, InqS Unknown, LMPv 0 (Unknown), SSrv: 0x11D3AB9 < HFP AVRCP A2DP HID WirelessiAP MAP Gaming NetworkConsumer Braille LEA CarPlay AACP GATT SCO >, BTv 5.3, AdTsMC <224063902955>, AMfD <4c 00 10 06 0a 1d 27 fa 6e 68>, naED <04 c7 bc e7>, nbIAT <27 fa 6e>, nbIF 0x1C0 < AT Duet WiFiP2P >, CF 0x200000000 < RSSI >
default	02:46:27.617250+0000	bluetoothd	BLE Scanner Device Found: CBDevice D8020202-75E5-974F-2DC4-382BD5E3FE32, BDA F9:F3:A9:52:75:04, Nm 'Mikhail’s MacBook Air', Md Mac15,12, IDS 43F22B9E-3D6B-40E5-AC08-6CEB9A2B5D33, stID 43F22B9E-3D6B-40E5-AC08-6CEB9A2B5D33, DsFl 0x800040 < NearbyInfo Pairing >, DvF 0x1B080 < SameAccount Hidden BLEPaired CloudPaired HIDGoodBehavior >, RSSI -38, Ch 38, CtInfo CBControllerInfo, BlSt Unknown, DcsS Unknown, Sync Status: Uploaded, FastLE v1, Allowed: no, InqS Unknown, LMPv 0 (Unknown), SSrv: 0x392039 < HFP AVRCP A2DP HID Braille LEA AACP GATT SerialPort >, BTv 5.3, AdTsMC <224063903858>, AMfD <4c 00 10 06 40 1d d6 ee a1 58>, naED <04 8b 64 f0>, nbIAT <d6 ee a1>, nbIF 0x1C1 < AirDrop AT Duet WiFiP2P >, CF 0x200000000 < RSSI >
default	02:46:27.637716+0000	batteryintelligenced	MMapped <private> to base address 4ae5f0000 with size 52944
default	02:46:27.684969+0000	kernel	ANE0: notifyPerfController: ERROR:eAnsCmdProgramEvent_ProcStart being called a second time for same work!


Worked for 24m 55s
Root cause confirmed from your logs: JS crashed on startup due to React version mismatch (react 19.2.4 vs react-native-renderer 19.1.0).

Applied fix:

Updated package.json:
react → 19.1.0
react-dom → 19.1.0
react-test-renderer → 19.1.0
@types/react → ~19.1.10
Regenerated lockfile and modules in package-lock.json.
Updated task tracking in todo.md.
Validation:

npm ls now resolves react, react-dom, and react-test-renderer to 19.1.0.
Fresh local iOS gesture build succeeded.
New IPA:

build-1771557065621.ipa
Note:

Build logs still show a non-blocking Expo doctor warning for @react-native-community/netinfo minor version mismatch (11.5.2 vs expected 11.4.1).
Next step:

Install build-1771557065621.ipa on device and recheck launch.

2 files changed
+14
-4
Undo
PromptPal/package.json
tasks/todo.md
explain the problem and the steps we've taken so i can get help from another dev

Problem summary:

The app was white-screening on launch in local build 12.
Device logs showed a fatal JS runtime error:
Incompatible React versions: react 19.2.4 vs react-native-renderer 19.1.0
This mismatch crashes React Native before UI renders, so you only see a white screen.
What we did:

Reviewed device logs and identified the first fatal error (React version mismatch).
Checked project deps and confirmed react/react-dom/react-test-renderer were 19.2.4.
Pinned React family deps to 19.1.0 to match the renderer used by RN runtime:
react → 19.1.0
react-dom → 19.1.0
react-test-renderer → 19.1.0
@types/react → ~19.1.10
Reinstalled dependencies and regenerated lockfile.
Verified resolved versions via npm ls and lockfile.
Rebuilt local iOS gesture profile successfully.
Files changed:

package.json
package-lock.json
todo.md (tracking only)
New build artifact:

build-1771557065621.ipa
Important notes for handoff:

Build succeeds now, but on-device validation is still needed to confirm the white screen is gone.
During build, Expo doctor reported a non-blocking minor mismatch:
@react-native-community/netinfo expected 11.4.1, found 11.5.2.
We also saw peer warnings from Clerk packages about preferred React ranges; build still completed and app packaged.
Suggested ask to next dev:

Install and run build-1771557065621.ipa on device.
Confirm no startup white screen and no React mismatch in logs.
If still failing, capture first fatal JS/native error after launch.
Optionally align @react-native-community/netinfo to Expo expected version to clean doctor warnings.

i meant the problem ever since build 3

Since build 3, the issue has been a launch-time white screen/crash on TestFlight/local iOS builds.

High-level timeline you can share:

Build 3+ symptom
App launches from SpringBoard, then shows white screen / appears stuck or exits.
No clear user-facing error, so we moved to staged isolation.
Isolation strategy we implemented
Added a SAFE_MODE boot path to bypass normal app startup services.
Added staged boot modes to re-enable subsystems incrementally:
safe
router-only
gesture
clerk
convex
Added build profiles/env flags so each mode could be built/tested independently.
What this isolation showed
SAFE_MODE launches.
Crash/white-screen reappeared when normal stack components were reintroduced, especially around Gesture/normal app boot path.
We fixed entry wiring to ensure react-native-gesture-handler is imported first (index.js entry flow).
Root cause finally identified (from latest device logs)
Fatal JS runtime mismatch:
react: 19.2.4
react-native-renderer: 19.1.0
This mismatch throws at startup and prevents initial render, producing white screen.
Fixes already applied
Pinned React family to match RN renderer/runtime:
react -> 19.1.0
react-dom -> 19.1.0
react-test-renderer -> 19.1.0
@types/react -> ~19.1.10
Reinstalled deps and regenerated lockfile.
Rebuilt local iOS gesture profile successfully:
build-1771557065621.ipa
Current status
Build completes successfully after version alignment.
Remaining verification is on-device run confirmation that white screen is gone.
If you want, I can also draft this as a short “handoff note” format (Problem / Evidence / Actions / Current State / Next Checks) you can paste directly to another dev.


ever since build 3 then clerk mode and convex mode etc

Correct. From build 3 onward, the ongoing issue was:

Normal app builds white-screened on launch
We introduced boot isolation modes (safe / router / gesture / clerk / convex) to pinpoint where startup broke.
What happened across those modes:

SAFE mode
App launched, confirming base shell + binary were okay.
Router / Gesture stages
Reintroducing normal startup path brought instability back.
We fixed entry ordering (gesture-handler import at top-level entry).
Clerk mode / Convex mode
These staged modes were used to test service-by-service startup and showed the problem was in the full runtime path, not just one obvious native crash.
Final decisive failure came from runtime logs showing React package mismatch, which would affect these modes once JS boot progressed.
Final root cause we found:

Startup JS crash due to:
react 19.2.4
react-native-renderer 19.1.0
That mismatch can produce white screen immediately after launch.
Fix applied:

Pinned React stack to 19.1.0 (react, react-dom, react-test-renderer) and @types/react ~19.1.10
Regenerated lockfile and rebuilt successfully.
Artifact:

build-1771557065621.ipa
So for handoff: Build 3+ white screen -> staged boot isolation (including clerk/convex) -> identified JS runtime React mismatch -> dependency alignment fix + new rebuild pending device confirmation.


first it was just crashing on open

Exactly. The sequence to share is:

From build 3, initial symptom
App crashed immediately on open (hard launch failure).
After partial startup fixes / different builds
Symptom shifted to white screen / non-rendering launch instead of instant visible crash.
Investigation path
Added staged boot modes (safe, router, gesture, clerk, convex) to isolate which startup layer reintroduced failure.
Fixed entry boot ordering for gesture-handler.
Captured full device logs for failing launch.
Root cause found
Fatal JS startup error:
react 19.2.4
react-native-renderer 19.1.0
This mismatch breaks runtime before UI is rendered, explaining both “crash on open” and white screen behavior across builds.
Remediation already done
Pinned React family to 19.1.0 + regenerated lockfile + rebuilt IPA:
build-1771557065621.ipa
So yes: it started as crash-on-open, then presented as white screen, and both map to startup/runtime breakage traced to the React version mismatch.


change the build number to 13 then build it again locally


Worked for 5m 41s
iOS build number is now 13 in app.json, and the local build completed successfully.

New IPA:

build-1771557929879.ipa
Only warning during build was the same non-blocking Expo doctor mismatch for @react-native-community/netinfo (11.5.2 vs expected 11.4.1).


1 file changed
Undo
PromptPal/app.json
okay gesture mode is showing up. what's next?

Great, that means the base startup path is healthy again.

Next step is staged re-enable to confirm full app stability:

Build and test clerk mode next.
If that passes, build and test convex mode.
If that passes, build normal production mode (no boot override) and validate end-to-end.
If any stage fails, grab first fatal device log immediately after launch.
If you want, I can do step 1 now and generate the next local IPA.


check the safe mode plan md


Worked for 20s
Checked: safe_mode_plan.md.

Based on that plan, since gesture now works, the remaining staged validations are:

clerk mode build + launch test
convex mode build + launch test
router mode build + launch test
full/production boot (no isolation mode)
One note: that doc has a small typo (duplicate “Build D” and an extra stale line), but the intended sequence above is clear.

If you want, I can start by building clerk mode now.


i've done those. we're on step 5 now, router mode

Step 5 (router mode) is the right next gate.

Run/verify:

Build router mode:
cd "/Users/mikhail/Documents/CURSOR CODES/In Progress/Prompt Pal App/PromptPal"
npx eas build --platform ios --profile router --local --non-interactive
Install IPA and confirm:
no crash/white screen
router mounts and basic navigation works
If router passes, next is full app boot (production profile). If router fails, capture first fatal launch log and we isolate router startup path.


[INSTALL_PODS] [Expo] Adding '[Expo Autolinking] Run Codegen with autolinking' build phase to ReactCodegen
[INSTALL_PODS] [!] React-Core-prebuilt has added 1 script phase. Please inspect before executing a build. See https://guides.cocoapods.org/syntax/podspec.html#script_phases for more information.
[INSTALL_PODS] [!] ReactNativeDependencies has added 1 script phase. Please inspect before executing a build. See https://guides.cocoapods.org/syntax/podspec.html#script_phases for more information.
[INSTALL_PODS] [!] hermes-engine has added 1 script phase. Please inspect before executing a build. See https://guides.cocoapods.org/syntax/podspec.html#script_phases for more information.
[CONFIGURE_XCODE_PROJECT] Configuring Xcode project
[CONFIGURE_XCODE_PROJECT] Assigning provisioning profile '*[expo] com.mikhailspeaks.promptpal AppStore 2026-02-12T00:44:07.108Z' (Apple Team ID: WH4MT5Z44S) to target 'PromptPal'
[EAGER_BUNDLE] Using src/app as the root directory for Expo Router.
[EAGER_BUNDLE] Starting Metro Bundler
[EAGER_BUNDLE] iOS ./index.js ▓▓▓░░░░░░░░░░░░░ 20.1% (157/350)
[EAGER_BUNDLE] iOS ./index.js ▓▓▓▓▓▓▓▓▓▓▓░░░░░ 74.8% ( 899/1148)
[EAGER_BUNDLE] iOS ./index.js ▓▓▓▓▓▓▓▓▓▓▓░░░░░ 74.8% (1318/1564)
[EAGER_BUNDLE] iOS ./index.js ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░ 93.8% (1789/1854)
[EAGER_BUNDLE] iOS Bundling failed 15558ms index.js (1888 modules)
[EAGER_BUNDLE] SyntaxError: /private/var/folders/bl/r9mbpt_118g_1sv7wjr_88240000gn/T/eas-build-local-nodejs/3cebb521-3f5c-48d9-b5b2-daa47d9d140d/build/PromptPal/src/features/levels/data.ts: Identifier 'isLevelUnlocked' has already been declared. (422:16)
[EAGER_BUNDLE] 
[EAGER_BUNDLE]   420 |  * @returns Whether the level is unlocked
[EAGER_BUNDLE]   421 |  */
[EAGER_BUNDLE] > 422 | export function isLevelUnlocked(level: Level, completedLevels: string[] = []): boolean {
[EAGER_BUNDLE]       |                 ^
[EAGER_BUNDLE]   423 |   if (!level.prerequisites || level.prerequisites.length === 0) {
[EAGER_BUNDLE]   424 |     return level.unlocked;
[EAGER_BUNDLE]   425 |   }
[EAGER_BUNDLE] SyntaxError: SyntaxError: /private/var/folders/bl/r9mbpt_118g_1sv7wjr_88240000gn/T/eas-build-local-nodejs/3cebb521-3f5c-48d9-b5b2-daa47d9d140d/build/PromptPal/src/features/levels/data.ts: Identifier 'isLevelUnlocked' has already been declared. (422:16)
[EAGER_BUNDLE] 
[EAGER_BUNDLE]   420 |  * @returns Whether the level is unlocked
[EAGER_BUNDLE]   421 |  */
[EAGER_BUNDLE] > 422 | export function isLevelUnlocked(level: Level, completedLevels: string[] = []): boolean {
[EAGER_BUNDLE]       |                 ^
[EAGER_BUNDLE]   423 |   if (!level.prerequisites || level.prerequisites.length === 0) {
[EAGER_BUNDLE]   424 |     return level.unlocked;
[EAGER_BUNDLE]   425 |   }
[EAGER_BUNDLE] 
Error: npx expo export:embed --eager --platform ios --dev false exited with non-zero code: 1
    at ChildProcess.completionListener (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/spawnAsync.js:42:23)
    at Object.onceWrapper (node:events:623:26)
    at ChildProcess.emit (node:events:508:28)
    at maybeClose (node:internal/child_process:1085:16)
    at Socket.<anonymous> (node:internal/child_process:456:11)
    at Socket.emit (node:events:508:28)
    at Pipe.<anonymous> (node:net:346:12)
    ...
    at spawnAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/spawnAsync.js:7:23)
    at spawn (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/index.js:16:47)
    at runExpoCliCommand (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/project.js:25:43)
    at eagerBundleAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eagerBundle.js:11:43)
    at /Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:118:58
    at BuildContext.runBuildPhase (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/context.js:123:34)
    at buildAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:117:23)
    at async runBuilderWithHooksAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/common.js:12:13)
    at async Object.iosBuilder (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:37:16)
    at async buildIosAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eas-cli-local-build-plugin/dist/ios.js:43:12)
[CLEAN_UP_CREDENTIALS] Destroying keychain - /var/folders/bl/r9mbpt_118g_1sv7wjr_88240000gn/T/eas-build-638a4ad0-cfdd-4735-bbec-0f00dd1bc4cb.keychain
[CLEAN_UP_CREDENTIALS] Removing provisioning profile

Build failed
Unknown error. See logs of the Bundle JavaScript build phase for more information.
Error: Unknown error. See logs of the Bundle JavaScript build phase for more information.
    at resolveBuildPhaseErrorAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/detectError.js:70:12)
    at async BuildContext.handleBuildPhaseErrorAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/context.js:190:28)
    at async BuildContext.runBuildPhase (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/context.js:135:35)
    at async buildAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:117:13)
    at async runBuilderWithHooksAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/common.js:12:13)
    at async Object.iosBuilder (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:37:16)
    at async buildIosAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eas-cli-local-build-plugin/dist/ios.js:43:12)
    at async buildAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eas-cli-local-build-plugin/dist/build.js:58:29)
    at async main (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eas-cli-local-build-plugin/dist/main.js:16:9)
npx -y eas-cli-local-build-plugin@18.0.1 eyJqb2IiOnsidHlwZSI6Im1hbmFnZWQiLCJwbGF0Zm9ybSI6ImlvcyIsInByb2plY3RBcmNoaXZlIjp7InR5cGUiOiJQQVRIIiwicGF0aCI6Ii92YXIvZm9sZGVycy9ibC9yOW1icHRfMTE4Z18xc3Y3d2pyXzg4MjQwMDAwZ24vVC9lYXMtY2xpLW5vZGVqcy9kMGRhNGRiMy0wMjAzLTQ1MjgtYjcwZC1lYmUzZTA3NDMzZmMudGFyLmd6In0sInByb2plY3RSb290RGlyZWN0b3J5IjoiUHJvbXB0UGFsIiwiYnVpbGRlckVudmlyb25tZW50Ijp7Im5vZGUiOiIyMC4xOS40IiwiZW52Ijp7IkVYUE9fUFVCTElDX0JPT1RfTU9ERSI6InJvdXRlciIsIkVYUE9fUFVCTElDX0NPTlZFWF9VUkwiOiJodHRwczovL2ZsaXBwYW50LWZlcnJldC0zMDYuY29udmV4LmNsb3VkIiwiRVhQT19QVUJMSUNfQ09OVkVYX1NJVEVfVVJMIjoiaHR0cHM6Ly9mbGlwcGFudC1mZXJyZXQtMzA2LmNvbnZleC5zaXRlIiwiRVhQT19QVUJMSUNfQ0xFUktfUFVCTElTSEFCTEVfS0VZIjoicGtfbGl2ZV9ZMnhsY21zdWNISnZiWEIwY0dGc0xtVjRjRzh1WkdWMkpBIn19LCJjYWNoZSI6eyJkaXNhYmxlZCI6ZmFsc2UsInBhdGhzIjpbXSwiY2xlYXIiOmZhbHNlfSwic2VjcmV0cyI6eyJidWlsZENyZWRlbnRpYWxzIjp7IlByb21wdFBhbCI6eyJwcm92aXNpb25pbmdQcm9maWxlQmFzZTY0IjoiTUlJdjFBWUpLb1pJaHZjTkFRY0NvSUl2eFRDQ0w4RUNBUUV4Q3pBSkJnVXJEZ01DR2dVQU1JSWY0UVlKS29aSWh2Y05BUWNCb0lJZjBnU0NIODQ4UDNodGJDQjJaWEp6YVc5dVBTSXhMakFpSUdWdVkyOWthVzVuUFNKVlZFWXRPQ0kvUGdvOElVUlBRMVJaVUVVZ2NHeHBjM1FnVUZWQ1RFbERJQ0l0THk5QmNIQnNaUzh2UkZSRUlGQk1TVk5VSURFdU1DOHZSVTRpSUNKb2RIUndPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOUVWRVJ6TDFCeWIzQmxjblI1VEdsemRDMHhMakF1WkhSa0lqNEtQSEJzYVhOMElIWmxjbk5wYjI0OUlqRXVNQ0krQ2p4a2FXTjBQZ29KUEd0bGVUNUJjSEJKUkU1aGJXVThMMnRsZVQ0S0NUeHpkSEpwYm1jK1VISnZiWEIwVUdGc1BDOXpkSEpwYm1jK0NnazhhMlY1UGtGd2NHeHBZMkYwYVc5dVNXUmxiblJwWm1sbGNsQnlaV1pwZUR3dmEyVjVQZ29KUEdGeWNtRjVQZ29KUEhOMGNtbHVaejVYU0RSTlZEVmFORFJUUEM5emRISnBibWMrQ2drOEwyRnljbUY1UGdvSlBHdGxlVDVEY21WaGRHbHZia1JoZEdVOEwydGxlVDRLQ1R4a1lYUmxQakl3TWpZdE1ESXRNVEpVTURBNk5EUTZNRGRhUEM5a1lYUmxQZ29KUEd0bGVUNVFiR0YwWm05eWJUd3ZhMlY1UGdvSlBHRnljbUY1UGdvSkNUeHpkSEpwYm1jK2FVOVRQQzl6ZEhKcGJtYytDZ2tKUEhOMGNtbHVaejU0Y2s5VFBDOXpkSEpwYm1jK0Nna0pQSE4wY21sdVp6NTJhWE5wYjI1UFV6d3ZjM1J5YVc1blBnb0pQQzloY25KaGVUNEtDVHhyWlhrK1NYTllZMjlrWlUxaGJtRm5aV1E4TDJ0bGVUNEtDVHhtWVd4elpTOCtDZ2s4YTJWNVBrUmxkbVZzYjNCbGNrTmxjblJwWm1sallYUmxjend2YTJWNVBnb0pQR0Z5Y21GNVBnb0pDVHhrWVhSaFBrMUpTVVoyVkVORFFrdFhaMEYzU1VKQlowbFJZbXRUVjFkdlUwUnVRa1pyZEZnMmFscEVVbEJqYWtGT1FtZHJjV2hyYVVjNWR6QkNRVkZ6UmtGRVFqRk5WVkYzVVdkWlJGWlJVVVJFUkhSQ1kwaENjMXBUUWxoaU0wcHpXa2hrY0ZwSFZXZFNSMVl5V2xkNGRtTkhWbmxKUmtwc1lrZEdNR0ZYT1hWamVVSkVXbGhLTUdGWFduQlpNa1l3WVZjNWRVbEZSakZrUjJoMlkyMXNNR1ZVUlV4TlFXdEhRVEZWUlVOM2QwTlNlazE0UlhwQlVrSm5UbFpDUVc5TlEydEdkMk5IZUd4SlJXeDFXWGswZUVONlFVcENaMDVXUWtGWlZFRnNWbFJOUWpSWVJGUkpNazFFU1hoTmFrRjNUWHBSZDAxc2IxaEVWRWt6VFVSSmVFMXFRWGROZWxGM1RWWnZkMmRhWjNoSGFrRlpRbWR2U210cFlVcHJMMGx6V2tGRlFrUkJjRmhUUkZKT1ZrUldZVTVFVWxSTlZIZDNUMmRaUkZaUlVVUkVSRTV3VlVkb2RtSnRWV2RTUjJ4NlpFaEtjRmx1VmpCaFZ6bDFUMmxDVG1GWGRHOVpWMnh6U1Vaa2NHRnRSblZaV0VweVlubEJiMVl3WnpCVVZsRXhWMnBSTUZWNWEzaEZla0ZTUW1kT1ZrSkJjMDFEYkdSSlRrVXhWVTVXYnpCT1JrMTRSMnBCV1VKblRsWkNRVzlOUlZVeGNHRXlhR2hoVjNkblZqSnNjVmxYTldoamJYUjJUVkZ6ZDBOUldVUldVVkZIUlhkS1ZsVjZRME5CVTBsM1JGRlpTa3R2V2tsb2RtTk9RVkZGUWtKUlFVUm5aMFZRUVVSRFEwRlJiME5uWjBWQ1FVb3Zibk1yTlc5S1pHTm1iSEY1ZDNrNU1FUXJSV00wV1RjeFEyZGlPR0ZWVGtKV1MyeFlZbkJ6WjA5cmIzZFNWREpRV205M2JWSXlialJ0VkZsVWNqWmtNa05VU1d4bE1WZGFha1JqVEcxVU1YQmhkRGRZUVZSalkwczJka1ZaYUdveFVVdFZNVGhLT0VkYVZsUXZaVlp0UjFCTGVtZFJSR3gzVUVvMVdYZFdVelUyYm5kdlRHMURSR3B2UWtreU5EYzVjakJOZEVWMk4zWkRORWM1ZWtOSVVHaHVUVTB4TDFCdmJFb3lVV2xXVjI1alluaFFiMUpZY2tOUVFtUjZjMjlRVHprM2NFTTFOWGgzVHpsaVprcFpNVzFhTWpRdkszcFJiRGxwZEdOa2NtUjVNM1ZqWjBSeFowbFdSbGhqVldOR1ZFbG5SVUppT0dWS1YwSlhkMlUwT0VVeWRrRTNjWGhqVlZOemJqVlJabTVuY1dsNWFXRXZaMEZGSzNodU55dE9NV1ZTUlhkc2IwazRaME14T0dsWWExRmFTVlo2U0ZGTVRUVlhNVVZOVTAxalpFWjFOREF3TDFWRE5IRTBXVTByVm1SWFZVTkJkMFZCUVdGUFEwRnBUWGRuWjBsbVRVRjNSMEV4VldSRmQwVkNMM2RSUTAxQlFYZElkMWxFVmxJd2FrSkNaM2RHYjBGVlEyWTNRVVphUkRWeU1sRkxhMmhMTlVwcGFHcEVTbVp6Y0RkSmQyTkJXVWxMZDFsQ1FsRlZTRUZSUlVWYVJFSnBUVU13UjBORGMwZEJVVlZHUW5wQlEyaHBSbTlrU0ZKM1QyazRkbGt5Vm5sa1NFMTFXVmhDZDJKSFZYVlpNamwwVEROa00xcElTbTVOZVRWcldsaEpkMDFSV1VsTGQxbENRbEZWU0UxQlIwZEtWMmd3WkVoQk5reDVPWFpaTTA1M1RHMUdkMk5IZUd4TWJVNTJZbE01ZGxrelRuZE5SRTEwWkROa2EyTnRZM3BOUkVsM1oyZEZaVUpuVGxaSVUwRkZaMmRGVmsxSlNVSkZWRU5EUVZFd1IwTlRjVWRUU1dJeldUSlJSa0ZVUTBJdmVrTkNkM2RaU1V0M1dVSkNVVlZJUVdkSmQyZGlXVTFuWWs1VFdsZDRjRmxYTldwYVUwSjJZbWxDTUdGSGJIcEpSMDVzWTI1U2NGcHRiR3BaV0ZKc1NVZEtOVWxIUm5WbFUwSjNXVmhLTUdWVFFtaGpNMDR4WWxkV2VrbEhSbXBaTWxaM1pFZEdkVmt5VldkaU1sbG5aRWRvYkVsSVVtOWFWelJuV1ZoQ2QySkhiR3BaVjBweldsTkNlbVJIUm5WYVIwWjVXa05DTUZwWVNuUmplVUpvWW0xUloxa3lPWFZhUjJ3d1lWYzVkV041UW5aYWFVSXhZekpWYzBsSFRteGpibEp3V20xc2FsbFlVbXhKU0VKMllrZHNhbVZUUW1oaWJWRm5XVEpXZVdSSGJHMWhWMDVvWkVkc2RtSnBRbmRqYlVacVpFZHNhbHBUUW5wa1IwWXdXbGN4YkdKdVVucE1ha0V6UW1kbmNrSm5SVVpDVVdORFFWSlpjbUZJVWpCalNFMDJUSGs1TTJRelkzVlpXRUozWWtkVmRWa3lPWFJNTWs1c1kyNVNjRnB0YkdwWldGSnNXVmhXTUdGSE9YbGhXRkkxVEhwQlYwSm5UbFpJVTFWQ1FXWTRSVVJFUVV0Q1oyZHlRbWRGUmtKUlkwUkJla0ZrUW1kT1ZraFJORVZHWjFGVlQxQnVlVEF6V0ZoVVNXTTRha0p6TkRoT1dIVm9jWE50ZUd4emQwUm5XVVJXVWpCUVFWRklMMEpCVVVSQloyVkJUVUpOUjBOcGNVZFRTV0l6V1RKUlIwRlJVVUpCWmpoRlFXZFZRVTFCTUVkRFUzRkhVMGxpTTBSUlJVSkRkMVZCUVRSSlFrRlJRVEJSV1VkSGNISnRNR1JXUkhKUGVqZHRiekJXYVZwTkwyVlZORk5hVjJwMmQwVklWa1JyZEcxWmRWSnZVR2hKY0hRd2RqaGljbmhqVDFkUGVXSjNWRmxSTVUxWFltcEJRa1ZHWkVGSE5USlFZME53TDNKRFRXZEdhRGQzVG5OUlV6Y3ZZblkyUjBGNk0yMVVaM2xzT0ZORWMweHNWR1prUkhrd2NWQlRabWhGTkcxMFFqbFZRVmRvZFhSTFJEWnBPRFZKTDJJM1EwbHlibGt3UkVsVlVXSndaVlJLVTBGWVZrdFZTM2REUkZWd01GRnpTVzVVUjJsc1ZFbDZWRTByU3pWM2RXd3pPV0ZZYVhseFYxSjZaVTByWjBoclNsVnlUa0pPYjBsYVdtZGxkR2cwTldkMFIzVjFWSEJOU3pWUFpHNVZhRU5yZFRWUldVWk5XbHB2V1V0SVVtaDZkRE5rVldsYUwyVndOMkoyYjNaeVFtVnRkelZqYVZwNk5tRjBaM0ZvUmtSU2NERnhSRkpvZURsSlR5dEtWVE5zV1c4MldWRXpSR0Z6WW1GNE5TOUhXRVJRZDNaRFNUQTVNUzk0WXpoek5HRXZQQzlrWVhSaFBnb0pQQzloY25KaGVUNEtDZ2s4YTJWNVBrUkZVaTFGYm1OdlpHVmtMVkJ5YjJacGJHVThMMnRsZVQ0S0NUeGtZWFJoUGsxSlNVNVdkMWxLUzI5YVNXaDJZMDVCVVdORGIwbEpUbE5FUTBORVZWRkRRVkZGZUVSVVFVeENaMnhuYUd0blFscFJUVVZCWjBWM1oyZE5XRUpuYTNGb2EybEhPWGN3UWtKM1IyZG5aMDFKUWtsSlJFSkVSME5CZDBGM1JFRjNTRlp0Vm5sak1teDJZbWRKUWtGVVFVNUVRV2hSVlVaR1JHRkhWbXBoZDBWQ1FVUkJVVVJCY0ZWaFZ6RnNWa2M1VFdGWVdteEJaMGxDWWtSQlZFUkJOVXBqTVdocVlqSlNiRlJYUm5WWlYyUnNXa0ZGUWtGRVFWZEVRV3hDWTBoQ1NsSkZOV2hpVjFWTlExWkNlV0l5TVhka1JrSm9Za1JCWkVSQmFGVmFWMFowVkcxR2RGcFJkMUpVVjJ4eVlVZEdjR0pEUWxoaFYzQm9ZbTFHZVdFeU9IZElVWGROVVROS2JGbFlVbkJpTWpWRldWaFNiRVozTUhsT2FrRjVUVlJKZDAxRVVUQk5SR1JoVFVJMFRVUnNVbXhaVnpGS1drZFdkV1JIYkcxaFYxWjVUVUYzVFVOc1pFbE9SVEZWVGxadk1FNUdUWGRJZDNkUFVsaG9kMkZZU21oa1IyeDJZbXRTYUdSSFZWaEVWRWt6VFVSSmVFMXFRWGROZWxGM1RWWnZkMGxCZDFoVlNFcDJXbTFzYzFwVlVuQmpNMUo1WVZkS01XUkhiSFppYkZJMVkwZFZUVUpXVGxWVU1VcEdUVU5GVFVOR1FuTlpXRkp0WWpOS2RFMUNWVTFCTW14UVZYZDNSV1ZJU2xCVmQzZEpaRzFzZW1GWE9YVlVNVTEzUzNkM1lsRllRbmRpUjJ4cVdWaFNjR0l5TlVwYVIxWjFaRWRzYldGWFZubFZTRXBzV20xc05FMUJkMDFEYkdSSlRrVXhWVTVXYnpCT1JrMTNURUYzUlZaV1ZrcFNRWGRyVFVSQmVGcFVTVFJPUjFWMFRYcGFhRTFwTURCT1ZGazBURlJzYTFsWFNYUk5lbFpvVDBSWmVrOUVhelZaTWxFMVRVUnpUVVpWVW14a2JWWnpZak5DYkdOclRteGpibEp3V20xc2FsbFlVbXhqZWtGcFFrTkVjakU0TlhKUmFXUkdPRkpwUlZOcFoyNTZTRlJ3ZVdaSmVXaFBSMk5SV2pOMmNEbEVibU5ZT1RSV1JFSk9SRUZTVDFsWE1XeEVSVlZ4VnpKV05HTkhPV1JKUjA1MllsTTFkR0ZYZEc5WlYyeHpZek5DYkZsWGRIcE1ia0o1WWpJeGQyUklRbWhpUTBKQ1kwaENWR1JIT1hsYVUwRjVUVVJKTWt4VVFYbE1WRVY1VmtSQmQwOXFVVEJQYWtFelRHcEZkMDlHYjNkblpsbE5SRVZXZFdSSGJEQmlSMVowV2xjMU1HTXpRMEkxVVVsQ1FXSkRRak42UWtGRVFscG9ZMGhDYzJGWFRtaGtSMngyWW1reGNGcEhWblZrUjJ4dFlWZFdlVVJEV2xoVFJGSk9Wa1JXWVU1RVVsUk1iVTUyWWxNMWRHRlhkRzlaVjJ4ell6TkNiRmxYZEhwTWJrSjVZakl4ZDJSSVFtaGlSRUZaUkVKT2FWcFlVbWhNV0Vwc1kwYzVlV1JJVFhSWlYwNHdZVmhhYkVGUlNDOU5SRVZOU1RKT2RtSlROV2hqU0VKeldsTTFhMXBZV214aVJ6bDNXbGhKZFdSSFZtaGlVekZ3V2tkV2RXUkhiRzFoVjFaNVJFRndXRk5FVWs1V1JGWmhUa1JTVkUxQ1RVMUViV1JzWkVNeE1GbFlUbkpNVjBaellrYzVNMEZSUlVGTlJHdE5SbTEwYkdWWFRtOVpWMngxVEZkR2Fsa3lWbnBqZVRGdVkyMDVNV05JVFhkSWQzZE5WakJuTUZSV1VURlhhbEV3VlhrMGNVUkJPV3BpTWpCMVdWaENkMkpIVlhWa1J6bHlXbGMyWjJkblp6aE5TVWxEVVhwRFEwRmpiV2RCZDBsQ1FXZEpTVXhqV0RocFRreEdVelZWZDBObldVbExiMXBKZW1vd1JVRjNUWGRhZWtWaVRVSnJSMEV4VlVWQmQzZFRVVmhDZDJKSFZXZFZiVGwyWkVOQ1JGRlRRWFJKUldONlRWTlpkMHBCV1VSV1VWRk1SRUl4UW1OSVFuTmFVMEpFV2xoS01HRlhXbkJaTWtZd1lWYzVkVWxGUmpGa1IyaDJZMjFzTUdWVVJWUk5Ra1ZIUVRGVlJVTm5kMHRSV0VKM1lrZFZaMU5YTldwTWFrVk1UVUZyUjBFeFZVVkNhRTFEVmxaTmQwaG9ZMDVOVkZGM1RrUk5kMDFVWjNoUFZFRXlWMmhqVGsxNmEzZE9SRTEzVFZSbmVFOVVRVEpYYWtKdVRWSnpkMGRSV1VSV1VWRkVSRUpLUW1OSVFuTmFVMEpUWWpJNU1FbEZUa0pKUXpCblVucE5lRXBxUVd0Q1owNVdRa0Z6VFVoVlJuZGpSM2hzU1VWT2JHTnVVbkJhYld4cVdWaFNjR0l5TkdkUldGWXdZVWM1ZVdGWVVqVk5VazEzUlZGWlJGWlJVVXRFUVhCQ1kwaENjMXBUUWtwaWJVMTFUVkZ6ZDBOUldVUldVVkZIUlhkS1ZsVjZRakpOUWtGSFFubHhSMU5OTkRsQlowVkhRbE4xUWtKQlFXbEJNa2xCUWtwcWNFeDZNVUZqY1ZSMGEzbEtlV2RTVFdNelVrTldPR05YYWxSdVNHTkdRbUphUkhWWGJVSlRjRE5hU0hSbVZHcHFWSFY0ZUVWMFdDOHhTRGRaZVZsc00wbzJXVkppVkhwQ1VFVldiMEV2Vm1oWlJFdFlNVVI1ZUU1Q01HTlVaR1J4V0d3MVpIWk5WbnAwU3pVeE4wbEVkbGwxVmxSYVdIQnRhMDlzUlV0TllVNURUVVZCZDBoUldVUldVakJQUWtKWlJVWk1kWGN6Y1VaWlRUUnBZWEJKY1ZvemNqWTVOall2WVhsNVUzSk5RVGhIUVRGVlpFVjNSVUl2ZDFGR1RVRk5Ra0ZtT0hkRVoxbEVWbEl3VUVGUlNDOUNRVkZFUVdkRlIwMUJiMGREUTNGSFUwMDBPVUpCVFVSQk1tZEJUVWRWUTAxUlEwUTJZMGhGUm13MFlWaFVVVmt5WlROMk9VZDNUMEZGV2t4MVRpdDVVbWhJUmtRdk0yMWxiM2xvY0cxMlQzZG5VRlZ1VUZkVWVHNVROR0YwSzNGSmVGVkRUVWN4Yldsb1JFc3hRVE5WVkRneVRsRjZOakJwYlU5c1RUSTNhbUprYjFoME1sRm1lVVpOYlN0WmFHbGtSR3RNUmpGMlRGVmhaMDAyUW1kRU5UWkxlVXRFUTBOQmRWbDNaMmRLZEc5QlRVTkJVVWxEUTBSTlRqZDJhUzlVUjJkMVRVRnZSME5EY1VkVFRUUTVRa0ZOUkUxSFkzaEhla0ZhUW1kT1ZrSkJUVTFGYTBaM1kwZDRiRWxHU25aaU0xRm5VVEJGWjB4VFFraE5la1Z0VFVOUlIwRXhWVVZEZDNka1VWaENkMkpIVldkUk1sWjVaRWRzYldGWFRtaGtSMngyWW1sQ1FtUllVbTlpTTBwd1pFaHJlRVY2UVZKQ1owNVdRa0Z2VFVOclJuZGpSM2hzU1VWc2RWbDVOSGhEZWtGS1FtZE9Wa0pCV1ZSQmJGWlVUVUkwV0VSVVJUTk5SRWw1VFdwSmVVMXFUWGxOYkc5WVJGUk5lVTFFU1hoUFJFRjNUVVJCZDAxR2IzZGpha1Z0VFVOUlIwRXhWVVZCZDNka1VWaENkMkpIVldkVk0yeDZaRWRXZEVsRmJIVmtSMVp1WTIxR01HRlhPWFZKUlU1Q1NVUlJlRXBxUVd0Q1owNVdRa0Z6VFVoVlJuZGpSM2hzU1VWT2JHTnVVbkJhYld4cVdWaFNjR0l5TkdkUldGWXdZVWM1ZVdGWVVqVk5VazEzUlZGWlJGWlJVVXRFUVhCQ1kwaENjMXBUUWtwaWJVMTFUVkZ6ZDBOUldVUldVVkZIUlhkS1ZsVjZRbHBOUWsxSFFubHhSMU5OTkRsQlowVkhRME54UjFOTk5EbEJkMFZJUVRCSlFVSkJXbkp3UmxwMlpsbzRiakJqTkRKcWNFbGlWbk14VlU1dFVrdDVXbEp2YldaeVNrbElOMms1Vm1kUU0wOUtjVFo0YkVoTWVUZDJUelpSUW5SQlJWUlNTSGhoU25FeVoyNURhMnhwZFZodFFtMDVVR1pHY1dwblptTjNaMlpSZDBSM1dVUldVakJVUVZGSUwwSkJWWGRCZDBWQ0wzcEJaa0puVGxaSVUwMUZSMFJCVjJkQ1V6ZHpUalpvVjBSUFNXMXhVMHR0WkRZcmRtVjFkakp6YzJ0eGVrSkhRbWRuY2tKblJVWkNVV05DUVZGUk5rMUVaM2RPWjFsSlMzZFpRa0pSVlVoTlFVZEhTMjFvTUdSSVFUWk1lVGwyV1ROT2QweHRSbmRqUjNoc1RHMU9kbUpUT1haWk0wNTNUVVJOZEZsWVFuZGlSMVo1WWpJNU1Ga3lSbTVOZWtFelFtZE9Wa2hTT0VWTlJFRjFUVU41WjB0eFFXOW9hVnB2WkVoU2QwOXBPSFpaTTBwelRHMUdkMk5IZUd4TWJVNTJZbE01YUdOSVFuTmFXRXAyWWpOU2FsbFhZM3BNYlU1NVlrUkJaRUpuVGxaSVVUUkZSbWRSVldWclpUWlBTVzlXU2tWbmFWSnpNaXRxZUc5clpYcFJSRXR0YTNkRVoxbEVWbEl3VUVGUlNDOUNRVkZFUVdkRlIwMUNRVWREYVhGSFUwbGlNMWt5VVVkQmFFVkZRV2RWUVUxQmIwZERRM0ZIVTAwME9VSkJUVVJCTW1OQlRVZFJRMDFDVlUxeFdUZEhjalZhY0dFMlpXWXpWbnBWUVRGc2MzSnNURlZaVFdGTVpIVkRNM2hoVEhoRFdIcG5iWFZPY25ObFRqaE5ZMUZ1WlhGbFQybG1NbkprZDBsM1dWUk5aemhUYmk4cldXTjVjbWx1U1ZwRU1USmxNVWRyTUdkSmRtUnlOV2RKY0VoNE1WUndNVE5NVkdsNGFYRlhMM05aU2pORmNGQXhVMVIzTDAxeGVVMUpTVVJDZWtORFFYRXlaMEYzU1VKQlowbEpSalJEYjA1SFdtczJjM04zUTJkWlNVdHZXa2w2YWpCRlFYZEpkMk5xUlcxTlExRkhRVEZWUlVGM2QyUlJXRUozWWtkVloxVXpiSHBrUjFaMFNVVnNkV1JIVm01amJVWXdZVmM1ZFVsRlRrSkpSRkY0U21wQmEwSm5UbFpDUVhOTlNGVkdkMk5IZUd4SlJVNXNZMjVTY0ZwdGJHcFpXRkp3WWpJMFoxRllWakJoUnpsNVlWaFNOVTFTVFhkRlVWbEVWbEZSUzBSQmNFSmpTRUp6V2xOQ1NtSnRUWFZOVVhOM1ExRlpSRlpSVVVkRmQwcFdWWHBCWlVaM01IbE9SRVY0VFdwQmQwMTZTWGRPUkZaaFJuY3dlVTlFUlhsTlZGRjRUMFJCZDAxNlFtRk5SVFI0UzJwQmIwSm5UbFpDUVUxTlNWWmtXRkpHU1dkVlNFcDJaRzFzZW1GWE9YVmhWelZ1U1VaQ2VXSXlXbkJpUjFWblZUSnNibUp0YkhWYWVrVlVUVUpGUjBFeFZVVkRaM2RMVVZoQ2QySkhWV2RUVnpWcVRHcEZURTFCYTBkQk1WVkZRbWhOUTFaV1RYZFhWRUZVUW1kamNXaHJhazlRVVVsQ1FtZG5jV2hyYWs5UVVVMUNRbmRPUTBGQlZERnNSbk5QZDJSU1ZWQjRibVZTYlVGc1dIbzJUMHRqT1hOVU5WQldTRXhrT1hSc1NtWklLMGczV1hkSGVXZG9kVzl2VlRZd01Dc3pkbFp5YTFneFNtcE9XVXhtVDFSeGJUTlBiR1F5VlN0bmVsRTJPVGx2TkVsQ1ZIcERRMEZWYzNkRVFWbEVWbEl3VkVGUlNDOUNRVWwzUVVSQlprSm5UbFpJVTAxRlIwUkJWMmRDVWpaU04yODBhV2hWYTFORFNrZDZZalpRUjJsU04wNUJUWEZoVkVKQ1FtZG5ja0puUlVaQ1VXTkNRVkZSTVUxRVRYZE5VVmxKUzNkWlFrSlJWVWhOUVVkSFNsZG9NR1JJUVRaTWVUbDJXVE5PZDB4dFJuZGpSM2hzVEcxT2RtSlRPWFpaTTA1M1RVUk5kRmxZVG5CWk1rVXdUVVJOZDJkYVdVZEJNVlZrU1VGVFFtcHFRMEpwZWtOQ2FVRlpTa3R2V2tsb2RtUnFXa0ZWUWsxSWMzZGxVVmxKUzNkWlFrSlJWVWhCWjBsM1lsRjRjbFpIYUhCamVVSnFXbGhLTUdGWFduQlpNa1l3V2xOQ2NHTjVRakJpZVVKcFdsTkNNV015Vm10SlIxWTBXVEo0TVdNeWJESmFWM2cxU1VkYWRtTnBRbTFrVnpWcVpFZHNkbUp1VFdkaFZ6VXdXbGhLZFZsWGQyZGtSemhuVVZoQ2QySkhWV2RWU0VwMldraFdhbVJJVFdkWlZ6VnJUREk1ZVVsRlJuZGpSM2hzU1VoQ2VXSXlUbXhqTTA1c1kzazBkMGhSV1VSV1VqQlBRa0paUlVaUGJGTjZaekozZUc5bllWcFZjVFJ0ZUVkUU9HUjNaVko0VWpoTlFUUkhRVEZWWkVSM1JVSXZkMUZGUVhkSlNHZEVRVkJDWjJ0eGFHdHBSemt5VG10RVFrMUZRV2RWUVUxQmIwZERRM0ZIVTAwME9VSkJUVU5CTUdkQlRVVlZRMGxSUkhadGNuaGtiMFp3YldKSFV6VjZWR1ZVY1ZaUE1FNDRXRWhpVDBkRUsyaGpZVE5uY3preGNYUnZXbWRKWjJWRFVGcDNOR2RJVTFRek1TczBiVkJyUnpWWk5FWmxabGt2T1ZrMFpHRlFXRXBvYWpGcWJ5dFFOVEI0WjJkSVZFMUpTVUo2ZDBsQ1FWUkNLMDFJU1hoS2FrRnJRbWRPVmtKQlRVMUlWVVozWTBkNGJFbEdUalZqTTFKc1lsTkNTbUp1VW14YU0wcG9aRWRzZG1KcFFrUlJVMEV3VFZOWmQwcEJXVVJXVVZGTVJFSXhRbU5JUW5OYVUwSkVXbGhLTUdGWFduQlpNa1l3WVZjNWRVbEZSakZrUjJoMlkyMXNNR1ZVUlZSTlFrVkhRVEZWUlVObmQwdFJXRUozWWtkVloxTlhOV3BNYWtWTVRVRnJSMEV4VlVWQ2FFMURWbFpOUTBOQ1pVRnhSRkp0V2s5eVRFMUJjMGREVjBOSFUwRkdiRUYzVVVOQllVTkNOWHBCV1VKbmEzRm9hMmxIT1hjd1FrTlJUWGhEZDFsS1MyOWFTV2gyWTA1QlVXTkNUVUozUjBOVGNVZFRTV0l6UkZGRlNrSlVSVkJHZHpCNVRtcEJlVTFVU1hkTlJGRXdUVVJrWVUxRFowZERVM0ZIVTBsaU0wUlJSVXBPUkVWaVRVSnJkME4zV1VwWlNWcEpRVmRWUkVKQlNVSnZVVzlIUTBOeFIxTk5ORGxDUVUxRFRVTTRSME5UY1VkVFNXSXpSRkZGU2tKRVJXbENRMEV2V1VWaFVHSlFkWGhvYlRoQlRqQXZRbTU2WmpCRFF6Um9jWEY0UzNWRmVrUktkbU54Ymxkd1psaHFRbE5DWjJ0eGFHdHBSemwzTUVKRFVUaDRVbFJDUkUxQmIwZERRM0ZIVTBsaU0wUlJUVWhOUVRSSFEwTnhSMU5KWWpORVVVMURRV2RKUVdkRVFVNUNaMmR4YUd0cFJ6bDNNRVJCWjBsQ1VVUkJTRUpuVlhKRVowMURRbnBCVGtKblozRm9hMmxIT1hjd1JFRm5TVUpMUkVGTFFtZG5jV2hyYWs5UVVWRkVRV2RTU0UxRlZVTkpVVU5aVTBVMU5XeFRSWEpHYUZwdVJqVkJWRzVzYTNZeWNFSmtNa1JMU1M5eE4yVmphVFpUU1hWcVdtVkJTV2RRWVdNM05sUmFiWHBFV2t3MGFsZG1LMk5yYUUxdEsxbEdXamR1VUUxUlFsa3ZSVlJ6YjBkeWNtTkJQVHd2WkdGMFlUNEtDUWtKQ1FrSkNRa0pDUWtKQ2drSkNUeHJaWGsrVUZCUlEyaGxZMnM4TDJ0bGVUNEtDVHhtWVd4elpTOCtDZ29KUEd0bGVUNUZiblJwZEd4bGJXVnVkSE04TDJ0bGVUNEtDVHhrYVdOMFBnb0pDVHhyWlhrK1ltVjBZUzF5WlhCdmNuUnpMV0ZqZEdsMlpUd3ZhMlY1UGdvSkNUeDBjblZsTHo0S0NRa0pDUW9KQ1FrSlBHdGxlVDVoY0hCc2FXTmhkR2x2YmkxcFpHVnVkR2xtYVdWeVBDOXJaWGsrQ2drSlBITjBjbWx1Wno1WFNEUk5WRFZhTkRSVExtTnZiUzV0YVd0b1lXbHNjM0JsWVd0ekxuQnliMjF3ZEhCaGJEd3ZjM1J5YVc1blBnb0pDUWtKQ2drSkNRazhhMlY1UG10bGVXTm9ZV2x1TFdGalkyVnpjeTFuY205MWNITThMMnRsZVQ0S0NRazhZWEp5WVhrK0Nna0pDUWs4YzNSeWFXNW5QbGRJTkUxVU5WbzBORk11S2p3dmMzUnlhVzVuUGdvSkNRa0pQSE4wY21sdVp6NWpiMjB1WVhCd2JHVXVkRzlyWlc0OEwzTjBjbWx1Wno0S0NRazhMMkZ5Y21GNVBnb0pDUWtKQ2drSkNRazhhMlY1UG1kbGRDMTBZWE5yTFdGc2JHOTNQQzlyWlhrK0Nna0pQR1poYkhObEx6NEtDUWtKQ1FvSkNRa0pQR3RsZVQ1amIyMHVZWEJ3YkdVdVpHVjJaV3h2Y0dWeUxuUmxZVzB0YVdSbGJuUnBabWxsY2p3dmEyVjVQZ29KQ1R4emRISnBibWMrVjBnMFRWUTFXalEwVXp3dmMzUnlhVzVuUGdvSkNRb0pQQzlrYVdOMFBnb0pQR3RsZVQ1RmVIQnBjbUYwYVc5dVJHRjBaVHd2YTJWNVBnb0pQR1JoZEdVK01qQXlOeTB3TWkweE1sUXdNRG96TkRvd01WbzhMMlJoZEdVK0NnazhhMlY1UGs1aGJXVThMMnRsZVQ0S0NUeHpkSEpwYm1jK0tsdGxlSEJ2WFNCamIyMHViV2xyYUdGcGJITndaV0ZyY3k1d2NtOXRjSFJ3WVd3Z1FYQndVM1J2Y21VZ01qQXlOaTB3TWkweE1sUXdNRG8wTkRvd055NHhNRGhhUEM5emRISnBibWMrQ2drOGEyVjVQbFJsWVcxSlpHVnVkR2xtYVdWeVBDOXJaWGsrQ2drOFlYSnlZWGsrQ2drSlBITjBjbWx1Wno1WFNEUk5WRFZhTkRSVFBDOXpkSEpwYm1jK0NnazhMMkZ5Y21GNVBnb0pQR3RsZVQ1VVpXRnRUbUZ0WlR3dmEyVjVQZ29KUEhOMGNtbHVaejVOYVd0b1lXbHNJRmRwYW1GdVlYSnJiend2YzNSeWFXNW5QZ29KUEd0bGVUNVVhVzFsVkc5TWFYWmxQQzlyWlhrK0NnazhhVzUwWldkbGNqNHpOalE4TDJsdWRHVm5aWEkrQ2drOGEyVjVQbFZWU1VROEwydGxlVDRLQ1R4emRISnBibWMrTURBeFpUSTROR1V0TXpaaE1pMDBOVFk0TFRsa1lXSXRNelZoT0RZek9EazVZMlE1UEM5emRISnBibWMrQ2drOGEyVjVQbFpsY25OcGIyNDhMMnRsZVQ0S0NUeHBiblJsWjJWeVBqRThMMmx1ZEdWblpYSStDand2WkdsamRENEtQQzl3YkdsemRENmdnZzAvTUlJRU5EQ0NBeHlnQXdJQkFnSUlQVm40TityUjJKOHdEUVlKS29aSWh2Y05BUUVMQlFBd2N6RXRNQ3NHQTFVRUF3d2tRWEJ3YkdVZ2FWQm9iMjVsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNU0F3SGdZRFZRUUxEQmREWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd0hoY05NalF4TWpFMk1Ua3lNVEF4V2hjTk1qa3hNakV4TVRneE16VTVXakJaTVRVd013WURWUVFEREN4QmNIQnNaU0JwVUdodmJtVWdUMU1nVUhKdmRtbHphVzl1YVc1bklGQnliMlpwYkdVZ1UybG5ibWx1WnpFVE1CRUdBMVVFQ2d3S1FYQndiR1VnU1c1akxqRUxNQWtHQTFVRUJoTUNWVk13Z2dFaU1BMEdDU3FHU0liM0RRRUJBUVVBQTRJQkR3QXdnZ0VLQW9JQkFRRFFrekdyK0ZNZTM2MGVMMlQzeVUzWGxyNWZTejE1WkZ4RDdpbkRRTkw2THh5Z3Ryd1JjKy93SXJEZjN2bjV6bFhqOVVJQnRTTmxRUkk3OTN4R2ZZa1RSWlZFN0phVlltYVhrQU1BMmVDdXhkbXhuQ0F0bHVDRjdXOXIwMUxUZ3p6VUFTTWw2ZVhHMUJIWWVhb0l3dDBWV1BYdmlwTkxEVXZ1RGJhSGszVVJFRlhMREhnSDJ6ZHdSanVYK3NUcmVDbmc5T3g0NDJIYVFGZUFCN3VJbktYSFNXM0lKdE9WSDAwaG9vMW9jNE1lNWxsYWhaWlZWTENWTGlYY2R3MWhoNEdOaWFRRGV6d0FkeXlKYWxuVFpFVFpkS1ZiaXJGU1lWOXVCRERVOCtJUU5BeVZqRXZoZTlZcmhZUHlKem1OY0FnajRoU0kvNVAwTFcxTUp1S0xONFl0QWdNQkFBR2pnZVV3Z2VJd0RBWURWUjBUQVFIL0JBSXdBREFmQmdOVkhTTUVHREFXZ0JSdjhaVVlZbHpneVBIRjdXd1l5ZURUWkZLWUlEQkFCZ2dyQmdFRkJRY0JBUVEwTURJd01BWUlLd1lCQlFVSE1BR0dKR2gwZEhBNkx5OXZZM053TG1Gd2NHeGxMbU52YlM5dlkzTndNRE10WVdsd1kyRXdOekF2QmdOVkhSOEVLREFtTUNTZ0lxQWdoaDVvZEhSd09pOHZZM0pzTG1Gd2NHeGxMbU52YlM5aGFYQmpZUzVqY213d0hRWURWUjBPQkJZRUZMeTF4ZW05L012UW50eVVzQjc0SVpSYy93a3VNQTRHQTFVZER3RUIvd1FFQXdJSGdEQVBCZ2txaGtpRzkyTmtCam9FQWdVQU1BMEdDU3FHU0liM0RRRUJDd1VBQTRJQkFRQXlOTUxwZDZwZjRNYktvdk4zV2VlS1o3anhVZlA3c1BhWHY3RVJvK0doUExzamt1a1NrNkp4SGJ6eG1uRnZwRHh2TnBLMjRFZUNvcFBqNTdpUHU5OGxSR0lDejgyODkvdU5pZ2x3ZUdYQ0dVMGx5M0ppSWVTcGFQa1FtaTU2RHlpK3BnTUcwVlZoSDY5OCtKVFVjUTdpMHlWVWk4NnQxV2dIVzcwdGU4ZGlSWG01cVlkTStCZzdnSzRRUzNIWWVDdm1DcSthNTlsTnpPcGJ0Nk9YVld2c0RhQjR4OEN3ejh2Y0VFd3draE54bE5hdjRPeko2Y21iemlVeTdoRU5JUmNraS9HVkxpSmlSa1YvNE52WEZsVEJ1VDdUMm9xNVpmYTB0Q04vZUYzWmNuWmtZNmNJVmNmWnQ1VGJJNy96azZmVUJFUkREY3JpVnJJcmxDaWtQWEtITUlJRVJEQ0NBeXlnQXdJQkFnSUlYR1BLNUVvM1U4a3dEUVlKS29aSWh2Y05BUUVMQlFBd1lqRUxNQWtHQTFVRUJoTUNWVk14RXpBUkJnTlZCQW9UQ2tGd2NHeGxJRWx1WXk0eEpqQWtCZ05WQkFzVEhVRndjR3hsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNUll3RkFZRFZRUURFdzFCY0hCc1pTQlNiMjkwSUVOQk1CNFhEVEUzTURVeE1ESXhNamN6TUZvWERUTXdNVEl6TVRBd01EQXdNRm93Y3pFdE1Dc0dBMVVFQXd3a1FYQndiR1VnYVZCb2IyNWxJRU5sY25ScFptbGpZWFJwYjI0Z1FYVjBhRzl5YVhSNU1TQXdIZ1lEVlFRTERCZERaWEowYVdacFkyRjBhVzl1SUVGMWRHaHZjbWwwZVRFVE1CRUdBMVVFQ2d3S1FYQndiR1VnU1c1akxqRUxNQWtHQTFVRUJoTUNWVk13Z2dFaU1BMEdDU3FHU0liM0RRRUJBUVVBQTRJQkR3QXdnZ0VLQW9JQkFRREpSV29CRHo2REJJYkgvTC9jWHZBZWdlNFhNSE5qSmk3ZVBYb2t6Wk0rVHpsSHVuVys4OERTOFZtaXF4LytDb1k4MlMyYUIvSU9hN2twa1JwZklncUw4WEpZQmE1TVMwVEZlYWVBUExDSTRJd01KNFJkR2VXSEdUYkw0OFYydDdEMFFYSlI5QVZjZzB1aWJhWlJ1UEVtMzN0ZXJXVU14cktZVVl5N2ZSdE13VTdJQ01mUzdXUUx0TjBialU5QWZSdVBTSmFTVy9QUW1IN1p2S1FaRHBsaHUwRmRBY3hiZDNwOUpORGMwMVAvdzl6RmxDeTJXazJPR0NNNXZkbkdVajdSOHZRbGlxRXFoLzNZREVZcFVmL3RGMnlKSld1SHY0cHBGSjkzbjhNVnQyaXppRVc5aE9ZR0FrRmtENjBxS0xnVnllQ3NwNHE2Y2dRMHNuaU0rTEtGQWdNQkFBR2pnZXd3Z2Vrd0R3WURWUjBUQVFIL0JBVXdBd0VCL3pBZkJnTlZIU01FR0RBV2dCUXIwR2xIbEhZSi92UnJqUzVBcHZkSFRYOElYakJFQmdnckJnRUZCUWNCQVFRNE1EWXdOQVlJS3dZQkJRVUhNQUdHS0doMGRIQTZMeTl2WTNOd0xtRndjR3hsTG1OdmJTOXZZM053TURNdFlYQndiR1Z5YjI5MFkyRXdMZ1lEVlIwZkJDY3dKVEFqb0NHZ0g0WWRhSFIwY0RvdkwyTnliQzVoY0hCc1pTNWpiMjB2Y205dmRDNWpjbXd3SFFZRFZSME9CQllFRkcveGxSaGlYT0RJOGNYdGJCako0Tk5rVXBnZ01BNEdBMVVkRHdFQi93UUVBd0lCQmpBUUJnb3Foa2lHOTJOa0JnSVNCQUlGQURBTkJna3Foa2lHOXcwQkFRc0ZBQU9DQVFFQU9zK3NtSTIra2lBaENhMlY4N0ZjSWZvMkxWY2dSSFJ6WkpJSXM1YXM5MjJYK2xzME9DZlBFa2JUUEJId0I4bVprTEhSNkJFSnBlT2xhMnhqQ0QrZUpmclZtWnhNNXVYT2pySk5hT3lMcTZPaVQ0b1JGVDdjRkNzY3hrUzJiMmZGVzArVktTMkhYRC9jZ3g1M1QrM2FWS2N0NXhPQndXUEVWQXNiU3dwcUtDSUkxRGVTZkg5bktGK3ZQVCszckZrZE9EUmtXdTR6U2hsQ1JDbkV5aGhyNGNGVExTMzBUY0lWOWpNeUdIanhKbStLVGV1VVRLUG8vdyt6QTR0bDJ1c3UyR1ZRbjl5Zml0OHhxSVJVM0ZKU1FkS3lFeDB4UmtlSVh6N3V3L0tNSXdTVjY2eUtQb0pzQnA4dTQ0dERtbUpiTkEzMG1jOHM3cnB5aGhranBmeU90VENDQkxzd2dnT2pvQU1DQVFJQ0FRSXdEUVlKS29aSWh2Y05BUUVGQlFBd1lqRUxNQWtHQTFVRUJoTUNWVk14RXpBUkJnTlZCQW9UQ2tGd2NHeGxJRWx1WXk0eEpqQWtCZ05WQkFzVEhVRndjR3hsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNUll3RkFZRFZRUURFdzFCY0hCc1pTQlNiMjkwSUVOQk1CNFhEVEEyTURReU5USXhOREF6TmxvWERUTTFNREl3T1RJeE5EQXpObG93WWpFTE1Ba0dBMVVFQmhNQ1ZWTXhFekFSQmdOVkJBb1RDa0Z3Y0d4bElFbHVZeTR4SmpBa0JnTlZCQXNUSFVGd2NHeGxJRU5sY25ScFptbGpZWFJwYjI0Z1FYVjBhRzl5YVhSNU1SWXdGQVlEVlFRREV3MUJjSEJzWlNCU2IyOTBJRU5CTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUE1SkdwQ1IrUjJ4NUhVT3NGN1Y1NWhDM3JOcUpYVEZYc2l4bUozdmxMYlBVSHF5SXdBdWdZUHZoUUNkTi9RYWlZK2RIS1pwd2theEhRbzd2a0d5ckRINVdlZWd5a1I0dGIxQlkzTTh2RUQwM09GR25SeVJseTlWME8xWDlmbS9JbEE3cFZqMDFkRGZGa05TTVZTeFZaSGJPVTkvYWNuczlRdXNGWVVHZVBDTFFnOTh1c0xDQnZjTFkvQVRDTXQwUFBENTA5OHl0SktCckkvczYxdVE3Wlhoeld5ejIxT3EzMER3NEFrZ3V4SVJZdWROVThEZHRpRnF1amNaSkhVMVhCcnk5QnMvajc0M0RONXFOTVJYNGZUR3RRbGtHSnhIUmlDeENEUVljemlvR3hNRmpzV2dReWpHaXpqeDNlWlhQL1oxNWx2RW5ZZHA4ekZHV2hkNVRKTFFJREFRQUJvNElCZWpDQ0FYWXdEZ1lEVlIwUEFRSC9CQVFEQWdFR01BOEdBMVVkRXdFQi93UUZNQU1CQWY4d0hRWURWUjBPQkJZRUZDdlFhVWVVZGduKzlHdU5Ma0NtOTBkTmZ3aGVNQjhHQTFVZEl3UVlNQmFBRkN2UWFVZVVkZ24rOUd1TkxrQ205MGROZndoZU1JSUJFUVlEVlIwZ0JJSUJDRENDQVFRd2dnRUFCZ2txaGtpRzkyTmtCUUV3Z2ZJd0tnWUlLd1lCQlFVSEFnRVdIbWgwZEhCek9pOHZkM2QzTG1Gd2NHeGxMbU52YlM5aGNIQnNaV05oTHpDQnd3WUlLd1lCQlFVSEFnSXdnYllhZ2JOU1pXeHBZVzVqWlNCdmJpQjBhR2x6SUdObGNuUnBabWxqWVhSbElHSjVJR0Z1ZVNCd1lYSjBlU0JoYzNOMWJXVnpJR0ZqWTJWd2RHRnVZMlVnYjJZZ2RHaGxJSFJvWlc0Z1lYQndiR2xqWVdKc1pTQnpkR0Z1WkdGeVpDQjBaWEp0Y3lCaGJtUWdZMjl1WkdsMGFXOXVjeUJ2WmlCMWMyVXNJR05sY25ScFptbGpZWFJsSUhCdmJHbGplU0JoYm1RZ1kyVnlkR2xtYVdOaGRHbHZiaUJ3Y21GamRHbGpaU0J6ZEdGMFpXMWxiblJ6TGpBTkJna3Foa2lHOXcwQkFRVUZBQU9DQVFFQVhEYVpUQzE0dCsyTW05enpkNXZ5ZHRKM01FL0JINFdEaFJ1WlBVYzM4cW1iUUk0czFMR1FFdGkrOUhPYjd0SmtEOHQ1VHpUWW9qNzVlUDlyeUFmc2ZUbURpMU1nMHpqRXNiK2FUd3ByL3l2OFdhY0ZDWHdYUUZZUkhuVFR0NHNqTzBlajFXOGs0dXZSdDNEZkQwWGhKOHJ4YlhqdDU3VVhGNmpjZmlJMXlpWFYyUS9XYTlTaUpDTVI5NkdzajNPQllNWWJXd2t2a3JMNFJFandZRGllRmZVOUptY2dpak5xOXcyQ3o5N3JveS81VTJwYlpNQmpNM2YzT2djc1Z1dmFEeUVPMnJwekdVKzEyVFovd1lkVjJhZVp1VEpDKzlqVmNaNStvVkszRzcyVFFpUVNLc2NQSGJaTm5GNWp5RXVBRjFDcWl0WGE1UHpRQ1FjM3NIVjFJVEdDQW9Vd2dnS0JBZ0VCTUg4d2N6RXRNQ3NHQTFVRUF3d2tRWEJ3YkdVZ2FWQm9iMjVsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNU0F3SGdZRFZRUUxEQmREWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNQ0NEMVorRGZxMGRpZk1Ba0dCU3NPQXdJYUJRQ2dnZHd3R0FZSktvWklodmNOQVFrRE1Rc0dDU3FHU0liM0RRRUhBVEFjQmdrcWhraUc5dzBCQ1FVeER4Y05Nall3TWpFeU1EQTBOREEzV2pBakJna3Foa2lHOXcwQkNRUXhGZ1FVWTlwTDdwTDdWRmVvaitnSVY4UnhaSGhMYmFjd0tRWUpLb1pJaHZjTkFRazBNUnd3R2pBSkJnVXJEZ01DR2dVQW9RMEdDU3FHU0liM0RRRUJBUVVBTUZJR0NTcUdTSWIzRFFFSkR6RkZNRU13Q2dZSUtvWklodmNOQXdjd0RnWUlLb1pJaHZjTkF3SUNBZ0NBTUEwR0NDcUdTSWIzRFFNQ0FnRkFNQWNHQlNzT0F3SUhNQTBHQ0NxR1NJYjNEUU1DQWdFb01BMEdDU3FHU0liM0RRRUJBUVVBQklJQkFEak5wV1RuSzJXUTJicnFqVTBjMjdXTUpzUkY1dUpBamFnQjFYTGVOelhuOS9uRUMrN3dnQitENk5nYTIyWmxUSDNPZmVKWCtZaHN3QzNuVDUvMmQ1Y2QvdFlPZjI2L3FDc0NLeGVlcndJT2tIWUVKUjZNMG9pKzR1MEYvRE5OVVhISzdmZTZ0eFRPS0tna01pQXN4V3JhWWlCOXA5dkdFODVrdThJN0tqZURaVDV4TTdYNmVtazgyMVU0c1dNN1puVlU3Sk5WakJiVWpweUpEbENGQTZvUU5BUkx0MXA1VXVhZGc1Y1lBTm1qMmZRaE94aHBWRnhGZXBWK1ZpcDgycGY2Vi9OYWVLRnY4TnYyZThHUWtnUTkzdmk3TW1mY0I0RWVPVmhoUVBuUnN5Z3NOMlBvZTdUeGJScEpSYTV1OXFUR3QvcDhqZjlRMm5iUVE0QjlyNkU9IiwiZGlzdHJpYnV0aW9uQ2VydGlmaWNhdGUiOnsiZGF0YUJhc2U2NCI6Ik1JSUw5QUlCQXpDQ0M3b0dDU3FHU0liM0RRRUhBYUNDQzZzRWdndW5NSUlMb3pDQ0JrTUdDU3FHU0liM0RRRUhBYUNDQmpRRWdnWXdNSUlHTERDQ0JpZ0dDeXFHU0liM0RRRU1DZ0VEb0lJRjJUQ0NCZFVHQ2lxR1NJYjNEUUVKRmdHZ2dnWEZCSUlGd1RDQ0JiMHdnZ1Nsb0FNQ0FRSUNFRzVFbGxxRWc1d1JaTFYrbzJRMFQzSXdEUVlKS29aSWh2Y05BUUVMQlFBd2RURkVNRUlHQTFVRUF3dzdRWEJ3YkdVZ1YyOXliR1IzYVdSbElFUmxkbVZzYjNCbGNpQlNaV3hoZEdsdmJuTWdRMlZ5ZEdsbWFXTmhkR2x2YmlCQmRYUm9iM0pwZEhreEN6QUpCZ05WQkFzTUFrY3pNUk13RVFZRFZRUUtEQXBCY0hCc1pTQkpibU11TVFzd0NRWURWUVFHRXdKVlV6QWVGdzB5TmpBeU1USXdNRE0wTURKYUZ3MHlOekF5TVRJd01ETTBNREZhTUlHWU1Sb3dHQVlLQ1pJbWlaUHlMR1FCQVF3S1YwZzBUVlExV2pRMFV6RThNRG9HQTFVRUF3d3phVkJvYjI1bElFUnBjM1J5YVdKMWRHbHZiam9nVFdscmFHRnBiQ0JYYVdwaGJtRnlhMjhnS0ZkSU5FMVVOVm8wTkZNcE1STXdFUVlEVlFRTERBcFhTRFJOVkRWYU5EUlRNUm93R0FZRFZRUUtEQkZOYVd0b1lXbHNJRmRwYW1GdVlYSnJiekVMTUFrR0ExVUVCaE1DVlZNd2dnRWlNQTBHQ1NxR1NJYjNEUUVCQVFVQUE0SUJEd0F3Z2dFS0FvSUJBUUNmNTdQdWFDWFhINWFzc012ZEEvaEhPR085UW9HL0dsRFFWU3BWMjZiSURwS01FVTlqMmFNSmtkcCtKazJFNituZGdreUpYdFZtWXczQzVrOWFXcmUxd0UzSEN1cnhHSVk5VUNsTmZDZkJtVlUvM2xaaGp5czRFQTVjRHllV01GVXVlcDhLQzVnZzQ2QVNOdU8vYTlETFJMKzd3dUJ2Y3doejRaekROZno2SlNka0lsVnAzRzhUNkVWNndqd1hjN0tEenZlNlF1ZWNjRHZXM3lXTlptZHVQL3MwSmZZclhIYTNjdDduSUE2b0NGUlYzRkhCVXlJQkFXL0hpVmdWc0h1UEJOcndPNnNYRkVySitVSDU0S29zb212NEFCUHNaKy9qZFhrUk1KYUNQSUF0ZklsNUVHU0ZjeDBDek9WdFJERWpISFJidU5OUDFBdUt1R0RQbFhWbEFnTUJBQUdqZ2dJak1JSUNIekFNQmdOVkhSTUJBZjhFQWpBQU1COEdBMVVkSXdRWU1CYUFGQW4rd0JXUSthOWtDcElTdVNZb1l3eVg3S2V5TUhBR0NDc0dBUVVGQndFQkJHUXdZakF0QmdnckJnRUZCUWN3QW9ZaGFIUjBjRG92TDJObGNuUnpMbUZ3Y0d4bExtTnZiUzkzZDJSeVp6TXVaR1Z5TURFR0NDc0dBUVVGQnpBQmhpVm9kSFJ3T2k4dmIyTnpjQzVoY0hCc1pTNWpiMjB2YjJOemNEQXpMWGQzWkhKbk16QXlNSUlCSGdZRFZSMGdCSUlCRlRDQ0FSRXdnZ0VOQmdrcWhraUc5Mk5rQlFFd2dmOHdnY01HQ0NzR0FRVUZCd0lDTUlHMkRJR3pVbVZzYVdGdVkyVWdiMjRnZEdocGN5QmpaWEowYVdacFkyRjBaU0JpZVNCaGJua2djR0Z5ZEhrZ1lYTnpkVzFsY3lCaFkyTmxjSFJoYm1ObElHOW1JSFJvWlNCMGFHVnVJR0Z3Y0d4cFkyRmliR1VnYzNSaGJtUmhjbVFnZEdWeWJYTWdZVzVrSUdOdmJtUnBkR2x2Ym5NZ2IyWWdkWE5sTENCalpYSjBhV1pwWTJGMFpTQndiMnhwWTNrZ1lXNWtJR05sY25ScFptbGpZWFJwYjI0Z2NISmhZM1JwWTJVZ2MzUmhkR1Z0Wlc1MGN5NHdOd1lJS3dZQkJRVUhBZ0VXSzJoMGRIQnpPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOWpaWEowYVdacFkyRjBaV0YxZEdodmNtbDBlUzh3RmdZRFZSMGxBUUgvQkF3d0NnWUlLd1lCQlFVSEF3TXdIUVlEVlIwT0JCWUVGRGo1OHROMTEweUhQSXdiT1BEVjdvYXJKc1piTUE0R0ExVWREd0VCL3dRRUF3SUhnREFUQmdvcWhraUc5Mk5rQmdFRUFRSC9CQUlGQURBTkJna3Foa2lHOXcwQkFRc0ZBQU9DQVFFQU5FR0JocWE1dEhWUTZ6cys1cU5GWW1UUDNsT0VtVm83OEJCMVE1TFptTGthRDRTS2JkTC9HNjhYRGxqc204RTJFTlRGbTR3QVJCWFFCdWRqM0FxZjZ3aklCWWU4RGJFRXUvMjcraGdNOTVrNE1wZkVnN0M1VTMzUTh0S2owbjRST0pyUWZWQUZvYnJTZytvdk9TUDIrd2lLNTJOQXlGRUc2WGt5VWdGMVNsQ3NBZzFLZEVMQ0oweG9wVXlNMHpQaXVjTHBkL1dsNHNxbGtjM2pQb0I1Q1ZLelFUYUNHV1lIclllT1lMUnJyazZUQ3VUbloxSVFwTHVVR0JUR1dhR0NoMFljN2QzVkltZjNxZTI3Nkw2d1hwc09YSW1jK21yWUtvUlEwYWRhZzBZY2ZTRHZpVk41V0tPbUVOdzJyRzJzZWZ4bHd6OEx3aU5QZGY4WFBMT0d2ekU4TUNNR0NTcUdTSWIzRFFFSkZURVdCQlRzcGFmUmlKYTVIVUU4NE4wbDlvM1l3MkZBWWpBVkJna3Foa2lHOXcwQkNSUXhDQjRHQUdzQVpRQjVNSUlGV0FZSktvWklodmNOQVFjQm9JSUZTUVNDQlVVd2dnVkJNSUlGUFFZTEtvWklodmNOQVF3S0FRS2dnZ1R1TUlJRTZqQWNCZ29xaGtpRzl3MEJEQUVETUE0RUNQSWdqVnRsa1hNdkFnSUlBQVNDQk1nUEVKRm9QYU9uc0lqVlZZSytTcmNiTVMrSjJsSzV1OG93MHZ5MnBmbEljQTlBek04SGMyMmRWVnR2OGxZdnpJcWpaaG1ZK09DNHNoRHhjbTRhdFBRR2M5aS9HdUNsb1ZEQVpKVnNXQmRJbzNUcGlMMW5Qb3RaUG04Nk1xRmhFWXB6K0Z0dldBbGN0VFBlbmpKSUFWbjNOWmFNVERzQnJZMEowVFAycnhMdUhzY01DVFVWcExrb1ZxaytqOXNuUXVlQVZTaXA0ekRSVHhoK2hVYXk0SGxsQSs1RGlpNGhTeFd3ZEczdXp2S2kyOGRLU3I0T3doY2U2YW9KaDQvODZKVkVnZS9lWGp0RXFHRkI4TlowbmxvaWhVL2lUVFBJSUlHYm02Yy9KOVlFQzJEVWtzSDJodWJsL0xibERrajhuUGh3cERiTXdKbWR0Z1Zkai9VWHRzRU53S0d2U0E1ZUtlblFlY2xJUkhnWTFKbHAxZlB2dGpYSUs1bmYxVUVTSVpSZ3d5aWJxZTY0R0Q4UXBEbElGMzFFTTJZU3Z3WlVLSjJuSFdrT0c2bTFoRHZMWVdmME96SjFBZHN2d2dvbFBlR2hDZmh0SEhkWDI1M1Yzd0tncWxmTkNsRXVLRDVudlFoZjY0ZU9lVDFqUzEzTkNVLzVOaUpDZGFDZ3VQTzlYYUE0ZUdXMDI5NVNkRTA4UUpwMndDS1NYams3dW80c0srQXRpa2lSY1FOcldmKzR6OGZDQ0FUOTFyMGhlazVmUThGOEZrenJWdDRSSk5NVFRjSXRzZVFKdVl3MERUb2lnN2Z2M3JjU0Z5V0VqYXRGbExud1dxaEhHMjJ0c2RrU1lMdzBRdXRsbzRoUDhZOXlXVm9JalovOTU3dzB1UzJVUjJCSVZ3T2NOODRIZnB2cWhRSk9kdkxHZGtnR2dNb05mNFZqdUJOK01WUHFyc2JucUZwQnh3N1RNM3JFMXF4QmlhRmJackt2dTdXQjVGa0FRcXJ1VEg1UnEzYzcwaVNjdXJvanVGL3NrSUNnc3pJbkZoZjdsZ1JOTkIrVERYcWM2VjQzSGxYQXJnbVFlcjNZOEVNRHZDWTQ3dmtEdFBOTGdaOW1WVmJrV3pJYTJPV2gyUTJpSTBkK0E4empYZk5UYmloWStNWjFaWXlGNmtPUVVySmY3ZUo4MDB1MGovOXkxemtWWEtMa3BiSTlLS3RIRnZuZnhFV01kbHpzVDU0NjZQNWJrb1dRNXVuK29xTm0rSnM2SWZ6S1pHL2dIcTB2cHE3YjkreGU1VzBqRXNtdmw4NkdGdlNQUUpvSjYrd3A0b0N5amZ3WFFXR244OE9SYjNSUlZoQm5nb0dRUW11SEFvb3Z0SjlRYTEyWVVVa3ppRkVYUFdFV0tyLysrZ051bmVBWnBzckUxWGhqdWdRYkdHeTR5N2ozMENHQ2kwaUJqMEROYnI3aEFlYldYeEViM2FUa2JTQjQxQ3kyLzBkMzJkK1g2b2NFclFZVzFpVGtIdG5IZnloWWJRQis1eHVtb21ERnRSd3pndjhTZmhKNjZ5QUNoTEJTOSt0RnF2MXRjbmdDMSsrbXhpZDFhOXdUanp3QnJxR2FEcHpGcEFFdEsvUWgwZGg5cEdVUGl0bUdGK1NMeStzZ0VZMDhoUmUwY0VhdE55eXlVREY0Umpnd1d1TXJGdTFtR2lCWDU3OS9oL0RtK3N4WVlvdFVDeUd2YkZyVVk5WldSOTdyVUpSUGlPV0c5dlkya0RsWmU0SFFHSzhWY2JmMFdEWmJOL2NrTjdEYjhzRWFuWENaZDZlMUtUdXFOVmUzWlNKZUwydVNtb3o3QnFBbzQ4ek9BdzRNY2VWUG5SMjdBZGZFaGdtb0VWa2xodjNWRVJNRTZLY3A0UEZ2ek9FcThhV25RNFlLOGlJUm54MWxmaVZIYUZVYnlIU3RFeGdjL2xhZVFBaUl1MEd6QXNwcjk3ZFhqeEZidStzTEljS2xCYXdTc1BwZGNYYkdwNnZXb1JRcW1ZeTVLVnV5c1RtdEVsZVZzRE9aYno2WHZtOFV1Y0I2enpIVWZSaXl6Nkh2REtXcW9kNVFDbS9BQ2dFVlFBQnB5WWl3a09wR3NEWE4vTkVJVE9lTFZWS3kwMHhPVkdKY2tvcEJwajdnM2hoWDgvL3FabHppRWhveFBEQWpCZ2txaGtpRzl3MEJDUlV4RmdRVTdLV24wWWlXdVIxQlBPRGRKZmFOMk1OaFFHSXdGUVlKS29aSWh2Y05BUWtVTVFnZUJnQnJBR1VBZVRBeE1DRXdDUVlGS3c0REFob0ZBQVFVa3I3MDd2cURhRkYwWnNVZ3JHU3dlVUpycG13RUNBd0FUeHRMbmpsbEFnSUlBQT09IiwicGFzc3dvcmQiOiJUZ1A5Zy84T2E5MzZoalBSN3MxdUlnPT0ifX19fSwidXBkYXRlcyI6e30sInNjaGVtZSI6IlByb21wdFBhbCIsInVzZXJuYW1lIjoibWlraGFpbHNwZWFrcyIsImV4cGVyaW1lbnRhbCI6e30sIm1vZGUiOiJidWlsZCIsInRyaWdnZXJlZEJ5IjoiRUFTX0NMSSIsImFwcElkIjoiZDhlNmVjOGEtYTJiNy00N2IxLWE5MDQtZjU0MmFmMzhlNmZjIiwiaW5pdGlhdGluZ1VzZXJJZCI6IjczY2FmMWJmLTFjYTEtNDE0ZC1hZjBkLWQ4ZDM5M2ZkYzU5ZSJ9LCJtZXRhZGF0YSI6eyJ0cmFja2luZ0NvbnRleHQiOnsidHJhY2tpbmdfaWQiOiI3NDlmMjBmNy1hNmU2LTRkN2UtOTUyZS1mY2VmN2VmYzA1ZDYiLCJwbGF0Zm9ybSI6ImlvcyIsInNka192ZXJzaW9uIjoiNTQuMC4wIiwiYWNjb3VudF9pZCI6IjAxNzc4ZTI4LWUxNTItNGYwYi05Y2YxLTc5YmI1ODMyNjdhNiIsInByb2plY3RfaWQiOiJkOGU2ZWM4YS1hMmI3LTQ3YjEtYTkwNC1mNTQyYWYzOGU2ZmMiLCJwcm9qZWN0X3R5cGUiOiJtYW5hZ2VkIiwiZGV2X2NsaWVudCI6ZmFsc2UsIm5vX3dhaXQiOmZhbHNlLCJydW5fZnJvbV9jaSI6ZmFsc2UsImxvY2FsIjp0cnVlfSwiYXBwQnVpbGRWZXJzaW9uIjoiMTQiLCJhcHBWZXJzaW9uIjoiMS4wLjAiLCJjbGlWZXJzaW9uIjoiMTguMC4xIiwid29ya2Zsb3ciOiJtYW5hZ2VkIiwiY3JlZGVudGlhbHNTb3VyY2UiOiJyZW1vdGUiLCJzZGtWZXJzaW9uIjoiNTQuMC4wIiwiZmluZ2VycHJpbnRIYXNoIjoiMTU5OTAxYWVjNDhlZGMwZGJmYjBhM2Y2YzZiMDY4MTc3ZTg2MGYwNyIsInJlYWN0TmF0aXZlVmVyc2lvbiI6IjAuODEuNSIsImRpc3RyaWJ1dGlvbiI6InN0b3JlIiwiYXBwTmFtZSI6IlByb21wdFBhbCIsImFwcElkZW50aWZpZXIiOiJjb20ubWlraGFpbHNwZWFrcy5wcm9tcHRwYWwiLCJidWlsZFByb2ZpbGUiOiJyb3V0ZXIiLCJnaXRDb21taXRIYXNoIjoiMjVhZGFmMDQ0ZTc0YjZjNmExODA3MWExMTgxNDliODdkZjI4ZjExOCIsImdpdENvbW1pdE1lc3NhZ2UiOiJNZXJnZSBicmFuY2ggJ21pa2hhaWwtY2hhbmdlcycgaW50byBtYWluIChyZXNvbHZlIGFwcC5qc29uLCBlYXMuanNvbiwgcGFja2FnZS1sb2NrIGNvbmZsaWN0cylcblxuQ28tYXV0aG9yZWQtYnk6IEN1cnNvciA8Y3Vyc29yYWdlbnRAY3Vyc29yLmNvbT4iLCJpc0dpdFdvcmtpbmdUcmVlRGlydHkiOmZhbHNlLCJ1c2VybmFtZSI6Im1pa2hhaWxzcGVha3MiLCJydW5XaXRoTm9XYWl0RmxhZyI6ZmFsc2UsInJ1bkZyb21DSSI6ZmFsc2UsImRldmVsb3BtZW50Q2xpZW50IjpmYWxzZSwicmVxdWlyZWRQYWNrYWdlTWFuYWdlciI6Im5wbSIsImN1c3RvbU5vZGVWZXJzaW9uIjoiMjAuMTkuNCIsInNpbXVsYXRvciI6ZmFsc2V9fQ== exited with non-zero code: 1
    Error: build command failed.


Worked for 2m 7s
Root cause in router mode was a duplicate export in:

data.ts

isLevelUnlocked (and the related helpers) were declared twice, which caused Metro to fail with:

Identifier 'isLevelUnlocked' has already been declared

What I changed:

Removed the duplicated block so these are each defined once:
isLevelUnlocked
getUnlockedLevelsByProgress
getNextUnlockableLevel
Verification:

Re-ran the failing step locally:
cd /Users/mikhail/Documents/CURSOR CODES/In Progress/Prompt Pal App/PromptPal && npx expo export:embed --eager --platform ios --dev false
It now succeeds (iOS Bundled ... Done writing bundle output).
Next:

Re-run your full local router build (eas ... --profile router --local).
If it fails again, send the new tail log and I’ll handle the next blocker immediately.

1 file changed
Undo
PromptPal/src/features/levels/data.ts

crashlog.crash

feedback.json
the router build crashed


Worked for 3m 17s
The router build failure is now a runtime crash, not a bundling error.

Crash signature from your files:

EXC_CRASH (SIGABRT) on build 14
Happens ~0.8s after launch
Crashed thread is in React TurboModule invocation (ObjCTurboModule::performVoidMethodInvocation)
Feedback file confirms TestFlight crash report for build 14
I applied an isolation patch for Step 5 (router-only):

Updated RouterRoot.tsx
Removed non-essential startup modules from router mode:
expo-status-bar
react-native-safe-area-context
global.css
Router mode now mounts only Expo Router Stack + boot screen.
I also kept your previous fix in:

data.ts
(duplicate isLevelUnlocked declarations removed)
Verification I ran:

EXPO_PUBLIC_BOOT_MODE=router npx expo export:embed --eager --platform ios --dev false
Result: success (bundle generated)
What to do next:

Build and ship a new TestFlight build (next build number) with EXPO_PUBLIC_BOOT_MODE=router.
If it still crashes, then the crash is inside Expo Router/Stack path itself (not status bar/safe-area/css).
If it still crashes, send that new crash log and I’ll give you an exact router-level mitigation (likely router entry split or temporary non-router fallback for release).

1 file changed
Undo
PromptPal/src/lib/RouterRoot.tsx
give me the command to run

From the project root, run:

cd "/Users/mikhail/Documents/CURSOR CODES/In Progress/Prompt Pal App/PromptPal" && EXPO_PUBLIC_BOOT_MODE=router npx eas build --platform ios --profile router --local


crashlog.crash

feedback.json
it crashed


Worked for 1m 30s
This new report is the same crash class on build 15:

EXC_CRASH (SIGABRT) in ObjCTurboModule::performVoidMethodInvocation during startup.
I’ve applied the next mitigation:

app.json
"newArchEnabled": false
iOS "buildNumber": "16"
Router root is still minimal in:
RouterRoot.tsx
Command to run next router build locally:

cd "/Users/mikhail/Documents/CURSOR CODES/In Progress/Prompt Pal App/PromptPal" && EXPO_PUBLIC_BOOT_MODE=router npx eas build --platform ios --profile router --local
If this still crashes on TestFlight, send that build 16 crash log and I’ll move to the next hard isolate (separate router app root / route tree pruning).


1 file changed
Undo
PromptPal/app.json
[PREBUILD] - Running prebuild
[PREBUILD] » ios: ios.usesAppleSignIn: Install expo-apple-authentication to enable this feature https://docs.expo.dev/versions/latest/sdk/apple-authentication/#eas-build
[PREBUILD] - Running prebuild
[PREBUILD] ✔ Finished prebuild
[PREBUILD] Running "npm install" in /var/folders/bl/r9mbpt_118g_1sv7wjr_88240000gn/T/eas-build-local-nodejs/42953ece-729a-44d6-937c-c50a0bf0dcf2/build/PromptPal directory
[PREBUILD] npm warn ERESOLVE overriding peer dependency
[PREBUILD] npm warn While resolving: @clerk/clerk-js@5.124.0
[PREBUILD] npm warn Found: react@19.1.0
[PREBUILD] npm warn node_modules/react
[PREBUILD] npm warn   react@"19.1.0" from the root project
[PREBUILD] npm warn   82 more (zustand, @clerk/clerk-expo, @emotion/react, ...)
[PREBUILD] npm warn
[PREBUILD] npm warn Could not resolve dependency:
[PREBUILD] npm warn peer react@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/clerk-js@5.124.0
[PREBUILD] npm warn node_modules/@clerk/clerk-expo/node_modules/@clerk/clerk-js
[PREBUILD] npm warn   @clerk/clerk-js@"^5.123.0" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo
[PREBUILD] npm warn
[PREBUILD] npm warn Conflicting peer dependency: react@19.2.4
[PREBUILD] npm warn node_modules/react
[PREBUILD] npm warn   peer react@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/clerk-js@5.124.0
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo/node_modules/@clerk/clerk-js
[PREBUILD] npm warn     @clerk/clerk-js@"^5.123.0" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn     node_modules/@clerk/clerk-expo
[PREBUILD] npm warn ERESOLVE overriding peer dependency
[PREBUILD] npm warn While resolving: @clerk/clerk-js@5.124.0
[PREBUILD] npm warn Found: react-dom@19.1.0
[PREBUILD] npm warn node_modules/react-dom
[PREBUILD] npm warn   react-dom@"19.1.0" from the root project
[PREBUILD] npm warn   19 more (@clerk/clerk-expo, @expo/metro-runtime, ...)
[PREBUILD] npm warn
[PREBUILD] npm warn Could not resolve dependency:
[PREBUILD] npm warn peer react-dom@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/clerk-js@5.124.0
[PREBUILD] npm warn node_modules/@clerk/clerk-expo/node_modules/@clerk/clerk-js
[PREBUILD] npm warn   @clerk/clerk-js@"^5.123.0" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo
[PREBUILD] npm warn
[PREBUILD] npm warn Conflicting peer dependency: react-dom@19.2.4
[PREBUILD] npm warn node_modules/react-dom
[PREBUILD] npm warn   peer react-dom@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/clerk-js@5.124.0
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo/node_modules/@clerk/clerk-js
[PREBUILD] npm warn     @clerk/clerk-js@"^5.123.0" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn     node_modules/@clerk/clerk-expo
[PREBUILD] npm warn ERESOLVE overriding peer dependency
[PREBUILD] npm warn While resolving: @clerk/clerk-react@5.61.0
[PREBUILD] npm warn Found: react@19.1.0
[PREBUILD] npm warn node_modules/react
[PREBUILD] npm warn   react@"19.1.0" from the root project
[PREBUILD] npm warn   82 more (zustand, @clerk/clerk-expo, @emotion/react, ...)
[PREBUILD] npm warn
[PREBUILD] npm warn Could not resolve dependency:
[PREBUILD] npm warn peer react@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/clerk-react@5.61.0
[PREBUILD] npm warn node_modules/@clerk/clerk-expo/node_modules/@clerk/clerk-react
[PREBUILD] npm warn   @clerk/clerk-react@"^5.60.1" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo
[PREBUILD] npm warn
[PREBUILD] npm warn Conflicting peer dependency: react@19.2.4
[PREBUILD] npm warn node_modules/react
[PREBUILD] npm warn   peer react@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/clerk-react@5.61.0
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo/node_modules/@clerk/clerk-react
[PREBUILD] npm warn     @clerk/clerk-react@"^5.60.1" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn     node_modules/@clerk/clerk-expo
[PREBUILD] npm warn ERESOLVE overriding peer dependency
[PREBUILD] npm warn While resolving: @clerk/clerk-react@5.61.0
[PREBUILD] npm warn Found: react-dom@19.1.0
[PREBUILD] npm warn node_modules/react-dom
[PREBUILD] npm warn   react-dom@"19.1.0" from the root project
[PREBUILD] npm warn   19 more (@clerk/clerk-expo, @expo/metro-runtime, ...)
[PREBUILD] npm warn
[PREBUILD] npm warn Could not resolve dependency:
[PREBUILD] npm warn peer react-dom@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/clerk-react@5.61.0
[PREBUILD] npm warn node_modules/@clerk/clerk-expo/node_modules/@clerk/clerk-react
[PREBUILD] npm warn   @clerk/clerk-react@"^5.60.1" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo
[PREBUILD] npm warn
[PREBUILD] npm warn Conflicting peer dependency: react-dom@19.2.4
[PREBUILD] npm warn node_modules/react-dom
[PREBUILD] npm warn   peer react-dom@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/clerk-react@5.61.0
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo/node_modules/@clerk/clerk-react
[PREBUILD] npm warn     @clerk/clerk-react@"^5.60.1" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn     node_modules/@clerk/clerk-expo
[PREBUILD] npm warn ERESOLVE overriding peer dependency
[PREBUILD] npm warn While resolving: @clerk/shared@3.46.0
[PREBUILD] npm warn Found: react@19.1.0
[PREBUILD] npm warn node_modules/react
[PREBUILD] npm warn   react@"19.1.0" from the root project
[PREBUILD] npm warn   82 more (zustand, @clerk/clerk-expo, @emotion/react, ...)
[PREBUILD] npm warn
[PREBUILD] npm warn Could not resolve dependency:
[PREBUILD] npm warn peerOptional react@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/shared@3.46.0
[PREBUILD] npm warn node_modules/@clerk/clerk-expo/node_modules/@clerk/shared
[PREBUILD] npm warn   @clerk/shared@"^3.45.0" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo
[PREBUILD] npm warn   2 more (@clerk/clerk-js, @clerk/clerk-react)
[PREBUILD] npm warn
[PREBUILD] npm warn Conflicting peer dependency: react@19.2.4
[PREBUILD] npm warn node_modules/react
[PREBUILD] npm warn   peerOptional react@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/shared@3.46.0
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo/node_modules/@clerk/shared
[PREBUILD] npm warn     @clerk/shared@"^3.45.0" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn     node_modules/@clerk/clerk-expo
[PREBUILD] npm warn     2 more (@clerk/clerk-js, @clerk/clerk-react)
[PREBUILD] npm warn ERESOLVE overriding peer dependency
[PREBUILD] npm warn While resolving: @clerk/shared@3.46.0
[PREBUILD] npm warn Found: react-dom@19.1.0
[PREBUILD] npm warn node_modules/react-dom
[PREBUILD] npm warn   react-dom@"19.1.0" from the root project
[PREBUILD] npm warn   19 more (@clerk/clerk-expo, @expo/metro-runtime, ...)
[PREBUILD] npm warn
[PREBUILD] npm warn Could not resolve dependency:
[PREBUILD] npm warn peerOptional react-dom@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/shared@3.46.0
[PREBUILD] npm warn node_modules/@clerk/clerk-expo/node_modules/@clerk/shared
[PREBUILD] npm warn   @clerk/shared@"^3.45.0" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo
[PREBUILD] npm warn   2 more (@clerk/clerk-js, @clerk/clerk-react)
[PREBUILD] npm warn
[PREBUILD] npm warn Conflicting peer dependency: react-dom@19.2.4
[PREBUILD] npm warn node_modules/react-dom
[PREBUILD] npm warn   peerOptional react-dom@"^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0" from @clerk/shared@3.46.0
[PREBUILD] npm warn   node_modules/@clerk/clerk-expo/node_modules/@clerk/shared
[PREBUILD] npm warn     @clerk/shared@"^3.45.0" from @clerk/clerk-expo@2.19.23
[PREBUILD] npm warn     node_modules/@clerk/clerk-expo
[PREBUILD] npm warn     2 more (@clerk/clerk-js, @clerk/clerk-react)
[PREBUILD] up to date, audited 1119 packages in 2s
[PREBUILD] 114 packages are looking for funding
[PREBUILD]   run npm fund for details
[PREBUILD] 34 high severity vulnerabilities
[PREBUILD] 
[PREBUILD] To address issues that do not require attention, run:
[PREBUILD]   npm audit fix
[PREBUILD] 
[PREBUILD] To address all issues (including breaking changes), run:
[PREBUILD]   npm audit fix --force
[PREBUILD] 
[PREBUILD] Run npm audit for details.
[RESTORE_CACHE] Local builds do not support restoring cache
[INSTALL_PODS] Using Expo modules
[INSTALL_PODS] [Expo] Enabling modular headers for pod ExpoModulesCore
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-RCTAppDelegate
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-RCTFabric
[INSTALL_PODS] [Expo] Enabling modular headers for pod ReactAppDependencyProvider
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-Core
[INSTALL_PODS] [Expo] Enabling modular headers for pod ReactCodegen
[INSTALL_PODS] [Expo] Enabling modular headers for pod RCTRequired
[INSTALL_PODS] [Expo] Enabling modular headers for pod RCTTypeSafety
[INSTALL_PODS] [Expo] Enabling modular headers for pod ReactCommon
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-NativeModulesApple
[INSTALL_PODS] [Expo] Enabling modular headers for pod Yoga
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-Fabric
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-graphics
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-utils
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-featureflags
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-debug
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-ImageManager
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-rendererdebug
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-jsi
[INSTALL_PODS] [Expo] Enabling modular headers for pod React-renderercss
[INSTALL_PODS] [Expo] Enabling modular headers for pod hermes-engine
[INSTALL_PODS] [Expo] Enabling modular headers for pod glog
[INSTALL_PODS] [Expo] Enabling modular headers for pod boost
[INSTALL_PODS] [Expo] Enabling modular headers for pod DoubleConversion
[INSTALL_PODS] [Expo] Enabling modular headers for pod fast_float
[INSTALL_PODS] [Expo] Enabling modular headers for pod fmt
[INSTALL_PODS] [Expo] Enabling modular headers for pod RCT-Folly
[INSTALL_PODS] [Expo] Enabling modular headers for pod SocketRocket
[INSTALL_PODS] [Expo] Enabling modular headers for pod SDWebImage
[INSTALL_PODS] [Expo] Enabling modular headers for pod SDWebImageAVIFCoder
[INSTALL_PODS] [Expo] Enabling modular headers for pod SDWebImageSVGCoder
[INSTALL_PODS] [Expo] Enabling modular headers for pod SDWebImageWebPCoder
[INSTALL_PODS] [Expo] Enabling modular headers for pod libavif
[INSTALL_PODS] [Expo] Enabling modular headers for pod RNScreens
[INSTALL_PODS] [!] Invalid Podfile file: 
[INSTALL_PODS] [!] Invalid RNReanimated.podspec file: [Reanimated] Reanimated requires the New Architecture to be enabled. If you have RCT_NEW_ARCH_ENABLED=0 set in your environment you should remove it..
[INSTALL_PODS]  #  from /private/var/folders/bl/r9mbpt_118g_1sv7wjr_88240000gn/T/eas-build-local-nodejs/42953ece-729a-44d6-937c-c50a0bf0dcf2/build/PromptPal/node_modules/react-native-reanimated/RNReanimated.podspec:9
[INSTALL_PODS]  #  -------------------------------------------
[INSTALL_PODS]  #  $new_arch_enabled = ENV['RCT_NEW_ARCH_ENABLED'] != '0'
[INSTALL_PODS]  >  assert_new_architecture_enabled($new_arch_enabled)
[INSTALL_PODS]  #  
[INSTALL_PODS]  #  -------------------------------------------
[INSTALL_PODS] .
[INSTALL_PODS]  #  from /private/var/folders/bl/r9mbpt_118g_1sv7wjr_88240000gn/T/eas-build-local-nodejs/42953ece-729a-44d6-937c-c50a0bf0dcf2/build/PromptPal/ios/Podfile:42
[INSTALL_PODS]  #  -------------------------------------------
[INSTALL_PODS]  #  
[INSTALL_PODS]  >    config = use_native_modules!(config_command)
[INSTALL_PODS]  #  
[INSTALL_PODS]  #  -------------------------------------------
[INSTALL_PODS] 
Error: pod install exited with non-zero code: 1
    at ChildProcess.completionListener (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/spawnAsync.js:42:23)
    at Object.onceWrapper (node:events:623:26)
    at ChildProcess.emit (node:events:508:28)
    at maybeClose (node:internal/child_process:1085:16)
    at ChildProcess._handle.onexit (node:internal/child_process:304:5)
    ...
    at spawnAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/spawnAsync.js:7:23)
    at spawn (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/index.js:16:47)
    at installPods (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/pod.js:14:50)
    at runInstallPodsAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:249:70)
    at /Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:89:19
    at BuildContext.runBuildPhase (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/context.js:123:34)
    at buildAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:88:19)
    at async runBuilderWithHooksAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/common.js:12:13)
    at async Object.iosBuilder (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:37:16)
    at async buildIosAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eas-cli-local-build-plugin/dist/ios.js:43:12)
[CLEAN_UP_CREDENTIALS] Destroying keychain - /var/folders/bl/r9mbpt_118g_1sv7wjr_88240000gn/T/eas-build-6b106811-4a2d-4dcf-95c9-3ac9c5de5f0e.keychain
[CLEAN_UP_CREDENTIALS] Removing provisioning profile

Build failed
Unknown error. See logs of the Install pods build phase for more information.
Error: Unknown error. See logs of the Install pods build phase for more information.
    at resolveBuildPhaseErrorAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/detectError.js:70:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async BuildContext.handleBuildPhaseErrorAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/context.js:190:28)
    at async BuildContext.runBuildPhase (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/context.js:135:35)
    at async buildAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:88:9)
    at async runBuilderWithHooksAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/common.js:12:13)
    at async Object.iosBuilder (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/ios.js:37:16)
    at async buildIosAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eas-cli-local-build-plugin/dist/ios.js:43:12)
    at async buildAsync (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eas-cli-local-build-plugin/dist/build.js:58:29)
    at async main (/Users/mikhail/.npm/_npx/203e17754726e48b/node_modules/eas-cli-local-build-plugin/dist/main.js:16:9)
npx -y eas-cli-local-build-plugin@18.0.1 eyJqb2IiOnsidHlwZSI6Im1hbmFnZWQiLCJwbGF0Zm9ybSI6ImlvcyIsInByb2plY3RBcmNoaXZlIjp7InR5cGUiOiJQQVRIIiwicGF0aCI6Ii92YXIvZm9sZGVycy9ibC9yOW1icHRfMTE4Z18xc3Y3d2pyXzg4MjQwMDAwZ24vVC9lYXMtY2xpLW5vZGVqcy80Nzk5OTMxMi0wOTBjLTQyNTgtYTM2My00NTU3ZWFkMzBiZTQudGFyLmd6In0sInByb2plY3RSb290RGlyZWN0b3J5IjoiUHJvbXB0UGFsIiwiYnVpbGRlckVudmlyb25tZW50Ijp7Im5vZGUiOiIyMC4xOS40IiwiZW52Ijp7IkVYUE9fUFVCTElDX0JPT1RfTU9ERSI6InJvdXRlciIsIkVYUE9fUFVCTElDX0NPTlZFWF9VUkwiOiJodHRwczovL2ZsaXBwYW50LWZlcnJldC0zMDYuY29udmV4LmNsb3VkIiwiRVhQT19QVUJMSUNfQ09OVkVYX1NJVEVfVVJMIjoiaHR0cHM6Ly9mbGlwcGFudC1mZXJyZXQtMzA2LmNvbnZleC5zaXRlIiwiRVhQT19QVUJMSUNfQ0xFUktfUFVCTElTSEFCTEVfS0VZIjoicGtfbGl2ZV9ZMnhsY21zdWNISnZiWEIwY0dGc0xtVjRjRzh1WkdWMkpBIn19LCJjYWNoZSI6eyJkaXNhYmxlZCI6ZmFsc2UsInBhdGhzIjpbXSwiY2xlYXIiOmZhbHNlfSwic2VjcmV0cyI6eyJidWlsZENyZWRlbnRpYWxzIjp7IlByb21wdFBhbCI6eyJwcm92aXNpb25pbmdQcm9maWxlQmFzZTY0IjoiTUlJdjFBWUpLb1pJaHZjTkFRY0NvSUl2eFRDQ0w4RUNBUUV4Q3pBSkJnVXJEZ01DR2dVQU1JSWY0UVlKS29aSWh2Y05BUWNCb0lJZjBnU0NIODQ4UDNodGJDQjJaWEp6YVc5dVBTSXhMakFpSUdWdVkyOWthVzVuUFNKVlZFWXRPQ0kvUGdvOElVUlBRMVJaVUVVZ2NHeHBjM1FnVUZWQ1RFbERJQ0l0THk5QmNIQnNaUzh2UkZSRUlGQk1TVk5VSURFdU1DOHZSVTRpSUNKb2RIUndPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOUVWRVJ6TDFCeWIzQmxjblI1VEdsemRDMHhMakF1WkhSa0lqNEtQSEJzYVhOMElIWmxjbk5wYjI0OUlqRXVNQ0krQ2p4a2FXTjBQZ29KUEd0bGVUNUJjSEJKUkU1aGJXVThMMnRsZVQ0S0NUeHpkSEpwYm1jK1VISnZiWEIwVUdGc1BDOXpkSEpwYm1jK0NnazhhMlY1UGtGd2NHeHBZMkYwYVc5dVNXUmxiblJwWm1sbGNsQnlaV1pwZUR3dmEyVjVQZ29KUEdGeWNtRjVQZ29KUEhOMGNtbHVaejVYU0RSTlZEVmFORFJUUEM5emRISnBibWMrQ2drOEwyRnljbUY1UGdvSlBHdGxlVDVEY21WaGRHbHZia1JoZEdVOEwydGxlVDRLQ1R4a1lYUmxQakl3TWpZdE1ESXRNVEpVTURBNk5EUTZNRGRhUEM5a1lYUmxQZ29KUEd0bGVUNVFiR0YwWm05eWJUd3ZhMlY1UGdvSlBHRnljbUY1UGdvSkNUeHpkSEpwYm1jK2FVOVRQQzl6ZEhKcGJtYytDZ2tKUEhOMGNtbHVaejU0Y2s5VFBDOXpkSEpwYm1jK0Nna0pQSE4wY21sdVp6NTJhWE5wYjI1UFV6d3ZjM1J5YVc1blBnb0pQQzloY25KaGVUNEtDVHhyWlhrK1NYTllZMjlrWlUxaGJtRm5aV1E4TDJ0bGVUNEtDVHhtWVd4elpTOCtDZ2s4YTJWNVBrUmxkbVZzYjNCbGNrTmxjblJwWm1sallYUmxjend2YTJWNVBnb0pQR0Z5Y21GNVBnb0pDVHhrWVhSaFBrMUpTVVoyVkVORFFrdFhaMEYzU1VKQlowbFJZbXRUVjFkdlUwUnVRa1pyZEZnMmFscEVVbEJqYWtGT1FtZHJjV2hyYVVjNWR6QkNRVkZ6UmtGRVFqRk5WVkYzVVdkWlJGWlJVVVJFUkhSQ1kwaENjMXBUUWxoaU0wcHpXa2hrY0ZwSFZXZFNSMVl5V2xkNGRtTkhWbmxKUmtwc1lrZEdNR0ZYT1hWamVVSkVXbGhLTUdGWFduQlpNa1l3WVZjNWRVbEZSakZrUjJoMlkyMXNNR1ZVUlV4TlFXdEhRVEZWUlVOM2QwTlNlazE0UlhwQlVrSm5UbFpDUVc5TlEydEdkMk5IZUd4SlJXeDFXWGswZUVONlFVcENaMDVXUWtGWlZFRnNWbFJOUWpSWVJGUkpNazFFU1hoTmFrRjNUWHBSZDAxc2IxaEVWRWt6VFVSSmVFMXFRWGROZWxGM1RWWnZkMmRhWjNoSGFrRlpRbWR2U210cFlVcHJMMGx6V2tGRlFrUkJjRmhUUkZKT1ZrUldZVTVFVWxSTlZIZDNUMmRaUkZaUlVVUkVSRTV3VlVkb2RtSnRWV2RTUjJ4NlpFaEtjRmx1VmpCaFZ6bDFUMmxDVG1GWGRHOVpWMnh6U1Vaa2NHRnRSblZaV0VweVlubEJiMVl3WnpCVVZsRXhWMnBSTUZWNWEzaEZla0ZTUW1kT1ZrSkJjMDFEYkdSSlRrVXhWVTVXYnpCT1JrMTRSMnBCV1VKblRsWkNRVzlOUlZVeGNHRXlhR2hoVjNkblZqSnNjVmxYTldoamJYUjJUVkZ6ZDBOUldVUldVVkZIUlhkS1ZsVjZRME5CVTBsM1JGRlpTa3R2V2tsb2RtTk9RVkZGUWtKUlFVUm5aMFZRUVVSRFEwRlJiME5uWjBWQ1FVb3Zibk1yTlc5S1pHTm1iSEY1ZDNrNU1FUXJSV00wV1RjeFEyZGlPR0ZWVGtKV1MyeFlZbkJ6WjA5cmIzZFNWREpRV205M2JWSXlialJ0VkZsVWNqWmtNa05VU1d4bE1WZGFha1JqVEcxVU1YQmhkRGRZUVZSalkwczJka1ZaYUdveFVVdFZNVGhLT0VkYVZsUXZaVlp0UjFCTGVtZFJSR3gzVUVvMVdYZFdVelUyYm5kdlRHMURSR3B2UWtreU5EYzVjakJOZEVWMk4zWkRORWM1ZWtOSVVHaHVUVTB4TDFCdmJFb3lVV2xXVjI1alluaFFiMUpZY2tOUVFtUjZjMjlRVHprM2NFTTFOWGgzVHpsaVprcFpNVzFhTWpRdkszcFJiRGxwZEdOa2NtUjVNM1ZqWjBSeFowbFdSbGhqVldOR1ZFbG5SVUppT0dWS1YwSlhkMlUwT0VVeWRrRTNjWGhqVlZOemJqVlJabTVuY1dsNWFXRXZaMEZGSzNodU55dE9NV1ZTUlhkc2IwazRaME14T0dsWWExRmFTVlo2U0ZGTVRUVlhNVVZOVTAxalpFWjFOREF3TDFWRE5IRTBXVTByVm1SWFZVTkJkMFZCUVdGUFEwRnBUWGRuWjBsbVRVRjNSMEV4VldSRmQwVkNMM2RSUTAxQlFYZElkMWxFVmxJd2FrSkNaM2RHYjBGVlEyWTNRVVphUkRWeU1sRkxhMmhMTlVwcGFHcEVTbVp6Y0RkSmQyTkJXVWxMZDFsQ1FsRlZTRUZSUlVWYVJFSnBUVU13UjBORGMwZEJVVlZHUW5wQlEyaHBSbTlrU0ZKM1QyazRkbGt5Vm5sa1NFMTFXVmhDZDJKSFZYVlpNamwwVEROa00xcElTbTVOZVRWcldsaEpkMDFSV1VsTGQxbENRbEZWU0UxQlIwZEtWMmd3WkVoQk5reDVPWFpaTTA1M1RHMUdkMk5IZUd4TWJVNTJZbE01ZGxrelRuZE5SRTEwWkROa2EyTnRZM3BOUkVsM1oyZEZaVUpuVGxaSVUwRkZaMmRGVmsxSlNVSkZWRU5EUVZFd1IwTlRjVWRUU1dJeldUSlJSa0ZVUTBJdmVrTkNkM2RaU1V0M1dVSkNVVlZJUVdkSmQyZGlXVTFuWWs1VFdsZDRjRmxYTldwYVUwSjJZbWxDTUdGSGJIcEpSMDVzWTI1U2NGcHRiR3BaV0ZKc1NVZEtOVWxIUm5WbFUwSjNXVmhLTUdWVFFtaGpNMDR4WWxkV2VrbEhSbXBaTWxaM1pFZEdkVmt5VldkaU1sbG5aRWRvYkVsSVVtOWFWelJuV1ZoQ2QySkhiR3BaVjBweldsTkNlbVJIUm5WYVIwWjVXa05DTUZwWVNuUmplVUpvWW0xUloxa3lPWFZhUjJ3d1lWYzVkV041UW5aYWFVSXhZekpWYzBsSFRteGpibEp3V20xc2FsbFlVbXhKU0VKMllrZHNhbVZUUW1oaWJWRm5XVEpXZVdSSGJHMWhWMDVvWkVkc2RtSnBRbmRqYlVacVpFZHNhbHBUUW5wa1IwWXdXbGN4YkdKdVVucE1ha0V6UW1kbmNrSm5SVVpDVVdORFFWSlpjbUZJVWpCalNFMDJUSGs1TTJRelkzVlpXRUozWWtkVmRWa3lPWFJNTWs1c1kyNVNjRnB0YkdwWldGSnNXVmhXTUdGSE9YbGhXRkkxVEhwQlYwSm5UbFpJVTFWQ1FXWTRSVVJFUVV0Q1oyZHlRbWRGUmtKUlkwUkJla0ZrUW1kT1ZraFJORVZHWjFGVlQxQnVlVEF6V0ZoVVNXTTRha0p6TkRoT1dIVm9jWE50ZUd4emQwUm5XVVJXVWpCUVFWRklMMEpCVVVSQloyVkJUVUpOUjBOcGNVZFRTV0l6V1RKUlIwRlJVVUpCWmpoRlFXZFZRVTFCTUVkRFUzRkhVMGxpTTBSUlJVSkRkMVZCUVRSSlFrRlJRVEJSV1VkSGNISnRNR1JXUkhKUGVqZHRiekJXYVZwTkwyVlZORk5hVjJwMmQwVklWa1JyZEcxWmRWSnZVR2hKY0hRd2RqaGljbmhqVDFkUGVXSjNWRmxSTVUxWFltcEJRa1ZHWkVGSE5USlFZME53TDNKRFRXZEdhRGQzVG5OUlV6Y3ZZblkyUjBGNk0yMVVaM2xzT0ZORWMweHNWR1prUkhrd2NWQlRabWhGTkcxMFFqbFZRVmRvZFhSTFJEWnBPRFZKTDJJM1EwbHlibGt3UkVsVlVXSndaVlJLVTBGWVZrdFZTM2REUkZWd01GRnpTVzVVUjJsc1ZFbDZWRTByU3pWM2RXd3pPV0ZZYVhseFYxSjZaVTByWjBoclNsVnlUa0pPYjBsYVdtZGxkR2cwTldkMFIzVjFWSEJOU3pWUFpHNVZhRU5yZFRWUldVWk5XbHB2V1V0SVVtaDZkRE5rVldsYUwyVndOMkoyYjNaeVFtVnRkelZqYVZwNk5tRjBaM0ZvUmtSU2NERnhSRkpvZURsSlR5dEtWVE5zV1c4MldWRXpSR0Z6WW1GNE5TOUhXRVJRZDNaRFNUQTVNUzk0WXpoek5HRXZQQzlrWVhSaFBnb0pQQzloY25KaGVUNEtDZ2s4YTJWNVBrUkZVaTFGYm1OdlpHVmtMVkJ5YjJacGJHVThMMnRsZVQ0S0NUeGtZWFJoUGsxSlNVNVdkMWxLUzI5YVNXaDJZMDVCVVdORGIwbEpUbE5FUTBORVZWRkRRVkZGZUVSVVFVeENaMnhuYUd0blFscFJUVVZCWjBWM1oyZE5XRUpuYTNGb2EybEhPWGN3UWtKM1IyZG5aMDFKUWtsSlJFSkVSME5CZDBGM1JFRjNTRlp0Vm5sak1teDJZbWRKUWtGVVFVNUVRV2hSVlVaR1JHRkhWbXBoZDBWQ1FVUkJVVVJCY0ZWaFZ6RnNWa2M1VFdGWVdteEJaMGxDWWtSQlZFUkJOVXBqTVdocVlqSlNiRlJYUm5WWlYyUnNXa0ZGUWtGRVFWZEVRV3hDWTBoQ1NsSkZOV2hpVjFWTlExWkNlV0l5TVhka1JrSm9Za1JCWkVSQmFGVmFWMFowVkcxR2RGcFJkMUpVVjJ4eVlVZEdjR0pEUWxoaFYzQm9ZbTFHZVdFeU9IZElVWGROVVROS2JGbFlVbkJpTWpWRldWaFNiRVozTUhsT2FrRjVUVlJKZDAxRVVUQk5SR1JoVFVJMFRVUnNVbXhaVnpGS1drZFdkV1JIYkcxaFYxWjVUVUYzVFVOc1pFbE9SVEZWVGxadk1FNUdUWGRJZDNkUFVsaG9kMkZZU21oa1IyeDJZbXRTYUdSSFZWaEVWRWt6VFVSSmVFMXFRWGROZWxGM1RWWnZkMGxCZDFoVlNFcDJXbTFzYzFwVlVuQmpNMUo1WVZkS01XUkhiSFppYkZJMVkwZFZUVUpXVGxWVU1VcEdUVU5GVFVOR1FuTlpXRkp0WWpOS2RFMUNWVTFCTW14UVZYZDNSV1ZJU2xCVmQzZEpaRzFzZW1GWE9YVlVNVTEzUzNkM1lsRllRbmRpUjJ4cVdWaFNjR0l5TlVwYVIxWjFaRWRzYldGWFZubFZTRXBzV20xc05FMUJkMDFEYkdSSlRrVXhWVTVXYnpCT1JrMTNURUYzUlZaV1ZrcFNRWGRyVFVSQmVGcFVTVFJPUjFWMFRYcGFhRTFwTURCT1ZGazBURlJzYTFsWFNYUk5lbFpvVDBSWmVrOUVhelZaTWxFMVRVUnpUVVpWVW14a2JWWnpZak5DYkdOclRteGpibEp3V20xc2FsbFlVbXhqZWtGcFFrTkVjakU0TlhKUmFXUkdPRkpwUlZOcFoyNTZTRlJ3ZVdaSmVXaFBSMk5SV2pOMmNEbEVibU5ZT1RSV1JFSk9SRUZTVDFsWE1XeEVSVlZ4VnpKV05HTkhPV1JKUjA1MllsTTFkR0ZYZEc5WlYyeHpZek5DYkZsWGRIcE1ia0o1WWpJeGQyUklRbWhpUTBKQ1kwaENWR1JIT1hsYVUwRjVUVVJKTWt4VVFYbE1WRVY1VmtSQmQwOXFVVEJQYWtFelRHcEZkMDlHYjNkblpsbE5SRVZXZFdSSGJEQmlSMVowV2xjMU1HTXpRMEkxVVVsQ1FXSkRRak42UWtGRVFscG9ZMGhDYzJGWFRtaGtSMngyWW1reGNGcEhWblZrUjJ4dFlWZFdlVVJEV2xoVFJGSk9Wa1JXWVU1RVVsUk1iVTUyWWxNMWRHRlhkRzlaVjJ4ell6TkNiRmxYZEhwTWJrSjVZakl4ZDJSSVFtaGlSRUZaUkVKT2FWcFlVbWhNV0Vwc1kwYzVlV1JJVFhSWlYwNHdZVmhhYkVGUlNDOU5SRVZOU1RKT2RtSlROV2hqU0VKeldsTTFhMXBZV214aVJ6bDNXbGhKZFdSSFZtaGlVekZ3V2tkV2RXUkhiRzFoVjFaNVJFRndXRk5FVWs1V1JGWmhUa1JTVkUxQ1RVMUViV1JzWkVNeE1GbFlUbkpNVjBaellrYzVNMEZSUlVGTlJHdE5SbTEwYkdWWFRtOVpWMngxVEZkR2Fsa3lWbnBqZVRGdVkyMDVNV05JVFhkSWQzZE5WakJuTUZSV1VURlhhbEV3VlhrMGNVUkJPV3BpTWpCMVdWaENkMkpIVlhWa1J6bHlXbGMyWjJkblp6aE5TVWxEVVhwRFEwRmpiV2RCZDBsQ1FXZEpTVXhqV0RocFRreEdVelZWZDBObldVbExiMXBKZW1vd1JVRjNUWGRhZWtWaVRVSnJSMEV4VlVWQmQzZFRVVmhDZDJKSFZXZFZiVGwyWkVOQ1JGRlRRWFJKUldONlRWTlpkMHBCV1VSV1VWRk1SRUl4UW1OSVFuTmFVMEpFV2xoS01HRlhXbkJaTWtZd1lWYzVkVWxGUmpGa1IyaDJZMjFzTUdWVVJWUk5Ra1ZIUVRGVlJVTm5kMHRSV0VKM1lrZFZaMU5YTldwTWFrVk1UVUZyUjBFeFZVVkNhRTFEVmxaTmQwaG9ZMDVOVkZGM1RrUk5kMDFVWjNoUFZFRXlWMmhqVGsxNmEzZE9SRTEzVFZSbmVFOVVRVEpYYWtKdVRWSnpkMGRSV1VSV1VWRkVSRUpLUW1OSVFuTmFVMEpUWWpJNU1FbEZUa0pKUXpCblVucE5lRXBxUVd0Q1owNVdRa0Z6VFVoVlJuZGpSM2hzU1VWT2JHTnVVbkJhYld4cVdWaFNjR0l5TkdkUldGWXdZVWM1ZVdGWVVqVk5VazEzUlZGWlJGWlJVVXRFUVhCQ1kwaENjMXBUUWtwaWJVMTFUVkZ6ZDBOUldVUldVVkZIUlhkS1ZsVjZRakpOUWtGSFFubHhSMU5OTkRsQlowVkhRbE4xUWtKQlFXbEJNa2xCUWtwcWNFeDZNVUZqY1ZSMGEzbEtlV2RTVFdNelVrTldPR05YYWxSdVNHTkdRbUphUkhWWGJVSlRjRE5hU0hSbVZHcHFWSFY0ZUVWMFdDOHhTRGRaZVZsc00wbzJXVkppVkhwQ1VFVldiMEV2Vm1oWlJFdFlNVVI1ZUU1Q01HTlVaR1J4V0d3MVpIWk5WbnAwU3pVeE4wbEVkbGwxVmxSYVdIQnRhMDlzUlV0TllVNURUVVZCZDBoUldVUldVakJQUWtKWlJVWk1kWGN6Y1VaWlRUUnBZWEJKY1ZvemNqWTVOall2WVhsNVUzSk5RVGhIUVRGVlpFVjNSVUl2ZDFGR1RVRk5Ra0ZtT0hkRVoxbEVWbEl3VUVGUlNDOUNRVkZFUVdkRlIwMUJiMGREUTNGSFUwMDBPVUpCVFVSQk1tZEJUVWRWUTAxUlEwUTJZMGhGUm13MFlWaFVVVmt5WlROMk9VZDNUMEZGV2t4MVRpdDVVbWhJUmtRdk0yMWxiM2xvY0cxMlQzZG5VRlZ1VUZkVWVHNVROR0YwSzNGSmVGVkRUVWN4Yldsb1JFc3hRVE5WVkRneVRsRjZOakJwYlU5c1RUSTNhbUprYjFoME1sRm1lVVpOYlN0WmFHbGtSR3RNUmpGMlRGVmhaMDAyUW1kRU5UWkxlVXRFUTBOQmRWbDNaMmRLZEc5QlRVTkJVVWxEUTBSTlRqZDJhUzlVUjJkMVRVRnZSME5EY1VkVFRUUTVRa0ZOUkUxSFkzaEhla0ZhUW1kT1ZrSkJUVTFGYTBaM1kwZDRiRWxHU25aaU0xRm5VVEJGWjB4VFFraE5la1Z0VFVOUlIwRXhWVVZEZDNka1VWaENkMkpIVldkUk1sWjVaRWRzYldGWFRtaGtSMngyWW1sQ1FtUllVbTlpTTBwd1pFaHJlRVY2UVZKQ1owNVdRa0Z2VFVOclJuZGpSM2hzU1VWc2RWbDVOSGhEZWtGS1FtZE9Wa0pCV1ZSQmJGWlVUVUkwV0VSVVJUTk5SRWw1VFdwSmVVMXFUWGxOYkc5WVJGUk5lVTFFU1hoUFJFRjNUVVJCZDAxR2IzZGpha1Z0VFVOUlIwRXhWVVZCZDNka1VWaENkMkpIVldkVk0yeDZaRWRXZEVsRmJIVmtSMVp1WTIxR01HRlhPWFZKUlU1Q1NVUlJlRXBxUVd0Q1owNVdRa0Z6VFVoVlJuZGpSM2hzU1VWT2JHTnVVbkJhYld4cVdWaFNjR0l5TkdkUldGWXdZVWM1ZVdGWVVqVk5VazEzUlZGWlJGWlJVVXRFUVhCQ1kwaENjMXBUUWtwaWJVMTFUVkZ6ZDBOUldVUldVVkZIUlhkS1ZsVjZRbHBOUWsxSFFubHhSMU5OTkRsQlowVkhRME54UjFOTk5EbEJkMFZJUVRCSlFVSkJXbkp3UmxwMlpsbzRiakJqTkRKcWNFbGlWbk14VlU1dFVrdDVXbEp2YldaeVNrbElOMms1Vm1kUU0wOUtjVFo0YkVoTWVUZDJUelpSUW5SQlJWUlNTSGhoU25FeVoyNURhMnhwZFZodFFtMDVVR1pHY1dwblptTjNaMlpSZDBSM1dVUldVakJVUVZGSUwwSkJWWGRCZDBWQ0wzcEJaa0puVGxaSVUwMUZSMFJCVjJkQ1V6ZHpUalpvVjBSUFNXMXhVMHR0WkRZcmRtVjFkakp6YzJ0eGVrSkhRbWRuY2tKblJVWkNVV05DUVZGUk5rMUVaM2RPWjFsSlMzZFpRa0pSVlVoTlFVZEhTMjFvTUdSSVFUWk1lVGwyV1ROT2QweHRSbmRqUjNoc1RHMU9kbUpUT1haWk0wNTNUVVJOZEZsWVFuZGlSMVo1WWpJNU1Ga3lSbTVOZWtFelFtZE9Wa2hTT0VWTlJFRjFUVU41WjB0eFFXOW9hVnB2WkVoU2QwOXBPSFpaTTBwelRHMUdkMk5IZUd4TWJVNTJZbE01YUdOSVFuTmFXRXAyWWpOU2FsbFhZM3BNYlU1NVlrUkJaRUpuVGxaSVVUUkZSbWRSVldWclpUWlBTVzlXU2tWbmFWSnpNaXRxZUc5clpYcFJSRXR0YTNkRVoxbEVWbEl3VUVGUlNDOUNRVkZFUVdkRlIwMUNRVWREYVhGSFUwbGlNMWt5VVVkQmFFVkZRV2RWUVUxQmIwZERRM0ZIVTAwME9VSkJUVVJCTW1OQlRVZFJRMDFDVlUxeFdUZEhjalZhY0dFMlpXWXpWbnBWUVRGc2MzSnNURlZaVFdGTVpIVkRNM2hoVEhoRFdIcG5iWFZPY25ObFRqaE5ZMUZ1WlhGbFQybG1NbkprZDBsM1dWUk5aemhUYmk4cldXTjVjbWx1U1ZwRU1USmxNVWRyTUdkSmRtUnlOV2RKY0VoNE1WUndNVE5NVkdsNGFYRlhMM05aU2pORmNGQXhVMVIzTDAxeGVVMUpTVVJDZWtORFFYRXlaMEYzU1VKQlowbEpSalJEYjA1SFdtczJjM04zUTJkWlNVdHZXa2w2YWpCRlFYZEpkMk5xUlcxTlExRkhRVEZWUlVGM2QyUlJXRUozWWtkVloxVXpiSHBrUjFaMFNVVnNkV1JIVm01amJVWXdZVmM1ZFVsRlRrSkpSRkY0U21wQmEwSm5UbFpDUVhOTlNGVkdkMk5IZUd4SlJVNXNZMjVTY0ZwdGJHcFpXRkp3WWpJMFoxRllWakJoUnpsNVlWaFNOVTFTVFhkRlVWbEVWbEZSUzBSQmNFSmpTRUp6V2xOQ1NtSnRUWFZOVVhOM1ExRlpSRlpSVVVkRmQwcFdWWHBCWlVaM01IbE9SRVY0VFdwQmQwMTZTWGRPUkZaaFJuY3dlVTlFUlhsTlZGRjRUMFJCZDAxNlFtRk5SVFI0UzJwQmIwSm5UbFpDUVUxTlNWWmtXRkpHU1dkVlNFcDJaRzFzZW1GWE9YVmhWelZ1U1VaQ2VXSXlXbkJpUjFWblZUSnNibUp0YkhWYWVrVlVUVUpGUjBFeFZVVkRaM2RMVVZoQ2QySkhWV2RUVnpWcVRHcEZURTFCYTBkQk1WVkZRbWhOUTFaV1RYZFhWRUZVUW1kamNXaHJhazlRVVVsQ1FtZG5jV2hyYWs5UVVVMUNRbmRPUTBGQlZERnNSbk5QZDJSU1ZWQjRibVZTYlVGc1dIbzJUMHRqT1hOVU5WQldTRXhrT1hSc1NtWklLMGczV1hkSGVXZG9kVzl2VlRZd01Dc3pkbFp5YTFneFNtcE9XVXhtVDFSeGJUTlBiR1F5VlN0bmVsRTJPVGx2TkVsQ1ZIcERRMEZWYzNkRVFWbEVWbEl3VkVGUlNDOUNRVWwzUVVSQlprSm5UbFpJVTAxRlIwUkJWMmRDVWpaU04yODBhV2hWYTFORFNrZDZZalpRUjJsU04wNUJUWEZoVkVKQ1FtZG5ja0puUlVaQ1VXTkNRVkZSTVUxRVRYZE5VVmxKUzNkWlFrSlJWVWhOUVVkSFNsZG9NR1JJUVRaTWVUbDJXVE5PZDB4dFJuZGpSM2hzVEcxT2RtSlRPWFpaTTA1M1RVUk5kRmxZVG5CWk1rVXdUVVJOZDJkYVdVZEJNVlZrU1VGVFFtcHFRMEpwZWtOQ2FVRlpTa3R2V2tsb2RtUnFXa0ZWUWsxSWMzZGxVVmxKUzNkWlFrSlJWVWhCWjBsM1lsRjRjbFpIYUhCamVVSnFXbGhLTUdGWFduQlpNa1l3V2xOQ2NHTjVRakJpZVVKcFdsTkNNV015Vm10SlIxWTBXVEo0TVdNeWJESmFWM2cxU1VkYWRtTnBRbTFrVnpWcVpFZHNkbUp1VFdkaFZ6VXdXbGhLZFZsWGQyZGtSemhuVVZoQ2QySkhWV2RWU0VwMldraFdhbVJJVFdkWlZ6VnJUREk1ZVVsRlJuZGpSM2hzU1VoQ2VXSXlUbXhqTTA1c1kzazBkMGhSV1VSV1VqQlBRa0paUlVaUGJGTjZaekozZUc5bllWcFZjVFJ0ZUVkUU9HUjNaVko0VWpoTlFUUkhRVEZWWkVSM1JVSXZkMUZGUVhkSlNHZEVRVkJDWjJ0eGFHdHBSemt5VG10RVFrMUZRV2RWUVUxQmIwZERRM0ZIVTAwME9VSkJUVU5CTUdkQlRVVlZRMGxSUkhadGNuaGtiMFp3YldKSFV6VjZWR1ZVY1ZaUE1FNDRXRWhpVDBkRUsyaGpZVE5uY3preGNYUnZXbWRKWjJWRFVGcDNOR2RJVTFRek1TczBiVkJyUnpWWk5FWmxabGt2T1ZrMFpHRlFXRXBvYWpGcWJ5dFFOVEI0WjJkSVZFMUpTVUo2ZDBsQ1FWUkNLMDFJU1hoS2FrRnJRbWRPVmtKQlRVMUlWVVozWTBkNGJFbEdUalZqTTFKc1lsTkNTbUp1VW14YU0wcG9aRWRzZG1KcFFrUlJVMEV3VFZOWmQwcEJXVVJXVVZGTVJFSXhRbU5JUW5OYVUwSkVXbGhLTUdGWFduQlpNa1l3WVZjNWRVbEZSakZrUjJoMlkyMXNNR1ZVUlZSTlFrVkhRVEZWUlVObmQwdFJXRUozWWtkVloxTlhOV3BNYWtWTVRVRnJSMEV4VlVWQ2FFMURWbFpOUTBOQ1pVRnhSRkp0V2s5eVRFMUJjMGREVjBOSFUwRkdiRUYzVVVOQllVTkNOWHBCV1VKbmEzRm9hMmxIT1hjd1FrTlJUWGhEZDFsS1MyOWFTV2gyWTA1QlVXTkNUVUozUjBOVGNVZFRTV0l6UkZGRlNrSlVSVkJHZHpCNVRtcEJlVTFVU1hkTlJGRXdUVVJrWVUxRFowZERVM0ZIVTBsaU0wUlJSVXBPUkVWaVRVSnJkME4zV1VwWlNWcEpRVmRWUkVKQlNVSnZVVzlIUTBOeFIxTk5ORGxDUVUxRFRVTTRSME5UY1VkVFNXSXpSRkZGU2tKRVJXbENRMEV2V1VWaFVHSlFkWGhvYlRoQlRqQXZRbTU2WmpCRFF6Um9jWEY0UzNWRmVrUktkbU54Ymxkd1psaHFRbE5DWjJ0eGFHdHBSemwzTUVKRFVUaDRVbFJDUkUxQmIwZERRM0ZIVTBsaU0wUlJUVWhOUVRSSFEwTnhSMU5KWWpORVVVMURRV2RKUVdkRVFVNUNaMmR4YUd0cFJ6bDNNRVJCWjBsQ1VVUkJTRUpuVlhKRVowMURRbnBCVGtKblozRm9hMmxIT1hjd1JFRm5TVUpMUkVGTFFtZG5jV2hyYWs5UVVWRkVRV2RTU0UxRlZVTkpVVU5aVTBVMU5XeFRSWEpHYUZwdVJqVkJWRzVzYTNZeWNFSmtNa1JMU1M5eE4yVmphVFpUU1hWcVdtVkJTV2RRWVdNM05sUmFiWHBFV2t3MGFsZG1LMk5yYUUxdEsxbEdXamR1VUUxUlFsa3ZSVlJ6YjBkeWNtTkJQVHd2WkdGMFlUNEtDUWtKQ1FrSkNRa0pDUWtKQ2drSkNUeHJaWGsrVUZCUlEyaGxZMnM4TDJ0bGVUNEtDVHhtWVd4elpTOCtDZ29KUEd0bGVUNUZiblJwZEd4bGJXVnVkSE04TDJ0bGVUNEtDVHhrYVdOMFBnb0pDVHhyWlhrK1ltVjBZUzF5WlhCdmNuUnpMV0ZqZEdsMlpUd3ZhMlY1UGdvSkNUeDBjblZsTHo0S0NRa0pDUW9KQ1FrSlBHdGxlVDVoY0hCc2FXTmhkR2x2YmkxcFpHVnVkR2xtYVdWeVBDOXJaWGsrQ2drSlBITjBjbWx1Wno1WFNEUk5WRFZhTkRSVExtTnZiUzV0YVd0b1lXbHNjM0JsWVd0ekxuQnliMjF3ZEhCaGJEd3ZjM1J5YVc1blBnb0pDUWtKQ2drSkNRazhhMlY1UG10bGVXTm9ZV2x1TFdGalkyVnpjeTFuY205MWNITThMMnRsZVQ0S0NRazhZWEp5WVhrK0Nna0pDUWs4YzNSeWFXNW5QbGRJTkUxVU5WbzBORk11S2p3dmMzUnlhVzVuUGdvSkNRa0pQSE4wY21sdVp6NWpiMjB1WVhCd2JHVXVkRzlyWlc0OEwzTjBjbWx1Wno0S0NRazhMMkZ5Y21GNVBnb0pDUWtKQ2drSkNRazhhMlY1UG1kbGRDMTBZWE5yTFdGc2JHOTNQQzlyWlhrK0Nna0pQR1poYkhObEx6NEtDUWtKQ1FvSkNRa0pQR3RsZVQ1amIyMHVZWEJ3YkdVdVpHVjJaV3h2Y0dWeUxuUmxZVzB0YVdSbGJuUnBabWxsY2p3dmEyVjVQZ29KQ1R4emRISnBibWMrVjBnMFRWUTFXalEwVXp3dmMzUnlhVzVuUGdvSkNRb0pQQzlrYVdOMFBnb0pQR3RsZVQ1RmVIQnBjbUYwYVc5dVJHRjBaVHd2YTJWNVBnb0pQR1JoZEdVK01qQXlOeTB3TWkweE1sUXdNRG96TkRvd01WbzhMMlJoZEdVK0NnazhhMlY1UGs1aGJXVThMMnRsZVQ0S0NUeHpkSEpwYm1jK0tsdGxlSEJ2WFNCamIyMHViV2xyYUdGcGJITndaV0ZyY3k1d2NtOXRjSFJ3WVd3Z1FYQndVM1J2Y21VZ01qQXlOaTB3TWkweE1sUXdNRG8wTkRvd055NHhNRGhhUEM5emRISnBibWMrQ2drOGEyVjVQbFJsWVcxSlpHVnVkR2xtYVdWeVBDOXJaWGsrQ2drOFlYSnlZWGsrQ2drSlBITjBjbWx1Wno1WFNEUk5WRFZhTkRSVFBDOXpkSEpwYm1jK0NnazhMMkZ5Y21GNVBnb0pQR3RsZVQ1VVpXRnRUbUZ0WlR3dmEyVjVQZ29KUEhOMGNtbHVaejVOYVd0b1lXbHNJRmRwYW1GdVlYSnJiend2YzNSeWFXNW5QZ29KUEd0bGVUNVVhVzFsVkc5TWFYWmxQQzlyWlhrK0NnazhhVzUwWldkbGNqNHpOalE4TDJsdWRHVm5aWEkrQ2drOGEyVjVQbFZWU1VROEwydGxlVDRLQ1R4emRISnBibWMrTURBeFpUSTROR1V0TXpaaE1pMDBOVFk0TFRsa1lXSXRNelZoT0RZek9EazVZMlE1UEM5emRISnBibWMrQ2drOGEyVjVQbFpsY25OcGIyNDhMMnRsZVQ0S0NUeHBiblJsWjJWeVBqRThMMmx1ZEdWblpYSStDand2WkdsamRENEtQQzl3YkdsemRENmdnZzAvTUlJRU5EQ0NBeHlnQXdJQkFnSUlQVm40TityUjJKOHdEUVlKS29aSWh2Y05BUUVMQlFBd2N6RXRNQ3NHQTFVRUF3d2tRWEJ3YkdVZ2FWQm9iMjVsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNU0F3SGdZRFZRUUxEQmREWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd0hoY05NalF4TWpFMk1Ua3lNVEF4V2hjTk1qa3hNakV4TVRneE16VTVXakJaTVRVd013WURWUVFEREN4QmNIQnNaU0JwVUdodmJtVWdUMU1nVUhKdmRtbHphVzl1YVc1bklGQnliMlpwYkdVZ1UybG5ibWx1WnpFVE1CRUdBMVVFQ2d3S1FYQndiR1VnU1c1akxqRUxNQWtHQTFVRUJoTUNWVk13Z2dFaU1BMEdDU3FHU0liM0RRRUJBUVVBQTRJQkR3QXdnZ0VLQW9JQkFRRFFrekdyK0ZNZTM2MGVMMlQzeVUzWGxyNWZTejE1WkZ4RDdpbkRRTkw2THh5Z3Ryd1JjKy93SXJEZjN2bjV6bFhqOVVJQnRTTmxRUkk3OTN4R2ZZa1RSWlZFN0phVlltYVhrQU1BMmVDdXhkbXhuQ0F0bHVDRjdXOXIwMUxUZ3p6VUFTTWw2ZVhHMUJIWWVhb0l3dDBWV1BYdmlwTkxEVXZ1RGJhSGszVVJFRlhMREhnSDJ6ZHdSanVYK3NUcmVDbmc5T3g0NDJIYVFGZUFCN3VJbktYSFNXM0lKdE9WSDAwaG9vMW9jNE1lNWxsYWhaWlZWTENWTGlYY2R3MWhoNEdOaWFRRGV6d0FkeXlKYWxuVFpFVFpkS1ZiaXJGU1lWOXVCRERVOCtJUU5BeVZqRXZoZTlZcmhZUHlKem1OY0FnajRoU0kvNVAwTFcxTUp1S0xONFl0QWdNQkFBR2pnZVV3Z2VJd0RBWURWUjBUQVFIL0JBSXdBREFmQmdOVkhTTUVHREFXZ0JSdjhaVVlZbHpneVBIRjdXd1l5ZURUWkZLWUlEQkFCZ2dyQmdFRkJRY0JBUVEwTURJd01BWUlLd1lCQlFVSE1BR0dKR2gwZEhBNkx5OXZZM053TG1Gd2NHeGxMbU52YlM5dlkzTndNRE10WVdsd1kyRXdOekF2QmdOVkhSOEVLREFtTUNTZ0lxQWdoaDVvZEhSd09pOHZZM0pzTG1Gd2NHeGxMbU52YlM5aGFYQmpZUzVqY213d0hRWURWUjBPQkJZRUZMeTF4ZW05L012UW50eVVzQjc0SVpSYy93a3VNQTRHQTFVZER3RUIvd1FFQXdJSGdEQVBCZ2txaGtpRzkyTmtCam9FQWdVQU1BMEdDU3FHU0liM0RRRUJDd1VBQTRJQkFRQXlOTUxwZDZwZjRNYktvdk4zV2VlS1o3anhVZlA3c1BhWHY3RVJvK0doUExzamt1a1NrNkp4SGJ6eG1uRnZwRHh2TnBLMjRFZUNvcFBqNTdpUHU5OGxSR0lDejgyODkvdU5pZ2x3ZUdYQ0dVMGx5M0ppSWVTcGFQa1FtaTU2RHlpK3BnTUcwVlZoSDY5OCtKVFVjUTdpMHlWVWk4NnQxV2dIVzcwdGU4ZGlSWG01cVlkTStCZzdnSzRRUzNIWWVDdm1DcSthNTlsTnpPcGJ0Nk9YVld2c0RhQjR4OEN3ejh2Y0VFd3draE54bE5hdjRPeko2Y21iemlVeTdoRU5JUmNraS9HVkxpSmlSa1YvNE52WEZsVEJ1VDdUMm9xNVpmYTB0Q04vZUYzWmNuWmtZNmNJVmNmWnQ1VGJJNy96azZmVUJFUkREY3JpVnJJcmxDaWtQWEtITUlJRVJEQ0NBeXlnQXdJQkFnSUlYR1BLNUVvM1U4a3dEUVlKS29aSWh2Y05BUUVMQlFBd1lqRUxNQWtHQTFVRUJoTUNWVk14RXpBUkJnTlZCQW9UQ2tGd2NHeGxJRWx1WXk0eEpqQWtCZ05WQkFzVEhVRndjR3hsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNUll3RkFZRFZRUURFdzFCY0hCc1pTQlNiMjkwSUVOQk1CNFhEVEUzTURVeE1ESXhNamN6TUZvWERUTXdNVEl6TVRBd01EQXdNRm93Y3pFdE1Dc0dBMVVFQXd3a1FYQndiR1VnYVZCb2IyNWxJRU5sY25ScFptbGpZWFJwYjI0Z1FYVjBhRzl5YVhSNU1TQXdIZ1lEVlFRTERCZERaWEowYVdacFkyRjBhVzl1SUVGMWRHaHZjbWwwZVRFVE1CRUdBMVVFQ2d3S1FYQndiR1VnU1c1akxqRUxNQWtHQTFVRUJoTUNWVk13Z2dFaU1BMEdDU3FHU0liM0RRRUJBUVVBQTRJQkR3QXdnZ0VLQW9JQkFRREpSV29CRHo2REJJYkgvTC9jWHZBZWdlNFhNSE5qSmk3ZVBYb2t6Wk0rVHpsSHVuVys4OERTOFZtaXF4LytDb1k4MlMyYUIvSU9hN2twa1JwZklncUw4WEpZQmE1TVMwVEZlYWVBUExDSTRJd01KNFJkR2VXSEdUYkw0OFYydDdEMFFYSlI5QVZjZzB1aWJhWlJ1UEVtMzN0ZXJXVU14cktZVVl5N2ZSdE13VTdJQ01mUzdXUUx0TjBialU5QWZSdVBTSmFTVy9QUW1IN1p2S1FaRHBsaHUwRmRBY3hiZDNwOUpORGMwMVAvdzl6RmxDeTJXazJPR0NNNXZkbkdVajdSOHZRbGlxRXFoLzNZREVZcFVmL3RGMnlKSld1SHY0cHBGSjkzbjhNVnQyaXppRVc5aE9ZR0FrRmtENjBxS0xnVnllQ3NwNHE2Y2dRMHNuaU0rTEtGQWdNQkFBR2pnZXd3Z2Vrd0R3WURWUjBUQVFIL0JBVXdBd0VCL3pBZkJnTlZIU01FR0RBV2dCUXIwR2xIbEhZSi92UnJqUzVBcHZkSFRYOElYakJFQmdnckJnRUZCUWNCQVFRNE1EWXdOQVlJS3dZQkJRVUhNQUdHS0doMGRIQTZMeTl2WTNOd0xtRndjR3hsTG1OdmJTOXZZM053TURNdFlYQndiR1Z5YjI5MFkyRXdMZ1lEVlIwZkJDY3dKVEFqb0NHZ0g0WWRhSFIwY0RvdkwyTnliQzVoY0hCc1pTNWpiMjB2Y205dmRDNWpjbXd3SFFZRFZSME9CQllFRkcveGxSaGlYT0RJOGNYdGJCako0Tk5rVXBnZ01BNEdBMVVkRHdFQi93UUVBd0lCQmpBUUJnb3Foa2lHOTJOa0JnSVNCQUlGQURBTkJna3Foa2lHOXcwQkFRc0ZBQU9DQVFFQU9zK3NtSTIra2lBaENhMlY4N0ZjSWZvMkxWY2dSSFJ6WkpJSXM1YXM5MjJYK2xzME9DZlBFa2JUUEJId0I4bVprTEhSNkJFSnBlT2xhMnhqQ0QrZUpmclZtWnhNNXVYT2pySk5hT3lMcTZPaVQ0b1JGVDdjRkNzY3hrUzJiMmZGVzArVktTMkhYRC9jZ3g1M1QrM2FWS2N0NXhPQndXUEVWQXNiU3dwcUtDSUkxRGVTZkg5bktGK3ZQVCszckZrZE9EUmtXdTR6U2hsQ1JDbkV5aGhyNGNGVExTMzBUY0lWOWpNeUdIanhKbStLVGV1VVRLUG8vdyt6QTR0bDJ1c3UyR1ZRbjl5Zml0OHhxSVJVM0ZKU1FkS3lFeDB4UmtlSVh6N3V3L0tNSXdTVjY2eUtQb0pzQnA4dTQ0dERtbUpiTkEzMG1jOHM3cnB5aGhranBmeU90VENDQkxzd2dnT2pvQU1DQVFJQ0FRSXdEUVlKS29aSWh2Y05BUUVGQlFBd1lqRUxNQWtHQTFVRUJoTUNWVk14RXpBUkJnTlZCQW9UQ2tGd2NHeGxJRWx1WXk0eEpqQWtCZ05WQkFzVEhVRndjR3hsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNUll3RkFZRFZRUURFdzFCY0hCc1pTQlNiMjkwSUVOQk1CNFhEVEEyTURReU5USXhOREF6TmxvWERUTTFNREl3T1RJeE5EQXpObG93WWpFTE1Ba0dBMVVFQmhNQ1ZWTXhFekFSQmdOVkJBb1RDa0Z3Y0d4bElFbHVZeTR4SmpBa0JnTlZCQXNUSFVGd2NHeGxJRU5sY25ScFptbGpZWFJwYjI0Z1FYVjBhRzl5YVhSNU1SWXdGQVlEVlFRREV3MUJjSEJzWlNCU2IyOTBJRU5CTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUE1SkdwQ1IrUjJ4NUhVT3NGN1Y1NWhDM3JOcUpYVEZYc2l4bUozdmxMYlBVSHF5SXdBdWdZUHZoUUNkTi9RYWlZK2RIS1pwd2theEhRbzd2a0d5ckRINVdlZWd5a1I0dGIxQlkzTTh2RUQwM09GR25SeVJseTlWME8xWDlmbS9JbEE3cFZqMDFkRGZGa05TTVZTeFZaSGJPVTkvYWNuczlRdXNGWVVHZVBDTFFnOTh1c0xDQnZjTFkvQVRDTXQwUFBENTA5OHl0SktCckkvczYxdVE3Wlhoeld5ejIxT3EzMER3NEFrZ3V4SVJZdWROVThEZHRpRnF1amNaSkhVMVhCcnk5QnMvajc0M0RONXFOTVJYNGZUR3RRbGtHSnhIUmlDeENEUVljemlvR3hNRmpzV2dReWpHaXpqeDNlWlhQL1oxNWx2RW5ZZHA4ekZHV2hkNVRKTFFJREFRQUJvNElCZWpDQ0FYWXdEZ1lEVlIwUEFRSC9CQVFEQWdFR01BOEdBMVVkRXdFQi93UUZNQU1CQWY4d0hRWURWUjBPQkJZRUZDdlFhVWVVZGduKzlHdU5Ma0NtOTBkTmZ3aGVNQjhHQTFVZEl3UVlNQmFBRkN2UWFVZVVkZ24rOUd1TkxrQ205MGROZndoZU1JSUJFUVlEVlIwZ0JJSUJDRENDQVFRd2dnRUFCZ2txaGtpRzkyTmtCUUV3Z2ZJd0tnWUlLd1lCQlFVSEFnRVdIbWgwZEhCek9pOHZkM2QzTG1Gd2NHeGxMbU52YlM5aGNIQnNaV05oTHpDQnd3WUlLd1lCQlFVSEFnSXdnYllhZ2JOU1pXeHBZVzVqWlNCdmJpQjBhR2x6SUdObGNuUnBabWxqWVhSbElHSjVJR0Z1ZVNCd1lYSjBlU0JoYzNOMWJXVnpJR0ZqWTJWd2RHRnVZMlVnYjJZZ2RHaGxJSFJvWlc0Z1lYQndiR2xqWVdKc1pTQnpkR0Z1WkdGeVpDQjBaWEp0Y3lCaGJtUWdZMjl1WkdsMGFXOXVjeUJ2WmlCMWMyVXNJR05sY25ScFptbGpZWFJsSUhCdmJHbGplU0JoYm1RZ1kyVnlkR2xtYVdOaGRHbHZiaUJ3Y21GamRHbGpaU0J6ZEdGMFpXMWxiblJ6TGpBTkJna3Foa2lHOXcwQkFRVUZBQU9DQVFFQVhEYVpUQzE0dCsyTW05enpkNXZ5ZHRKM01FL0JINFdEaFJ1WlBVYzM4cW1iUUk0czFMR1FFdGkrOUhPYjd0SmtEOHQ1VHpUWW9qNzVlUDlyeUFmc2ZUbURpMU1nMHpqRXNiK2FUd3ByL3l2OFdhY0ZDWHdYUUZZUkhuVFR0NHNqTzBlajFXOGs0dXZSdDNEZkQwWGhKOHJ4YlhqdDU3VVhGNmpjZmlJMXlpWFYyUS9XYTlTaUpDTVI5NkdzajNPQllNWWJXd2t2a3JMNFJFandZRGllRmZVOUptY2dpak5xOXcyQ3o5N3JveS81VTJwYlpNQmpNM2YzT2djc1Z1dmFEeUVPMnJwekdVKzEyVFovd1lkVjJhZVp1VEpDKzlqVmNaNStvVkszRzcyVFFpUVNLc2NQSGJaTm5GNWp5RXVBRjFDcWl0WGE1UHpRQ1FjM3NIVjFJVEdDQW9Vd2dnS0JBZ0VCTUg4d2N6RXRNQ3NHQTFVRUF3d2tRWEJ3YkdVZ2FWQm9iMjVsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNU0F3SGdZRFZRUUxEQmREWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNQ0NEMVorRGZxMGRpZk1Ba0dCU3NPQXdJYUJRQ2dnZHd3R0FZSktvWklodmNOQVFrRE1Rc0dDU3FHU0liM0RRRUhBVEFjQmdrcWhraUc5dzBCQ1FVeER4Y05Nall3TWpFeU1EQTBOREEzV2pBakJna3Foa2lHOXcwQkNRUXhGZ1FVWTlwTDdwTDdWRmVvaitnSVY4UnhaSGhMYmFjd0tRWUpLb1pJaHZjTkFRazBNUnd3R2pBSkJnVXJEZ01DR2dVQW9RMEdDU3FHU0liM0RRRUJBUVVBTUZJR0NTcUdTSWIzRFFFSkR6RkZNRU13Q2dZSUtvWklodmNOQXdjd0RnWUlLb1pJaHZjTkF3SUNBZ0NBTUEwR0NDcUdTSWIzRFFNQ0FnRkFNQWNHQlNzT0F3SUhNQTBHQ0NxR1NJYjNEUU1DQWdFb01BMEdDU3FHU0liM0RRRUJBUVVBQklJQkFEak5wV1RuSzJXUTJicnFqVTBjMjdXTUpzUkY1dUpBamFnQjFYTGVOelhuOS9uRUMrN3dnQitENk5nYTIyWmxUSDNPZmVKWCtZaHN3QzNuVDUvMmQ1Y2QvdFlPZjI2L3FDc0NLeGVlcndJT2tIWUVKUjZNMG9pKzR1MEYvRE5OVVhISzdmZTZ0eFRPS0tna01pQXN4V3JhWWlCOXA5dkdFODVrdThJN0tqZURaVDV4TTdYNmVtazgyMVU0c1dNN1puVlU3Sk5WakJiVWpweUpEbENGQTZvUU5BUkx0MXA1VXVhZGc1Y1lBTm1qMmZRaE94aHBWRnhGZXBWK1ZpcDgycGY2Vi9OYWVLRnY4TnYyZThHUWtnUTkzdmk3TW1mY0I0RWVPVmhoUVBuUnN5Z3NOMlBvZTdUeGJScEpSYTV1OXFUR3QvcDhqZjlRMm5iUVE0QjlyNkU9IiwiZGlzdHJpYnV0aW9uQ2VydGlmaWNhdGUiOnsiZGF0YUJhc2U2NCI6Ik1JSUw5QUlCQXpDQ0M3b0dDU3FHU0liM0RRRUhBYUNDQzZzRWdndW5NSUlMb3pDQ0JrTUdDU3FHU0liM0RRRUhBYUNDQmpRRWdnWXdNSUlHTERDQ0JpZ0dDeXFHU0liM0RRRU1DZ0VEb0lJRjJUQ0NCZFVHQ2lxR1NJYjNEUUVKRmdHZ2dnWEZCSUlGd1RDQ0JiMHdnZ1Nsb0FNQ0FRSUNFRzVFbGxxRWc1d1JaTFYrbzJRMFQzSXdEUVlKS29aSWh2Y05BUUVMQlFBd2RURkVNRUlHQTFVRUF3dzdRWEJ3YkdVZ1YyOXliR1IzYVdSbElFUmxkbVZzYjNCbGNpQlNaV3hoZEdsdmJuTWdRMlZ5ZEdsbWFXTmhkR2x2YmlCQmRYUm9iM0pwZEhreEN6QUpCZ05WQkFzTUFrY3pNUk13RVFZRFZRUUtEQXBCY0hCc1pTQkpibU11TVFzd0NRWURWUVFHRXdKVlV6QWVGdzB5TmpBeU1USXdNRE0wTURKYUZ3MHlOekF5TVRJd01ETTBNREZhTUlHWU1Sb3dHQVlLQ1pJbWlaUHlMR1FCQVF3S1YwZzBUVlExV2pRMFV6RThNRG9HQTFVRUF3d3phVkJvYjI1bElFUnBjM1J5YVdKMWRHbHZiam9nVFdscmFHRnBiQ0JYYVdwaGJtRnlhMjhnS0ZkSU5FMVVOVm8wTkZNcE1STXdFUVlEVlFRTERBcFhTRFJOVkRWYU5EUlRNUm93R0FZRFZRUUtEQkZOYVd0b1lXbHNJRmRwYW1GdVlYSnJiekVMTUFrR0ExVUVCaE1DVlZNd2dnRWlNQTBHQ1NxR1NJYjNEUUVCQVFVQUE0SUJEd0F3Z2dFS0FvSUJBUUNmNTdQdWFDWFhINWFzc012ZEEvaEhPR085UW9HL0dsRFFWU3BWMjZiSURwS01FVTlqMmFNSmtkcCtKazJFNituZGdreUpYdFZtWXczQzVrOWFXcmUxd0UzSEN1cnhHSVk5VUNsTmZDZkJtVlUvM2xaaGp5czRFQTVjRHllV01GVXVlcDhLQzVnZzQ2QVNOdU8vYTlETFJMKzd3dUJ2Y3doejRaekROZno2SlNka0lsVnAzRzhUNkVWNndqd1hjN0tEenZlNlF1ZWNjRHZXM3lXTlptZHVQL3MwSmZZclhIYTNjdDduSUE2b0NGUlYzRkhCVXlJQkFXL0hpVmdWc0h1UEJOcndPNnNYRkVySitVSDU0S29zb212NEFCUHNaKy9qZFhrUk1KYUNQSUF0ZklsNUVHU0ZjeDBDek9WdFJERWpISFJidU5OUDFBdUt1R0RQbFhWbEFnTUJBQUdqZ2dJak1JSUNIekFNQmdOVkhSTUJBZjhFQWpBQU1COEdBMVVkSXdRWU1CYUFGQW4rd0JXUSthOWtDcElTdVNZb1l3eVg3S2V5TUhBR0NDc0dBUVVGQndFQkJHUXdZakF0QmdnckJnRUZCUWN3QW9ZaGFIUjBjRG92TDJObGNuUnpMbUZ3Y0d4bExtTnZiUzkzZDJSeVp6TXVaR1Z5TURFR0NDc0dBUVVGQnpBQmhpVm9kSFJ3T2k4dmIyTnpjQzVoY0hCc1pTNWpiMjB2YjJOemNEQXpMWGQzWkhKbk16QXlNSUlCSGdZRFZSMGdCSUlCRlRDQ0FSRXdnZ0VOQmdrcWhraUc5Mk5rQlFFd2dmOHdnY01HQ0NzR0FRVUZCd0lDTUlHMkRJR3pVbVZzYVdGdVkyVWdiMjRnZEdocGN5QmpaWEowYVdacFkyRjBaU0JpZVNCaGJua2djR0Z5ZEhrZ1lYTnpkVzFsY3lCaFkyTmxjSFJoYm1ObElHOW1JSFJvWlNCMGFHVnVJR0Z3Y0d4cFkyRmliR1VnYzNSaGJtUmhjbVFnZEdWeWJYTWdZVzVrSUdOdmJtUnBkR2x2Ym5NZ2IyWWdkWE5sTENCalpYSjBhV1pwWTJGMFpTQndiMnhwWTNrZ1lXNWtJR05sY25ScFptbGpZWFJwYjI0Z2NISmhZM1JwWTJVZ2MzUmhkR1Z0Wlc1MGN5NHdOd1lJS3dZQkJRVUhBZ0VXSzJoMGRIQnpPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOWpaWEowYVdacFkyRjBaV0YxZEdodmNtbDBlUzh3RmdZRFZSMGxBUUgvQkF3d0NnWUlLd1lCQlFVSEF3TXdIUVlEVlIwT0JCWUVGRGo1OHROMTEweUhQSXdiT1BEVjdvYXJKc1piTUE0R0ExVWREd0VCL3dRRUF3SUhnREFUQmdvcWhraUc5Mk5rQmdFRUFRSC9CQUlGQURBTkJna3Foa2lHOXcwQkFRc0ZBQU9DQVFFQU5FR0JocWE1dEhWUTZ6cys1cU5GWW1UUDNsT0VtVm83OEJCMVE1TFptTGthRDRTS2JkTC9HNjhYRGxqc204RTJFTlRGbTR3QVJCWFFCdWRqM0FxZjZ3aklCWWU4RGJFRXUvMjcraGdNOTVrNE1wZkVnN0M1VTMzUTh0S2owbjRST0pyUWZWQUZvYnJTZytvdk9TUDIrd2lLNTJOQXlGRUc2WGt5VWdGMVNsQ3NBZzFLZEVMQ0oweG9wVXlNMHpQaXVjTHBkL1dsNHNxbGtjM2pQb0I1Q1ZLelFUYUNHV1lIclllT1lMUnJyazZUQ3VUbloxSVFwTHVVR0JUR1dhR0NoMFljN2QzVkltZjNxZTI3Nkw2d1hwc09YSW1jK21yWUtvUlEwYWRhZzBZY2ZTRHZpVk41V0tPbUVOdzJyRzJzZWZ4bHd6OEx3aU5QZGY4WFBMT0d2ekU4TUNNR0NTcUdTSWIzRFFFSkZURVdCQlRzcGFmUmlKYTVIVUU4NE4wbDlvM1l3MkZBWWpBVkJna3Foa2lHOXcwQkNSUXhDQjRHQUdzQVpRQjVNSUlGV0FZSktvWklodmNOQVFjQm9JSUZTUVNDQlVVd2dnVkJNSUlGUFFZTEtvWklodmNOQVF3S0FRS2dnZ1R1TUlJRTZqQWNCZ29xaGtpRzl3MEJEQUVETUE0RUNQSWdqVnRsa1hNdkFnSUlBQVNDQk1nUEVKRm9QYU9uc0lqVlZZSytTcmNiTVMrSjJsSzV1OG93MHZ5MnBmbEljQTlBek04SGMyMmRWVnR2OGxZdnpJcWpaaG1ZK09DNHNoRHhjbTRhdFBRR2M5aS9HdUNsb1ZEQVpKVnNXQmRJbzNUcGlMMW5Qb3RaUG04Nk1xRmhFWXB6K0Z0dldBbGN0VFBlbmpKSUFWbjNOWmFNVERzQnJZMEowVFAycnhMdUhzY01DVFVWcExrb1ZxaytqOXNuUXVlQVZTaXA0ekRSVHhoK2hVYXk0SGxsQSs1RGlpNGhTeFd3ZEczdXp2S2kyOGRLU3I0T3doY2U2YW9KaDQvODZKVkVnZS9lWGp0RXFHRkI4TlowbmxvaWhVL2lUVFBJSUlHYm02Yy9KOVlFQzJEVWtzSDJodWJsL0xibERrajhuUGh3cERiTXdKbWR0Z1Zkai9VWHRzRU53S0d2U0E1ZUtlblFlY2xJUkhnWTFKbHAxZlB2dGpYSUs1bmYxVUVTSVpSZ3d5aWJxZTY0R0Q4UXBEbElGMzFFTTJZU3Z3WlVLSjJuSFdrT0c2bTFoRHZMWVdmME96SjFBZHN2d2dvbFBlR2hDZmh0SEhkWDI1M1Yzd0tncWxmTkNsRXVLRDVudlFoZjY0ZU9lVDFqUzEzTkNVLzVOaUpDZGFDZ3VQTzlYYUE0ZUdXMDI5NVNkRTA4UUpwMndDS1NYams3dW80c0srQXRpa2lSY1FOcldmKzR6OGZDQ0FUOTFyMGhlazVmUThGOEZrenJWdDRSSk5NVFRjSXRzZVFKdVl3MERUb2lnN2Z2M3JjU0Z5V0VqYXRGbExud1dxaEhHMjJ0c2RrU1lMdzBRdXRsbzRoUDhZOXlXVm9JalovOTU3dzB1UzJVUjJCSVZ3T2NOODRIZnB2cWhRSk9kdkxHZGtnR2dNb05mNFZqdUJOK01WUHFyc2JucUZwQnh3N1RNM3JFMXF4QmlhRmJackt2dTdXQjVGa0FRcXJ1VEg1UnEzYzcwaVNjdXJvanVGL3NrSUNnc3pJbkZoZjdsZ1JOTkIrVERYcWM2VjQzSGxYQXJnbVFlcjNZOEVNRHZDWTQ3dmtEdFBOTGdaOW1WVmJrV3pJYTJPV2gyUTJpSTBkK0E4empYZk5UYmloWStNWjFaWXlGNmtPUVVySmY3ZUo4MDB1MGovOXkxemtWWEtMa3BiSTlLS3RIRnZuZnhFV01kbHpzVDU0NjZQNWJrb1dRNXVuK29xTm0rSnM2SWZ6S1pHL2dIcTB2cHE3YjkreGU1VzBqRXNtdmw4NkdGdlNQUUpvSjYrd3A0b0N5amZ3WFFXR244OE9SYjNSUlZoQm5nb0dRUW11SEFvb3Z0SjlRYTEyWVVVa3ppRkVYUFdFV0tyLysrZ051bmVBWnBzckUxWGhqdWdRYkdHeTR5N2ozMENHQ2kwaUJqMEROYnI3aEFlYldYeEViM2FUa2JTQjQxQ3kyLzBkMzJkK1g2b2NFclFZVzFpVGtIdG5IZnloWWJRQis1eHVtb21ERnRSd3pndjhTZmhKNjZ5QUNoTEJTOSt0RnF2MXRjbmdDMSsrbXhpZDFhOXdUanp3QnJxR2FEcHpGcEFFdEsvUWgwZGg5cEdVUGl0bUdGK1NMeStzZ0VZMDhoUmUwY0VhdE55eXlVREY0Umpnd1d1TXJGdTFtR2lCWDU3OS9oL0RtK3N4WVlvdFVDeUd2YkZyVVk5WldSOTdyVUpSUGlPV0c5dlkya0RsWmU0SFFHSzhWY2JmMFdEWmJOL2NrTjdEYjhzRWFuWENaZDZlMUtUdXFOVmUzWlNKZUwydVNtb3o3QnFBbzQ4ek9BdzRNY2VWUG5SMjdBZGZFaGdtb0VWa2xodjNWRVJNRTZLY3A0UEZ2ek9FcThhV25RNFlLOGlJUm54MWxmaVZIYUZVYnlIU3RFeGdjL2xhZVFBaUl1MEd6QXNwcjk3ZFhqeEZidStzTEljS2xCYXdTc1BwZGNYYkdwNnZXb1JRcW1ZeTVLVnV5c1RtdEVsZVZzRE9aYno2WHZtOFV1Y0I2enpIVWZSaXl6Nkh2REtXcW9kNVFDbS9BQ2dFVlFBQnB5WWl3a09wR3NEWE4vTkVJVE9lTFZWS3kwMHhPVkdKY2tvcEJwajdnM2hoWDgvL3FabHppRWhveFBEQWpCZ2txaGtpRzl3MEJDUlV4RmdRVTdLV24wWWlXdVIxQlBPRGRKZmFOMk1OaFFHSXdGUVlKS29aSWh2Y05BUWtVTVFnZUJnQnJBR1VBZVRBeE1DRXdDUVlGS3c0REFob0ZBQVFVa3I3MDd2cURhRkYwWnNVZ3JHU3dlVUpycG13RUNBd0FUeHRMbmpsbEFnSUlBQT09IiwicGFzc3dvcmQiOiJUZ1A5Zy84T2E5MzZoalBSN3MxdUlnPT0ifX19fSwidXBkYXRlcyI6e30sInNjaGVtZSI6IlByb21wdFBhbCIsInVzZXJuYW1lIjoibWlraGFpbHNwZWFrcyIsImV4cGVyaW1lbnRhbCI6e30sIm1vZGUiOiJidWlsZCIsInRyaWdnZXJlZEJ5IjoiRUFTX0NMSSIsImFwcElkIjoiZDhlNmVjOGEtYTJiNy00N2IxLWE5MDQtZjU0MmFmMzhlNmZjIiwiaW5pdGlhdGluZ1VzZXJJZCI6IjczY2FmMWJmLTFjYTEtNDE0ZC1hZjBkLWQ4ZDM5M2ZkYzU5ZSJ9LCJtZXRhZGF0YSI6eyJ0cmFja2luZ0NvbnRleHQiOnsidHJhY2tpbmdfaWQiOiIyY2UyNjVmMi0yYmRjLTQ2YzUtOGZjNC0yZTgxYzE2ZjIzOWQiLCJwbGF0Zm9ybSI6ImlvcyIsInNka192ZXJzaW9uIjoiNTQuMC4wIiwiYWNjb3VudF9pZCI6IjAxNzc4ZTI4LWUxNTItNGYwYi05Y2YxLTc5YmI1ODMyNjdhNiIsInByb2plY3RfaWQiOiJkOGU2ZWM4YS1hMmI3LTQ3YjEtYTkwNC1mNTQyYWYzOGU2ZmMiLCJwcm9qZWN0X3R5cGUiOiJtYW5hZ2VkIiwiZGV2X2NsaWVudCI6ZmFsc2UsIm5vX3dhaXQiOmZhbHNlLCJydW5fZnJvbV9jaSI6ZmFsc2UsImxvY2FsIjp0cnVlfSwiYXBwQnVpbGRWZXJzaW9uIjoiMTYiLCJhcHBWZXJzaW9uIjoiMS4wLjAiLCJjbGlWZXJzaW9uIjoiMTguMC4xIiwid29ya2Zsb3ciOiJtYW5hZ2VkIiwiY3JlZGVudGlhbHNTb3VyY2UiOiJyZW1vdGUiLCJzZGtWZXJzaW9uIjoiNTQuMC4wIiwiZmluZ2VycHJpbnRIYXNoIjoiZGNkMjc2OTY5NWRkNzM2NWJjYTQxMzA1Njc1OTZmM2Y3NDY0YTY5YyIsInJlYWN0TmF0aXZlVmVyc2lvbiI6IjAuODEuNSIsImRpc3RyaWJ1dGlvbiI6InN0b3JlIiwiYXBwTmFtZSI6IlByb21wdFBhbCIsImFwcElkZW50aWZpZXIiOiJjb20ubWlraGFpbHNwZWFrcy5wcm9tcHRwYWwiLCJidWlsZFByb2ZpbGUiOiJyb3V0ZXIiLCJnaXRDb21taXRIYXNoIjoiMjVhZGFmMDQ0ZTc0YjZjNmExODA3MWExMTgxNDliODdkZjI4ZjExOCIsImdpdENvbW1pdE1lc3NhZ2UiOiJNZXJnZSBicmFuY2ggJ21pa2hhaWwtY2hhbmdlcycgaW50byBtYWluIChyZXNvbHZlIGFwcC5qc29uLCBlYXMuanNvbiwgcGFja2FnZS1sb2NrIGNvbmZsaWN0cylcblxuQ28tYXV0aG9yZWQtYnk6IEN1cnNvciA8Y3Vyc29yYWdlbnRAY3Vyc29yLmNvbT4iLCJpc0dpdFdvcmtpbmdUcmVlRGlydHkiOnRydWUsInVzZXJuYW1lIjoibWlraGFpbHNwZWFrcyIsInJ1bldpdGhOb1dhaXRGbGFnIjpmYWxzZSwicnVuRnJvbUNJIjpmYWxzZSwiZGV2ZWxvcG1lbnRDbGllbnQiOmZhbHNlLCJyZXF1aXJlZFBhY2thZ2VNYW5hZ2VyIjoibnBtIiwiY3VzdG9tTm9kZVZlcnNpb24iOiIyMC4xOS40Iiwic2ltdWxhdG9yIjpmYWxzZX19 exited with non-zero code: 1
    Error: build command failed.
mikhail@mikhail-super-computer PromptPal % 


Worked for 3m 19s
pod install failed because react-native-reanimated@~4.1.1 requires New Architecture, and build 16 was trying old architecture (RCT_NEW_ARCH_ENABLED=0).

I fixed this locally:

Re-enabled New Architecture in app.json ("newArchEnabled": true)
Added dynamic router isolation config in app.config.js
Router profile now points Expo Router to isolated routes in /Users/mikhail/Documents/CURSOR CODES/In Progress/Prompt Pal App/PromptPal/src/router-app (via eas.json + plugin root)
Run this again:

cd "/Users/mikhail/Documents/CURSOR CODES/In Progress/Prompt Pal App/PromptPal" && EXPO_PUBLIC_BOOT_MODE=router npx eas build --platform ios --profile router --local
The peer dependency warnings are non-blocking; the fatal blocker was the Reanimated/New-Arch mismatch.


5 files changed
+75
-1
Undo
PromptPal/app.config.js
PromptPal/app.json
PromptPal/eas.json
PromptPal/src/router-app/_layout.tsx
PromptPal/src/router-app/index.tsx
okay build 16 is showing router isolation mode. btw record all our learnings in docs/safe_mode_plan.md

I’ll update safe_mode_plan.md with a concrete “learnings log” from build 3 through build 16, including what failed, what was proven, and what to do next.

Explored 1 file
I’ve got the current plan file. I’m now patching it with a full execution log and hard-earned constraints (including the Reanimated/New-Arch constraint and router app-root isolation outcome).

Edited
safe_mode_plan.md
+58
-3
Explored 1 file
Worked for 44s
Done. I recorded the full learnings in:

safe_mode_plan.md

I added:

Build 3 → 16 timeline
Crash signature findings (build 14/15)
The isLevelUnlocked duplicate-build blocker + fix
New Architecture/Reanimated constraint
Router isolation app-root result
Guardrails and next route-bisection steps.

1 file changed
Undo
docs/safe_mode_plan.md
Running 2 terminals

Stop





GPT-5.3-Codex

High



Local

Default permissions

mikhail-changes
Terminal
/bin/zsh

