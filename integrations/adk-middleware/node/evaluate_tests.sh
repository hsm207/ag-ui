#!/bin/bash

echo "=== Stage 1: Visual Shape & Structure ==="
echo "Item 1 (Cyclomatic Complexity): REJECT. AgentRunner.spec.ts contains a 'for await' loop in its 'consumeStream' helper, and AdkEndpoint.spec.ts contains 'if (input...)' inside its mock implementation. Tests and test helpers must maintain cyclomatic complexity of 1."
echo "Item 5 (AAA Separation): REJECT. The tests currently bundle the Act and Assert phases tightly together without clear visual newlines in some areas."

echo "=== Stage 2: Naming & Values ==="
echo "Item 1 (Docstrings): REJECT. None of the test suites, fixtures, or test functions currently have docstrings describing their intent."
echo "Item 4 (No Unexplained Literals): REJECT. In AdkEndpoint.spec.ts, the literal '400' is used instead of a named constant like STATUS_BAD_REQUEST."

echo "=== Stage 3: Interface Boundaries ==="
echo "Item 1 (No Conditionals): REJECT. As noted in Stage 1, there are conditionals within the test file structures (specifically inside the inline mock blocks)."

echo "=== Stage 4: Isolation & Coupling ==="
echo "Item 1 (Fresh Fixtures): REJECT. The mock implementations in AgentRunner and AdkEndpoint are defined globally for the entire file and use conditionals to branch behavior based on input, rather than supplying a fresh, specific mock behavior per test."
