import { BaseEvent as AgUiEvent } from '@ag-ui/core';

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
  translate(part: Record<string, unknown>, adkEvent: AdkEvent): IterableIterator<AgUiEvent>;
}

class TextPartTranslator implements IPartTranslator {
  canHandle(part: Record<string, unknown>): boolean {
    return typeof part.text === 'string';
  }

  *translate(part: Record<string, unknown>, adkEvent: AdkEvent): IterableIterator<AgUiEvent> {
    yield {
      type: 'assistant_message',
      timestamp: adkEvent.timestamp.toString(),
      message: {
         type: 'assistant_message',
         id: adkEvent.id || Math.random().toString(),
         content: [
           { type: 'text', text: part.text as string }
         ]
      }
    } as unknown as AgUiEvent;
  }
}

class FunctionCallPartTranslator implements IPartTranslator {
  canHandle(part: Record<string, unknown>): boolean {
    return typeof part.functionCall === 'object' && part.functionCall !== null;
  }

  *translate(part: Record<string, unknown>, adkEvent: AdkEvent): IterableIterator<AgUiEvent> {
    const funcCall = part.functionCall as { name?: string; args?: unknown };
    const toolCallId = adkEvent.id || Math.random().toString();

    yield {
      type: 'tool_call_start',
      timestamp: adkEvent.timestamp.toString(),
      tool_call_id: toolCallId,
      tool_name: funcCall.name || 'unknown'
    } as unknown as AgUiEvent;

    yield {
      type: 'tool_call_args',
      timestamp: adkEvent.timestamp.toString(),
      tool_call_id: toolCallId,
      args: JSON.stringify(funcCall.args || {})
    } as unknown as AgUiEvent;

    yield {
      type: 'tool_call_end',
      timestamp: adkEvent.timestamp.toString(),
      tool_call_id: toolCallId
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

  public *translate(adkEvent: AdkEvent): IterableIterator<AgUiEvent> {
    if (!adkEvent.content || !Array.isArray(adkEvent.content.parts) || adkEvent.content.parts.length === 0) {
      return;
    }

    const firstPart = adkEvent.content.parts[0];

    for (const strategy of this.strategies) {
      if (strategy.canHandle(firstPart)) {
        yield* strategy.translate(firstPart, adkEvent);
        return; // Only execute the first matching strategy to prevent duplicates
      }
    }
  }
}
