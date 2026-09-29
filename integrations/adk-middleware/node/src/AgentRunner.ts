import { BaseAgent, Runner, BaseSessionService, App, InMemorySessionService, RunnableNode } from '@google/adk';
import { RunAgentInput, BaseEvent as AgUiEvent } from '@ag-ui/core';
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

    yield this.createRunStartedEvent();
    yield* this.translateEventStream(adkStream);
    yield this.createRunFinishedEvent();
  }

  private createRunner(): Runner {
    const runnableNode: RunnableNode = (this.app || this.agent) as unknown as RunnableNode;
    return new Runner({
      agent: runnableNode,
      appName: this.appName,
      sessionService: this.sessionService
    });
  }

  private resolveSessionId(input: RunAgentInput): string {
    return input.threadId || crypto.randomUUID();
  }

  private extractUserText(input: RunAgentInput): string {
    const lastUserMessage = input.messages[input.messages.length - 1];
    if (!lastUserMessage || !lastUserMessage.content) {
      return "";
    }

    const contentArray = lastUserMessage.content as Array<{type?: string, text?: string}>;

    // PURE FUNCTIONAL TRANSFORM: Use reduce instead of mutable loop appending
    return contentArray.reduce((acc, part) => {
      return part.type === 'text' && part.text ? acc + part.text : acc;
    }, "");
  }

  private async initializeSession(sessionId: string): Promise<void> {
    await this.sessionService.createSession({
       appName: this.appName,
       userId: "default_user",
       sessionId
    });
  }

  private createRunStartedEvent(): AgUiEvent {
    return { type: 'run_started', timestamp: Date.now().toString() } as unknown as AgUiEvent;
  }

  private createRunFinishedEvent(): AgUiEvent {
    return { type: 'run_finished', timestamp: Date.now().toString() } as unknown as AgUiEvent;
  }

  private async *translateEventStream(adkStream: AsyncGenerator<unknown, void, unknown>): AsyncGenerator<AgUiEvent, void, unknown> {
    for await (const adkEvent of adkStream) {
      const translatedEvents = this.translator.translate(adkEvent as unknown as AdkEvent);
      for (const agUiEvent of translatedEvents) {
        yield agUiEvent;
      }
    }
  }
}
