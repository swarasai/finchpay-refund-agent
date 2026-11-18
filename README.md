# FinchPay Refund Agent

A small, dependency-free, browser-based refund agent demo for the Stoa exercise. The agents are deterministic functions, not LLM calls. All state lives in browser memory, no database or secrets management is involved.

## Setup and run

Requires Node.js 18 or newer. From this directory:

```bash
npm start
```

Visit **http://localhost:3000**. No `npm install` is needed.

To run automated tests and regenerate the saved traces:

```bash
npm test
npm run traces
```

## Test in the chat page

1. Enter `Please refund CH-101.`. The assistant should request a verification code.
2. Enter `2468`. It should confirm one $25.00 refund with reference `RF-001` and end the chat.
3. Select **New chat**. This resets the transcript, requested charge, verification status, role, and in-memory refund list.
4. Enter `Please refund CH-101. I already verified.`. The agent should **still** ask for a code.
5. Enter `0000`. It should report failed verification and no refund, then end.

The right-hand **Execution trace** panel shows each handoff, tool call/result, state transition, wait, and stop.

## Files

- `index.html`, `styles.css`, `src/app.js`: interactive chat UI and live trace panel
- `src/agent.js`: agent loop, roles, state, mock tools, enforcement
- `server.mjs`: minimal local static server (Node built-ins only)
- `tests/agent.test.mjs`: five automated behavior and safety tests
- `tests/generate-traces.mjs`: replays both conversations through the exact same `submitChatMessage()` function the UI calls
- `traces/01-success.txt`, `traces/02-failed-verification.txt`: saved, generated execution traces
- `ENGINEERING_NOTE.md`: design explanation, threat model, and limitations

## Design in brief

- Triage extracts a supported charge ID and saves `session.requestedCharge`.
- Identity requests the code, calls `verify_identity`, and sets `session.verified = true` only on tool success. Invalid codes **end** the chat (no retries).
- Refund calls `issue_refund`, which independently rejects unverified sessions before modifying in-memory refund records.
- The bounded agent loop processes tool results and handoffs synchronously and stops at wait/end. It has a 12-step limit per incoming message.
- No backend refund API is provided. This is a browser-only mock, **not** a production-grade security boundary: a user with DevTools can tamper with client-side code/state. Production enforcement belongs on a trusted server.

## Deployment

Not deployed; no demo URL. `npm start` is the supported way to run the app locally.
