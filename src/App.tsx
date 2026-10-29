import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { TaskCard } from './components/TaskCard';
import { FocusTimer } from './components/FocusTimer';
import { PlanGeneratorModal } from './components/PlanGeneratorModal';
import { ActiveRecallModal } from './components/ActiveRecallModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { A11yProvider, useA11y } from './components/A11yAnnouncer';
import {
  StudyPlan,
  StudyTask,
  AIProviderConfig,
  TimerMode
} from './types';
import {
  loadPlans,
  savePlans,
  loadActivePlanId,
  saveActivePlanId,
  loadAIConfig,
  saveAIConfig,
  loadStats,
  saveStats,
  UserStats
} from './services/storageService';
import {
  Plus,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Code2,
  Cpu
} from 'lucide-react';

const TIMER_DURATIONS: Record<TimerMode, number> = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

// Web Audio API Synthesizer Chime (Zero external audio file dependency, zero 404s)
function playGentleChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // Audio might be blocked by browser autoplay policy before user gesture
  }
}

export const StudyFlowApp: React.FC = () => {
  const { announce } = useA11y();

  // Core App State
  const [plans, setPlans] = useState<StudyPlan[]>(() => loadPlans());
  const [activePlanId, setActivePlanId] = useState<string>(() => {
    const saved = loadActivePlanId();
    const loaded = loadPlans();
    if (saved && loaded.some((p) => p.id === saved)) return saved;
    return loaded[0]?.id || '';
  });

  const [aiConfig, setAiConfig] = useState<AIProviderConfig>(() => loadAIConfig());
  const [stats, setStats] = useState<UserStats>(() => loadStats());

  // Dark Mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('studyflow_dark_theme');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizTask, setQuizTask] = useState<StudyTask | null>(null);

  // Filter & Search
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'high'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pomodoro Focus Timer State
  const [timerMode, setTimerMode] = useState<TimerMode>('pomodoro');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(TIMER_DURATIONS.pomodoro);
  const [totalSeconds, setTotalSeconds] = useState<number>(TIMER_DURATIONS.pomodoro);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Sync Dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('studyflow_dark_theme', darkMode ? 'true' : 'false');
  }, [darkMode]);

  // Persist Plans and Active ID
  useEffect(() => {
    savePlans(plans);
  }, [plans]);

  useEffect(() => {
    if (activePlanId) saveActivePlanId(activePlanId);
  }, [activePlanId]);

  useEffect(() => {
    saveAIConfig(aiConfig);
  }, [aiConfig]);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  // Current Active Plan
  const activePlan = useMemo(() => {
    return plans.find((p) => p.id === activePlanId) || plans[0] || null;
  }, [plans, activePlanId]);

  // Active Task for Timer
  const activeFocusTask = useMemo(() => {
    if (!activePlan || !activeFocusTaskId) return null;
    return activePlan.tasks.find((t) => t.id === activeFocusTaskId) || null;
  }, [activePlan, activeFocusTaskId]);

  // Timer Tick Engine
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isTimerRunning) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            // Timer expired!
            if (soundEnabled) playGentleChime();

            if (timerMode === 'pomodoro') {
              announce('Pomodoro session completed! Great focus. Take a 5-minute break or test recall.', 'assertive');
              setStats((s) => ({
                ...s,
                completedPomodoros: s.completedPomodoros + 1,
                totalStudyMinutes: s.totalStudyMinutes + 25
              }));

              // If an active task is selected, trigger recall prompt
              if (activeFocusTask) {
                setQuizTask(activeFocusTask);
                setIsQuizModalOpen(true);
              }

              // Switch to short break
              setTimerMode('shortBreak');
              setTotalSeconds(TIMER_DURATIONS.shortBreak);
              return TIMER_DURATIONS.shortBreak;
            } else {
              announce('Break completed! Ready to begin next focus session.', 'assertive');
              setTimerMode('pomodoro');
              setTotalSeconds(TIMER_DURATIONS.pomodoro);
              return TIMER_DURATIONS.pomodoro;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerMode, soundEnabled, activeFocusTask, announce]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    if (!activePlan) return [];
    return activePlan.tasks.filter((task) => {
      // Filter tab
      if (filter === 'pending' && task.completed) return false;
      if (filter === 'completed' && !task.completed) return false;
      if (filter === 'high' && task.priority !== 'high') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(q);
        const inDesc = task.description.toLowerCase().includes(q);
        const inRecall = task.activeRecall.some((r) => r.question.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inRecall) return false;
      }

      return true;
    });
  }, [activePlan, filter, searchQuery]);

  // Task Actions
  const handleToggleComplete = useCallback(
    (taskId: string) => {
      if (!activePlan) return;
      let newlyCompleted = false;

      const updatedTasks = activePlan.tasks.map((t) => {
        if (t.id === taskId) {
          newlyCompleted = !t.completed;
          return { ...t, completed: !t.completed };
        }
        return t;
      });

      const updatedPlan = { ...activePlan, tasks: updatedTasks };
      setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? updatedPlan : p)));

      if (newlyCompleted) {
        announce('Task marked as completed! Excellent progress.', 'polite');
        setStats((s) => ({ ...s, completedTasksCount: s.completedTasksCount + 1 }));
      } else {
        announce('Task marked as incomplete.', 'polite');
      }
    },
    [activePlan, announce]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      if (!activePlan) return;
      const updatedTasks = activePlan.tasks.filter((t) => t.id !== taskId);
      const updatedPlan = { ...activePlan, tasks: updatedTasks };
      setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? updatedPlan : p)));
      if (activeFocusTaskId === taskId) {
        setActiveFocusTaskId(null);
      }
      announce('Task removed from study plan.', 'polite');
    },
    [activePlan, activeFocusTaskId, announce]
  );

  const handleStartFocus = useCallback(
    (task: StudyTask) => {
      setActiveFocusTaskId(task.id);
      setTimerMode('pomodoro');
      setTotalSeconds(TIMER_DURATIONS.pomodoro);
      setSecondsRemaining(TIMER_DURATIONS.pomodoro);
      setIsTimerRunning(true);
      announce(`Focus session started for ${task.title}. 25-minute timer running.`, 'polite');
    },
    [announce]
  );

  const handleOpenQuiz = useCallback((task: StudyTask) => {
    setQuizTask(task);
    setIsQuizModalOpen(true);
  }, []);

  const handleTimerModeSelect = useCallback(
    (mode: TimerMode) => {
      setTimerMode(mode);
      const dur = TIMER_DURATIONS[mode];
      setTotalSeconds(dur);
      setSecondsRemaining(dur);
      setIsTimerRunning(false);
      announce(`Timer set to ${mode === 'pomodoro' ? '25-minute focus session' : 'break session'}.`, 'polite');
    },
    [announce]
  );

  const handlePlanCreated = useCallback(
    (newPlan: StudyPlan) => {
      setPlans((prev) => [newPlan, ...prev]);
      setActivePlanId(newPlan.id);
      announce(`New AI study plan created: ${newPlan.title}. ${newPlan.tasks.length} tasks ready.`, 'polite');
    },
    [announce]
  );

  const timerDisplayFormatted = `${Math.floor(secondsRemaining / 60)
    .toString()
    .padStart(2, '0')}:${(secondsRemaining % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Accessible Header */}
      <Header
        plans={plans}
        activePlan={activePlan}
        onSelectPlan={(id) => {
          setActivePlanId(id);
          const p = plans.find((x) => x.id === id);
          if (p) announce(`Switched active plan to ${p.subject}: ${p.targetGoal}`, 'polite');
        }}
        onOpenNewPlanModal={() => setIsPlanModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        aiConfig={aiConfig}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        timerRunning={isTimerRunning}
        timerDisplay={timerDisplayFormatted}
      />

      {/* Main Content Landmark */}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 focus:outline-none">
        {activePlan ? (
          <>
            {/* Top Stats & Filters Section */}
            <StatsBar
              plan={activePlan}
              filter={filter}
              onFilterChange={setFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              pomodoroCount={stats.completedPomodoros}
            />

            {/* Layout Grid: Tasks (Left) + Focus Timer (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Task List Column (2 cols on large screen) */}
              <section aria-label="Structured Micro-Tasks" className="lg:col-span-2 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Curriculum Tasks
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {filteredTasks.length}
                    </span>
                  </div>

                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Arranged by cognitive sequence
                  </span>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <BookOpen className="w-10 h-10 mx-auto text-slate-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      No matching tasks found
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      {searchQuery
                        ? `No tasks match the keyword "${searchQuery}". Clear your search query to see all items.`
                        : 'All tasks under this filter are caught up! Switch filters or generate another AI plan.'}
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Clear Search Filter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isTimerActive={activeFocusTaskId === task.id}
                        onToggleComplete={handleToggleComplete}
                        onStartFocus={handleStartFocus}
                        onOpenQuiz={handleOpenQuiz}
                        onDeleteTask={handleDeleteTask}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Sidebar: Pomodoro Focus Timer */}
              <div className="lg:col-span-1 space-y-6">
                <FocusTimer
                  activeTask={activeFocusTask}
                  mode={timerMode}
                  secondsRemaining={secondsRemaining}
                  totalSeconds={totalSeconds}
                  isRunning={isTimerRunning}
                  pomodoroCount={stats.completedPomodoros}
                  soundEnabled={soundEnabled}
                  onToggleSound={() => setSoundEnabled(!soundEnabled)}
                  onStart={() => {
                    setIsTimerRunning(true);
                    announce('Timer started.', 'polite');
                  }}
                  onPause={() => {
                    setIsTimerRunning(false);
                    announce('Timer paused.', 'polite');
                  }}
                  onReset={() => {
                    setIsTimerRunning(false);
                    const dur = TIMER_DURATIONS[timerMode];
                    setSecondsRemaining(dur);
                    announce('Timer reset.', 'polite');
                  }}
                  onSkip={() => {
                    const nextMode: TimerMode = timerMode === 'pomodoro' ? 'shortBreak' : 'pomodoro';
                    handleTimerModeSelect(nextMode);
                  }}
                  onSelectMode={handleTimerModeSelect}
                  onOpenRecallForActiveTask={() => {
                    if (activeFocusTask) handleOpenQuiz(activeFocusTask);
                  }}
                />

                {/* Cognitive Architecture Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Evidence-Based Cognitive Design</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    StudyFlow AI applies <strong>Spaced Retrieval Practice</strong> and <strong>Cognitive Task Chunking</strong>:
                  </p>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 list-disc list-inside">
                    <li>25-min high-intensity focus sprints</li>
                    <li>Immediate active recall self-drilling</li>
                    <li>Roving tabindex & full keyboard control (FE-05)</li>
                    <li>Structured JSON validation & safe fallback (FE-07)</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 max-w-lg mx-auto mt-12">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              No Study Plans Yet
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create your first AI-engineered study curriculum with custom micro-tasks and active recall questions.
            </p>
            <button
              type="button"
              onClick={() => setIsPlanModalOpen(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md shadow-indigo-600/30 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create First AI Study Plan</span>
            </button>
          </div>
        )}
      </main>

      {/* Production Footer (FE-11) */}
      <footer
        role="contentinfo"
        className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-xs text-slate-500 dark:text-slate-400 transition-colors mt-12"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              StudyFlow AI
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              WCAG 2.1 AA Compliant
            </span>
            <span>•</span>
            <span>Week 8 Production Capstone</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 underline"
            >
              AI Engine Settings
            </button>
            <a
              href="https://github.com/safuan36/flyrank_capstone1"
              target="_blank"
              rel="noreferrer"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Repository</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PlanGeneratorModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onPlanCreated={handlePlanCreated}
        aiConfig={aiConfig}
        onOpenSettings={() => {
          setIsPlanModalOpen(false);
          setIsSettingsModalOpen(true);
        }}
      />

      <ActiveRecallModal
        task={quizTask}
        isOpen={isQuizModalOpen}
        onClose={() => {
          setIsQuizModalOpen(false);
          setQuizTask(null);
        }}
        onCompleteTask={handleToggleComplete}
        aiConfig={aiConfig}
      />

      <ApiKeyModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={aiConfig}
        onSaveConfig={(newConfig) => {
          setAiConfig(newConfig);
          announce(`AI Engine updated to ${newConfig.provider.toUpperCase()}.`, 'polite');
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <A11yProvider>
      <StudyFlowApp />
    </A11yProvider>
  );
}
