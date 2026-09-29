import { describe, it, expect } from 'vitest';
import { ContextStateMapper } from '../src/ContextState.js';

/**
 * Tests for the ContextStateMapper value object.
 * Validates the pure transformation of AG-UI contexts into ADK state dictionaries.
 */
describe('ContextStateMapper', () => {
  describe('Given an AG-UI Context array', () => {
    /**
     * Verifies successful mapping of valid context values.
     */
    it('When the array is populated with valid context data, Then it maps to a well-formed ADK State object', () => {
      const context = [
        { description: 'app', value: 'my_app' },
        { description: 'user', value: 'john' }
      ];

      const state = ContextStateMapper.mapToAdkState(context);

      expect(state).toHaveProperty(ContextStateMapper.CONTEXT_STATE_KEY);
      expect(state[ContextStateMapper.CONTEXT_STATE_KEY]).toEqual(context);
    });

    /**
     * Verifies boundary mapping for an empty array.
     */
    it('When the array is empty, Then it maps to an empty object representation without errors', () => {
      const emptyContext: any[] = [];

      const state = ContextStateMapper.mapToAdkState(emptyContext);

      expect(state).toEqual({});
    });

    /**
     * Verifies boundary mapping for null safety.
     */
    it('When the array is null or undefined, Then it safely falls back to an empty object representation', () => {
      const nullContext: any = null;

      const state = ContextStateMapper.mapToAdkState(nullContext);

      expect(state).toEqual({});
    });
  });
});
