import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { taskApi } from '../services/api'
import { useReminderStore } from './useReminderStore'
import { translations } from '../i18n/translations'

const TIMER_ALARM_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
let primedAlarmAudio = null;

export const getCurrentLocalDateStr = (overrideTz = null) => {
  try {
    const userTz =
      overrideTz ||
      Intl.DateTimeFormat?.().resolvedOptions?.().timeZone ||
      'America/Bogota';
    return new Date().toLocaleDateString('en-CA', { timeZone: userTz });
  } catch {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  }
};

const primeTimerAlarmAudio = () => {
  try {
    if (typeof Audio === 'undefined') return;
    if (!primedAlarmAudio) {
      primedAlarmAudio = new Audio(TIMER_ALARM_URL);
      primedAlarmAudio.preload = 'auto';
    }
    primedAlarmAudio.load();
  } catch {
    // Ignore audio initialization errors in headless/test environments
  }
};

const playSynthesizedFallbackAlarm = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const notes = [587.33, 880, 1174.66, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.14;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch {
    // Ignore audio fallback errors
  }
};

const playTimerAlarm = () => {
  try {
    const alarm = primedAlarmAudio || new Audio(TIMER_ALARM_URL);
    alarm.currentTime = 0;
    const playPromise = alarm.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        playSynthesizedFallbackAlarm();
      });
    }
  } catch {
    playSynthesizedFallbackAlarm();
  }
};

const showLocalTimerNotification = async (task) => {
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

    await registration.showNotification('⏳ RECUERDA', {
      body: `Timer finalizado: ${task?.title || ''}`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { task_id: task?.id, type: 'timer_end' },
      vibrate: [500, 200, 500, 200, 1000],
      tag: `timer-${task?.id}`,
      renotify: true,
      requireInteraction: true
    });
  } catch {
    // Non-fatal if SW notification is unavailable
  }
};

