import { create } from 'zustand'
import { taskApi } from '../services/api'

export const useHabitStore = create((set, get) => ({
  isAuthenticated: !!localStorage.getItem('habit_token'),
  
  login: async (username, password) => {
    try {
      const data = await taskApi.login(username, password);
      localStorage.setItem('habit_token', data.access_token);
      set({ isAuthenticated: true, error: null });
      get().fetchTasks(); // Load data immediately after login
      return true;
    } catch (error) {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('habit_token');
    set({ isAuthenticated: false, tasks: [] });
  },
  columns: [
    // Added viewMode to each column state
    { id: 'daily', title: 'Daily', type: 'daily', viewMode: 'active' },
    { id: 'monthly', title: 'Monthly', type: 'monthly', viewMode: 'active' },
    { id: 'annually', title: 'Annually', type: 'annually', viewMode: 'active' },
    { id: 'todo', title: 'To Do', type: 'todo', viewMode: 'active' },
  ],
  tasks: [],
  isLoading: false,
  error: null,
  showReviewModal: false,
  pendingResets: [], // ['daily', 'monthly', 'annually']
  lastUsedDate: localStorage.getItem('last_used_date'),
  activeTimer: { taskId: null, remainingSeconds: 0 },

  startTimer: (taskId, durationMinutes) => {
    set({ activeTimer: { taskId, remainingSeconds: durationMinutes * 60 } });
  },

  stopTimer: () => {
    set({ activeTimer: { taskId: null, remainingSeconds: 0 } });
  },

  tickTimer: () => {
    const { activeTimer, toggleTaskCompletion, stopTimer } = get();
    if (!activeTimer.taskId) return;

    if (activeTimer.remainingSeconds <= 1) {
      // Time is up!
      toggleTaskCompletion(activeTimer.taskId);
      stopTimer();
    } else {
      set({ 
        activeTimer: { 
          ...activeTimer, 
          remainingSeconds: activeTimer.remainingSeconds - 1 
        } 
      });
    }
  },

  checkDayChange: () => {
    const lastDateStr = get().lastUsedDate;
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    if (lastDateStr && lastDateStr !== todayStr) {
      const lastDate = new Date(lastDateStr + 'T00:00:00'); // Use ISO-like for consistent parsing
      
      const resets = ['daily'];
      if (today.getMonth() !== lastDate.getMonth() || today.getFullYear() !== lastDate.getFullYear()) {
        resets.push('monthly');
      }
      if (today.getFullYear() !== lastDate.getFullYear()) {
        resets.push('annually');
      }

      // Check if there are tasks to review in these columns
      const hasTasksToReview = get().tasks.some(t => resets.includes(t.columnId));
      
      if (hasTasksToReview) {
        set({ pendingResets: resets, showReviewModal: true });
      } else {
        // Just update the date if no tasks
        localStorage.setItem('last_used_date', todayStr);
        set({ lastUsedDate: todayStr, pendingResets: [] });
      }
    } else if (!lastDateStr) {
      localStorage.setItem('last_used_date', todayStr);
      set({ lastUsedDate: todayStr });
    }
  },

  confirmReview: async (completedTaskIds) => {
    set({ isLoading: true });
    try {
      const { pendingResets, tasks } = get();

      // 1. Mark tasks as completed (the ones user said they finished)
      for (const id of completedTaskIds) {
        const task = tasks.find(t => t.id === id);
        if (task && !task.completed) {
          await taskApi.toggleComplete(id, true);
        }
      }
      
      // 2. Perform resets in backend for each pending column
      if (pendingResets.includes('daily')) await taskApi.resetDaily();
      if (pendingResets.includes('monthly')) await taskApi.resetMonthly();
      if (pendingResets.includes('annually')) await taskApi.resetAnnually();
      
      // 3. Update local state
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      localStorage.setItem('last_used_date', todayStr);
      
      set({ 
        showReviewModal: false, 
        lastUsedDate: todayStr,
        pendingResets: [],
        isLoading: false 
      });
      
      await get().fetchTasks();
    } catch (error) {
      console.error("Review confirmation failed", error);
      set({ isLoading: false });
    }
  },

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await taskApi.getAll();
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // New action to change the view mode globally
  setViewMode: (columnId, mode) => set((state) => ({
    columns: state.columns.map(c => c.id === columnId ? { ...c, viewMode: mode } : c)
  })),

  toggleCollapse: (taskId) => set((state) => ({
    tasks: state.tasks.map(t => t.id === taskId ? { ...t, isCollapsed: !t.isCollapsed } : t)
  })),

  toggleColumnCollapse: (columnId, setCollapsed) => set((state) => ({
    tasks: state.tasks.map(t => t.columnId === columnId ? { ...t, isCollapsed: setCollapsed } : t)
  })),

  toggleTaskCompletion: async (taskId) => {
    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    }));
    try {
      await taskApi.toggleComplete(taskId, false);
    } catch (error) {
      get().fetchTasks(); // Revert on failure
    }
  },

  // FIXED: Reorder logic now accounts for the current view subset
  reorderTasks: async (columnId, startIndex, endIndex) => {
    const state = get();
    const column = state.columns.find(c => c.id === columnId);
    const isDoneView = column.viewMode === 'done';

    // 1. Separate the tasks that are currently visible from those that are not
    const visibleTasks = state.tasks.filter(t => t.columnId === columnId && t.completed === isDoneView);
    const hiddenTasks = state.tasks.filter(t => !(t.columnId === columnId && t.completed === isDoneView));

    // 2. Perform the reorder only on the visible subset
    const [removedTask] = visibleTasks.splice(startIndex, 1);
    visibleTasks.splice(endIndex, 0, removedTask);

    // 3. Recombine all tasks
    const newTaskArray = [...hiddenTasks, ...visibleTasks];
    
    // Optimistic Update
    set({ tasks: newTaskArray });

    // 4. Persist only the new order of the visible subset to the backend
    const orderedIds = visibleTasks.map(t => t.id);
    try {
      await taskApi.reorderColumn(columnId, orderedIds);
    } catch (error) {
      console.error("Sync failed", error);
      get().fetchTasks();
    }
  },

  addTask: async (columnId, taskData) => {
    const payload = {
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      target_day: taskData.targetDay,
      target_month: taskData.targetMonth,
      duration_minutes: taskData.durationMinutes,
      column_id: columnId,
      is_collapsed: true,
      completed: false
    };
    try {
      await taskApi.create(payload);
      get().fetchTasks();
      return true;
    } catch (error) {
      return false;
    }
  },

  updateTask: async (taskId, updatedData) => {
    const payload = {
      title: updatedData.title,
      description: updatedData.description,
      priority: updatedData.priority,
      target_day: updatedData.targetDay,
      target_month: updatedData.targetMonth,
      duration_minutes: updatedData.durationMinutes,
    };
    try {
      await taskApi.update(taskId, payload);
      get().fetchTasks();
      return true;
    } catch (error) {
      return false;
    }
  },

  deleteTask: async (taskId) => {
    try {
      await taskApi.delete(taskId);
      set((state) => ({ tasks: state.tasks.filter(t => t.id !== taskId) }));
    } catch (error) {
      console.error("Delete failed", error);
    }
  }
}))