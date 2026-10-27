import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { taskApi } from '../services/api'
import { useHabitStore } from './useHabitStore'
import { translations } from '../i18n/translations'
import confetti from 'canvas-confetti'

const getDeviceType = () => {
  if (typeof navigator === 'undefined') return 'desktop';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ? 'mobile'
    : 'desktop';
};

export const parseServerDateMs = (dateValue) => {
  if (!dateValue) return null;
  if (typeof dateValue === 'number') return dateValue;
  const str = String(dateValue).trim();
  const hasTimezone = str.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(str);
  const normalized = hasTimezone ? str : `${str.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized).getTime();
  return isNaN(parsed) ? null : parsed;
};

export const playFocusEndSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.12;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // Ignore audio errors
  }
};

export const playPomodoroVictorySound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const playNote = (frequency, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);
      gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };
    playNote(523.25, 0, 0.4);
    playNote(659.25, 0.06, 0.4);
    playNote(783.99, 0.12, 0.4);
    playNote(1046.50, 0.18, 0.6);
  } catch {
    // Ignore audio errors
  }
};

export const firePomodoroConfetti = () => {
  try {
    const fire = typeof confetti === 'function' ? confetti : confetti?.default;
    if (fire) {
      fire({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#0d9488', '#14b8a6', '#99f6e4'], // paramo-frailejon shades
        disableForReducedMotion: true
      });
    }
  } catch {
    // Ignore confetti errors
  }
};

const showLocalPomodoroNotification = async (title, body, type, pomodoroId) => {
  try {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    if (!registration || !registration.showNotification) return;

    await registration.showNotification(`🍅 ${title}`, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { pomodoro_id: pomodoroId, type },
      vibrate: [500, 200, 500, 200, 1000],
      tag: `pomodoro-${pomodoroId}-${type}`,
      renotify: true,
      requireInteraction: true
    });
  } catch {
    // Non-fatal
  }
};

export const usePomodoroStore = create(
  persist(
    (set, get) => ({
      activeSession: null, // { id, phase: 'focus'|'break'|'done', status: 'in_progress'|'completed'|'interrupted', endTime: ms, remainingSeconds }
      todayStats: {
        completed_today_count: 0,
        interrupted_today_count: 0,
        today_sessions: []
      },
      isPanelOpen: false,
      isOverlayOpen: false,
      isLoading: false,

      // Ensures mutual exclusion with habit/task timers
      ensureTimerExclusion: () => {
        try {
          const habitStore = useHabitStore.getState();
          if (habitStore.activeTimer && habitStore.activeTimer.taskId) {
            habitStore.stopTimer(true);
          }
        } catch {
          // Ignore if habit store not initialized
        }
      },

      openPanel: () => {
        get().ensureTimerExclusion();
        set({ isPanelOpen: true });
        get().fetchTodayPomodoros();
      },

      closePanel: () => {
        set({ isPanelOpen: false });
      },

      openOverlay: () => {
        set({ isOverlayOpen: true });
      },

      closeOverlay: () => {
        const { activeSession } = get();
        if (activeSession && activeSession.phase === 'focus' && activeSession.status === 'in_progress') {
          get().interruptPomodoro();
        } else {
          set({ isOverlayOpen: false });
          if (activeSession && (activeSession.phase === 'done' || activeSession.phase === 'break')) {
            set({ activeSession: null });
          }
        }
      },

      fetchTodayPomodoros: async () => {
        set({ isLoading: true });
        try {
          const stats = (await taskApi.getTodayPomodoros()) || {};
          const { activeSession } = get();

          let nextActiveSession = activeSession;
          // If server has an active session and client doesn't, or to sync
          if (stats.active_session && !activeSession) {
            const serverSession = stats.active_session;
            const endMs = serverSession.timer_end_time
              ? parseServerDateMs(serverSession.timer_end_time)
              : null;
            const rawRemaining = endMs ? Math.max(0, Math.round((endMs - Date.now()) / 1000)) : 0;
            const maxSeconds = serverSession.phase === 'break' ? 300 : 1500;
            const remaining = Math.min(maxSeconds, rawRemaining);
            nextActiveSession = {
              id: serverSession.id,
              phase: serverSession.phase,
              status: serverSession.status,
              endTime: endMs,
              remainingSeconds: remaining
            };
          }

          set({
            todayStats: {
              completed_today_count: stats.completed_today_count || 0,
              interrupted_today_count: stats.interrupted_today_count || 0,
              today_sessions: stats.today_sessions || []
            },
            activeSession: nextActiveSession,
            isLoading: false
          });
        } catch (error) {
          console.error("Failed to fetch today pomodoros:", error);
          set({ isLoading: false });
        }
      },

      startFocus: async () => {
        get().ensureTimerExclusion();
        set({ isLoading: true });
        try {
          const deviceType = getDeviceType();
          const session = await taskApi.startPomodoro(deviceType);
          const endMs = session.timer_end_time
            ? parseServerDateMs(session.timer_end_time)
            : Date.now() + 25 * 60 * 1000;
          const rawRemaining = Math.max(0, Math.round((endMs - Date.now()) / 1000));
          const remainingSeconds = Math.min(1500, rawRemaining > 0 ? rawRemaining : 1500);

          set({
            activeSession: {
              id: session.id,
              phase: 'focus',
              status: 'in_progress',
              endTime: endMs,
              remainingSeconds
            },
            isOverlayOpen: true,
            isPanelOpen: false,
            isLoading: false
          });
          get().fetchTodayPomodoros();
        } catch (error) {
          console.error("Failed to start pomodoro:", error);
          set({ isLoading: false });
        }
      },

      completeFocus: async (fromTimer = false) => {
        const { activeSession } = get();
        if (!activeSession) return;

        playFocusEndSound();
        const lang = useHabitStore.getState().language || 'en';
        const t = translations[lang] || translations.en;
        showLocalPomodoroNotification(
          t.pomodoro_title || 'Pomodoro',
          t.pomodoro_focus_done_title || 'Focus time finished',
          'pomodoro_focus_end',
          activeSession.id
        );

        try {
          await taskApi.completePomodoroFocus(activeSession.id);
        } catch (error) {
          console.error("Failed to complete focus on server:", error);
        }

        set({
          activeSession: {
            ...activeSession,
            phase: 'focus',
            status: 'completed',
            endTime: null,
            remainingSeconds: 0
          }
        });
        get().fetchTodayPomodoros();
      },

      startBreak: async () => {
        const { activeSession } = get();
        if (!activeSession) return;

        set({ isLoading: true });
        try {
          const session = await taskApi.startPomodoroBreak(activeSession.id);
          const endMs = session.timer_end_time
            ? parseServerDateMs(session.timer_end_time)
            : Date.now() + 5 * 60 * 1000;
          const rawRemaining = Math.max(0, Math.round((endMs - Date.now()) / 1000));
          const remainingSeconds = Math.min(300, rawRemaining > 0 ? rawRemaining : 300);

          set({
            activeSession: {
              ...activeSession,
              phase: 'break',
              status: 'completed',
              endTime: endMs,
              remainingSeconds
            },
            isLoading: false
          });
        } catch (error) {
          console.error("Failed to start break:", error);
          set({ isLoading: false });
        }
      },

      completeBreak: async (fromTimer = false) => {
        const { activeSession } = get();
        if (!activeSession) return;

        playPomodoroVictorySound();
        firePomodoroConfetti();

        const lang = useHabitStore.getState().language || 'en';
        const t = translations[lang] || translations.en;
        showLocalPomodoroNotification(
          t.pomodoro_title || 'Pomodoro',
          t.pomodoro_congrats_title || 'Pomodoro Completed!',
          'pomodoro_break_end',
          activeSession.id
        );

        try {
          await taskApi.completePomodoroBreak(activeSession.id);
        } catch (error) {
          console.error("Failed to complete break on server:", error);
        }

        set({
          activeSession: {
            ...activeSession,
            phase: 'done',
            status: 'completed',
            endTime: null,
            remainingSeconds: 0
          }
        });
        get().fetchTodayPomodoros();
      },

      interruptPomodoro: async () => {
        const { activeSession } = get();
        if (!activeSession) {
          set({ isOverlayOpen: false });
          return;
        }

        try {
          const elapsed = activeSession.phase === 'focus'
            ? Math.max(0, 1500 - activeSession.remainingSeconds)
            : 1500;
          await taskApi.interruptPomodoro(activeSession.id, elapsed);
        } catch (error) {
          console.error("Failed to interrupt pomodoro:", error);
        }

        set({
          activeSession: null,
          isOverlayOpen: false
        });
        get().fetchTodayPomodoros();
      },

      createManualPomodoro: async (hourOfDay) => {
        set({ isLoading: true });
        try {
          const deviceType = getDeviceType();
          await taskApi.createManualPomodoro(hourOfDay, deviceType);
          playPomodoroVictorySound();
          firePomodoroConfetti();
          await get().fetchTodayPomodoros();
          set({ isLoading: false });
          return true;
        } catch (error) {
          console.error("Failed to log manual pomodoro:", error);
          set({ isLoading: false });
          return false;
        }
      },

      deleteManualPomodoro: async (pomodoroId) => {
        set({ isLoading: true });
        try {
          await taskApi.deleteManualPomodoro(pomodoroId);
          await get().fetchTodayPomodoros();
          set({ isLoading: false });
          return true;
        } catch (error) {
          console.error("Failed to delete manual pomodoro:", error);
          set({ isLoading: false });
          return false;
        }
      },

      tickPomodoro: () => {
        const { activeSession } = get();
        if (!activeSession || !activeSession.endTime) return;

        const rawRemaining = Math.max(0, Math.round((activeSession.endTime - Date.now()) / 1000));
        const maxLimit = activeSession.phase === 'break' ? 300 : 1500;
        const remaining = Math.min(maxLimit, rawRemaining);

        if (remaining === 0) {
          if (activeSession.phase === 'focus' && activeSession.status === 'in_progress') {
            get().completeFocus(true);
          } else if (activeSession.phase === 'break') {
            get().completeBreak(true);
          }
        } else if (remaining !== activeSession.remainingSeconds) {
          set({
            activeSession: {
              ...activeSession,
              remainingSeconds: remaining
            }
          });
        }
      },

      handlePushNotification: (type, pomodoroId) => {
        const { activeSession } = get();
        if (type === 'pomodoro_focus_end') {
          if (activeSession && activeSession.phase === 'focus' && activeSession.status === 'in_progress') {
            get().completeFocus(true);
          } else {
            get().fetchTodayPomodoros();
          }
        } else if (type === 'pomodoro_break_end') {
          if (activeSession && activeSession.phase === 'break') {
            get().completeBreak(true);
          } else {
            get().fetchTodayPomodoros();
          }
        }
      }
    }),
    {
      name: 'pomodoro_storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeSession: state.activeSession,
        isOverlayOpen: state.isOverlayOpen
      })
    }
  )
);
