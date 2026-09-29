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
    configureSseHeaders(res);

    const input = extractAndValidateInput(req);
    if (!input) {
      sendBadRequest(res);
      return;
    }

    const runner = new AgentRunner(options);

    try {
      await streamRunnerEvents(runner, input, res);
    } catch (err: unknown) {
      streamErrorEvent(err, res);
    } finally {
      res.end();
    }
  };
}

function configureSseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function extractAndValidateInput(req: Request): RunAgentInput | null {
  const input = req.body as RunAgentInput;
  if (!input || !input.messages) {
    return null;
  }
  return input;
}

function sendBadRequest(res: Response): void {
  res.status(400).send('Invalid RunAgentInput');
}

async function streamRunnerEvents(runner: AgentRunner, input: RunAgentInput, res: Response): Promise<void> {
  const stream = runner.run(input);
  for await (const event of stream) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

function streamErrorEvent(err: unknown, res: Response): void {
  let msg = 'Unknown error';
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === 'string') {
    msg = err;
  }
  const errorEvent = { type: 'run_error', message: msg };
  res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
}
