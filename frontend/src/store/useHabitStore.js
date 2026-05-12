import { create } from 'zustand'
import { taskApi } from '../services/api'
import { useReminderStore } from './useReminderStore'
import { translations } from '../i18n/translations'

export const useHabitStore = create((set, get) => ({
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
      return { success: false, message: error.message };
    }
  },

  register: async (data) => {
    try {
      await taskApi.register(data);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  logout: async () => {
    try {
      await taskApi.logout();
    } catch (e) {
      console.error("Logout failed on server", e);
    }
    set({ isAuthenticated: false, user: null, tasks: [], lastUsedDate: null });
  },

  fetchUserProfile: async () => {
    try {
      const user = await taskApi.getMe();
      set({ 
        user, 
        isAuthenticated: true, 
        language: user.language,
        lastUsedDate: user.last_period_reset_date 
      });
      localStorage.setItem('habit_lang', user.language);
    } catch (error) {
      if (error.message === 'Session expired') {
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

  updateTaskOnServer: async (taskId, fields) => {
    if (!navigator.onLine) return;
    try {
      await taskApi.update(taskId, fields);
    } catch (error) {
      console.error("Failed to update task on server", error);
    }
  },

  startTimer: async (taskId, durationMinutes) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
      return;
    }
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

  stopTimer: async () => {
    const { activeTimer } = get();
    const taskId = activeTimer.taskId;
    
    localStorage.removeItem('active_timer_task_id');
    localStorage.removeItem('active_timer_end_time');
    set({ activeTimer: { taskId: null, endTime: 0, remainingSeconds: 0 } });

    if (taskId) {
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
      get().stopTimer();
      return;
    }

    const now = Date.now();
    const remaining = Math.round((activeTimer.endTime - now) / 1000);

    if (remaining <= 0) {
      const alarm = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      alarm.play().catch(e => console.log("Audio blocked", e));
      
      const taskId = activeTimer.taskId;
      get().stopTimer();
      get().toggleTaskCompletion(taskId, true);
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
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    if (lastUsedDate === todayStr && showReviewModal) {
      set({ showReviewModal: false, pendingResets: [] });
      return;
    }

    if (lastUsedDate && lastUsedDate !== todayStr) {
      const lastDate = new Date(lastUsedDate + 'T00:00:00'); 
      
      const resets = ['daily'];
      if (today.getMonth() !== lastDate.getMonth() || today.getFullYear() !== lastDate.getFullYear()) {
        resets.push('monthly');
      }
      if (today.getFullYear() !== lastDate.getFullYear()) {
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
      
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
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
      console.error("Review confirmation failed", error);
      set({ isLoading: false });
    }
  },

  fetchTasks: async (isBackground = false) => {
    if (!isBackground) {
      set({ isLoading: true, error: null });
    }
    try {
      const tasks = await taskApi.getAll();
      set({ tasks, isLoading: false, isAuthenticated: true });
      // Trigger day change check after tasks are loaded
      get().checkDayChange();
    } catch (error) {
      if (error.message === 'Session expired') {
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
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
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
    } catch (error) {
      get().fetchTasks(); 
    }
  },

  toggleColumnCollapse: (columnId, setCollapsed) => set((state) => ({
    tasks: state.tasks.map(t => t.columnId === columnId ? { ...t, isCollapsed: setCollapsed } : t)
  })),

  toggleTaskCompletion: async (taskId, targetState = null) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
      return;
    }

    const task = get().tasks.find(t => t.id === taskId);
    const newCompletedState = targetState !== null ? targetState : !task?.completed;

    if (task && task.completed === newCompletedState) return;

    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, completed: newCompletedState } : t)
    }));
    try {
      // Clear timer fields on server if completing
      if (newCompletedState) {
        await taskApi.update(taskId, { 
          timer_end_time: null,
          timer_triggered: false 
        });
      }
      await taskApi.toggleComplete(taskId, false, targetState);
      useReminderStore.getState().fetchReminders();
    } catch (error) {
      get().fetchTasks();
    }
  },

  incrementTask: async (taskId, isRetroactive = false) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
      return;
    }

    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, currentCount: t.currentCount + 1 } : t)
    }));
    try {
      await taskApi.increment(taskId, isRetroactive);
      useReminderStore.getState().fetchReminders();
    } catch (error) {
      get().fetchTasks();
    }
  },

  decrementTask: async (taskId) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
      return;
    }

    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, currentCount: Math.max(0, t.currentCount - 1) } : t)
    }));
    try {
      await taskApi.decrement(taskId);
    } catch (error) {
      get().fetchTasks();
    }
  },

  reorderTasks: async (columnId, startIndex, endIndex) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
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
    } catch (error) {
      console.error("Sync failed", error);
      get().fetchTasks();
    }
  },

  addTask: async (columnId, taskData) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
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
      get().fetchTasks();
      useReminderStore.getState().fetchReminders();
      return true;
    } catch (error) {
      return false;
    }
  },

  updateTask: async (taskId, updatedData) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
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
      get().fetchTasks();
      useReminderStore.getState().fetchReminders();
      return true;
    } catch (error) {
      return false;
    }
  },

  deleteTask: async (taskId) => {
    if (!navigator.onLine) {
      const lang = get().language;
      alert(translations[lang].offline_action);
      return;
    }

    try {
      await taskApi.delete(taskId);
      set((state) => ({ tasks: state.tasks.filter(t => t.id !== taskId) }));
      useReminderStore.getState().fetchReminders();
    } catch (error) {
      console.error("Delete failed", error);
    }
  }
}))
