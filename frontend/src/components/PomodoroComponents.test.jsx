import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PomodoroPanel } from './PomodoroPanel';
import { PomodoroFocusOverlay } from './PomodoroFocusOverlay';
import { TaskCard } from './TaskCard';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { useHabitStore } from '../store/useHabitStore';

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
      expect(screen.getByText(/2:00 PM · Manual/i)).toBeDefined();
    });

    it('does not render when isOpen is false', () => {
      const { container } = render(<PomodoroPanel isOpen={false} onClose={vi.fn()} />);
      expect(container.firstChild).toBeNull();
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
