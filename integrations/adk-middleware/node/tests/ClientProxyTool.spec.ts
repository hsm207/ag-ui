import { describe, it, expect } from 'vitest';
import { ClientProxyTool } from '../src/ClientProxyTool.js';

/**
 * Tests for the ClientProxyTool capability.
 * Validates the tool defers execution back to the client.
 */
describe('ClientProxyTool', () => {
  describe('Given a registered ClientProxyTool', () => {
    /**
     * Verifies the tool does not execute business logic natively.
     */
    it('When the tool is invoked by the LLM (runAsync), Then it signals the client proxy rather than executing native logic', async () => {
      const tool = new ClientProxyTool('test_tool', 'a test tool');
      const inputArgs = { param: 'value' };

      const result = await tool.runAsync(inputArgs);

      expect(result).toContain('triggered for client execution');
    });
  });
});
