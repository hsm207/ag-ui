import { describe, it, expect, vi } from 'vitest';

vi.mock('@google/adk', async (importOriginal) => {
  const mod = await importOriginal() as any;
  return {
    ...mod,
    Runner: class {
      constructor() {}
      async *runAsync() {
         // Assistant Message Event
         yield {
           id: "1",
           invocationId: "1",
           timestamp: Date.now(),
           author: "model",
           content: { role: "model", parts: [{ text: "Hello from agent" }] }
         };
         // Generative UI / Tool Call Event with ID and args
         yield {
           id: "2",
           invocationId: "2",
           timestamp: Date.now(),
           author: "model",
           content: { role: "model", parts: [{ functionCall: { name: "test_tool", args: { a: 1 } } }] }
         };
         // Generative UI / Tool Call Event missing ID and args to test fallback coverage
         yield {
           invocationId: "2b",
           timestamp: Date.now(),
           author: "model",
           content: { role: "model", parts: [{ functionCall: { name: "test_tool2" } }] }
         };
         // Miss branch (empty content)
         yield {
           id: "3",
           invocationId: "3",
           timestamp: Date.now(),
           author: "model"
         };
         // Miss branch (empty parts)
         yield {
           id: "4",
           invocationId: "4",
           timestamp: Date.now(),
           author: "model",
           content: { role: "model", parts: [] }
         };
         // Miss branch (unsupported part type)
         yield {
           id: "5",
           invocationId: "5",
           timestamp: Date.now(),
           author: "model",
           content: { role: "model", parts: [{ image: { url: "http" } }] }
         };
      }
    }
  };
});

import { AgentRunner } from '../src/AgentRunner.js';
import { Agent, InMemorySessionService } from '@google/adk';

describe('AgentRunner Aggregate', () => {
  describe('Given a valid RunAgentInput payload from the AG-UI protocol', () => {
    it('When the run stream is processed, Then it emits a valid lifecycle containing start, messages, tool calls, and finish events', async () => {
      const mockAgent = new Agent({ name: 'test', instruction: 'test' });
      const runner = new AgentRunner({
        agent: mockAgent,
        appName: 'testApp',
        sessionService: new InMemorySessionService()
      });

      const stream = runner.run({
        threadId: '123',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }, { type: 'image_url', image_url: {url: "http"} }] }]
      });

      const events = [];
      for await (const ev of stream) {
        events.push(ev);
      }

      // Assert basic lifecycle
      expect(events.length).toBeGreaterThanOrEqual(4);
      expect(events[0].type).toBe('run_started');
      expect(events[events.length - 1].type).toBe('run_finished');

      // Assert text mapping
      const msgEvent = events.find(e => e.type === 'assistant_message') as any;
      expect(msgEvent).toBeDefined();
      expect(msgEvent.message.content[0].text).toBe('Hello from agent');

      // Assert Tool Calling capabilities (Generative UI)
      const toolStarts = events.filter(e => e.type === 'tool_call_start') as any;
      expect(toolStarts.length).toBe(2);
      expect(toolStarts[0].tool_name).toBe('test_tool');

      const toolArgs = events.find(e => e.type === 'tool_call_args') as any;
      expect(toolArgs).toBeDefined();
      expect(toolArgs.args).toBe('{"a":1}');

      // The second tool call has missing args, which defaults to '{}'
      const toolArgs2 = events.filter(e => e.type === 'tool_call_args')[1] as any;
      expect(toolArgs2).toBeDefined();
      expect(toolArgs2.args).toBe('{}');
    });

    it('When initialized without optional configuration, Then it provides safe default fallbacks for Session Management', () => {
      const mockAgent = new Agent({ name: 'test', instruction: 'test' });
      const runner = new AgentRunner({ agent: mockAgent });
      expect((runner as any).appName).toBe('ag-ui-app');
      expect((runner as any).sessionService).toBeDefined();
    });

    it('When input lacks a threadId, Then it automatically generates one to ensure session uniqueness', async () => {
      const mockAgent = new Agent({ name: 'test', instruction: 'test' });
      const runner = new AgentRunner({
        agent: mockAgent,
      });

      const stream = runner.run({
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
      });

      const events = [];
      for await (const ev of stream) {
        events.push(ev);
      }

      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('When input messages contain no textual content, Then it processes safely as an empty string to avoid crashes', async () => {
      const mockAgent = new Agent({ name: 'test', instruction: 'test' });
      const runner = new AgentRunner({
        agent: mockAgent,
      });

      const stream = runner.run({
        messages: [{ role: 'user' }]
      });

      const events = [];
      for await (const ev of stream) {
        events.push(ev);
      }

      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('When input entirely lacks messages, Then it skips processing without crashing', async () => {
      const mockAgent = new Agent({ name: 'test', instruction: 'test' });
      const runner = new AgentRunner({
        agent: mockAgent,
      });

      const stream = runner.run({
        messages: []
      });

      const events = [];
      for await (const ev of stream) {
        events.push(ev);
      }

      expect(events.length).toBeGreaterThanOrEqual(2);
    });
  });
});
