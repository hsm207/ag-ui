import { Request, Response } from 'express';
import { RunAgentInput, EventType as AgUiEventType } from '@ag-ui/core';
import { AgentRunner, AgentRunnerOptions } from './AgentRunner.js';

export interface AdkEndpointOptions extends AgentRunnerOptions {
  extractHeaders?: string[];
}

/**
 * Infrastructure Adapter: Express HTTP Endpoint
 * Wraps the Domain's AgentRunner in a standard Express request handler,
 * providing the required SSE transport layer for the AG-UI Protocol.
 *
 * Framework orchestration adapter by design: This module explicitly binds
 * the vendor Express Framework to the internal AG-UI protocol representations.
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
      // Must generate threadId defensively if the domain threw early without generating one
      const threadId = input.threadId || 'unknown';
      streamErrorEvent(err, res, threadId);
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function streamErrorEvent(err: unknown, res: Response, _threadId: string): void {
  let msg = 'Unknown error';
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === 'string') {
    msg = err;
  }
  // RUN_ERROR Schema requires: type, message. (NO error object, NO runId requirement)
  const errorEvent = { type: AgUiEventType.RUN_ERROR, message: msg, timestamp: Date.now() };
  res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
}
