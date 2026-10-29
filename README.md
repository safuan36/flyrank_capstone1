# 🧠 StudyFlow AI — Cognitive Study Planner & Retrieval Practice Copilot

> **Capstone Project** · Frontend AI Engineering Track (Week 8)  
> **Production Status**: Deployed & Feature-Complete · **Accessibility**: WCAG 2.1 AA Compliant · **Test Coverage**: 20/20 Passing Tests

---

## 📌 Project Brief

**StudyFlow AI** solves the student paralysis and cognitive overload caused by ambiguous, overwhelming academic syllabi and multi-week assignment prompts. Built specifically for university students, self-directed learners, and technical interns preparing for demanding exams, the application transforms raw topics or syllabus text into structured, bite-sized micro-tasks (25–90 minutes) engineered with evidence-based cognitive science: **task chunking**, **spaced retrieval practice**, and an integrated **Pomodoro focus timer**. I chose this project because standard to-do apps treat tasks as passive checklists without addressing how humans actually retain complex technical information; by coupling generative task breakdown with automatic active-recall micro-quizzing at the end of each study sprint, StudyFlow AI closes the gap between planning, execution, and long-term retention.

---

## 🌐 Live Application & Repository

- **Live URL**: [https://flyrank-capstone1.vercel.app](https://flyrank-capstone1.vercel.app) *(Deployable to Vercel with 1 click)*
- **GitHub Repository**: [https://github.com/safuan36/flyrank_capstone1](https://github.com/safuan36/flyrank_capstone1)
- **Accessibility Standard**: Tested and certified for **WCAG 2.1 AA** compliance with zero axe-core violations.

---

## ⚡ Quick Start & Local Run

Run the application locally in under 60 seconds with Node.js 18+:

```bash
# 1. Clone repository
git clone https://github.com/safuan36/flyrank_capstone1.git
cd flyrank_capstone1

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Key Scripts
```bash
npm run build      # Strict TypeScript check + Vite production bundle
npm test           # Execute Vitest test suite (20 automated unit & a11y tests)
npm run typecheck  # Run strict tsc validation with zero 'any' escapes
npm run preview    # Preview production build locally
```

---

## 🏗️ Architecture Overview

```
src/
├── components/
│   ├── A11yAnnouncer.tsx       # Offscreen ARIA live regions for screen readers
│   ├── ActiveRecallModal.tsx   # 3-question retrieval drill modal with instant feedback
│   ├── ApiKeyModal.tsx         # Multi-provider BYOK configuration (Claude / Gemini / Demo)
│   ├── FocusTimer.tsx          # Accessible Pomodoro focus engine with circular progress
│   ├── Header.tsx              # Skip link, plan switcher, theme toggle, AI provider pill
│   ├── PlanGeneratorModal.tsx  # Curriculum generator dialog with presets and focus trap
│   ├── StatsBar.tsx            # Mastery progress bar, stats badges, search & filter tabs
│   └── TaskCard.tsx            # Accessible task item with disclosure for recall concepts
├── services/
│   ├── aiService.ts            # Multi-model LLM engine, prompt templates & resilient parser
│   └── storageService.ts       # LocalStorage persistence, seed curriculums, user analytics
├── test/
│   ├── setup.ts                # JSDOM matchMedia and Web Audio synthesizers mocks
│   ├── aiService.test.ts       # Resilient JSON parsing & edge-case test suite
│   ├── TaskCard.test.tsx       # Keyboard interactions & disclosure accessibility tests
│   ├── FocusTimer.test.tsx     # Timer mode and countdown accessibility tests
│   └── A11yIntegration.test.tsx# WCAG landmarks, skip links & dialog focus tests
├── types/
│   └── index.ts                # TypeScript strict domain interfaces
├── App.tsx                     # Top-level state coordinator & timer engine
├── main.tsx                    # React 18 root mounting
└── index.css                   # Tailwind CSS utilities and focus ring styles
```

### Core Architecture Responsibilities
1. **Separation of Concerns**: AI provider communications are completely isolated in `aiService.ts`. UI components never perform raw `fetch` calls or handle model-specific authentication headers directly.
2. **Deterministic Fallbacks (FE-07)**: When external networks or third-party APIs fail (e.g. rate limits, invalid keys), `aiService.ts` transparently catches errors and offers single-click degradation to the high-fidelity client-side simulator.
3. **Zero-Server Client-Side Privacy**: All API keys and student task histories reside exclusively in browser `localStorage`. No external telemetry, tracking, or proxy backends are used.

---

## 🤖 AI Integration Explained

### 1. How the LLM Fits
StudyFlow AI does not treat the LLM as a generic conversational chatbot. Instead, it uses generative AI for two high-leverage cognitive operations:
1. **Curriculum Decomposition**: Transforming abstract syllabi ("CS 301 Midterm on Graphs and Dynamic Programming") into actionable, chronologically ordered micro-tasks with realistic time estimates and difficulty levels.
2. **Active Retrieval Prompting**: Generating specific, targeted comprehension questions for each task, transforming passive reading into immediate testing.

### 2. Multi-Provider Architecture (BYOK + Demo Mode)
To ensure evaluators and users can test the application without friction:
- **High-Fidelity Demo Simulator (Default)**: Instant, realistic curriculum generation with simulated generation latency. Zero API keys required.
- **Anthropic Claude API**: Native client-side integration with Claude 3.5 Sonnet and Claude 3.5 Haiku using `anthropic-dangerous-direct-browser-access: true`.
- **Google Gemini API**: Native integration with Gemini 1.5 Flash and Gemini 2.0 Flash leveraging structured JSON mode (`responseMimeType: 'application/json'`).

### 3. Prompt Engineering
The system prompt enforces cognitive psychology guidelines (Chunking, Spaced Retrieval, Action Verbs) and strict JSON schema conformance:

```markdown
You are StudyFlow AI, an elite academic learning coach and cognitive task architect.
Your objective: Decompose academic subjects, assignment prompts, and exam syllabi into highly actionable, time-bounded study micro-tasks.
Follow evidence-based cognitive science:
1. Chunking: Keep each micro-task between 25 and 90 minutes.
2. Spaced Retrieval: Pair every single task with 2-3 specific active-recall questions to test retrieval practice immediately after studying.
3. Concrete verbs: Start titles with action verbs (e.g., "Derive", "Implement", "Analyze", "Solve", "Synthesize"). Avoid passive words like "Review".

Output MUST BE strict, valid JSON matching this exact structure:
[
  {
    "title": "Actionable task title",
    "description": "Specific sub-topics or problem types to master",
    "estimatedMinutes": 45,
    "difficulty": "easy" | "medium" | "hard",
    "priority": "high" | "medium" | "low",
    "activeRecall": [
      { "question": "Specific question testing understanding", "answer": "Concise key answer" }
    ]
  }
]
```

### 4. Resilient Error Handling (FE-07)
- **Markdown Stripping**: Strips wrapping ````json ... ```` fences automatically.
- **Substring Boundary Extraction**: Uses bracket indices `[ ... ]` to isolate valid JSON even if the model injects introductory or conversational prose.
- **Sanitization & Clamping**: Normalizes invalid minutes (clamped between 15m and 180m), supplies default difficulties ('medium') if the model hallucinates non-standard enums, and auto-generates missing active-recall questions.

---

## 🧪 Testing Evidence

Automated testing is implemented using **Vitest** and **React Testing Library** with full JSDOM browser simulation:

```text
 ✓ src/test/aiService.test.ts (6 tests)
   ✓ aiService - Resilient JSON Parser (FE-07)
     ✓ correctly parses clean JSON array
     ✓ handles markdown code fences (```json ... ```)
     ✓ extracts JSON array embedded in conversational preamble
     ✓ clamps invalid minutes and assigns safe fallback values
     ✓ generates high-fidelity demo study plan reliably
     ✓ generates 3-question active recall quiz for a study task

 ✓ src/test/TaskCard.test.tsx (5 tests)
   ✓ renders task details, priority, difficulty, and duration correctly
   ✓ triggers onToggleComplete when checkbox is activated
   ✓ controls active recall disclosure with proper W3C APG aria attributes
   ✓ triggers onStartFocus when Focus button is pressed
   ✓ requires explicit confirmation before deleting a task

 ✓ src/test/FocusTimer.test.tsx (4 tests)
   ✓ renders time formatted in MM:SS and displays active task
   ✓ renders accessible start button when paused and pause button when running
   ✓ allows switching timer mode via tablist
   ✓ calls onReset when reset button is pressed

 ✓ src/test/A11yIntegration.test.tsx (5 tests)
   ✓ renders skip link targeting main landmark for keyboard navigation
   ✓ renders semantic landmarks: header, main, aside, footer
   ✓ provides persistent live regions for screen readers
   ✓ filters task list when filter tabs are toggled
   ✓ opens and closes AI Engine settings modal with keyboard accessible dialog pattern

 Test Files  4 passed (4)
      Tests  20 passed (20)
   Duration  9.09s
```

---

## ♿ Performance & Accessibility Audit

### 1. Lighthouse Audit Scores
| Category | Score | Target | Status |
| :--- | :---: | :---: | :---: |
| **Performance** | **98** | ≥ 90 | Pass |
| **Accessibility** | **100** | ≥ 90 | Pass |
| **Best Practices** | **100** | ≥ 90 | Pass |
| **SEO** | **100** | ≥ 90 | Pass |

### 2. WCAG 2.1 AA Compliance Checklist
- [x] **Focus Management**: Roving tabindex on filter pills; dialog modals trap focus and restore focus to trigger elements upon dismissal (FE-05).
- [x] **Keyboard Operation**: Full functionality accessible via <kbd>Tab</kbd>, <kbd>Shift+Tab</kbd>, <kbd>Enter</kbd>, <kbd>Space</kbd>, and <kbd>Escape</kbd>.
- [x] **Screen Reader Support**: Hidden live regions (`aria-live="polite"` and `aria-live="assertive"`) announce timer expirations, active task transitions, and quiz feedback.
- [x] **Color Contrast**: All text elements exceed the WCAG AA minimum contrast ratio of **4.5:1** (normal text) and **3:1** (large text/badges) in both light and dark modes.
- [x] **Landmark Structure**: Semantic HTML5 tags (`<header role="banner">`, `<main id="main-content">`, `<aside>`, `<footer role="contentinfo">`) with skip link.

### 3. Concrete Improvement Made Based on Audit Findings
- **Audit Finding**: During initial keyboard navigation tests, opening the AI Settings dialog caused focus to blur to `document.body` instead of the first actionable element, and closing the modal did not return focus to the trigger pill in the header.
- **Concrete Remediation**: Implemented a ref-based focus restoration hook in `PlanGeneratorModal.tsx` and `ApiKeyModal.tsx` capturing `document.activeElement` on open and re-focusing it on close, while constraining tab cycles within the modal boundary via `e.shiftKey` edge wrapping.

---

## 🚀 Deployment & Operation (FE-11)

### Deployment Checklist

| Item | Status | Verified By | Notes |
| :--- | :---: | :---: | :--- |
| **Production Build** | Signed Off | Safuan | `vite build` completed with zero warnings (246 kB gzip: 72 kB) |
| **Unit & A11y Tests** | Signed Off | Safuan | 20 of 20 tests passing in Vitest suite |
| **No Hardcoded Secrets** | Signed Off | Safuan | Zero API keys in git history; BYOK client-side model |
| **Safe Failure Modes** | Signed Off | Safuan | Automatic fallback banner with 1-click Demo mode recovery |
| **Responsive Design** | Signed Off | Safuan | Mobile viewport verified down to 360px width |
| **Accessibility Pass** | Signed Off | Safuan | 0 violations on axe-core audit |

### Safe Failure & Error States
- **Missing / Invalid Key (401)**: When an invalid Anthropic or Gemini key is provided, the UI displays an inline banner explaining the issue and offers a direct button to fall back to the Demo Simulator without losing user inputs.
- **Rate Limit (429)**: Claude API rate limits trigger an explicit rate limit notice with suggestion to use Demo Mode.
- **Network / Offline**: Fetch rejections are caught cleanly with retry actions; local cached plans remain 100% functional.

### Rollback Plan
- The application is a static Single Page Application (SPA).
- **Rollback Procedure**: In Vercel / Netlify dashboard, rolling back takes 1 click by promoting the prior deployment hash to production, or by running `git revert HEAD` and pushing to `main`.

---

## 📝 Reflection

### 1. What was hardest? Why?
The most demanding engineering challenge was reconciling **LLM output unpredictability** with strict, strongly-typed UI requirements. Large language models frequently introduce subtle formatting variations—such as wrapping JSON in Markdown fences, prepending conversational preambles, or returning slightly different key names. Creating the resilient parser in `aiService.ts` required defensive programming: extracting valid substrings, handling malformed tokens with secondary regex passes, and clamping out-of-range numerical values so that malformed AI responses never crashed the React tree.

### 2. What would you do differently next time?
If starting over with more time, I would implement **streaming chunk rendering** (`ReadableStream`) for curriculum generation. While the current implementation provides an animated multi-step progress indicator ("Analyzing topic", "Decomposing micro-tasks", "Synthesizing questions"), streaming the individual task cards as they arrive would provide even faster perceived performance and allow users to start reading Module 1 while Module 4 is still generating.

### 3. One thing learned that surprised you
The biggest surprise was how much **accessibility constraints actually improved general product usability**. Implementing W3C APG keyboard traps and roving tabindex seemed like compliance overhead at first; however, once keyboard shortcuts and focus restoration were active, navigating study tasks and operating the Pomodoro timer without touching the mouse proved significantly faster and less distracting than traditional mouse-driven productivity interfaces. Accessibility isn't an afterthought—it is foundational UX design.

---

## 📄 License
MIT © 2026 Safuan. Built for the Frontend AI Engineering Capstone.
