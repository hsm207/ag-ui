import { describe, it, expect, vi } from 'vitest';
import { createAdkEndpoint } from '../src/AdkEndpoint.js';

vi.mock('../src/AgentRunner.js', () => {
  return {
    AgentRunner: class {
      constructor() {}
      async *run(input: any) {
        if (input.messages && input.messages[0].content === 'throw') {
          throw new Error('Test error');
        }
        if (input.messages && input.messages[0].content === 'throw_unknown') {
          throw 'string error'; // Throw a string without .message to hit coverage branch
        }
        if (input.messages && input.messages[0].content === 'throw_object') {
          throw { random: 'object' }; // Throw random object to hit last fallback branch
        }
        yield { type: 'run_started' };
        yield { type: 'run_finished' };
      }
    }
  };
});

describe('ExpressAdapter (AdkEndpoint)', () => {
  describe('Given an incoming HTTP Request to the integration endpoint', () => {
    it('When the payload lacks the required RunAgentInput schema, Then it returns an immediate 400 Bad Request', async () => {
      const handler = createAdkEndpoint({});
      const req = { body: {} } as any;
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any;

      await handler(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid RunAgentInput');
    });

    it('When the payload is valid, Then it establishes a Server-Sent Events (SSE) connection and streams the lifecycle', async () => {
      const handler = createAdkEndpoint({ extractHeaders: ['x-user-id'] });
      const req = {
        body: { messages: [{}] }
      } as any;
      const res = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any;

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith('data: {"type":"run_started"}\n\n');
      expect(res.write).toHaveBeenCalledWith('data: {"type":"run_finished"}\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('When the underlying AgentRunner domain throws an Error object, Then it translates to a graceful run_error SSE event', async () => {
      const handler = createAdkEndpoint({});
      const req = {
        body: { messages: [{ content: 'throw' }] }
      } as any;
      const res = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any;

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith('data: {"type":"run_error","message":"Test error"}\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('When the underlying AgentRunner domain throws a non-Error object, Then it translates to a graceful run_error SSE event with default message', async () => {
      const handler = createAdkEndpoint({});
      const req = {
        body: { messages: [{ content: 'throw_unknown' }] }
      } as any;
      const res = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any;

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith('data: {"type":"run_error","message":"string error"}\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('When the underlying AgentRunner domain throws a random object, Then it translates to a graceful run_error SSE event with default unknown message', async () => {
      const handler = createAdkEndpoint({});
      const req = {
        body: { messages: [{ content: 'throw_object' }] }
      } as any;
      const res = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any;

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith('data: {"type":"run_error","message":"Unknown error"}\n\n');
      expect(res.end).toHaveBeenCalled();
    });
  });
});
