import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingSkeleton } from './LoadingSkeleton';

describe('LoadingSkeleton Component', () => {
  it('renders correctly', () => {
    const { container } = render(<LoadingSkeleton />);
    
    // Check if it has the animate-pulse class
    expect(container.firstChild).toHaveClass('animate-pulse');
    
    // Check if it renders 3 skeleton items
    const skeletonItems = container.querySelectorAll('.bg-paramo-card\\/50');
    expect(skeletonItems.length).toBe(3);
  });
});
