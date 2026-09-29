import { describe, it, expect } from 'vitest';
import { ContextStateMapper } from '../src/ContextState.js';

describe('ContextStateMapper', () => {
  describe('Given an AG-UI Context array', () => {
    it('When the array is populated with valid context data, Then it maps to a well-formed ADK State object', () => {
      const context = [
        { description: 'app', value: 'my_app' },
        { description: 'user', value: 'john' }
      ];

      const state = ContextStateMapper.mapToAdkState(context);

      expect(state).toHaveProperty(ContextStateMapper.CONTEXT_STATE_KEY);
      expect(state[ContextStateMapper.CONTEXT_STATE_KEY]).toEqual(context);
    });

    it('When the array is empty, Then it maps to an empty object representation without errors', () => {
      const state = ContextStateMapper.mapToAdkState([]);
      expect(state).toEqual({});
    });

    it('When the array is null or undefined, Then it safely falls back to an empty object representation', () => {
      const state = ContextStateMapper.mapToAdkState(null as any);
      expect(state).toEqual({});
    });
  });
});
