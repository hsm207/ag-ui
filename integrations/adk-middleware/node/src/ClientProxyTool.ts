import { BaseTool } from '@google/adk';

/**
 * Domain Entity: ClientProxyTool
 * Represents a tool that the Agent can invoke, but whose execution
 * is proxied to the AG-UI Client instead of running natively.
 */
export class ClientProxyTool extends BaseTool {
  constructor(name: string, description: string) {
    super({ name, description });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async runAsync(_args: unknown): Promise<string> {
    // A proxy tool's local execution is essentially a no-op because
    // the true execution happens on the client side, driven by events.
    return `Client Proxy Tool ${this.name} triggered for client execution.`;
  }
}
