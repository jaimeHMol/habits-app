import { useEffect, useRef } from 'react'
import { useReminderStore } from '../store/useReminderStore'
import { useHabitStore } from '../store/useHabitStore'
import { usePomodoroStore } from '../store/usePomodoroStore'
import { stripMarkdown } from '../utils/textUtils'
import { syncExistingPushSubscription } from '../services/pushSubscription'

const SLACK_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

export const ReminderEngine = () => {
  const { reminders, userSettings, lastTriggeredAt, setTriggered, fetchReminders, addAlert } = useReminderStore();
  const { tasks, isAuthenticated } = useHabitStore();
  const audioRef = useRef(new Audio(SLACK_SOUND_URL));

  // 1. Request notification permissions
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isAuthenticated]);

  // 2. Load initial data and sync active push subscription
  useEffect(() => {
    if (isAuthenticated) {
      fetchReminders();
      syncExistingPushSubscription();
    }
  }, [isAuthenticated, fetchReminders]);

  // 3. Local reminder engine (for immediate in-app Toasts when the app is open)
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkReminders = () => {
      const now = new Date();
      // Use browser local time for the in-app Toast engine
      const currentStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      const todayStr = now.toLocaleDateString('en-CA');
      
      if (currentStr < userSettings.dayStartTime || currentStr > userSettings.dayEndTime) {
        return;
      }

      reminders.forEach(reminder => {
        if (!reminder.isActive) return;

        // Interval reminders
        if (!reminder.task_id) {
          const lastTime = lastTriggeredAt[reminder.id] ? new Date(lastTriggeredAt[reminder.id]) : null;
          const diffMinutes = lastTime ? (now - lastTime) / (1000 * 60) : Infinity;
          if (diffMinutes >= reminder.intervalMinutes) {
            triggerNotification(reminder);
          }
          return;
        }

        // Task-linked reminders (3 daily slots)
        const task = tasks.find(t => t.id === reminder.task_id);
        if (!task || task.completed) return;

        const dayOfMonth = now.getDate();
        const monthOfYear = now.getMonth() + 1;
        const isDueToday = (
          (task.columnId === 'monthly' && task.targetDay === dayOfMonth) ||
          (task.columnId === 'annually' && task.targetDay === dayOfMonth && task.targetMonth === monthOfYear)
        );

        if (!isDueToday) return;

        // Calculate the 3 daily reminder slots within the user's active window
        const slots = calculateSlots(userSettings.dayStartTime, userSettings.dayEndTime);
        slots.forEach((slotTime, index) => {
          if (currentStr >= slotTime) {
            const slotKey = `slot_${reminder.id}_${index}_${todayStr}`;
            if (!localStorage.getItem(slotKey)) {
              triggerNotification(reminder);
              localStorage.setItem(slotKey, 'true');
            }
          }
        });
      });
    };

    const calculateSlots = (start, end) => {
      const [hStart, mStart] = start.split(':').map(Number);
      const [hEnd, mEnd] = end.split(':').map(Number);
      const startMin = hStart * 60 + mStart;
      const endMin = hEnd * 60 + mEnd;
      const duration = endMin - startMin;
      const format = (totalMin) => {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };
      return [start, format(startMin + duration / 2), format(endMin - 30)];
    };

    const interval = setInterval(checkReminders, 60000);
    checkReminders();
    return () => clearInterval(interval);
  }, [reminders, userSettings, lastTriggeredAt, isAuthenticated, tasks, addAlert, setTriggered]);

  // 4. Push notification broadcast channel listener
  useEffect(() => {
    const channel = new BroadcastChannel('reminders-channel');
    channel.onmessage = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        const { title, body, data } = event.data.payload;
        const isTimer = data?.type === 'timer_end';
        const isPomodoroFocus = data?.type === 'pomodoro_focus_end';
        const isPomodoroBreak = data?.type === 'pomodoro_break_end';

        if (isTimer && data?.task_id) {
          const habitState = useHabitStore.getState?.();
          if (habitState?.activeTimer?.taskId === data.task_id) {
            habitState.stopTimer?.(false);
          }
          habitState?.fetchTasks?.(true);
        }

        if (isPomodoroFocus || isPomodoroBreak) {
          const pomodoroStore = usePomodoroStore.getState?.();
          pomodoroStore?.handlePushNotification?.(data.type, data.pomodoro_id);
        }

        // The payload 'body' contains the habit text from the backend.
        // We use it as the title for our internal Toast UI.
        triggerNotification({ 
          title: body || title, 
          id: data?.reminder_id, 
          task_id: data?.task_id,
          pomodoro_id: data?.pomodoro_id,
          type: data?.type,
          isTimer: isTimer || isPomodoroFocus || isPomodoroBreak
        });
      }
    };
    return () => channel.close();
  }, [addAlert]);

  const triggerNotification = (reminder) => {
    const plainTitle = stripMarkdown(reminder.title);
    
    // Play notification sound
    try {
      const audio = new Audio(SLACK_SOUND_URL);
      audio.play().catch(e => {});
    } catch (e) {}

    // Toast UI
    addAlert({ ...reminder, title: plainTitle });
    if (reminder.id) setTriggered(reminder.id);
  };

  return null;
}
