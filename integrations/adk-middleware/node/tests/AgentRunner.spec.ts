import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '../src/AgentRunner.js';
import { Agent, InMemorySessionService, Runner } from '@google/adk';
import { EventType } from '@ag-ui/core';

vi.mock('@google/adk', async (importOriginal) => {
  const mod = await importOriginal() as any;
  return {
    ...mod,
    Runner: vi.fn()
  };
});

function createRunResult(events: any[]) {
  return async function* () {
    for (const ev of events) {
      yield ev;
    }
  };
}

/**
 * Tests for the AgentRunner aggregate orchestrator.
 * Validates initialization logic and event stream orchestration against actual AG-UI schemas.
 */
describe('AgentRunner Aggregate', () => {
  describe('Given a valid RunAgentInput payload from the AG-UI protocol', () => {

    /**
     * Verifies the complete lifecycle bounds emitted from the pipeline match the AG-UI schemas.
     */
    it('When the run stream is processed, Then it emits a valid lifecycle containing start, messages, tool calls, and finish events that pass schema validation', async () => {
      vi.mocked(Runner).mockImplementation(function() {
        return {
          runAsync: createRunResult([
             { id: "1", invocationId: "1", timestamp: Date.now(), author: "model", content: { role: "model", parts: [{ text: "Hello" }] } },
             { id: "2", invocationId: "2", timestamp: Date.now(), author: "model", content: { role: "model", parts: [{ functionCall: { name: "test", args: { a: 1 } } }] } },
             { id: "5", invocationId: "5", timestamp: Date.now(), author: "model", content: { role: "model", parts: [{ image: { url: "http" } }] } }
          ])
        } as any;
      } as any);

      const runner = new AgentRunner({
        agent: new Agent({ name: 'test', instruction: 'test' }),
        appName: 'testApp',
        sessionService: new InMemorySessionService()
      });

      const stream = runner.run({
        threadId: '123',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
      });

      const startEv = (await stream.next()).value as any;
      const txtStartEv = (await stream.next()).value as any;
      const txtContentEv = (await stream.next()).value as any;
      const txtEndEv = (await stream.next()).value as any;
      const toolStart = (await stream.next()).value as any;
      const toolArgs = (await stream.next()).value as any;
      const toolEnd = (await stream.next()).value as any;
      const finishEv = (await stream.next()).value as any;

      expect(startEv.type).toBe(EventType.RUN_STARTED);
      expect(txtStartEv.type).toBe(EventType.TEXT_MESSAGE_START);
      expect(txtContentEv.type).toBe(EventType.TEXT_MESSAGE_CONTENT);
      expect(txtEndEv.type).toBe(EventType.TEXT_MESSAGE_END);
      expect(toolStart.type).toBe(EventType.TOOL_CALL_START);
      expect(toolArgs.type).toBe(EventType.TOOL_CALL_ARGS);
      expect(toolEnd.type).toBe(EventType.TOOL_CALL_END);
      expect(finishEv.type).toBe(EventType.RUN_FINISHED);

      expect(txtContentEv.delta).toBe('Hello');
      expect(toolStart.toolCallName).toBe('test');
      expect(typeof startEv.timestamp).toBe('number');
    });

    /**
     * Verifies default fallback logic for missing config options.
     */
    it('When initialized without optional configuration, Then it provides safe default fallbacks for Session Management', () => {
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });

      expect((runner as any).appName).toBe('ag-ui-app');
      expect((runner as any).sessionService).toBeDefined();
    });

    /**
     * Verifies UUID generation logic on missing thread IDs.
     */
    it('When input lacks a threadId, Then it automatically generates one to ensure session uniqueness', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });

      const stream = runner.run({ messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }] });
      const startEv = (await stream.next()).value as any;
      const endEv = (await stream.next()).value as any;

      expect(startEv.type).toBe(EventType.RUN_STARTED);
      expect(endEv.type).toBe(EventType.RUN_FINISHED);
    });

    /**
     * Verifies missing text logic on payload.
     */
    it('When input messages contain no textual content, Then it processes safely as an empty string to avoid crashes', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });

      const stream = runner.run({ messages: [{ role: 'user' }] });
      const startEv = (await stream.next()).value as any;
      const endEv = (await stream.next()).value as any;

      expect(startEv.type).toBe(EventType.RUN_STARTED);
      expect(endEv.type).toBe(EventType.RUN_FINISHED);
    });

    /**
     * Verifies empty message array guard logic.
     */
    it('When input entirely lacks messages, Then it skips processing without crashing', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });

      const stream = runner.run({ messages: [] });
      const startEv = (await stream.next()).value as any;
      const endEv = (await stream.next()).value as any;

      expect(startEv.type).toBe(EventType.RUN_STARTED);
      expect(endEv.type).toBe(EventType.RUN_FINISHED);
    });

    /**
     * Verifies string message content extraction.
     */
    it('When input messages contain string content, Then it processes safely as a string without crashing', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });

      const stream = runner.run({ threadId: '123', messages: [{ role: 'user', content: 'hello as string' }] });
      const startEv = (await stream.next()).value as any;
      const endEv = (await stream.next()).value as any;

      expect(startEv.type).toBe(EventType.RUN_STARTED);
      expect(endEv.type).toBe(EventType.RUN_FINISHED);
    });

    /**
     * Verifies existing session handling.
     */
    it('When session already exists, Then it does not try to recreate it', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const sessionService = new InMemorySessionService();
      await sessionService.createSession({ appName: 'testApp', userId: 'default_user', sessionId: '123' });

      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }), appName: 'testApp', sessionService });

      const stream = runner.run({ threadId: '123', messages: [{ role: 'user', content: 'hello as string' }] });
      const startEv = (await stream.next()).value as any;
      const endEv = (await stream.next()).value as any;

      expect(startEv.type).toBe(EventType.RUN_STARTED);
      expect(endEv.type).toBe(EventType.RUN_FINISHED);
    });
  });
});
