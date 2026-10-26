import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useHabitStore } from './useHabitStore'
import { taskApi } from '../services/api'

// Mock dependencies
vi.mock('../services/api', () => ({
  taskApi: {
    getAll: vi.fn(),
    confirmReset: vi.fn().mockResolvedValue(true),
    resetDaily: vi.fn().mockResolvedValue(true),
    resetMonthly: vi.fn().mockResolvedValue(true),
    resetAnnually: vi.fn().mockResolvedValue(true),
    toggleComplete: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(true),
    increment: vi.fn().mockResolvedValue(true),
    decrement: vi.fn().mockResolvedValue(true)
  }
}))

// Mock useReminderStore to avoid errors
vi.mock('./useReminderStore', () => ({
  useReminderStore: {
    getState: () => ({ fetchReminders: vi.fn() })
  }
}))

describe('useHabitStore - checkDayChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useHabitStore.setState({
      tasks: [],
      lastUsedDate: null,
      pendingResets: [],
      showReviewModal: false,
      isLoading: false
    })
  })

  it('should trigger only daily reset on a normal day change', async () => {
    const yesterdayStr = '2026-04-20'
    const today = new Date('2026-04-21T08:00:00-05:00') // America/Bogota approx
    
    // Mock date to be today
    vi.useFakeTimers()
    vi.setSystemTime(today)

    const tasks = [
      { id: 1, columnId: 'daily', completed: true, taskType: 'normal' },
      { id: 2, columnId: 'daily', completed: false, taskType: 'normal' }
    ]

    useHabitStore.setState({ lastUsedDate: yesterdayStr, tasks })

    await useHabitStore.getState().checkDayChange()

    const state = useHabitStore.getState()
    expect(state.showReviewModal).toBe(true)
    expect(state.pendingResets).toEqual(['daily'])
    
    vi.useRealTimers()
  })

  it('should trigger daily and monthly reset on month change', async () => {
    const lastDayApril = '2026-04-30'
    const firstDayMay = new Date('2026-05-01T08:00:00-05:00')
    
    vi.useFakeTimers()
    vi.setSystemTime(firstDayMay)

    const tasks = [
      { id: 1, columnId: 'daily', completed: false, taskType: 'normal' },
      { id: 2, columnId: 'monthly', completed: false, taskType: 'normal' }
    ]

    useHabitStore.setState({ lastUsedDate: lastDayApril, tasks })

    await useHabitStore.getState().checkDayChange()

    const state = useHabitStore.getState()
    expect(state.showReviewModal).toBe(true)
    expect(state.pendingResets).toEqual(['daily', 'monthly'])
    
    vi.useRealTimers()
  })

  it('should trigger daily, monthly and annual reset on year change', async () => {
    const lastDayYear = '2025-12-31'
    const firstDayYear = new Date('2026-01-01T08:00:00-05:00')
    
    vi.useFakeTimers()
    vi.setSystemTime(firstDayYear)

    const tasks = [
      { id: 1, columnId: 'daily', completed: false, taskType: 'normal' },
      { id: 2, columnId: 'annually', completed: false, taskType: 'normal' }
    ]

    useHabitStore.setState({ lastUsedDate: lastDayYear, tasks })

    await useHabitStore.getState().checkDayChange()

    const state = useHabitStore.getState()
    expect(state.showReviewModal).toBe(true)
    expect(state.pendingResets).toEqual(['daily', 'monthly', 'annually'])
    
    vi.useRealTimers()
  })

  it('should auto-confirm if all tasks to review are already completed', async () => {
    const yesterdayStr = '2026-04-20'
    const today = new Date('2026-04-21T08:00:00-05:00')
    
    vi.useFakeTimers()
    vi.setSystemTime(today)

    const tasks = [
      { id: 1, columnId: 'daily', completed: true, taskType: 'normal' },
      { id: 2, columnId: 'daily', completed: true, taskType: 'normal' }
    ]

    useHabitStore.setState({ lastUsedDate: yesterdayStr, tasks })

    await useHabitStore.getState().checkDayChange()

    const state = useHabitStore.getState()
    expect(state.showReviewModal).toBe(false)
    expect(taskApi.resetDaily).toHaveBeenCalled()
    expect(taskApi.confirmReset).toHaveBeenCalled()
    
    vi.useRealTimers()
  })

  it('should include monthly tasks in the same modal if overlapping', async () => {
    // This is implicitly tested by checking state.pendingResets
    // but we can verify how confirmReview uses them
    const lastDayApril = '2026-04-30'
    const firstDayMay = new Date('2026-05-01T08:00:00-05:00')
    
    vi.useFakeTimers()
    vi.setSystemTime(firstDayMay)

    useHabitStore.setState({ 
      lastUsedDate: lastDayApril, 
      tasks: [{ id: 1, columnId: 'daily', completed: false }] 
    })

    await useHabitStore.getState().checkDayChange()
    expect(useHabitStore.getState().pendingResets).toEqual(['daily', 'monthly'])

    await useHabitStore.getState().confirmReview([1])

    expect(taskApi.resetDaily).toHaveBeenCalled()
    expect(taskApi.resetMonthly).toHaveBeenCalled()
    expect(taskApi.resetAnnually).not.toHaveBeenCalled()
    
    vi.useRealTimers()
  })

  it('should auto-close the modal and abort if lastUsedDate matches today (concurrent device sync)', async () => {
    const today = new Date('2026-04-21T08:00:00-05:00')
    const todayStr = '2026-04-21'
    
    vi.useFakeTimers()
    vi.setSystemTime(today)

    useHabitStore.setState({ 
      lastUsedDate: todayStr, 
      showReviewModal: true,
      pendingResets: ['daily']
    })

    await useHabitStore.getState().checkDayChange()

    const state = useHabitStore.getState()
    expect(state.showReviewModal).toBe(false)
    expect(state.pendingResets).toEqual([])
    expect(taskApi.confirmReset).not.toHaveBeenCalled()
    expect(taskApi.resetDaily).not.toHaveBeenCalled()
    
    vi.useRealTimers()
  })
})

