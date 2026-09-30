import { BaseTool } from '@google/adk';

/**
 * Domain Entity: ClientProxyTool
 * Represents a tool that the Agent can invoke, but whose execution
 * is proxied to the AG-UI Client instead of running natively.
 *
 * Framework orchestration adapter by design: This module explicitly binds
 * the vendor Google ADK SDK's Tooling capabilities to the internal representations.
 */
export class ClientProxyTool extends BaseTool {
  constructor(name: string, description: string) {
    super({ name, description });
    // Redefining the property directly on the instance since BaseTool sets it in its constructor
    Object.defineProperty(this, 'isLongRunning', {
      value: true,
      writable: true,
      enumerable: true,
      configurable: true
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async runAsync(_args: unknown): Promise<null> {
    // Null returning executor guarantees agents/functions.js skips the auto-response.
    return null;
  }
}
