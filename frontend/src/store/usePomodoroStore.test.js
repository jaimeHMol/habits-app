import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePomodoroStore } from './usePomodoroStore'
import { useHabitStore } from './useHabitStore'
import { taskApi } from '../services/api'
import confetti from 'canvas-confetti'

vi.mock('../services/api', () => ({
  taskApi: {
    getTodayPomodoros: vi.fn(),
    startPomodoro: vi.fn(),
    completePomodoroFocus: vi.fn(),
    startPomodoroBreak: vi.fn(),
    completePomodoroBreak: vi.fn(),
    interruptPomodoro: vi.fn(),
    createManualPomodoro: vi.fn(),
    deleteManualPomodoro: vi.fn()
  }
}))

vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}))

describe('usePomodoroStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taskApi.getTodayPomodoros.mockResolvedValue({
      completed_today_count: 0,
      interrupted_today_count: 0,
      today_sessions: []
    })

    usePomodoroStore.setState({
      activeSession: null,
      todayStats: {
        completed_today_count: 0,
        interrupted_today_count: 0,
        today_sessions: []
      },
      isPanelOpen: false,
      isOverlayOpen: false,
      isLoading: false
    })

    useHabitStore.setState({
      activeTimer: { taskId: null, remainingSeconds: 0 },
      stopTimer: vi.fn()
    })
  })

  it('stops active task timer upon opening pomodoro panel or starting focus', async () => {
    const stopTimerMock = vi.fn()
    useHabitStore.setState({
      activeTimer: { taskId: 42, remainingSeconds: 600 },
      stopTimer: stopTimerMock
    })

    taskApi.getTodayPomodoros.mockResolvedValueOnce({
      completed_today_count: 0,
      interrupted_today_count: 0,
      today_sessions: []
    })

    usePomodoroStore.getState().openPanel()
    expect(stopTimerMock).toHaveBeenCalledWith(true)

    // Test startFocus also enforces exclusion
    taskApi.startPomodoro.mockResolvedValueOnce({
      id: 1,
      status: 'in_progress',
      phase: 'focus',
      timer_end_time: new Date(Date.now() + 25 * 60 * 1000).toISOString()
    })

    await usePomodoroStore.getState().startFocus()
    expect(stopTimerMock).toHaveBeenCalledTimes(2)
  })

  it('handles standard lifecycle: Start Focus -> Complete Focus -> Start Break -> Complete Break', async () => {
    const endTime = new Date(Date.now() + 25 * 60 * 1000).toISOString()
    taskApi.startPomodoro.mockResolvedValueOnce({
      id: 10,
      status: 'in_progress',
      phase: 'focus',
      timer_end_time: endTime
    })
    taskApi.getTodayPomodoros.mockResolvedValue({
      completed_today_count: 0,
      interrupted_today_count: 0,
      today_sessions: []
    })

    // 1. Start Focus
    await usePomodoroStore.getState().startFocus()
    let state = usePomodoroStore.getState()
    expect(state.activeSession).not.toBeNull()
    expect(state.activeSession.id).toBe(10)
    expect(state.activeSession.phase).toBe('focus')
    expect(state.activeSession.status).toBe('in_progress')
    expect(state.isOverlayOpen).toBe(true)

    // 2. Complete Focus
    taskApi.completePomodoroFocus.mockResolvedValueOnce({
      id: 10,
      status: 'completed',
      phase: 'focus'
    })
    await usePomodoroStore.getState().completeFocus()
    state = usePomodoroStore.getState()
    expect(state.activeSession.status).toBe('completed')
    expect(state.activeSession.phase).toBe('focus')
    expect(state.activeSession.endTime).toBeNull()

    // 3. Start Break
    const breakEndTime = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    taskApi.startPomodoroBreak.mockResolvedValueOnce({
      id: 10,
      status: 'completed',
      phase: 'break',
      timer_end_time: breakEndTime
    })
    await usePomodoroStore.getState().startBreak()
    state = usePomodoroStore.getState()
    expect(state.activeSession.phase).toBe('break')
    expect(state.activeSession.remainingSeconds).toBeGreaterThan(0)

    // 4. Complete Break
    taskApi.completePomodoroBreak.mockResolvedValueOnce({
      id: 10,
      status: 'completed',
      phase: 'done'
    })
    await usePomodoroStore.getState().completeBreak()
    state = usePomodoroStore.getState()
    expect(state.activeSession.phase).toBe('done')
    expect(state.activeSession.status).toBe('completed')
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        colors: ['#0d9488', '#14b8a6', '#99f6e4'],
        disableForReducedMotion: true
      })
    )
  })

  it('interrupts active focus session when interruptPomodoro is called', async () => {
    taskApi.interruptPomodoro.mockResolvedValueOnce({
      id: 5,
      status: 'interrupted',
      phase: 'done'
    })

    usePomodoroStore.setState({
      activeSession: {
        id: 5,
        phase: 'focus',
        status: 'in_progress',
        endTime: Date.now() + 1000 * 1000,
        remainingSeconds: 1000
      },
      isOverlayOpen: true
    })

    await usePomodoroStore.getState().interruptPomodoro()
    expect(taskApi.interruptPomodoro).toHaveBeenCalledWith(5, 500)
    const state = usePomodoroStore.getState()
    expect(state.activeSession).toBeNull()
    expect(state.isOverlayOpen).toBe(false)
  })

  it('creates and deletes manual pomodoro entries', async () => {
    taskApi.createManualPomodoro.mockResolvedValueOnce({
      id: 99,
      is_manual: true,
      hour_of_day: 15,
      status: 'completed'
    })
    taskApi.getTodayPomodoros.mockResolvedValueOnce({
      completed_today_count: 1,
      interrupted_today_count: 0,
      today_sessions: [{ id: 99, is_manual: true, hour_of_day: 15, status: 'completed' }]
    })

    const created = await usePomodoroStore.getState().createManualPomodoro(15)
    expect(created).toBe(true)
    expect(taskApi.createManualPomodoro).toHaveBeenCalledWith(15, expect.any(String))
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        colors: ['#0d9488', '#14b8a6', '#99f6e4'],
        disableForReducedMotion: true
      })
    )

    taskApi.deleteManualPomodoro.mockResolvedValueOnce(true)
    taskApi.getTodayPomodoros.mockResolvedValueOnce({
      completed_today_count: 0,
      interrupted_today_count: 0,
      today_sessions: []
    })

    const deleted = await usePomodoroStore.getState().deleteManualPomodoro(99)
    expect(deleted).toBe(true)
    expect(taskApi.deleteManualPomodoro).toHaveBeenCalledWith(99)
  })

  it('ticks pomodoro timer and triggers completeFocus when focus time expires', () => {
    const completeFocusSpy = vi.spyOn(usePomodoroStore.getState(), 'completeFocus')

    usePomodoroStore.setState({
      activeSession: {
        id: 1,
        phase: 'focus',
        status: 'in_progress',
        endTime: Date.now() - 100, // already past
        remainingSeconds: 1
      }
    })

    usePomodoroStore.getState().tickPomodoro()
    expect(completeFocusSpy).toHaveBeenCalledWith(true)
  })
})
