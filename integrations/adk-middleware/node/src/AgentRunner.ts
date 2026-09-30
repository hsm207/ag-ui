import { BaseAgent, Runner, BaseSessionService, App, InMemorySessionService } from '@google/adk';
import { RunAgentInput, BaseEvent as AgUiEvent, EventType as AgUiEventType, RunFinishedEvent } from '@ag-ui/core';
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

    // Fallback required by protocol if client sends no threadId
    const threadId = input.threadId || crypto.randomUUID();
    const runId = crypto.randomUUID();

    await this.initializeSession(threadId);

    const session = await this.sessionService.getSession({
      appName: this.appName,
      userId: "default_user",
      sessionId: threadId
    });

    const lastMessage = input.messages ? input.messages[input.messages.length - 1] : undefined;

    // Inbound Loop: if the client is submitting a tool result, we must map it back to ADK.
    if (lastMessage && lastMessage.role === 'tool') {
      const toolMsg = lastMessage as unknown as { toolCallId: string, toolName: string, content: unknown };

      // Append the client result as a FunctionResponse with the *exact* call id
      await this.sessionService.appendEvent({
        session: session!,
        event: {
          id: toolMsg.toolCallId,
          invocationId: runId, // Dummy invocationId to satisfy ADK append
          author: "user",
          timestamp: Date.now(),
          content: {
            role: "user",
            parts: [{
              functionResponse: {
                name: toolMsg.toolName,
                response: { result: toolMsg.content }
              }
            }]
          }
        } as unknown as AdkEvent
      });
    }

    const textToRun = this.extractUserText(input);

    const adkStream = runner.runAsync({
      userId: "default_user",
      sessionId: threadId,
      runConfig: {
        // pauseOnToolCalls: true is mandatory to prevent the model from hallucinating
        // a confirmation over its own unanswered call during SSE StreamingMode.
        pauseOnToolCalls: true
      } as unknown as Record<string, unknown>,
      newMessage: {
        role: "user",
        // Re-invoke with an empty-text newMessage if we are resuming from a tool
        parts: [{ text: (lastMessage && lastMessage.role === 'tool') ? "" : textToRun }]
      }
    });

    yield { type: AgUiEventType.RUN_STARTED, runId, threadId, timestamp: Date.now() } as AgUiEvent;

    yield* this.translateEventStream(adkStream, runId);

    yield { type: AgUiEventType.RUN_FINISHED, runId, threadId, timestamp: Date.now(), outcome: { type: "success" } } as RunFinishedEvent;
  }

  private createRunner(): Runner {
    return new Runner({
      agent: this.agent,
      app: this.app,
      appName: this.appName,
      sessionService: this.sessionService
    });
  }

  private extractUserText(input: RunAgentInput): string {
    if (!input.messages || input.messages.length === 0) {
      return "";
    }
    const lastUserMessage = input.messages[input.messages.length - 1];
    if (!lastUserMessage || !lastUserMessage.content) {
      return "";
    }

    if (typeof lastUserMessage.content === 'string') {
      return lastUserMessage.content;
    }

    const contentArray = lastUserMessage.content as Array<{type?: string, text?: string}>;
    return contentArray.reduce((acc, part) => {
      return part.type === 'text' && part.text ? acc + part.text : acc;
    }, "");
  }

  private async initializeSession(sessionId: string): Promise<void> {
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
