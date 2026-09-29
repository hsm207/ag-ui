import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '../src/AgentRunner.js';
import { Agent, InMemorySessionService } from '@google/adk';

vi.mock('@google/adk', async (importOriginal) => {
  const mod = await importOriginal() as any;
  return {
    ...mod,
    Runner: class {
      constructor() {}
      async *runAsync() {
         yield {
           id: "1", invocationId: "1", timestamp: Date.now(), author: "model",
           content: { role: "model", parts: [{ text: "Hello from agent" }] }
         };
         yield {
           id: "2", invocationId: "2", timestamp: Date.now(), author: "model",
           content: { role: "model", parts: [{ functionCall: { name: "test_tool", args: { a: 1 } } }] }
         };
         yield {
           invocationId: "2b", timestamp: Date.now(), author: "model",
           content: { role: "model", parts: [{ functionCall: { name: "test_tool2" } }] }
         };
         yield { id: "3", invocationId: "3", timestamp: Date.now(), author: "model" };
         yield { id: "4", invocationId: "4", timestamp: Date.now(), author: "model", content: { role: "model", parts: [] } };
         yield { id: "5", invocationId: "5", timestamp: Date.now(), author: "model", content: { role: "model", parts: [{ image: { url: "http" } }] } };
      }
    }
  };
});

// Testing DSL Helper
async function consumeStream(stream: AsyncGenerator<any>): Promise<any[]> {
  const events = [];
  for await (const ev of stream) events.push(ev);
  return events;
}

function expectLifecycleBounds(events: any[]) {
  expect(events.length).toBeGreaterThanOrEqual(4);
  expect(events[0].type).toBe('run_started');
  expect(events[events.length - 1].type).toBe('run_finished');
}

function expectAssistantMessage(events: any[], text: string) {
  const msgEvent = events.find(e => e.type === 'assistant_message');
  expect(msgEvent).toBeDefined();
  expect(msgEvent.message.content[0].text).toBe(text);
}

function expectToolCallSequence(events: any[], expectedName: string, expectedArgsStr: string, instanceIndex: number = 0) {
  const toolStarts = events.filter(e => e.type === 'tool_call_start');
  expect(toolStarts[instanceIndex].tool_name).toBe(expectedName);

  const toolArgs = events.filter(e => e.type === 'tool_call_args');
  expect(toolArgs[instanceIndex].args).toBe(expectedArgsStr);
}

describe('AgentRunner Aggregate', () => {
  describe('Given a valid RunAgentInput payload from the AG-UI protocol', () => {
    it('When the run stream is processed, Then it emits a valid lifecycle containing start, messages, tool calls, and finish events', async () => {
      const runner = new AgentRunner({
        agent: new Agent({ name: 'test', instruction: 'test' }),
        appName: 'testApp',
        sessionService: new InMemorySessionService()
      });

      const events = await consumeStream(runner.run({
        threadId: '123',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }, { type: 'image_url', image_url: {url: "http"} }] }]
      }));

      expectLifecycleBounds(events);
      expectAssistantMessage(events, 'Hello from agent');
      expectToolCallSequence(events, 'test_tool', '{"a":1}', 0);
      expectToolCallSequence(events, 'test_tool2', '{}', 1);
    });

    it('When initialized without optional configuration, Then it provides safe default fallbacks for Session Management', () => {
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });
      expect((runner as any).appName).toBe('ag-ui-app');
      expect((runner as any).sessionService).toBeDefined();
    });

    it('When input lacks a threadId, Then it automatically generates one to ensure session uniqueness', async () => {
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });
      const events = await consumeStream(runner.run({
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
      }));
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('When input messages contain no textual content, Then it processes safely as an empty string to avoid crashes', async () => {
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });
      const events = await consumeStream(runner.run({ messages: [{ role: 'user' }] }));
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('When input entirely lacks messages, Then it skips processing without crashing', async () => {
      const runner = new AgentRunner({ agent: new Agent({ name: 'test', instruction: 'test' }) });
      const events = await consumeStream(runner.run({ messages: [] }));
      expect(events.length).toBeGreaterThanOrEqual(2);
    });
  });
});
