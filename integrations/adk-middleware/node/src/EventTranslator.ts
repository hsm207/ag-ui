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
 * Domain Service: EventTranslator
 * Translates ubiquitous ADK events into the ubiquitous AG-UI Protocol events.
 */
export class EventTranslator {
  public *translate(adkEvent: AdkEvent): IterableIterator<AgUiEvent> {
    if (!adkEvent.content || !Array.isArray(adkEvent.content.parts) || adkEvent.content.parts.length === 0) {
      return;
    }

    const firstPart = adkEvent.content.parts[0];

    // Text Generation Mapping
    if (typeof firstPart.text === 'string') {
       yield {
          type: 'assistant_message',
          timestamp: adkEvent.timestamp.toString(),
          message: {
             type: 'assistant_message',
             id: adkEvent.id || Math.random().toString(),
             content: [
               { type: 'text', text: firstPart.text }
             ]
          }
       } as unknown as AgUiEvent;
       return;
    }

    // Generative UI Tool Call Mapping
    if (typeof firstPart.functionCall === 'object' && firstPart.functionCall !== null) {
      const funcCall = firstPart.functionCall as { name?: string; args?: unknown };
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
      return;
    }
  }
}
