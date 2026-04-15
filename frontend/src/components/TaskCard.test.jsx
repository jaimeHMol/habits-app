import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from './TaskCard';
import { useHabitStore } from '../store/useHabitStore';

// Mock the store
vi.mock('../store/useHabitStore', () => ({
  useHabitStore: vi.fn(),
}));

describe('TaskCard Component', () => {
  const mockToggleCollapse = vi.fn();
  const mockToggleTaskCompletion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useHabitStore.mockReturnValue({
      toggleCollapse: mockToggleCollapse,
      toggleTaskCompletion: mockToggleTaskCompletion,
    });
  });

  const defaultTask = {
    id: 1,
    title: 'Test Task',
    description: 'Test Description',
    completed: false,
    isCollapsed: true,
    priority: 'muted',
  };

  const defaultColumn = {
    id: 'daily',
    type: 'daily',
  };

  const defaultSnapshot = {
    isDragging: false,
  };

  it('renders task title correctly', () => {
    render(
      <TaskCard 
        task={defaultTask} 
        column={defaultColumn} 
        snapshot={defaultSnapshot} 
        dragHandleProps={{}} 
      />
    );
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('shows description when not collapsed', () => {
    const uncollapsedTask = { ...defaultTask, isCollapsed: false };
    render(
      <TaskCard 
        task={uncollapsedTask} 
        column={defaultColumn} 
        snapshot={defaultSnapshot} 
        dragHandleProps={{}} 
      />
    );
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders markdown in description correctly', () => {
    const markdownTask = { 
      ...defaultTask, 
      isCollapsed: false, 
      description: 'Check this **bold** text and [this link](https://google.com)' 
    };
    render(
      <TaskCard 
        task={markdownTask} 
        column={defaultColumn} 
        snapshot={defaultSnapshot} 
        dragHandleProps={{}} 
      />
    );
    
    expect(screen.getByText('bold')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /this link/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://google.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not show description when collapsed', () => {
    render(
      <TaskCard 
        task={defaultTask} 
        column={defaultColumn} 
        snapshot={defaultSnapshot} 
        dragHandleProps={{}} 
      />
    );
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  it('calls toggleTaskCompletion when completion button is clicked', () => {
    render(
      <TaskCard 
        task={defaultTask} 
        column={defaultColumn} 
        snapshot={defaultSnapshot} 
        dragHandleProps={{}} 
      />
    );
    
    const completeButton = screen.getByTitle('Mark as done');
    fireEvent.click(completeButton);
    
    expect(mockToggleTaskCompletion).toHaveBeenCalledWith(defaultTask.id);
  });

  it('calls toggleCollapse when collapse button is clicked', () => {
    render(
      <TaskCard 
        task={defaultTask} 
        column={defaultColumn} 
        snapshot={defaultSnapshot} 
        dragHandleProps={{}} 
      />
    );
    
    // The collapse button contains the Chevron icon. 
    // It's the second button in the right action group usually.
    // Let's find it by looking for the one that isn't the completion button.
    const buttons = screen.getAllByRole('button');
    // TaskCard has: 1. Completion button, 2. Collapse button
    const collapseButton = buttons[1];
    
    fireEvent.click(collapseButton);
    
    expect(mockToggleCollapse).toHaveBeenCalledWith(defaultTask.id);
  });
});