export const useHabitStore = create(
  persist(
    (set, get) => ({
  isAuthenticated: true, // Assume true to try initial data fetch, but will be set to false on 401
  user: null, // { username, fullName, role }
  
  login: async (username, password) => {
    try {
      const data = await taskApi.login(username, password);
      set({ 
        isAuthenticated: true, 
        user: data.user, 
        error: null,
        lastUsedDate: data.user.last_period_reset_date
      });
      get().fetchTasks(); // Load data immediately after login
      return { success: true };
    } catch (error) {
      get().fetchTasks(true);
      return { success: false, message: error.message };
    }
  },

  register: async (data) => {
    try {
      await taskApi.register(data);
      return { success: true };
    } catch (error) {
      get().fetchTasks(true);
      return { success: false, message: error.message };
    }
  },

  logout: async () => {
    try {
      await taskApi.logout();
    } catch (e) {
      console.error("Logout failed on server", e);
    }
    localStorage.removeItem('active_timer_task_id');
    localStorage.removeItem('active_timer_end_time');
    localStorage.removeItem('pomodoro-storage');
    set({
      isAuthenticated: false,
      user: null,
      tasks: [],
      lastUsedDate: null,
      activeTimer: { taskId: null, endTime: 0, remainingSeconds: 0 }
    });
  },

  fetchUserProfile: async () => {
    try {
      const user = await taskApi.getMe();
      const browserTz = Intl.DateTimeFormat?.().resolvedOptions?.().timeZone;
      if (browserTz && user.timezone && user.timezone !== browserTz) {
        taskApi.updateSettings({
          dayStartTime: user.dayStartTime || '08:00',
          dayEndTime: user.dayEndTime || '20:00',
          language: user.language || 'en',
          timezone: browserTz
        }).catch(() => {});
        user.timezone = browserTz;
      }
      set({ 
        user, 
        isAuthenticated: true, 
        language: user.language,
        lastUsedDate: user.last_period_reset_date,
        isOffline: false
      });
      localStorage.setItem('habit_lang', user.language);
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
      } else if (error.message === 'Session expired') {
        set({ isAuthenticated: false, user: null });
      }
      console.error("Failed to fetch profile", error);
    }
  },

  setLanguage: async (lang) => {
    const { user } = get();
    const { userSettings } = useReminderStore.getState();
    
    if (user && userSettings) {
      await taskApi.updateSettings({
        dayStartTime: userSettings.dayStartTime,
        dayEndTime: userSettings.dayEndTime,
        language: lang
      });
    }
    localStorage.setItem('habit_lang', lang);
    set({ language: lang });
  },

  generateInvite: async () => {
    try {
      const data = await taskApi.generateInvite();
      return data.code;
    } catch (error) {
      get().fetchTasks(true);
      console.error("Failed to generate invite", error);
      return null;
    }
  },

  columns: [
    { id: 'daily', title: 'Daily', type: 'daily', viewMode: 'active' },
    { id: 'monthly', title: 'Monthly', type: 'monthly', viewMode: 'active' },
    { id: 'annually', title: 'Annually', type: 'annually', viewMode: 'active' },
    { id: 'todo', title: 'To Do', type: 'todo', viewMode: 'active' },
  ],
  tasks: [],
  isLoading: false,
  isOffline: !navigator.onLine,
  setIsOffline: (isOffline) => set({ isOffline }),
  error: null,
  showReviewModal: false,
  pendingResets: [], 
  lastUsedDate: null, 
  language: localStorage.getItem('habit_lang') || 'en',
  activeTimer: { 
    taskId: JSON.parse(localStorage.getItem('active_timer_task_id') || 'null'), 
    endTime: JSON.parse(localStorage.getItem('active_timer_end_time') || '0'),
    remainingSeconds: 0 
  },

  syncQueue: JSON.parse(localStorage.getItem('offline_sync_queue') || '[]'),
  isSyncing: false,

  enqueueAction: (actionData) => {
    const action = { ...actionData, id: Date.now().toString() + Math.random().toString(36).substring(7) };
    set(state => {
      const newQueue = [...state.syncQueue, action];
      localStorage.setItem('offline_sync_queue', JSON.stringify(newQueue));
      return { syncQueue: newQueue };
    });
  },

  processSyncQueue: async () => {
    const { syncQueue, isSyncing } = get();
    if (syncQueue.length === 0 || !navigator.onLine || isSyncing) return;
    
    set({ isSyncing: true });
    let hasErrors = false;

    for (const action of syncQueue) {
      try {
        if (action.type === 'TOGGLE_COMPLETION') {
          if (action.newCompletedState && !action.fromTimer) {
            await taskApi.update(action.taskId, { timer_end_time: null, timer_triggered: false });
          }
          await taskApi.toggleComplete(action.taskId, false, action.targetState, Boolean(action.fromTimer));
        } else if (action.type === 'INCREMENT') {
          await taskApi.increment(action.taskId, action.isRetroactive);
        } else if (action.type === 'DECREMENT') {
          await taskApi.decrement(action.taskId);
        }
        
        set(state => {
          const newQueue = state.syncQueue.filter(a => a.id !== action.id);
          localStorage.setItem('offline_sync_queue', JSON.stringify(newQueue));
          return { syncQueue: newQueue };
        });
      } catch (error) {
        if (error.message === 'OFFLINE_ERROR') {
          set({ isOffline: true });
        }
        console.error("Failed to sync action", action, error);
        hasErrors = true;
        break;
      }
    }

    set({ isSyncing: false });
    if (!hasErrors) {
       set({ isOffline: false });
       get().fetchTasks();
       useReminderStore.getState().fetchReminders();
    }
  },


  updateTaskOnServer: async (taskId, fields) => {
    if (!navigator.onLine) return;
    try {
      await taskApi.update(taskId, fields);
    } catch (error) {
      get().fetchTasks(true);
      console.error("Failed to update task on server", error);
    }
  },

  startTimer: async (taskId, durationMinutes) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
      return;
    }
    const prevTaskId = get().activeTimer?.taskId;
    if (prevTaskId && prevTaskId !== taskId) {
      get().updateTaskOnServer(prevTaskId, {
        timer_end_time: null,
        timer_triggered: false
      });
    }

    primeTimerAlarmAudio();

    const now = Date.now();
    const endTime = now + (durationMinutes * 60 * 1000);
    localStorage.setItem('active_timer_task_id', JSON.stringify(taskId));
    localStorage.setItem('active_timer_end_time', JSON.stringify(endTime));
    set({ activeTimer: { taskId, endTime, remainingSeconds: durationMinutes * 60 } });
    
    // Sync with backend for background push notifications
    get().updateTaskOnServer(taskId, { 
      timer_end_time: new Date(endTime).toISOString(),
      timer_triggered: false 
    });
  },

  stopTimer: async (syncWithServer = true) => {
    const { activeTimer } = get();
    const taskId = activeTimer.taskId;
    
    localStorage.removeItem('active_timer_task_id');
    localStorage.removeItem('active_timer_end_time');
    set({ activeTimer: { taskId: null, endTime: 0, remainingSeconds: 0 } });

    if (taskId && syncWithServer) {
      get().updateTaskOnServer(taskId, { 
        timer_end_time: null,
        timer_triggered: false 
      });
    }
  },

  tickTimer: () => {
    const { activeTimer, tasks } = get();
    if (!activeTimer.taskId || !activeTimer.endTime) return;

    // If the task was already completed by the background scheduler, just stop locally
    const task = tasks.find(t => t.id === activeTimer.taskId);
    if (task?.completed) {
      get().stopTimer(false);
      return;
    }

    const now = Date.now();
    const remaining = Math.round((activeTimer.endTime - now) / 1000);

    if (remaining <= 0) {
      playTimerAlarm();
      showLocalTimerNotification(task || { id: activeTimer.taskId, title: '' });
      
      const taskId = activeTimer.taskId;
      // Clear local timer without wiping timer_end_time on server before completion/push
      get().stopTimer(false);
      get().toggleTaskCompletion(taskId, true, true);
    } else {
      set({ 
        activeTimer: { 
          ...activeTimer, 
          remainingSeconds: remaining 
        } 
      });
    }
  },

  checkDayChange: async () => {
    const { lastUsedDate, tasks, showReviewModal } = get();
    const todayStr = getCurrentLocalDateStr();

    if (lastUsedDate && lastUsedDate >= todayStr && showReviewModal) {
      set({ showReviewModal: false, pendingResets: [] });
      return;
    }

    // Only trigger period resets when moving forward in calendar days (todayStr > lastUsedDate).
    // If a user travels westward across the dateline/midnight (todayStr < lastUsedDate) after
    // already resetting for the new day, do not regress or double-reset their tasks.
    if (lastUsedDate && todayStr > lastUsedDate) {
      const resets = ['daily'];
      const [todayYear, todayMonth] = todayStr.split('-').map(Number);
      const [lastYear, lastMonth] = lastUsedDate.split('-').map(Number);

      if (todayYear > lastYear || (todayYear === lastYear && todayMonth > lastMonth)) {
        resets.push('monthly');
      }
      if (todayYear > lastYear) {
        resets.push('annually');
      }

      // We only show the modal if there are INCOMPLETE non-counter tasks to review.
      // Counter tasks are reset automatically without requiring review if everything else is done.
      const hasTasksToReview = tasks.some(t => 
        resets.includes(t.columnId) && t.taskType !== 'counter' && !t.completed
      );
      
      if (hasTasksToReview) {
        set({ pendingResets: resets, showReviewModal: true });
      } else {
        // Skip modal but still perform resets for all pending columns
        set({ pendingResets: resets });
        await get().confirmReview([]);
      }
    } else if (!lastUsedDate) {
      set({ lastUsedDate: todayStr });
      taskApi.confirmReset(todayStr).catch(e => console.error("Sync failed", e));
    }
  },

  confirmReview: async (completedTaskIds) => {
    set({ isLoading: true });
    try {
      const { pendingResets, tasks } = get();

      for (const id of completedTaskIds) {
        const task = tasks.find(t => t.id === id);
        if (task && !task.completed) {
          await taskApi.toggleComplete(id, true);
        }
      }
      
      if (pendingResets.includes('daily')) await taskApi.resetDaily();
      if (pendingResets.includes('monthly')) await taskApi.resetMonthly();
      if (pendingResets.includes('annually')) await taskApi.resetAnnually();
      
      const todayStr = getCurrentLocalDateStr();
      await taskApi.confirmReset(todayStr);
      
      set({ 
        showReviewModal: false, 
        lastUsedDate: todayStr,
        pendingResets: [],
        isLoading: false 
      });
      
      await get().fetchTasks();
      useReminderStore.getState().fetchReminders();
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
      }
      console.error("Review confirmation failed", error);
      set({ isLoading: false });
    }
  },

  fetchTasks: async (isBackground = false) => {
    if (!isBackground) {
      set({ isLoading: true, error: null });
    }
    try {
      let tasks = await taskApi.getAll();
      
      const { syncQueue, tasks: currentTasks } = get();

      // Preserve local isCollapsed state to avoid cards collapsing on background refresh
      tasks = tasks.map(newTask => {
        const existingTask = currentTasks.find(t => t.id === newTask.id);
        if (existingTask !== undefined && existingTask.isCollapsed !== undefined) {
          newTask.isCollapsed = existingTask.isCollapsed;
        }
        return newTask;
      });

      if (syncQueue && syncQueue.length > 0) {
        syncQueue.forEach(action => {
          const task = tasks.find(t => t.id === action.taskId);
          if (!task) return;
          if (action.type === 'TOGGLE_COMPLETION') {
            task.completed = action.newCompletedState;
            if (task.completed) {
              task.timerEndTime = null;
              task.timerTriggered = false;
            }
          } else if (action.type === 'INCREMENT') {
            task.currentCount += 1;
          } else if (action.type === 'DECREMENT') {
            task.currentCount = Math.max(0, task.currentCount - 1);
          }
        });
      }

      set({ tasks, isLoading: false, isAuthenticated: true, isOffline: false });
      // Trigger day change check after tasks are loaded
      get().checkDayChange();
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true, isLoading: false });
      } else if (error.message === 'Session expired') {
        set({ isAuthenticated: false, user: null, isLoading: false });
      } else {
        set({ error: error.message, isLoading: false });
      }
    }
  },

  setViewMode: (columnId, mode) => set((state) => ({
    columns: state.columns.map(c => c.id === columnId ? { ...c, viewMode: mode } : c)
  })),

  toggleCollapse: (taskId) => set((state) => ({
    tasks: state.tasks.map(t => t.id === taskId ? { ...t, isCollapsed: !t.isCollapsed } : t)
  })),

  togglePinTask: async (taskId) => {
    if (!navigator.onLine || get().isOffline) {
      const lang = get().language;
      alert(translations[lang]?.offline_action || "Action not available without connection");
      return;
    }

    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;
    const newPinnedState = !task.isPinned;

    set((state) => {
      const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, isPinned: newPinnedState } : t);
      updatedTasks.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return 0;
      });
      return { tasks: updatedTasks };
    });

    try {
      await taskApi.update(taskId, { is_pinned: newPinnedState });
      set({ isOffline: false });
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
      }
      // Rollback
      set((state) => {
        const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, isPinned: !newPinnedState } : t);
        return { tasks: updatedTasks };
      });
      const lang = get().language;
      alert(translations[lang]?.offline_action || "Action not available without connection");
    }
  },

  toggleColumnCollapse: (columnId, setCollapsed) => set((state) => ({
    tasks: state.tasks.map(t => t.columnId === columnId ? { ...t, isCollapsed: setCollapsed } : t)
  })),

  toggleTaskCompletion: async (taskId, targetState = null, fromTimer = false) => {
    const task = get().tasks.find(t => t.id === taskId);
    const newCompletedState = targetState !== null ? targetState : !task?.completed;

    if (task && task.completed === newCompletedState) return;

    if (newCompletedState && !fromTimer && get().activeTimer?.taskId === taskId) {
      get().stopTimer(false);
    }

    // Optimistically update local state immediately
    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, completed: newCompletedState } : t)
    }));

    if (!navigator.onLine || get().isOffline) {
      get().enqueueAction({ 
        type: 'TOGGLE_COMPLETION', 
        taskId, 
        targetState, 
        newCompletedState,
        fromTimer
      });
      return;
    }

    try {
      if (newCompletedState && !fromTimer) {
        await taskApi.update(taskId, { 
          timer_end_time: null,
          timer_triggered: false 
        });
      }
      await taskApi.toggleComplete(taskId, false, targetState, fromTimer);
      set({ isOffline: false });
      useReminderStore.getState().fetchReminders();
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
        get().enqueueAction({ 
          type: 'TOGGLE_COMPLETION', 
          taskId, 
          targetState, 
          newCompletedState,
          fromTimer
        });
      } else {
        // Server rejected action: rollback
        set((state) => ({
          tasks: state.tasks.map(t => t.id === taskId ? { ...t, completed: !newCompletedState } : t)
        }));
      }
    }
  },

  incrementTask: async (taskId, isRetroactive = false) => {
    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, currentCount: t.currentCount + 1 } : t)
    }));

    if (!navigator.onLine || get().isOffline) {
      get().enqueueAction({ type: 'INCREMENT', taskId, isRetroactive });
      return;
    }

    try {
      await taskApi.increment(taskId, isRetroactive);
      set({ isOffline: false });
      useReminderStore.getState().fetchReminders();
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
        get().enqueueAction({ type: 'INCREMENT', taskId, isRetroactive });
      } else {
        // Rollback
        set((state) => ({
          tasks: state.tasks.map(t => t.id === taskId ? { ...t, currentCount: Math.max(0, t.currentCount - 1) } : t)
        }));
      }
    }
  },

  decrementTask: async (taskId) => {
    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, currentCount: Math.max(0, t.currentCount - 1) } : t)
    }));

    if (!navigator.onLine || get().isOffline) {
      get().enqueueAction({ type: 'DECREMENT', taskId });
      return;
    }

    try {
      await taskApi.decrement(taskId);
      set({ isOffline: false });
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
        get().enqueueAction({ type: 'DECREMENT', taskId });
      } else {
        // Rollback
        set((state) => ({
          tasks: state.tasks.map(t => t.id === taskId ? { ...t, currentCount: t.currentCount + 1 } : t)
        }));
      }
    }
  },

  reorderTasks: async (columnId, startIndex, endIndex) => {
    if (!navigator.onLine || get().isOffline) {
      const lang = get().language;
      alert(translations[lang]?.offline_action || "Action not available without connection");
      return;
    }

    const state = get();
    const column = state.columns.find(c => c.id === columnId);
    const isDoneView = column.viewMode === 'done';
    const visibleTasks = state.tasks.filter(t => t.columnId === columnId && t.completed === isDoneView);
    const hiddenTasks = state.tasks.filter(t => !(t.columnId === columnId && t.completed === isDoneView));
    const [removedTask] = visibleTasks.splice(startIndex, 1);
    visibleTasks.splice(endIndex, 0, removedTask);
    const newTaskArray = [...hiddenTasks, ...visibleTasks];
    set({ tasks: newTaskArray });
    const orderedIds = visibleTasks.map(t => t.id);
    try {
      await taskApi.reorderColumn(columnId, orderedIds);
      set({ isOffline: false });
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
      }
      console.error("Sync failed", error);
    }
  },

  addTask: async (columnId, taskData) => {
    if (!navigator.onLine || get().isOffline) {
      const lang = get().language;
      alert(translations[lang]?.offline_action || "Action not available without connection");
      return false;
    }

    const payload = {
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      target_day: taskData.targetDay,
      target_month: taskData.targetMonth,
      duration_minutes: taskData.durationMinutes,
      task_type: taskData.taskType,
      current_count: taskData.currentCount || 0,
      column_id: columnId,
      is_collapsed: true,
      completed: false
    };
    try {
      await taskApi.create(payload);
      set({ isOffline: false });
      await get().fetchTasks();
      useReminderStore.getState().fetchReminders();
      return true;
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
        const lang = get().language;
        alert(translations[lang]?.offline_action || "Action not available without connection");
      }
      return false;
    }
  },

  updateTask: async (taskId, updatedData) => {
    if (!navigator.onLine || get().isOffline) {
      const lang = get().language;
      alert(translations[lang]?.offline_action || "Action not available without connection");
      return false;
    }

    const payload = {
      title: updatedData.title,
      description: updatedData.description,
      priority: updatedData.priority,
      target_day: updatedData.targetDay,
      target_month: updatedData.targetMonth,
      duration_minutes: updatedData.durationMinutes,
      task_type: updatedData.taskType,
      current_count: updatedData.currentCount,
    };
    try {
      await taskApi.update(taskId, payload);
      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updatedData } : t),
        isOffline: false
      }));
      useReminderStore.getState().fetchReminders();
      return true;
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
        const lang = get().language;
        alert(translations[lang]?.offline_action || "Action not available without connection");
      }
      return false;
    }
  },

  deleteTask: async (taskId) => {
    const taskToDelete = get().tasks.find(t => t.id === taskId);
    if (!taskToDelete) return;

    if (!navigator.onLine || get().isOffline) {
      const lang = get().language;
      alert(translations[lang]?.offline_action || "Action not available without connection");
      return;
    }

    // Optimistic Deletion
    set((state) => ({ tasks: state.tasks.filter(t => t.id !== taskId) }));

    try {
      await taskApi.delete(taskId);
      set({ isOffline: false });
      useReminderStore.getState().fetchReminders();
    } catch (error) {
      if (error.message === 'OFFLINE_ERROR') {
        set({ isOffline: true });
      }
      // Rollback
      set((state) => ({ tasks: [...state.tasks, taskToDelete] }));
      const lang = get().language;
      alert(translations[lang]?.offline_action || "Error deleting task offline.");
      console.error("Delete failed", error);
    }
  }
}), {
  name: 'habits-storage',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ 
    tasks: state.tasks, 
    columns: state.columns, 
    language: state.language, 
    lastUsedDate: state.lastUsedDate 
  }),
})
);
