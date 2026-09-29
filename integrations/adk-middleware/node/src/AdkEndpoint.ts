import { Request, Response } from 'express';
import { RunAgentInput } from '@ag-ui/core';
import { AgentRunner, AgentRunnerOptions } from './AgentRunner.js';

export interface AdkEndpointOptions extends AgentRunnerOptions {
  extractHeaders?: string[];
}

/**
 * Infrastructure Adapter: Express HTTP Endpoint
 * Wraps the Domain's AgentRunner in a standard Express request handler,
 * providing the required SSE transport layer for the AG-UI Protocol.
 */
export function createAdkEndpoint(options: AdkEndpointOptions) {
  return async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const input = req.body as RunAgentInput;
    if (!input || !input.messages) {
      res.status(400).send('Invalid RunAgentInput');
      return;
    }

    if (options.extractHeaders && options.extractHeaders.length > 0) {
      // Future mapping of headers to ContextStateMapper
    }

    const runner = new AgentRunner(options);

    try {
      const stream = runner.run(input);
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err: unknown) {
      let msg = 'Unknown error';
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'string') {
        msg = err;
      }
      const errorEvent = { type: 'run_error', message: msg };
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    } finally {
      res.end();
    }
  };
}
