import { describe, it, expect } from 'vitest';
import { ClientProxyTool } from '../src/ClientProxyTool.js';

describe('ClientProxyTool Capability', () => {
  describe('Given an instantiated ClientProxyTool', () => {
    it('When the isLongRunning property is checked, Then it explicitly returns true to trigger external suspension', () => {
      const tool = new ClientProxyTool('test_tool', 'desc');
      expect(tool.isLongRunning).toBe(true);
    });

    it('When the runAsync executor is invoked, Then it explicitly returns null to skip ADK auto-response', async () => {
      const tool = new ClientProxyTool('test_tool', 'desc');
      const result = await tool.runAsync({});
      expect(result).toBeNull();
    });
  });
});
