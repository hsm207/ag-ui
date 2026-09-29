import { describe, it, expect } from 'vitest';
import { EventTranslator } from '../src/EventTranslator.js';
import { EventType } from '@ag-ui/core';

/**
 * Tests for the EventTranslator Domain Service.
 * Validates the translation pipeline from ADK events to AG-UI events.
 */
describe('EventTranslator Domain Service', () => {
  const translator = new EventTranslator();

  describe('Given an ADK Event payload', () => {
    /**
     * Verifies graceful handling of malformed parts.
     */
    it('When the event lacks content parts, Then it is safely ignored', () => {
      const iter = translator.translate({ id: '1', invocationId: '1', author: 'model', timestamp: 1 } as any, 'run-1');
      const results = Array.from(iter);
      expect(results.length).toBe(0);
    });

    /**
     * Verifies graceful handling of empty parts.
     */
    it('When the event parts are empty, Then it is safely ignored', () => {
      const iter = translator.translate({ id: '1', invocationId: '1', author: 'model', timestamp: 1, content: { parts: [] } } as any, 'run-1');
      const results = Array.from(iter);
      expect(results.length).toBe(0);
    });

    /**
     * Verifies text payload translation into 3 lifecycle events.
     */
    it('When the event contains text, Then it translates to an AG-UI text message lifecycle', () => {
      const iter = translator.translate({
        id: '1',
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ text: 'Hello' }] }
      } as any, 'run-1');

      const results = Array.from(iter) as any[];

      expect(results.length).toBe(3);
      expect(results[0].type).toBe(EventType.TEXT_MESSAGE_START);
      expect(results[1].type).toBe(EventType.TEXT_MESSAGE_CONTENT);
      expect(results[2].type).toBe(EventType.TEXT_MESSAGE_END);
    });

    /**
     * Verifies missing ID fallback logic for text payloads.
     */
    it('When the event contains text without an id, Then it safely falls back to a generated ID', () => {
      const iter = translator.translate({
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ text: 'Hello' }] }
      } as any, 'run-1');

      const results = Array.from(iter) as any[];

      expect(results.length).toBe(3);
      expect(results[0].messageId).toBeDefined();
    });

    /**
     * Verifies function call payload translates into three discrete lifecycle events.
     */
    it('When the event contains a functionCall, Then it translates to a full AG-UI Tool Calling lifecycle', () => {
      const iter = translator.translate({
        id: '1',
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ functionCall: { name: 'test', args: { a: 1 } } }] }
      } as any, 'run-1');

      const results = Array.from(iter) as any[];

      expect(results.length).toBe(3);
      expect(results[0].type).toBe(EventType.TOOL_CALL_START);
      expect(results[1].type).toBe(EventType.TOOL_CALL_ARGS);
      expect(results[2].type).toBe(EventType.TOOL_CALL_END);
    });

    /**
     * Verifies args defaults for function calls.
     */
    it('When the event contains a functionCall without args, Then it safely defaults to an empty object string', () => {
      const iter = translator.translate({
        id: '1',
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ functionCall: { name: 'test' } }] }
      } as any, 'run-1');

      const results = Array.from(iter) as any[];

      expect(results.length).toBe(3);
      expect(results[1].delta).toBe('{}');
    });

    /**
     * Verifies name defaults for function calls.
     */
    it('When the event contains a functionCall without a name, Then it safely defaults to unknown', () => {
      const iter = translator.translate({
        id: '1',
        invocationId: '1',
        author: 'model',
        timestamp: 1,
        content: { parts: [{ functionCall: { args: { a: 1 } } }] }
      } as any, 'run-1');

      const results = Array.from(iter) as any[];

      expect(results.length).toBe(3);
      expect(results[0].toolName).toBe('unknown');
    });
  });
});
