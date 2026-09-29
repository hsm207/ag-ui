import { BaseAgent, Runner, BaseSessionService, App, InMemorySessionService } from '@google/adk';
import { RunAgentInput, BaseEvent as AgUiEvent, EventType as AgUiEventType } from '@ag-ui/core';
import { EventTranslator, AdkEvent } from './EventTranslator.js';
import crypto from 'crypto';

export interface AgentRunnerOptions {
  agent?: BaseAgent;
  app?: App;
  appName?: string;
  sessionService?: BaseSessionService;
}

/**
 * Aggregate Root: AgentRunner
 * Orchestrates the execution of a Google ADK Agent Session
 * and yields translated AG-UI events.
 *
 * Framework orchestration adapter by design: This module explicitly binds
 * the vendor Google ADK SDK to the internal AG-UI protocol representations.
 */
export class AgentRunner {
  private readonly agent?: BaseAgent;
  private readonly app?: App;
  private readonly appName: string;
  private readonly sessionService: BaseSessionService;
  private readonly translator: EventTranslator;

  constructor(options: AgentRunnerOptions) {
    this.agent = options.agent;
    this.app = options.app;
    this.appName = options.appName || "ag-ui-app";
    this.sessionService = options.sessionService || new InMemorySessionService();
    this.translator = new EventTranslator();
  }

  public async *run(input: RunAgentInput): AsyncGenerator<AgUiEvent, void, unknown> {
    const runner = this.createRunner();
    const sessionId = this.resolveSessionId(input);
    const runId = crypto.randomUUID();
    const textToRun = this.extractUserText(input);

    await this.initializeSession(sessionId);

    const adkStream = runner.runAsync({
      userId: "default_user",
      sessionId,
      newMessage: {
        role: "user",
        parts: [{ text: textToRun }]
      }
    });

    yield { type: AgUiEventType.RUN_STARTED, runId, timestamp: Date.now().toString() } as unknown as AgUiEvent;
    yield* this.translateEventStream(adkStream, runId);
    yield { type: AgUiEventType.RUN_FINISHED, runId, timestamp: Date.now().toString(), outcome: { type: "success" } } as unknown as AgUiEvent;
  }

  private createRunner(): Runner {
    // Finding 3: RunnableNode is internal, pass directly in config without cast hack
    return new Runner({
      agent: this.agent,
      app: this.app,
      appName: this.appName,
      sessionService: this.sessionService
    });
  }

  private resolveSessionId(input: RunAgentInput): string {
    return input.threadId || crypto.randomUUID();
  }

  private extractUserText(input: RunAgentInput): string {
    if (!input.messages || input.messages.length === 0) {
      return "";
    }
    const lastUserMessage = input.messages[input.messages.length - 1];
    if (!lastUserMessage || !lastUserMessage.content) {
      return "";
    }

    // Finding 4: Handle string format directly vs ContentPart format
    if (typeof lastUserMessage.content === 'string') {
      return lastUserMessage.content;
    }

    const contentArray = lastUserMessage.content as Array<{type?: string, text?: string}>;
    return contentArray.reduce((acc, part) => {
      return part.type === 'text' && part.text ? acc + part.text : acc;
    }, "");
  }

  private async initializeSession(sessionId: string): Promise<void> {
    // Finding 5: Must use getSession or createSession cleanly to avoid churn
    const existing = await this.sessionService.getSession({
      appName: this.appName,
      userId: "default_user",
      sessionId
    });

    if (!existing) {
      await this.sessionService.createSession({
         appName: this.appName,
         userId: "default_user",
         sessionId
      });
    }
  }

  private async *translateEventStream(adkStream: AsyncGenerator<unknown, void, unknown>, runId: string): AsyncGenerator<AgUiEvent, void, unknown> {
    for await (const adkEvent of adkStream) {
      const translatedEvents = this.translator.translate(adkEvent as unknown as AdkEvent, runId);
      for (const agUiEvent of translatedEvents) {
        yield agUiEvent;
      }
    }
  }
}
