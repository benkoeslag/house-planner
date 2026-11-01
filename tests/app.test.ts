import { describe, expect, it } from 'vitest';
import { APP_NAME } from '../src/app';

describe('app shell', () => {
  it('names the app', () => {
    expect(APP_NAME).toBe('House Planner');
  });
});
