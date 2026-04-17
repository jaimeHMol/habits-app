import { create } from 'zustand'
import { taskApi } from '../services/api'

export const useReminderStore = create((set, get) => ({
  reminders: [],
  userSettings: {
    dayStartTime: '08:00',
    dayEndTime: '20:00'
  },
  // Map of reminderId -> lastTriggeredTime (ISO String)
  lastTriggeredAt: JSON.parse(localStorage.getItem('reminders_last_triggered') || '{}'),
  activeAlerts: [],
  isLoading: false,

  fetchReminders: async () => {
    set({ isLoading: true });
    try {
      const reminders = await taskApi.getReminders();
      const me = await taskApi.getMe();
      set({ 
        reminders, 
        userSettings: { 
          dayStartTime: me.dayStartTime, 
          dayEndTime: me.dayEndTime 
        },
        isLoading: false 
      });
    } catch (error) {
      console.error("Failed to fetch reminders", error);
      set({ isLoading: false });
    }
  },

  addReminder: async (reminderData) => {
    try {
      await taskApi.createReminder(reminderData);
      get().fetchReminders();
      return true;
    } catch (error) {
      return false;
    }
  },

  updateReminder: async (id, reminderData) => {
    try {
      await taskApi.updateReminder(id, reminderData);
      get().fetchReminders();
      return true;
    } catch (error) {
      return false;
    }
  },

  deleteReminder: async (id) => {
    try {
      await taskApi.deleteReminder(id);
      set(state => ({ reminders: state.reminders.filter(r => r.id !== id) }));
      return true;
    } catch (error) {
      return false;
    }
  },

  updateSettings: async (settings) => {
    try {
      await taskApi.updateSettings(settings);
      set({ userSettings: settings });
      return true;
    } catch (error) {
      return false;
    }
  },

  setTriggered: (reminderId) => {
    const now = new Date().toISOString();
    const newTriggered = { ...get().lastTriggeredAt, [reminderId]: now };
    localStorage.setItem('reminders_last_triggered', JSON.stringify(newTriggered));
    set({ lastTriggeredAt: newTriggered });
  },

  addAlert: (reminder) => {
    const id = Date.now();
    const isUrgent = !!reminder.task_id;
    
    set(state => ({ 
      activeAlerts: [...state.activeAlerts, { ...reminder, alertId: id, isUrgent }] 
    }));

    // Auto-remove after 10 seconds ONLY if NOT urgent
    if (!isUrgent) {
      setTimeout(() => get().removeAlert(id), 10000);
    }
  },

  removeAlert: (alertId) => {
    set(state => ({ 
      activeAlerts: state.activeAlerts.filter(a => a.alertId !== alertId) 
    }));
  }
}))
