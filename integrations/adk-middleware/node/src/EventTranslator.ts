import { BaseEvent as AgUiEvent, EventType as AgUiEventType } from '@ag-ui/core';

export interface AdkEvent {
  id: string;
  invocationId: string;
  author: string;
  content?: Record<string, unknown> & { parts?: Array<Record<string, unknown>> };
  timestamp: number;
  type?: string;
  [key: string]: unknown;
}

/**
 * Interface Adapter: IPartTranslator
 * Polymorphic strategy interface ensuring the EventTranslator is open
 * for extension but closed for modification.
 */
interface IPartTranslator {
  canHandle(part: Record<string, unknown>): boolean;
  translate(part: Record<string, unknown>, adkEvent: AdkEvent, runId: string): IterableIterator<AgUiEvent>;
}

class TextPartTranslator implements IPartTranslator {
  canHandle(part: Record<string, unknown>): boolean {
    return typeof part.text === 'string';
  }

  *translate(part: Record<string, unknown>, adkEvent: AdkEvent, runId: string): IterableIterator<AgUiEvent> {
    const messageId = adkEvent.id || Math.random().toString();
    const ts = adkEvent.timestamp;

    yield {
      type: AgUiEventType.TEXT_MESSAGE_START,
      runId,
      messageId,
      timestamp: ts
    } as unknown as AgUiEvent;

    yield {
      type: AgUiEventType.TEXT_MESSAGE_CONTENT,
      runId,
      messageId,
      timestamp: ts,
      delta: part.text as string
    } as unknown as AgUiEvent;

    yield {
      type: AgUiEventType.TEXT_MESSAGE_END,
      runId,
      messageId,
      timestamp: ts
    } as unknown as AgUiEvent;
  }
}

class FunctionCallPartTranslator implements IPartTranslator {
  canHandle(part: Record<string, unknown>): boolean {
    return typeof part.functionCall === 'object' && part.functionCall !== null;
  }

  *translate(part: Record<string, unknown>, adkEvent: AdkEvent, runId: string): IterableIterator<AgUiEvent> {
    const funcCall = part.functionCall as { name?: string; args?: unknown };
    const toolCallId = adkEvent.id || Math.random().toString();
    const ts = adkEvent.timestamp;

    yield {
      type: AgUiEventType.TOOL_CALL_START,
      runId,
      toolCallId,
      timestamp: ts,
      toolCallName: funcCall.name || 'unknown'
    } as unknown as AgUiEvent;

    yield {
      type: AgUiEventType.TOOL_CALL_ARGS,
      runId,
      toolCallId,
      timestamp: ts,
      delta: JSON.stringify(funcCall.args || {})
    } as unknown as AgUiEvent;

    yield {
      type: AgUiEventType.TOOL_CALL_END,
      runId,
      toolCallId,
      timestamp: ts
    } as unknown as AgUiEvent;
  }
}

/**
 * Domain Service: EventTranslator
 * Translates ubiquitous ADK events into the ubiquitous AG-UI Protocol events.
 */
export class EventTranslator {
  private readonly strategies: IPartTranslator[];

  constructor() {
    this.strategies = [
      new TextPartTranslator(),
      new FunctionCallPartTranslator()
    ];
  }

  public *translate(adkEvent: AdkEvent, runId: string): IterableIterator<AgUiEvent> {
    if (!adkEvent.content || !Array.isArray(adkEvent.content.parts) || adkEvent.content.parts.length === 0) {
      return;
    }

    const firstPart = adkEvent.content.parts[0];

    for (const strategy of this.strategies) {
      if (strategy.canHandle(firstPart)) {
        yield* strategy.translate(firstPart, adkEvent, runId);
        return;
      }
    }
  }
}
