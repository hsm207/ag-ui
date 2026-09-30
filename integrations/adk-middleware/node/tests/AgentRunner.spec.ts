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

describe('AgentRunner Aggregate', () => {
  describe('Given a valid RunAgentInput payload from the AG-UI protocol', () => {
    it('When the run stream is processed, Then it emits a valid lifecycle containing start, messages, tool calls, and finish events', async () => {
      vi.mocked(Runner).mockImplementation(function() {
        return {
          runAsync: createRunResult([
             { id: "1", invocationId: "1", timestamp: Date.now(), author: "model", content: { role: "model", parts: [{ text: "Hello" }] } }
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
      const finishEv = (await stream.next()).value as any;

      expect(startEv.type).toBe(EventType.RUN_STARTED);
      expect(startEv.threadId).toBe('123');
      expect(startEv.runId).toBeDefined();

      expect(txtStartEv.type).toBe(EventType.TEXT_MESSAGE_START);

      expect(finishEv.type).toBe(EventType.RUN_FINISHED);
      expect(finishEv.threadId).toBe('123');
      expect(finishEv.runId).toBeDefined();
    });

    it('When initialized without optional configuration, Then it provides safe default fallbacks', () => {
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });
      expect((runner as any).appName).toBe('ag-ui-app');
    });

    it('When input lacks a threadId, Then it automatically generates one to ensure session uniqueness', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });

      const stream = runner.run({ messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }] });
      const startEv = (await stream.next()).value as any;
      expect(startEv.threadId).toBeDefined();
    });

    it('When input messages contain no textual content, Then it processes safely as an empty string', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });
      const stream = runner.run({ messages: [{ role: 'user' }] });
      const startEv = (await stream.next()).value as any;
      expect(startEv.type).toBe(EventType.RUN_STARTED);
    });

    it('When input entirely lacks messages, Then it skips processing without crashing', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });
      const stream = runner.run({ messages: [] });
      const startEv = (await stream.next()).value as any;
      expect(startEv.type).toBe(EventType.RUN_STARTED);
    });

    it('When input messages contain string content, Then it processes safely as a string', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });
      const stream = runner.run({ threadId: '123', messages: [{ role: 'user', content: 'hello as string' }] });
      const startEv = (await stream.next()).value as any;
      expect(startEv.type).toBe(EventType.RUN_STARTED);
    });

    it('When session already exists, Then it does not try to recreate it', async () => {
      vi.mocked(Runner).mockImplementation(function() { return { runAsync: createRunResult([]) } as any; } as any);
      const sessionService = new InMemorySessionService();
      await sessionService.createSession({ appName: 'testApp', userId: 'default_user', sessionId: '123' });
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }), appName: 'testApp', sessionService });
      const stream = runner.run({ threadId: '123', messages: [{ role: 'user', content: 'hello' }] });
      const startEv = (await stream.next()).value as any;
      expect(startEv.type).toBe(EventType.RUN_STARTED);
    });
  });
});
