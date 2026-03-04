# 🎮 PromptPal

**Master the Art of AI Prompt Engineering**

An innovative multi-module mobile game that teaches players to craft perfect AI prompts across three domains: image generation, coding, and copywriting. Master the art of communicating with AI through gamified challenges and real-time feedback.

![PromptPal Banner](https://img.shields.io/badge/Status-65%25%20Complete-yellow?style=for-the-badge)
![Modules](https://img.shields.io/badge/Modules-3%20(Image%2C%20Code%2C%20Copy)-blue?style=for-the-badge)
![Expo](https://img.shields.io/badge/Expo-SDK%2054-black?style=flat-square&logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square)

---

## 📊 Development Status

**Overall Progress: ~65% Complete**

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Project Initialization & Architecture | ✅ Complete | 100% |
| Phase 2: AI Proxy Backend Integration | ✅ Complete | 100% |
| Phase 3: Gameplay Implementation | ✅ Complete | 100% |
| Phase 4: Level Design & Persistence | ⚠️ In Progress | ~60% |
| Phase 5: Advanced Gameplay | ⚠️ In Progress | ~40% |
| Phase 6: Polish, Testing & Deployment | 📋 Planned | 0% |

---

## 🌟 Features

### ✅ Implemented Features

#### Authentication & User Management
- **🔐 Clerk Authentication**: Full sign-in/sign-up flows with Google OAuth support
- **🔑 Secure Token Management**: JWT authentication with automatic refresh
- **📱 Session Management**: Persistent sessions with auto sign-out on token expiry

#### Game Mechanics
- **🎮 Three Challenge Modules**: Image Generation, Code/Logic, and Copywriting
- **❤️ Lives System**: 3 lives per level with retry mechanics
- **🏆 Level Completion Tracking**: Progress saved across sessions
- **📊 XP & Streak System**: Gamification elements (UI implemented)

#### AI Integration
- **🤖 AI Proxy Backend**: Secure proxied AI calls with rate limiting
- **🖼️ Image Generation**: Create images from text prompts via Gemini
- **📝 Text Generation**: AI-powered content generation
- **🔄 Retry Logic**: Exponential backoff with automatic retries

#### User Interface
- **🎨 Dark Theme UI**: Beautiful, consistent dark mode design
- **📱 Adaptive Game Screen**: Dynamic UI for each module type
- **🏠 Home Screen**: Stats, daily quests, learning modules display
- **📚 Library Screen**: Level browsing (basic structure)
- **🏅 Ranking Screen**: Leaderboard view (basic structure)
- **⚙️ Settings Modal**: User preferences and sign-out

#### State Management
- **💾 Persistent Progress**: SecureStore for encrypted local storage
- **🔄 Zustand Stores**: Game state, user progress, achievements
- **📡 Sync Manager**: Background sync infrastructure (structure ready)

### ⚠️ Partially Implemented

- **📈 Scoring System**: Works with mocked scoring (real AI scoring pending)
- **🎯 Level Content**: 3 sample levels (15+ more needed per module)
- **🔓 Level Unlocking**: Store has unlock logic, not fully integrated
- **📊 Progress Sync**: Structure exists, backend testing pending

### 🚀 Upcoming Features

- **🧮 Real Scoring Services**: AI-powered scoring for all three modules
- **💡 NanoAssistant Hints**: AI-powered contextual hints during gameplay
- **🎬 Onboarding Flow**: First-time user tutorial
- **🔊 Sound Effects**: Audio feedback for actions
- **✨ Enhanced Animations**: Polish and micro-interactions
- **🧪 Comprehensive Testing**: Unit, integration, and E2E tests
- **📱 App Store Deployment**: iOS and Android releases

---

## 🛠️ Technology Stack

### Frontend (Mobile App)
- **Expo SDK 54**: Latest Expo platform for cross-platform development
- **React Native 0.81.5**: Modern React Native with new architecture
- **TypeScript 5.9**: Type-safe development with latest TypeScript features
- **Expo Router**: File-based routing and navigation

### UI & Styling
- **NativeWind**: Tailwind CSS for React Native
- **React Native Safe Area Context**: Proper notch and edge handling
- **Expo Haptics**: Tactile feedback

### State Management
- **Zustand**: Lightweight, scalable state management with persist middleware
- **Expo SecureStore**: Encrypted persistent storage

### Authentication
- **Clerk**: Complete authentication solution with Expo integration
- **JWT Tokens**: Secure API authentication

### AI Integration
- **AI Proxy Backend**: Secure server-side AI API calls
- **Google Gemini API**: Image generation, text generation, and comparison
- **Rate Limiting**: Client-side rate limiting with axios-retry

### API & Networking
- **Axios**: HTTP client with interceptors for auth and retry
- **axios-retry**: Exponential backoff for failed requests

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **Bun** ([install](https://bun.sh))
- **Expo CLI**: `bun add -g @expo/cli` or `npm install -g @expo/cli`
- **iOS Simulator** (macOS) or **Android Emulator** or **Physical Device**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mwijanarko1/Prompt-Pal-App.git
   cd Prompt-Pal-App
   ```

2. **Navigate to the project**
   ```bash
   cd PromptPal
   ```

3. **Install dependencies**
   ```bash
   bun install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Clerk and API keys
   ```

5. **Start the development server**
   ```bash
   bun start
   ```

6. **Run on device/emulator**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Or scan QR code with **Expo Go** app

---

## 📁 Project Structure

```
PromptPal/
├── src/
│   ├── app/                      # Expo Router pages
│   │   ├── _layout.tsx           # Root layout with Clerk provider
│   │   ├── global.css            # Global styles
│   │   ├── (auth)/               # Authentication screens
│   │   │   ├── _layout.tsx
│   │   │   ├── sign-in.tsx
│   │   │   └── sign-up.tsx
│   │   └── (tabs)/               # Main app tabs
│   │       ├── _layout.tsx       # Tab navigation
│   │       ├── index.tsx         # Home screen
│   │       ├── library.tsx       # Level library
│   │       ├── ranking.tsx       # Leaderboards
│   │       └── game/
│   │           └── [id].tsx      # Dynamic game screen
│   ├── components/
│   │   ├── ui/                   # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── RadarChart.tsx
│   │   │   ├── ResultModal.tsx
│   │   │   └── index.ts
│   │   ├── UsageDisplay.tsx      # API usage stats
│   │   ├── SignOutButton.tsx
│   │   └── ErrorBoundary.tsx
│   ├── features/
│   │   ├── game/
│   │   │   └── store.ts          # Game state (lives, progress)
│   │   ├── levels/
│   │   │   └── data.ts           # Level definitions
│   │   ├── achievements/
│   │   │   └── store.ts          # Achievements tracking
│   │   └── user/
│   │       └── store.ts          # User progress, XP, streaks
│   └── lib/
│       ├── aiProxy.ts            # AI backend client
│       ├── api.ts                # General API client
│       ├── auth.ts               # Token cache
│       ├── clerk.tsx             # Clerk provider
│       ├── usage.ts              # Usage tracking
│       ├── syncManager.ts        # Progress sync
│       ├── rateLimiter.ts        # Rate limiting
│       ├── logger.ts             # Logging utility
│       ├── gemini.ts             # Gemini API (legacy)
│       └── ...                   # Other utilities
├── docs/
│   ├── phases/                   # Phase documentation
│   ├── jan-25-report.md          # Current status report
│   ├── jan-25-plan.md            # Team work plan
│   ├── CODEBASE_MAP.md           # Codebase reference
│   └── plan.md                   # Original plan
├── app.json                      # Expo configuration
├── tailwind.config.js            # Tailwind configuration
└── package.json                  # Dependencies
```

---

## 🎯 How to Play

### 🖼️ **Image Generation Module**
1. **Select a Level**: Choose from unlocked image challenges
2. **Analyze the Target**: Study the displayed image carefully
3. **Craft Your Prompt**: Write a detailed description to recreate the image
4. **Generate & Compare**: AI creates your image and scores similarity
5. **Improve & Retry**: Use feedback to refine your prompt engineering

### 💻 **Coding Module**
1. **Read Requirements**: Study the programming task and test cases
2. **Write AI Prompt**: Craft a prompt instructing AI to generate the code
3. **Execute & Test**: Generated code runs against test cases
4. **Analyze Results**: Review test results and code quality
5. **Refine Prompts**: Improve based on failures and feedback

### ✍️ **Copywriting Module**
1. **Review Brief**: Read the audience, product, and tone requirements
2. **Craft Copy Prompt**: Write a prompt for generating marketing copy
3. **Analyze Content**: AI evaluates tone, persuasion, and effectiveness
4. **Review Metrics**: Study radar chart feedback on key metrics
5. **Iterate & Improve**: Refine for better copy generation

### Scoring System
- **Images**: 75%+ similarity score to pass
- **Code**: 80%+ test pass rate to pass
- **Copy**: 85%+ effectiveness score to pass
- **Limited Lives**: 3 attempts per level before game over
- **Progression**: Passing unlocks next level

---

## 📅 Development Roadmap

| Phase | Duration | Focus Area | Status |
|-------|----------|------------|--------|
| 1 | Jan 1-3 | Project Initialization & Architecture | ✅ Complete |
| 2 | Jan 4-10 | AI Proxy Backend Integration | ✅ Complete |
| 3 | Jan 11-24 | Gameplay Implementation | ✅ Complete |
| 4 | Jan 25-28 | Level Design & Persistence | ⚠️ In Progress |
| 5 | Jan 28-31 | Advanced Gameplay Features | ⚠️ In Progress |
| 6 | Feb 1-7 | Polish, Testing & Deployment | 📋 Planned |

**Target Launch**: February 15th, 2026

---

## 🔧 Current Known Issues

### Critical
- Scoring returns mocked values (AI scoring services not yet implemented)
- Only 3 levels exist (need 15+ per module)

### High Priority
- Level unlock system not fully integrated with UI
- Next level navigation not implemented

### Medium Priority
- Alert-based results in some flows (should use modals)
- Progress sync not tested with backend

---

## 🤝 Contributing

We welcome contributions! Please see our contribution guidelines below.

### Git Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes and commit**
   ```bash
   git commit -m "feat: add your feature description"
   ```
4. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Convention

We use [Conventional Commits](https://conventionalcommits.org/):

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `style:` | Code style (formatting) |
| `refactor:` | Code restructure |
| `test:` | Tests |
| `chore:` | Maintenance |

### Code Style
- **TypeScript**: Strict mode - all code must be type-safe
- **NativeWind**: Use Tailwind classes for styling
- **ESLint/Prettier**: Run `bun run lint` before committing

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Contact

- **Repository**: [github.com/mwijanarko1/Prompt-Pal-App](https://github.com/mwijanarko1/Prompt-Pal-App)
- **Issues**: [GitHub Issues](https://github.com/mwijanarko1/Prompt-Pal-App/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mwijanarko1/Prompt-Pal-App/discussions)
