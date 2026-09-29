import { describe, it, expect } from 'vitest';
import { ClientProxyTool } from '../src/ClientProxyTool.js';

describe('ClientProxyTool', () => {
  describe('Given a registered ClientProxyTool', () => {
    it('When the tool is invoked by the LLM (runAsync), Then it signals the client proxy rather than executing native logic', async () => {
      const tool = new ClientProxyTool('test_tool', 'a test tool');
      const result = await tool.runAsync({ param: 'value' });
      expect(result).toContain('triggered for client execution');
    });
  });
});
