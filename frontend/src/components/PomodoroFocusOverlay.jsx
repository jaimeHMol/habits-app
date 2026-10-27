import React from 'react'
import { usePomodoroStore } from '../store/usePomodoroStore'
import { useHabitStore } from '../store/useHabitStore'
import { translations } from '../i18n/translations'
import { X, Play, CheckCircle2, Coffee } from 'lucide-react'

const formatTime = (totalSeconds) => {
  const clamped = Math.max(0, totalSeconds || 0);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const PomodoroFocusOverlay = () => {
  const {
    activeSession,
    isOverlayOpen,
    startBreak,
    closeOverlay,
    interruptPomodoro,
    isLoading
  } = usePomodoroStore();
  const { language } = useHabitStore();
  const t = translations[language] || translations.en;

  if (!isOverlayOpen || !activeSession) return null;

  const isFocusRunning =
    activeSession.phase === 'focus' && activeSession.status === 'in_progress';
  const isFocusFinished =
    activeSession.phase === 'focus' && activeSession.status === 'completed';
  const isBreakRunning = activeSession.phase === 'break';
  const isBreakDone = activeSession.phase === 'done';

  // Calculate progress percentage
  let progress = 0;
  if (isFocusRunning) {
    progress = Math.min(100, Math.max(0, ((1500 - (activeSession.remainingSeconds || 0)) / 1500) * 100));
  } else if (isFocusFinished) {
    progress = 100;
  } else if (isBreakRunning) {
    progress = Math.min(100, Math.max(0, ((300 - (activeSession.remainingSeconds || 0)) / 300) * 100));
  } else if (isBreakDone) {
    progress = 100;
  }

  const handleClose = () => {
    if (isFocusRunning) {
      interruptPomodoro();
    } else {
      closeOverlay();
    }
  };

  // Color scheme based on phase
  const isBreakTheme = isBreakRunning || isBreakDone;
  const borderColor = isBreakTheme ? 'border-paramo-muted/40' : 'border-paramo-frailejon/50';
  const textColor = isBreakTheme ? 'text-paramo-muted' : 'text-paramo-frailejon';
  const progressBg = isBreakTheme ? 'bg-paramo-muted' : 'bg-paramo-frailejon';

  return (
    <div className="fixed inset-0 z-[120] pointer-events-none flex flex-col items-center justify-start pt-8 md:pt-14 px-4 animate-fadeIn">
      <div
        className={`pointer-events-auto bg-paramo-board/95 backdrop-blur-md border-2 ${borderColor} shadow-[0_25px_70px_rgba(0,0,0,0.85)] rounded-2xl p-6 w-[92%] max-w-sm flex flex-col items-center transition-colors duration-500`}
      >
        {/* Top bar with badge and close button */}
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            {isBreakTheme ? (
              <Coffee size={14} className={textColor} />
            ) : (
              <span className="h-2 w-2 rounded-full bg-paramo-frailejon animate-pulse" />
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest ${textColor}`}>
              {isBreakTheme ? t.pomodoro_break_label : t.pomodoro_focus_label}
            </span>
          </div>

          <button
            onClick={handleClose}
            className="text-paramo-muted hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            title={isFocusRunning ? t.pomodoro_interrupt_tip : t.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* State 1: Focus in Progress */}
        {isFocusRunning && (
          <div className="w-full flex flex-col items-center space-y-4">
            <div className={`text-6xl font-black tabular-nums tracking-tighter ${textColor} italic`}>
              {formatTime(activeSession.remainingSeconds)}
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div
                className={`h-full ${progressBg} transition-all duration-1000 ease-linear`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* State 2: Focus Finished -> Prompt for Break */}
        {isFocusFinished && (
          <div className="w-full flex flex-col items-center text-center space-y-4 py-2">
            <div className="h-12 w-12 rounded-full bg-paramo-frailejon/15 border border-paramo-frailejon/30 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-paramo-frailejon" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {t.pomodoro_focus_done_title}
              </h3>
              <p className="text-xs text-paramo-muted">
                {t.pomodoro_focus_done_msg}
              </p>
            </div>

            <button
              onClick={startBreak}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-paramo-frailejon text-paramo-bg font-black uppercase tracking-widest text-xs py-3 px-4 rounded-xl shadow-lg hover:bg-opacity-90 active:scale-95 transition-all mt-2"
            >
              <Play size={14} fill="currentColor" />
              {t.pomodoro_start_break_btn}
            </button>
          </div>
        )}

        {/* State 3: Break in Progress */}
        {isBreakRunning && (
          <div className="w-full flex flex-col items-center space-y-4">
            <div className={`text-6xl font-black tabular-nums tracking-tighter ${textColor} italic`}>
              {formatTime(activeSession.remainingSeconds)}
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div
                className={`h-full ${progressBg} transition-all duration-1000 ease-linear`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* State 4: Break Finished / Full Cycle Completed */}
        {isBreakDone && (
          <div className="w-full flex flex-col items-center text-center space-y-4 py-2">
            <div className="h-12 w-12 rounded-full bg-paramo-frailejon/15 border border-paramo-frailejon/30 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-paramo-frailejon" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {t.pomodoro_congrats_title}
              </h3>
              <p className="text-xs text-paramo-muted">
                {t.pomodoro_congrats_msg}
              </p>
            </div>

            <button
              onClick={closeOverlay}
              className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest text-xs py-3 px-4 rounded-xl transition-colors mt-2"
            >
              {t.close}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