describe('useHabitStore - offline behavior and resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useHabitStore.setState({
      tasks: [],
      syncQueue: [],
      isOffline: false,
      isLoading: false,
      error: null
    })
  })

  it('fetchTasks sets isOffline: true and avoids infinite loop when network fails with OFFLINE_ERROR', async () => {
    taskApi.getAll.mockRejectedValueOnce(new Error('OFFLINE_ERROR'))

    await useHabitStore.getState().fetchTasks()

    const state = useHabitStore.getState()
    expect(state.isOffline).toBe(true)
    expect(state.isLoading).toBe(false)
    // Verify it was only called once, NOT recursing indefinitely
    expect(taskApi.getAll).toHaveBeenCalledTimes(1)
  })

  it('toggleTaskCompletion keeps optimistic checkmark and enqueues action on OFFLINE_ERROR', async () => {
    const task = { id: 10, columnId: 'daily', completed: false, currentCount: 0 }
    useHabitStore.setState({ tasks: [task], isOffline: false })

    taskApi.toggleComplete.mockRejectedValueOnce(new Error('OFFLINE_ERROR'))

    await useHabitStore.getState().toggleTaskCompletion(10, true)

    const state = useHabitStore.getState()
    // Task remains completed optimistically
    expect(state.tasks[0].completed).toBe(true)
    // isOffline set to true
    expect(state.isOffline).toBe(true)
    // Enqueued for background sync
    expect(state.syncQueue.length).toBe(1)
    expect(state.syncQueue[0].type).toBe('TOGGLE_COMPLETION')
    expect(state.syncQueue[0].taskId).toBe(10)
  })

  it('incrementTask keeps optimistic increment and enqueues action on OFFLINE_ERROR', async () => {
    const task = { id: 20, columnId: 'daily', completed: false, currentCount: 2 }
    useHabitStore.setState({ tasks: [task], isOffline: false })

    taskApi.increment = vi.fn().mockRejectedValueOnce(new Error('OFFLINE_ERROR'))

    await useHabitStore.getState().incrementTask(20)

    const state = useHabitStore.getState()
    expect(state.tasks[0].currentCount).toBe(3)
    expect(state.isOffline).toBe(true)
    expect(state.syncQueue.length).toBe(1)
    expect(state.syncQueue[0].type).toBe('INCREMENT')
  })

  it('tickTimer completes task with fromTimer=true without wiping server timer_end_time beforehand', async () => {
    const task = { id: 99, title: 'Focus Session', columnId: 'daily', completed: false }
    const expiredEndTime = Date.now() - 1000

    useHabitStore.setState({
      tasks: [task],
      activeTimer: { taskId: 99, endTime: expiredEndTime, remainingSeconds: 1 },
      isOffline: false
    })

    useHabitStore.getState().tickTimer()

    // Wait for async toggleTaskCompletion
    await new Promise(resolve => setTimeout(resolve, 0))

    // Should NOT have called taskApi.update with timer_end_time: null
    expect(taskApi.update).not.toHaveBeenCalled()
    // Should have called toggleComplete with fromTimer = true
    expect(taskApi.toggleComplete).toHaveBeenCalledWith(99, false, true, true)
    expect(useHabitStore.getState().tasks[0].completed).toBe(true)
    expect(useHabitStore.getState().activeTimer.taskId).toBeNull()
  })

  it('manual stopTimer clears timer_end_time on the server', async () => {
    useHabitStore.setState({
      activeTimer: { taskId: 99, endTime: Date.now() + 60000, remainingSeconds: 60 },
      isOffline: false
    })

    await useHabitStore.getState().stopTimer()

    expect(taskApi.update).toHaveBeenCalledWith(99, {
      timer_end_time: null,
      timer_triggered: false
    })
    expect(useHabitStore.getState().activeTimer.taskId).toBeNull()
  })
})

