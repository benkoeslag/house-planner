import { describe, expect, it } from 'vitest';
import { APP_NAME, placeholderMessage } from '../src/app';

describe('app shell', () => {
  it('names the app', () => {
    expect(APP_NAME).toBe('House Planner');
  });

  it('shows a placeholder until the editor exists', () => {
    expect(placeholderMessage()).toContain('nothing drawn yet');
  });
});
