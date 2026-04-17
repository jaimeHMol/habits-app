import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReminderEngine } from './ReminderEngine'
import { useReminderStore } from '../store/useReminderStore'
import { useHabitStore } from '../store/useHabitStore'

// Mock the stores
vi.mock('../store/useReminderStore')
vi.mock('../store/useHabitStore')

describe('ReminderEngine', () => {
  const mockAddAlert = vi.fn()
  const mockFetchReminders = vi.fn()
  const mockSetTriggered = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    useReminderStore.mockReturnValue({
      reminders: [],
      userSettings: { dayStartTime: '08:00', dayEndTime: '20:00' },
      lastTriggeredAt: {},
      addAlert: mockAddAlert,
      fetchReminders: mockFetchReminders,
      setTriggered: mockSetTriggered
    })

    useHabitStore.mockReturnValue({
      tasks: [],
      isAuthenticated: true
    })

    // Mock Audio
    global.Audio = class {
      constructor() {
        this.play = vi.fn().mockResolvedValue(undefined)
      }
    }

    // Mock Notification
    global.Notification = class {
      static permission = 'granted'
      static requestPermission = vi.fn()
      constructor() {}
    }
  })

  it('should not trigger anything if no reminders', () => {
    render(<ReminderEngine />)
    expect(mockAddAlert).not.toHaveBeenCalled()
  })

  it('should trigger a task-based alert when in a slot time', () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const dayOfMonth = new Date().getDate();

    useReminderStore.mockReturnValue({
      reminders: [
        { id: 1, title: 'Task Alert', task_id: 101, isActive: true }
      ],
      userSettings: { dayStartTime: '08:00', dayEndTime: '20:00' },
      lastTriggeredAt: {},
      addAlert: mockAddAlert,
      fetchReminders: mockFetchReminders,
      setTriggered: mockSetTriggered
    })

    useHabitStore.mockReturnValue({
      tasks: [
        { id: 101, title: 'Test Task', columnId: 'monthly', targetDay: dayOfMonth, completed: false }
      ],
      isAuthenticated: true
    })

    // Mock current time to be 08:01 (Slot 1 is 08:00)
    vi.useFakeTimers()
    const now = new Date()
    now.setHours(8, 1, 0)
    vi.setSystemTime(now)

    render(<ReminderEngine />)
    
    expect(mockAddAlert).toHaveBeenCalled()
    expect(localStorage.getItem(`slot_1_0_${today}`)).toBe('true')
    
    vi.useRealTimers()
  })
})
