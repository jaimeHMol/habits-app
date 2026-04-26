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

  // Mock BroadcastChannel
  let mockPostMessage = vi.fn()
  let channelInstance

  beforeEach(() => {
    vi.clearAllMocks()
    
    useReminderStore.mockReturnValue({
      reminders: [],
      userSettings: { dayStartTime: '08:00', dayEndTime: '20:00' },
      addAlert: mockAddAlert,
      fetchReminders: mockFetchReminders,
      setTriggered: mockSetTriggered
    })

    useHabitStore.mockReturnValue({
      isAuthenticated: true
    })

    // Mock Audio
    global.Audio = class {
      constructor() {
        this.play = vi.fn().mockResolvedValue(undefined)
      }
    }

    // Mock BroadcastChannel
    global.BroadcastChannel = class {
      constructor(name) {
        this.name = name
        this.onmessage = null
        channelInstance = this
      }
      postMessage = mockPostMessage
      close = vi.fn()
    }

    // Mock Notification
    global.Notification = class {
      static permission = 'granted'
      static requestPermission = vi.fn()
      constructor() {}
    }
  })

  it('should not trigger anything if no message received', () => {
    render(<ReminderEngine />)
    expect(mockAddAlert).not.toHaveBeenCalled()
  })

  it('should trigger alert when receiving PUSH_RECEIVED message', () => {
    render(<ReminderEngine />)
    
    // Simulate receiving a message from the Service Worker
    const mockPayload = {
      title: 'Push Title',
      body: 'Push Body',
      data: { task_id: 123, reminder_id: 456 }
    }
    
    channelInstance.onmessage({
      data: {
        type: 'PUSH_RECEIVED',
        payload: mockPayload
      }
    })

    expect(mockAddAlert).toHaveBeenCalledWith({
      title: 'Push Title',
      body: 'Push Body',
      task_id: 123,
      id: 456
    })
    expect(mockSetTriggered).toHaveBeenCalledWith(456)
  })
})
