# @ag-ui/adk-middleware

A standalone TypeScript middleware backend that enables [Google ADK](https://github.com/google/adk-js) agents to communicate seamlessly with the AG-UI Protocol.

This package provides a bridge between the two frameworks. It is designed around Domain-Driven Design (Screaming Architecture) to accurately model the ubiquitous language of both AG-UI and Google ADK.

## Features

- **Express HTTP Adapter**: Easily bind your Google ADK agent to an Express.js endpoint using Server-Sent Events (SSE).
- **Generative UI & Tool Calling**: Full lifecycle mapping of `functionCall` events from ADK to the AG-UI Protocol's tool execution state.
- **Shared State (`ContextStateMapper`)**: Pass client context securely to the ADK Agent Session state.
- **Strict Typing**: Built with aggressive TypeScript checking and ESLint rules to prevent null-safety runtime errors.
- **High Test Coverage**: Backed by Vitest with 100% test coverage using strict Given/When/Then behavioral specs.

## Installation

```bash
npm install @ag-ui/adk-middleware
```

You will also need the core `@google/adk` and `@ag-ui/core` dependencies:

```bash
npm install @google/adk @ag-ui/core express
```

## Quick Start (Express)

Here is a basic example of how to expose a Google ADK Agent over an Express endpoint using this middleware:

```typescript
import express from 'express';
import { Agent } from '@google/adk';
import { createAdkEndpoint } from '@ag-ui/adk-middleware';

const app = express();
app.use(express.json());

// 1. Create your Google ADK Agent
const myAgent = new Agent({
  name: "demo_assistant",
  instruction: "You are a helpful assistant."
});

// 2. Bind the endpoint
app.post('/api/chat', createAdkEndpoint({
  agent: myAgent,
  appName: "my-ag-ui-app"
}));

// 3. Start the server
app.listen(3000, () => {
  console.log("ADK Middleware listening on port 3000");
});
```

## Architecture

We use Screaming Architecture—the code is organized by domain and function rather than by rigid technical layers:

- `AgentRunner`: The Aggregate Root that orchestrates the execution of a Google ADK Agent Session.
- `EventTranslator`: Domain Service that translates ubiquitous ADK events into the ubiquitous AG-UI Protocol events.
- `ClientProxyTool`: Represents an ADK Tool whose execution is explicitly proxied to the AG-UI frontend (Generative UI).
- `ContextStateMapper`: Maps AG-UI context to the internal ADK Session State.
- `AdkEndpoint`: The Express infrastructure adapter to bridge HTTP POST requests to the `AgentRunner`.

## Testing

This project adheres to a minimum 95% Code Coverage requirement across all Statements, Branches, Lines, and Functions, driven by `vitest`.

To run the test suite:

```bash
npm run test
```
