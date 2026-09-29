import { describe, it, expect } from 'vitest';
import { EventTranslator } from '../src/EventTranslator.js';

describe('EventTranslator Domain Service', () => {
  const translator = new EventTranslator();

  describe('Given an ADK Event payload', () => {
    it('When the event lacks content parts, Then it is safely ignored', () => {
      const iter = translator.translate({ id: '1', invocationId: '1', author: 'model', timestamp: 1 } as any);
      const results = Array.from(iter);
      expect(results.length).toBe(0);
    });

    it('When the event parts are empty, Then it is safely ignored', () => {
      const iter = translator.translate({ id: '1', invocationId: '1', author: 'model', timestamp: 1, content: { parts: [] } } as any);
      const results = Array.from(iter);
      expect(results.length).toBe(0);
    });

    it('When the event contains text, Then it translates to an AG-UI assistant_message event', () => {
      const iter = translator.translate({
        id: '1',
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ text: 'Hello' }] }
      } as any);
      const results = Array.from(iter);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('assistant_message');
    });

    it('When the event contains text without an id, Then it safely falls back to a generated ID', () => {
      const iter = translator.translate({
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ text: 'Hello' }] }
      } as any);
      const results = Array.from(iter);
      expect(results.length).toBe(1);
      expect((results[0] as any).message.id).toBeDefined();
    });

    it('When the event contains a functionCall, Then it translates to a full AG-UI Tool Calling lifecycle', () => {
      const iter = translator.translate({
        id: '1',
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ functionCall: { name: 'test', args: { a: 1 } } }] }
      } as any);
      const results = Array.from(iter);
      expect(results.length).toBe(3);
      expect(results[0].type).toBe('tool_call_start');
      expect(results[1].type).toBe('tool_call_args');
      expect(results[2].type).toBe('tool_call_end');
    });

    it('When the event contains a functionCall without args, Then it safely defaults to an empty object string', () => {
      const iter = translator.translate({
        id: '1',
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ functionCall: { name: 'test' } }] }
      } as any);
      const results = Array.from(iter);
      expect(results.length).toBe(3);
      expect((results[1] as any).args).toBe('{}');
    });

    it('When the event contains a functionCall without a name, Then it safely defaults to unknown', () => {
      const iter = translator.translate({
        id: '1',
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ functionCall: { args: { a: 1 } } }] }
      } as any);
      const results = Array.from(iter);
      expect(results.length).toBe(3);
      expect((results[0] as any).tool_name).toBe('unknown');
    });
  });
});
