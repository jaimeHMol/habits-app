import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PomodoroPanel, getActiveWindowHours, getClosestHourInOptions } from './PomodoroPanel';
import { PomodoroFocusOverlay } from './PomodoroFocusOverlay';
import { TaskCard } from './TaskCard';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { useHabitStore } from '../store/useHabitStore';
import { useReminderStore } from '../store/useReminderStore';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Pomodoro UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHabitStore.setState({
      language: 'en',
      activeTimer: { taskId: null, remainingSeconds: 0 },
      toggleTaskCompletion: vi.fn(),
      toggleCollapse: vi.fn(),
      updateTask: vi.fn(),
    });
  });

  describe('PomodoroPanel', () => {
    it('renders summary count, action button, and manual logging form', () => {
      const mockStartFocus = vi.fn();
      usePomodoroStore.setState({
        todayStats: {
          completed_today_count: 3,
          interrupted_today_count: 1,
          today_sessions: [
            { id: 1, status: 'completed', is_manual: false, started_at: '2026-10-26T10:00:00Z' },
            { id: 2, status: 'completed', is_manual: true, hour_of_day: 14 }
          ]
        },
        startFocus: mockStartFocus,
        createManualPomodoro: vi.fn(),
        deleteManualPomodoro: vi.fn(),
        isLoading: false,
      });

      render(<PomodoroPanel isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Pomodoro')).toBeDefined();
      expect(screen.getByText('3')).toBeDefined();
      expect(screen.getByText(/1 Interrupted/i)).toBeDefined();

      const startBtn = screen.getByText('Start Pomodoro');
      expect(startBtn).toBeDefined();
      fireEvent.click(startBtn);
      expect(mockStartFocus).toHaveBeenCalled();

      expect(screen.getByText('Log Manual Pomodoro')).toBeDefined();
      expect(screen.getByText('Today\'s Sessions')).toBeDefined();
      expect(screen.getByText('2:00 PM')).toBeDefined();
      expect(screen.getByText('Manual')).toBeDefined();
    });

    it('does not render when isOpen is false', () => {
      const { container } = render(<PomodoroPanel isOpen={false} onClose={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });

    it('filters manual hour dropdown based on reminders active window and selects closest hour on open', () => {
      vi.useFakeTimers();
      // Set current time to 06:30 AM (before the 09:00 - 17:00 window)
      vi.setSystemTime(new Date(2026, 9, 27, 6, 30, 0));

      useReminderStore.setState({
        userSettings: {
          dayStartTime: '09:00',
          dayEndTime: '17:00',
        },
      });

      const { rerender } = render(<PomodoroPanel isOpen={true} onClose={vi.fn()} />);

      // Closest hour in [9..17] to 6 is 9 (9:00 AM)
      const dropdownTrigger = screen.getByText('9:00 AM');
      expect(dropdownTrigger).toBeDefined();

      // Open dropdown options
      fireEvent.click(dropdownTrigger);

      // Should contain 9:00 AM and 5:00 PM, but not 8:00 AM or 6:00 PM
      expect(screen.getAllByText('9:00 AM').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('5:00 PM')).toBeDefined();
      expect(screen.queryByText('8:00 AM')).toBeNull();
      expect(screen.queryByText('6:00 PM')).toBeNull();

      // Change selection manually to 11:00 AM
      fireEvent.click(screen.getByText('11:00 AM'));
      expect(screen.getByText('11:00 AM')).toBeDefined();

      // Close panel, advance clock to 15:10 (3:10 PM), and reopen panel
      rerender(<PomodoroPanel isOpen={false} onClose={vi.fn()} />);
      vi.setSystemTime(new Date(2026, 9, 27, 15, 10, 0));
      rerender(<PomodoroPanel isOpen={true} onClose={vi.fn()} />);

      // Should reset to closest hour to current time (3:00 PM) when reopened
      expect(screen.getByText('3:00 PM')).toBeDefined();

      vi.useRealTimers();
    });

    it('computes active window hours including overnight ranges and circular closest hour', () => {
      // Standard daytime window
      expect(getActiveWindowHours('08:00', '12:00')).toEqual([8, 9, 10, 11, 12]);
      // Overnight window crossing midnight
      expect(getActiveWindowHours('22:00', '02:00')).toEqual([22, 23, 0, 1, 2]);
      // Closest hour calculation
      expect(getClosestHourInOptions(7, [9, 10, 11, 12])).toBe(9);
      expect(getClosestHourInOptions(23, [8, 9, 10, 20])).toBe(20);
    });
  });

  describe('PomodoroFocusOverlay', () => {
    it('renders Focus mode with 25:00 and calls interrupt on close', () => {
      const mockInterrupt = vi.fn();
      usePomodoroStore.setState({
        isOverlayOpen: true,
        activeSession: {
          id: 1,
          phase: 'focus',
          status: 'in_progress',
          remainingSeconds: 1500,
        },
        interruptPomodoro: mockInterrupt,
        closeOverlay: vi.fn(),
      });

      render(<PomodoroFocusOverlay />);

      expect(screen.getByText('Focus Time')).toBeDefined();
      expect(screen.getByText('25:00')).toBeDefined();

      const closeBtn = screen.getByTitle('Interrupt Pomodoro');
      fireEvent.click(closeBtn);
      expect(mockInterrupt).toHaveBeenCalled();
    });

    it('renders break prompt when focus finishes and triggers startBreak', () => {
      const mockStartBreak = vi.fn();
      usePomodoroStore.setState({
        isOverlayOpen: true,
        activeSession: {
          id: 1,
          phase: 'focus',
          status: 'completed',
          remainingSeconds: 0,
        },
        startBreak: mockStartBreak,
        closeOverlay: vi.fn(),
      });

      render(<PomodoroFocusOverlay />);

      expect(screen.getByText('Focus time finished')).toBeDefined();
      const breakBtn = screen.getByText('Start Break (5m)');
      fireEvent.click(breakBtn);
      expect(mockStartBreak).toHaveBeenCalled();
    });

    it('renders Break mode with muted style and countdown', () => {
      usePomodoroStore.setState({
        isOverlayOpen: true,
        activeSession: {
          id: 1,
          phase: 'break',
          status: 'completed',
          remainingSeconds: 300,
        },
        closeOverlay: vi.fn(),
      });

      render(<PomodoroFocusOverlay />);

      expect(screen.getByText('Break Time')).toBeDefined();
      expect(screen.getByText('05:00')).toBeDefined();
    });

    it('renders cycle completion congratulations message when done', () => {
      const mockClose = vi.fn();
      usePomodoroStore.setState({
        isOverlayOpen: true,
        activeSession: {
          id: 1,
          phase: 'done',
          status: 'completed',
          remainingSeconds: 0,
        },
        closeOverlay: mockClose,
      });

      render(<PomodoroFocusOverlay />);

      expect(screen.getByText('Pomodoro Completed!')).toBeDefined();
      const closeBtn = screen.getByText('Close');
      fireEvent.click(closeBtn);
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('TaskCard read-only under Pomodoro', () => {
    it('disables edit and completion interactions when pomodoro overlay is active', () => {
      const mockOnEditClick = vi.fn();
      const mockToggleComplete = vi.fn();
      useHabitStore.setState({
        toggleTaskCompletion: mockToggleComplete,
        language: 'en',
      });

      usePomodoroStore.setState({
        isOverlayOpen: true,
        activeSession: {
          id: 1,
          phase: 'focus',
          status: 'in_progress',
          remainingSeconds: 1500,
        },
      });

      const task = {
        id: 99,
        title: 'Do homework',
        completed: false,
        priority: 'frailejon',
        taskType: 'checkbox',
      };
      const column = { id: 'daily', type: 'daily' };

      render(
        <TaskCard
          task={task}
          column={column}
          dragHandleProps={{}}
          snapshot={{ isDragging: false }}
          onEditClick={mockOnEditClick}
        />
      );

      // Card touch should not open edit
      const titleElem = screen.getByText('Do homework');
      fireEvent.click(titleElem);
      expect(mockOnEditClick).not.toHaveBeenCalled();

      // Completion button should be disabled
      const completeBtn = screen.getByTitle('Mark as done');
      fireEvent.click(completeBtn);
      expect(mockToggleComplete).not.toHaveBeenCalled();
    });
  });
});
