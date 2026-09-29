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
 */
export class AgentRunner {
  private agent?: BaseAgent;
  private app?: App;
  private appName: string;
  private sessionService: BaseSessionService;
  private translator: EventTranslator;

  constructor(options: AgentRunnerOptions) {
    this.agent = options.agent;
    this.app = options.app;
    this.appName = options.appName || "ag-ui-app";
    this.sessionService = options.sessionService || new InMemorySessionService();
    this.translator = new EventTranslator();
  }

  public async *run(input: RunAgentInput): AsyncGenerator<AgUiEvent, void, unknown> {
    const runnableNode: RunnableNode = (this.app || this.agent) as unknown as RunnableNode;
    const runner = new Runner({
      agent: runnableNode,
      appName: this.appName,
      sessionService: this.sessionService
    });

    const lastUserMessage = input.messages[input.messages.length - 1];
    let textToRun = "";
    if (lastUserMessage && lastUserMessage.content) {
       const contentArray = lastUserMessage.content as Array<{type?: string, text?: string}>;
       for(const part of contentArray) {
          if (part.type === 'text' && part.text) {
             textToRun += part.text;
          }
       }
    }

    const sessionId = input.threadId || crypto.randomUUID();

    await this.sessionService.createSession({
       appName: this.appName,
       userId: "default_user",
       sessionId
    });

    const adkStream = runner.runAsync({
      userId: "default_user",
      sessionId,
      newMessage: {
        role: "user",
        parts: [{ text: textToRun }]
      }
    });

    yield { type: 'run_started', timestamp: Date.now().toString() } as unknown as AgUiEvent;

    for await (const adkEvent of adkStream) {
      const translatedEvents = this.translator.translate(adkEvent as unknown as AdkEvent);
      for (const agUiEvent of translatedEvents) {
        yield agUiEvent;
      }
    }

    yield { type: 'run_finished', timestamp: Date.now().toString() } as unknown as AgUiEvent;
  }
}
