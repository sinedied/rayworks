import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

global.ResizeObserver = class implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
for (const method of ['setPointerCapture', 'releasePointerCapture', 'scrollIntoView']) {
  Object.defineProperty(HTMLElement.prototype, method, {
    configurable: true,
    value: () => {},
  });
}
Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
});

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: function (key: string) {
    return this.store[key] || null;
  },
  setItem: function (key: string, value: string) {
    this.store[key] = value.toString();
  },
  removeItem: function (key: string) {
    delete this.store[key];
  },
  clear: function () {
    this.store = {};
  },
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// Clear localStorage before each test
beforeEach(() => {
  localStorageMock.clear();
});
