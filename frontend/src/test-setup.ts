import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global localStorage Mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: 0,
    key: () => null,
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock canvas-confetti to prevent jsdom canvas errors
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));
