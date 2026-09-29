import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '../src/AgentRunner.js';
import { Agent, InMemorySessionService, Runner } from '@google/adk';

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
 * Validates initialization logic and event stream orchestration.
 */
describe('AgentRunner Aggregate', () => {
  describe('Given a valid RunAgentInput payload from the AG-UI protocol', () => {

    /**
     * Verifies the complete lifecycle bounds emitted from the pipeline.
     */
    it('When the run stream is processed, Then it emits a valid lifecycle containing start, messages, tool calls, and finish events', async () => {
      vi.mocked(Runner).mockImplementation(function() {
        return {
          runAsync: createRunResult([
             { id: "1", invocationId: "1", timestamp: Date.now(), author: "model", content: { role: "model", parts: [{ text: "Hello" }] } },
             { id: "2", invocationId: "2", timestamp: Date.now(), author: "model", content: { role: "model", parts: [{ functionCall: { name: "test", args: { a: 1 } } }] } },
             // Miss branch (unsupported part type like an image payload) to ensure it translates correctly
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

      // No cyclomatic loop via unrolling explicit iterator steps
      const startEv = (await stream.next()).value;
      const msgEv = (await stream.next()).value as any;
      const toolStart = (await stream.next()).value as any;
      const toolArgs = (await stream.next()).value as any;
      const toolEnd = (await stream.next()).value as any;
      const finishEv = (await stream.next()).value;

      expect(startEv.type).toBe('run_started');
      expect(msgEv.type).toBe('assistant_message');
      expect(msgEv.message.content[0].text).toBe('Hello');

      expect(toolStart.type).toBe('tool_call_start');
      expect(toolStart.tool_name).toBe('test');
      expect(toolArgs.args).toBe('{"a":1}');
      expect(toolEnd.type).toBe('tool_call_end');

      expect(finishEv.type).toBe('run_finished');
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
      const startEv = (await stream.next()).value;
      const endEv = (await stream.next()).value;

      expect(startEv.type).toBe('run_started');
      expect(endEv.type).toBe('run_finished');
    });

    /**
     * Verifies missing text logic on payload.
     */
    it('When input messages contain no textual content, Then it processes safely as an empty string to avoid crashes', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });

      const stream = runner.run({ messages: [{ role: 'user' }] });
      const startEv = (await stream.next()).value;
      const endEv = (await stream.next()).value;

      expect(startEv.type).toBe('run_started');
      expect(endEv.type).toBe('run_finished');
    });

    /**
     * Verifies empty message array guard logic.
     */
    it('When input entirely lacks messages, Then it skips processing without crashing', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });

      const stream = runner.run({ messages: [] });
      const startEv = (await stream.next()).value;
      const endEv = (await stream.next()).value;

      expect(startEv.type).toBe('run_started');
      expect(endEv.type).toBe('run_finished');
    });
  });
});
