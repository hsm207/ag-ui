import { describe, it, expect } from 'vitest';
import { EventTranslator } from '../src/EventTranslator.js';
import { EventSchema } from '@ag-ui/core/schemas';

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
});
