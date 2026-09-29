import { describe, it, expect, vi } from 'vitest';
import { createAdkEndpoint } from '../src/AdkEndpoint.js';
import { AgentRunner } from '../src/AgentRunner.js';

vi.mock('../src/AgentRunner.js');

const STATUS_BAD_REQUEST = 400;

function createMockResponse() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
    write: vi.fn(),
    end: vi.fn()
  } as any;
}

/**
 * Tests the AdkEndpoint Infrastructure Adapter.
 * Validates HTTP bridging and SSE stream serialization.
 */
describe('ExpressAdapter (AdkEndpoint)', () => {
  describe('Given an incoming HTTP Request to the integration endpoint', () => {

    /**
     * Verifies invalid schema rejection logic.
     */
    it('When the payload lacks the required RunAgentInput schema, Then it returns an immediate 400 Bad Request', async () => {
      const handler = createAdkEndpoint({});
      const req = { body: {} } as any;
      const res = createMockResponse();

      await handler(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.status).toHaveBeenCalledWith(STATUS_BAD_REQUEST);
      expect(res.send).toHaveBeenCalledWith('Invalid RunAgentInput');
    });

    /**
     * Verifies standard successful streaming execution.
     */
    it('When the payload is valid, Then it establishes a Server-Sent Events (SSE) connection and streams the lifecycle', async () => {
      vi.mocked(AgentRunner).mockImplementation(function() {
        return {
          run: async function* () {
            yield { type: 'RUN_STARTED' };
            yield { type: 'RUN_FINISHED' };
          }
        } as any;
      } as any);

      const handler = createAdkEndpoint({ extractHeaders: ['x-user-id'] });
      const req = { body: { messages: [{}] }, threadId: 'thread1' } as any;
      const res = createMockResponse();

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith('data: {"type":"RUN_STARTED"}\n\n');
      expect(res.write).toHaveBeenCalledWith('data: {"type":"RUN_FINISHED"}\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    /**
     * Verifies Graceful Error handling for Error instances.
     */
    it('When the underlying AgentRunner domain throws an Error object, Then it translates to a graceful run_error SSE event', async () => {
      vi.mocked(AgentRunner).mockImplementation(function() {
        return {
          run: async function* () {
            throw new Error('Test error');
          }
        } as any;
      } as any);

      const handler = createAdkEndpoint({});
      const req = { body: { messages: [{}] }, threadId: 'thread1' } as any;
      const res = createMockResponse();

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('RUN_ERROR'));
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('Test error'));
      expect(res.end).toHaveBeenCalled();
    });

    /**
     * Verifies Graceful Error handling for string exceptions.
     */
    it('When the underlying AgentRunner domain throws a non-Error string, Then it translates to a graceful run_error SSE event with the string', async () => {
      vi.mocked(AgentRunner).mockImplementation(function() {
        return {
          run: async function* () {
            throw 'string error';
          }
        } as any;
      } as any);

      const handler = createAdkEndpoint({});
      const req = { body: { messages: [{}] }, threadId: 'thread1' } as any;
      const res = createMockResponse();

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('RUN_ERROR'));
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('string error'));
      expect(res.end).toHaveBeenCalled();
    });

    /**
     * Verifies fallback logic for completely unknown errors.
     */
    it('When the underlying AgentRunner domain throws a random object, Then it translates to a graceful run_error SSE event with default unknown message', async () => {
      vi.mocked(AgentRunner).mockImplementation(function() {
        return {
          run: async function* () {
            throw { random: 'object' };
          }
        } as any;
      } as any);

      const handler = createAdkEndpoint({});
      const req = { body: { messages: [{}] }, threadId: 'thread1' } as any;
      const res = createMockResponse();

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('RUN_ERROR'));
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
      expect(res.end).toHaveBeenCalled();
    });
  });
});
