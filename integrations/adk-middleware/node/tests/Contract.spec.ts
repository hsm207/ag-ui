import { describe, it, expect } from 'vitest';
import { EventTranslator } from '../src/EventTranslator.js';
import { EventSchema, EventType } from '@ag-ui/core/schemas';

const REAL_ADK_EVENTS = [
  {
    id: "wkLTkC7z",
    invocationId: "1",
    author: "model",
    content: { role: "model", parts: [{ text: "Hello" }] },
    timestamp: 1790699914533
  },
  {
    id: "wkLTkC7y",
    invocationId: "2",
    author: "model",
    content: { role: "model", parts: [{ functionCall: { name: "test_tool", args: { param: "value" } } }] },
    timestamp: 1790699914534
  }
];

describe('Protocol Contract', () => {
  const translator = new EventTranslator();

  it('When real ADK events are translated, Then the full AG-UI EventSchema validates the output', () => {
    for (const adkEvent of REAL_ADK_EVENTS) {
      const translatedIter = translator.translate(adkEvent, "run-1");
      const agUiEvents = Array.from(translatedIter);

      expect(agUiEvents.length).toBeGreaterThan(0);

      for (const agUiEvent of agUiEvents) {
        expect(() => EventSchema.parse(agUiEvent)).not.toThrow();
      }
    }
  });

  it('When a required field (messageId) is dropped, Then EventSchema validation fails', () => {
    // Generate a valid text message content event
    const validIter = translator.translate(REAL_ADK_EVENTS[0], "run-1");
    const validEvents = Array.from(validIter) as any[];
    const contentEvent = validEvents.find(e => e.type === 'TEXT_MESSAGE_CONTENT');

    // Mutate it: delete messageId
    const malformedEvent = { ...contentEvent };
    delete malformedEvent.messageId;

    expect(() => EventSchema.parse(malformedEvent)).toThrow();
  });

  it('When a field has the wrong type (timestamp as string), Then EventSchema validation fails', () => {
    // Generate a valid text message content event
    const validIter = translator.translate(REAL_ADK_EVENTS[0], "run-1");
    const validEvents = Array.from(validIter) as any[];
    const contentEvent = validEvents.find(e => e.type === 'TEXT_MESSAGE_CONTENT');

    // Mutate it: string timestamp
    const malformedEvent = { ...contentEvent, timestamp: "1790699914533" };

    expect(() => EventSchema.parse(malformedEvent)).toThrow();
  });
});
