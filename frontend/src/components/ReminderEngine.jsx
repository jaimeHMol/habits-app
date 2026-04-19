import React, { useEffect, useRef } from 'react'
import { useReminderStore } from '../store/useReminderStore'
import { useHabitStore } from '../store/useHabitStore'

const SLACK_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'; // A clean "pop" sound

export const ReminderEngine = () => {
  const { reminders, userSettings, lastTriggeredAt, setTriggered, fetchReminders, addAlert } = useReminderStore();
  const { tasks, isAuthenticated } = useHabitStore();
  const audioRef = useRef(new Audio(SLACK_SOUND_URL));

  // Request notification permissions
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isAuthenticated]);

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchReminders();
    }
  }, [isAuthenticated, fetchReminders]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkReminders = () => {
      const now = new Date();
      const currentStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      
      // 1. Check if we are within the activity window
      if (currentStr < userSettings.dayStartTime || currentStr > userSettings.dayEndTime) {
        return;
      }

      reminders.forEach(reminder => {
        if (!reminder.isActive) return;

        // --- Logic A: Interval-based (General Reminders) ---
        if (!reminder.task_id) {
          const lastTime = lastTriggeredAt[reminder.id] ? new Date(lastTriggeredAt[reminder.id]) : null;
          const diffMinutes = lastTime ? (now - lastTime) / (1000 * 60) : Infinity;

          if (diffMinutes >= reminder.intervalMinutes) {
            triggerNotification(reminder);
          }
          return;
        }

        // --- Logic B: Slot-based (Task-linked Reminders) ---
        const task = tasks.find(t => t.id === reminder.task_id);
        if (!task || task.completed) return;

        // Verify if today is the target day
        const dayOfMonth = now.getDate();
        const monthOfYear = now.getMonth() + 1; // 1-12

        const isDueToday = (
          (task.columnId === 'monthly' && task.targetDay === dayOfMonth) ||
          (task.columnId === 'annually' && task.targetDay === dayOfMonth && task.targetMonth === monthOfYear)
        );

        if (!isDueToday) return;

        // Calculate slots (Start, Middle, Near-End)
        const slots = calculateSlots(userSettings.dayStartTime, userSettings.dayEndTime);
        
        slots.forEach((slotTime, index) => {
          if (currentStr >= slotTime) {
            const slotKey = `slot_${reminder.id}_${index}_${todayStr}`;
            const alreadyTriggered = localStorage.getItem(slotKey);

            if (!alreadyTriggered) {
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

      return [
        start, // Start
        format(startMin + duration / 2), // Middle
        format(endMin - 30) // End minus 30 min
      ];
    };

    const triggerNotification = (reminder) => {
      // Audio: Use a fresh instance if needed or handle rapid plays
      try {
        const audio = new Audio(SLACK_SOUND_URL);
        audio.play().catch(e => console.log("Audio play blocked"));
      } catch (e) {
        console.error("Audio error", e);
      }

      // Browser Notification
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification("RECUERDA", {
            body: reminder.title,
            icon: '/favicon.svg',
            silent: true // We handle sound ourselves
          });
        }
      } catch (e) {
        console.error("System notification error", e);
      }

      // Add to store
      addAlert(reminder);
      setTriggered(reminder.id);
    };

    };

    // Check every minute
    const interval = setInterval(checkReminders, 60000);
    // Also run once on mount
    checkReminders();

    return () => clearInterval(interval);
  }, [reminders, userSettings, lastTriggeredAt, isAuthenticated, setTriggered]);

  return null; // Invisible component
}
