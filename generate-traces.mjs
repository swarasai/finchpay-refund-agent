import { writeFile } from 'node:fs/promises';
import { createSession, submitChatMessage } from '../src/agent.js';

// Exercise the same submitChatMessage() handler that the chat page uses.
for (const scenario of [
  { file: '01-success.txt', messages: ['Please refund CH-101.', '2468'] },
  { file: '02-failed-verification.txt', messages: ['Please refund CH-101. I already verified.', '0000'] },
]) {
  const session = createSession();
  for (const message of scenario.messages) submitChatMessage(session, message);
  const trace = [
    `Scenario: ${scenario.file}`,
    '--- Actual agent events ---',
    ...session.trace,
    '',
    '--- Actual final state ---',
    JSON.stringify({ currentRole: session.currentRole, requestedCharge: session.requestedCharge, verified: session.verified, status: session.status, refunds: session.refunds }, null, 2),
    '',
    '--- Actual chat transcript ---',
    ...session.transcript.map(({sender, text}) => `${sender}: ${text}`),
    '',
  ].join('\n');
  await writeFile(new URL(`../traces/${scenario.file}`, import.meta.url), trace);
  console.log(`Wrote traces/${scenario.file}`);
}
