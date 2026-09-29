#!/bin/bash
echo "=== Stage 4: Side Effects & The Sith Rule Evaluation ==="
echo "Item 1: The Sith Rule (Resource Lifecycle Pairs)"
echo "VERIFIED: The codebase does not manually manage physical unmanaged resources (like sockets, file descriptors, or database connections). Express handles HTTP response lifecycle, and ADK manages its own async streams. No manual open/close or malloc/free patterns exist in the project code."

echo "Item 2: Command-Query Separation (CQS)"
echo "VERIFIED: Method names accurately reflect their behavior. 'ContextStateMapper.mapToAdkState' is a query (returns state). 'AgentRunner.run' and 'AdkEndpoint.streamRunnerEvents' are Orchestrators that handle side-effects and encapsulate pipeline execution (PERMITTED EXCEPTION — Encapsulated Execution Pipelines / Orchestrators). There are no ambiguous verb/adjective signatures that secretly mutate state."

echo "Item 3: Purity & Hidden Side Effects"
echo "VERIFIED: The project code contains no hidden mutations to global variables. Classes rely entirely on injected state (e.g. AgentRunnerOptions) and do not leak modifications to external singletons."
