/**
 * Value Object: ContextStateMapper
 * Translates the AG-UI Context array into the ubiquitous language
 * of an ADK State object.
 */
export class ContextStateMapper {
  static readonly CONTEXT_STATE_KEY = '_ag_ui_context';

  public static mapToAdkState(context: Array<{ description: string; value: string }>): Record<string, unknown> {
    if (!context || context.length === 0) {
      return {};
    }
    return {
      [this.CONTEXT_STATE_KEY]: context
    };
  }
}
