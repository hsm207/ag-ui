import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner } from '../src/AgentRunner.js';
import { Agent, InMemorySessionService, Runner } from '@google/adk';
import { EventSchema } from '@ag-ui/core/schemas';
import { createAdkEndpoint } from '../src/AdkEndpoint.js';
import { EventTranslator } from '../src/EventTranslator.js';

vi.mock('@google/adk', async (importOriginal) => {
  const mod = await importOriginal() as any;
  return {
    ...mod,
    Runner: vi.fn()
  };
});

const REAL_ADK_EVENTS = [
  { id: "wkLTkC7z", invocationId: "1", author: "model", content: { role: "model", parts: [{ text: "Hello" }] }, timestamp: 1790699914533 },
  { id: "wkLTkC7y", invocationId: "2", author: "model", content: { role: "model", parts: [{ functionCall: { name: "test_tool", args: { param: "value" } } }] }, timestamp: 1790699914534 }
];

function createRunResult(events: any[]) {
  return async function* () {
    for (const ev of events) yield ev;
  };
}

function createMockResponse() {
  const chunks: string[] = [];
  return {
    setHeader: () => {},
    status: () => ({ send: () => {} }),
    write: (chunk: string) => { chunks.push(chunk); },
    end: () => {},
    _getChunks: () => chunks
  } as any;
}

describe('Full Pipeline Protocol Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Given the full Express-to-ADK stream', () => {

    it('When processing a full mock ADK lifecycle, Then every emitted event passes strict wire schema validation', async () => {
      vi.mocked(Runner).mockImplementation(function() {
        return { runAsync: createRunResult(REAL_ADK_EVENTS) } as any;
      } as any);

      const handler = createAdkEndpoint({ agent: new Agent({ name: 'test', instruction: 't' }), appName: 'testApp', sessionService: new InMemorySessionService() });
      const res = createMockResponse();

      await handler({ body: { threadId: "test-thread", messages: [{ role: "user", content: "hi" }] } } as any, res);

      const streamChunks = res._getChunks();
      expect(streamChunks.length).toBeGreaterThan(0);

      for (const chunk of streamChunks) {
        const eventJson = chunk.replace('data: ', '').trim();
        const eventObj = JSON.parse(eventJson);
        expect(() => EventSchema.parse(eventObj)).not.toThrow();
      }
    });

    it('When the domain forcibly errors out, Then the emitted RUN_ERROR event passes strict schema validation', async () => {
      vi.mocked(Runner).mockImplementation(function() {
        return { runAsync: async function*() { throw new Error('Domain crashed'); }() } as any;
      } as any);

      const handler = createAdkEndpoint({ agent: new Agent({ name: 'test', instruction: 't' }), appName: 'testApp', sessionService: new InMemorySessionService() });
      const res = createMockResponse();

      await handler({ body: { threadId: "test-thread", messages: [{ role: "user", content: "hi" }] } } as any, res);

      const streamChunks = res._getChunks();
      expect(streamChunks.length).toBe(1);

      const eventJson = streamChunks[0].replace('data: ', '').trim();
      const eventObj = JSON.parse(eventJson);

      expect(eventObj.type).toBe('RUN_ERROR');
      expect(() => EventSchema.parse(eventObj)).not.toThrow();
    });

  });

  describe('Given negative protocol sabotages', () => {
    it('When a required field (messageId) is dropped from the translated event, Then EventSchema validation fails', () => {
      const translator = new EventTranslator();
      const validIter = translator.translate(REAL_ADK_EVENTS[0], "run-1");
      const validEvents = Array.from(validIter) as any[];
      const contentEvent = validEvents.find(e => e.type === 'TEXT_MESSAGE_CONTENT');

      const malformedEvent = { ...contentEvent };
      delete malformedEvent.messageId;

      expect(() => EventSchema.parse(malformedEvent)).toThrow();
    });

    it('When a field has the wrong type (timestamp as string), Then EventSchema validation fails', () => {
      const translator = new EventTranslator();
      const validIter = translator.translate(REAL_ADK_EVENTS[0], "run-1");
      const validEvents = Array.from(validIter) as any[];
      const contentEvent = validEvents.find(e => e.type === 'TEXT_MESSAGE_CONTENT');

      const malformedEvent = { ...contentEvent, timestamp: "1790699914533" };

      expect(() => EventSchema.parse(malformedEvent)).toThrow();
    });

    it('When RUN_FINISHED emits an invalid outcome type, Then EventSchema validation fails', () => {
      const malformedEvent = {
        type: 'RUN_FINISHED',
        runId: 'run-1',
        threadId: 'thread-1',
        timestamp: 123456789,
        outcome: { type: 'nope' }
      };

      expect(() => EventSchema.parse(malformedEvent)).toThrow();
    });
  });

  describe('Given a tool-calling stream', () => {
    it('When a functionCall is emitted, Then the lifecycle sequencing enforces START -> ARGS -> END', async () => {
      vi.mocked(Runner).mockImplementation(function() {
        return { runAsync: createRunResult([REAL_ADK_EVENTS[1]]) } as any;
      } as any);

      const handler = createAdkEndpoint({ agent: new Agent({ name: 'test', instruction: 't' }), appName: 'testApp', sessionService: new InMemorySessionService() });
      const res = createMockResponse();

      await handler({ body: { threadId: "test-thread", messages: [{ role: "user", content: "hi" }] } } as any, res);

      const streamChunks = res._getChunks();
      const agUiEvents = streamChunks.map((chunk: string) => JSON.parse(chunk.replace('data: ', '').trim()));

      const toolStartIdx = agUiEvents.findIndex((e: any) => e.type === 'TOOL_CALL_START');
      const toolArgsIdx = agUiEvents.findIndex((e: any) => e.type === 'TOOL_CALL_ARGS');
      const toolEndIdx = agUiEvents.findIndex((e: any) => e.type === 'TOOL_CALL_END');

      expect(toolStartIdx).toBeGreaterThan(-1);
      expect(toolArgsIdx).toBeGreaterThan(toolStartIdx);
      expect(toolEndIdx).toBeGreaterThan(toolArgsIdx);
    });
  });
});
