# Engineering Note — FinchPay Refund Agent

## 1. What happens when the customer sends `2468`?

After `Please refund CH-101.`, `submitChatMessage()` in `src/agent.js` runs Triage, sets `session.requestedCharge = 'CH-101'`, hands off to Identity, asks for a verification code, and pauses. The *same* session object persists in `src/app.js` across message submissions. When the customer sends `2468`, the loop resumes in Identity, calls `verify_identity('2468')`, and inspects its `{ success: true }` result. Only then does it set `session.verified = true`, hand off to Refund, and call `issue_refund(session, 'CH-101')`. That tool **checks `session.verified` before recording anything**, rejects unknown charges and duplicates, records one mock refund, and returns `RF-001`. Refund sends a confirmation and `finish()` changes the status to `ended`, stopping the loop. On the first turn, the loop stops at an explicit *wait* for user input; on the second, it stops at *ended*. A separate maximum of 12 steps per turn prevents runaway handoffs or tool calls. The UI disables further messages when the session has ended.

The refund invariant is enforced in `issue_refund()`, not just by trusting the Identity agent's instructions. A claim such as “I already verified” is merely text; it does not change `session.verified`.

## 2. Design choice

I chose deterministic role functions instead of an LLM-based agent. The alternative was an LLM deciding which tool to call and when to hand off. For this narrow workflow, deterministic logic is easier to audit and keeps identity verification independent of any language-model interpretation of customer claims. I also chose to **end the session on a wrong code**, rather than allow retries; that simplifies the failure path and makes the negative test unambiguous. A real service would likely use rate-limited retries plus stronger identity methods.

## 3. Known weakness and what I'd change

The most serious limitation is that this is a **browser-only mock**. A technically capable customer could edit `session.verified` or even change the JavaScript running in their browser, then cause a refund record to appear in local memory. The customer would see a refund confirmation even though no trusted service performed verification. My first production change would move session state, verification, and `issue_refund` to a server, with a server-owned per-session verification record and an idempotent refund endpoint. A smaller input limitation: `please refund my last charge` has no charge ID, so Triage asks for an explicit ID rather than looking it up.

## AI use and checking

I used **OpenAI ChatGPT** to help generate the initial implementation, tests, README, and this note. I checked the output by running `npm test` (five passing tests), generating both saved traces with `npm run traces`, and inspecting the results. The trace generator executes the **same message-handling function used by the chat page**, but I did **not** run a full browser automation test or deploy the app. The verification code is hard-coded for the mock; it is not genuine identity verification. There is no production backend, database, or external payment integration.
