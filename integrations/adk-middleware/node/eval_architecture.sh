#!/bin/bash

echo "=== Stage 1: Programming Paradigms Evaluation ==="
echo "Item 4 (Immutability): REJECT. AgentRunner.ts contains a mutable variable 'let textToRun = ""' and mutates it inside a loop. This violates Immutability by Default."

echo "=== Stage 2: Single-File SOLID Principles ==="
echo "Item 2 (Open-Closed Principle): REJECT. EventTranslator.ts contains raw conditionals checking 'firstPart.text' and 'firstPart.functionCall'. Adding a new part type requires modifying the core translate logic."

echo "=== Stage 3: Dependency Inversion & Stage 5: High-Level Architecture ==="
echo "Item 1 (Dependency Rule) & Stage 5 Item 6: REJECT. The classes import the concrete vendor '@google/adk' SDK. While this entire package is essentially an adapter between AG-UI and Google ADK, the files lack the explicit 'framework orchestration adapter by design' docstring necessary to exempt them from strict Dependency Rule violations."
