import { useEffect, useRef } from 'react'
import { useReminderStore } from '../store/useReminderStore'
import { useHabitStore } from '../store/useHabitStore'
import { stripMarkdown } from '../utils/textUtils'

const SLACK_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

/**
 * ReminderEngine is now a passive receiver.
 * It no longer calculates schedules. 
 * The Backend Scheduler is the single source of truth.
 * This component listens for messages from the Service Worker (Push Notifications)
 * and plays the sound + shows the in-app Toast.
 */
export const ReminderEngine = () => {
  const { fetchReminders, addAlert, setTriggered } = useReminderStore();
  const { isAuthenticated } = useHabitStore();
  const audioRef = useRef(new Audio(SLACK_SOUND_URL));

  // Request notification permissions (Standard PWA flow)
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isAuthenticated]);

  // Initial fetch of reminders for UI list
  useEffect(() => {
    if (isAuthenticated) {
      fetchReminders();
    }
  }, [isAuthenticated, fetchReminders]);

  // Listen for Push Messages from the Service Worker
  useEffect(() => {
    const channel = new BroadcastChannel('reminders-channel');
    
    channel.onmessage = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        const { title, body, data } = event.data.payload;
        
        // 1. Play Sound
        try {
          const audio = new Audio(SLACK_SOUND_URL);
          audio.play().catch(e => console.log("Audio play blocked", e));
        } catch (e) {
          console.error("Audio error", e);
        }

        // 2. Add to Store (shows the NotificationToast UI)
        addAlert({ 
          title, 
          body, 
          task_id: data?.task_id,
          id: data?.reminder_id || Date.now() // Use provided ID or fallback
        });
        
        // 3. Mark as triggered locally if needed
        if (data?.reminder_id) {
          setTriggered(data.reminder_id);
        }
      }
    };

    return () => channel.close();
  }, [addAlert, setTriggered]);

  return null; // Invisible component
}
