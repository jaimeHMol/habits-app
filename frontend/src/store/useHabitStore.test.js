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
    toggleComplete: vi.fn().mockResolvedValue(true)
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
