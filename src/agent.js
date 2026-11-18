
 // The same deterministic agent engine is used by the browser UI and the trace tests.

export const CHARGES = Object.freeze({
  'CH-101': {
    amountCents: 2500,
    currency: 'USD',
  },
});

const VALID_CODE = '2468'; // Mocked verification code, not real authentication.
const MAX_STEPS_PER_TURN = 12;

// Create a fresh, unverified session.
export function createSession() {
  return {
    currentRole: 'Triage',
    requestedCharge: null,
    verified: false,
    awaitingInput: 'refund_request',
    status: 'active',
    refunds: [],
    transcript: [
      {
        sender: 'agent',
        text: 'Hi! I can help with a refund. Which charge would you like refunded?',
      },
    ],
    trace: [
      'New chat: session.verified = false; currentRole = Triage',
    ],
  };
}

// Tool 1: Verify customer identity.
export function verify_identity(code) {
  return {
    success: code === VALID_CODE,
  };
}

// Tool 2: Issue a mock refund.
// Safety rule is enforced here, not just in the agent prompts.
export function issue_refund(session, chargeId) {
  if (!session.verified) {
    return {
      success: false,
      error: 'IDENTITY_NOT_VERIFIED',
    };
  }

  if (!Object.hasOwn(CHARGES, chargeId)) {
    return {
      success: false,
      error: 'UNKNOWN_CHARGE',
    };
  }

  if (session.refunds.some((refund) => refund.chargeId === chargeId)) {
    return {
      success: false,
      error: 'ALREADY_REFUNDED',
    };
  }

  const charge = CHARGES[chargeId];

  const reference = `RF-${String(
    session.refunds.length + 1
  ).padStart(3, '0')}`;

  session.refunds.push({
    reference,
    chargeId,
    amountCents: charge.amountCents,
    currency: charge.currency,
  });

  return {
    success: true,
    reference,
  };
}

// Helper functions for tracing and state transitions.
function log(session, event) {
  session.trace.push(event);
}

function reply(session, text) {
  session.transcript.push({
    sender: 'agent',
    text,
  });

  log(session, `Agent replies: ${text}`);
}

function finish(session) {
  session.status = 'ended';
  session.awaitingInput = null;
  log(session, 'Loop ends: session ended');
}

function handoff(session, from, to) {
  session.currentRole = to;
  log(session, `${from} -> ${to}`);
}

// Main agent loop.
// Processes a message, calls tools, changes roles,
// or pauses until another customer message arrives.
export function submitChatMessage(session, input) {
  if (session.status !== 'active') {
    return session;
  }

  const message = String(input).trim();

  if (!message) {
    return session;
  }

  session.transcript.push({
    sender: 'customer',
    text: message,
  });

  log(session, `Customer: ${message}`);

  let steps = 0;
  let pendingInput = message;

  while (session.status === 'active') {
    steps += 1;

    // Prevent infinite agent loops.
    if (steps > MAX_STEPS_PER_TURN) {
      log(session, `Step limit (${MAX_STEPS_PER_TURN}) exceeded`);
      reply(session, 'Something went wrong. Please start a new chat.');
      finish(session);
      break;
    }

    // AGENT 1: TRIAGE
    if (session.currentRole === 'Triage') {
      const match = pendingInput.match(/\bCH-\d+\b/i);
      const chargeId = match?.[0].toUpperCase();

      if (!chargeId || !Object.hasOwn(CHARGES, chargeId)) {
        log(
          session,
          `Triage: missing or unknown charge (${chargeId ?? 'none'})`
        );

        reply(
          session,
          'Please provide a valid charge ID, such as CH-101.'
        );

        log(session, 'Loop waits: customer refund request');
        break;
      }

      // Store requested charge in shared session state.
      session.requestedCharge = chargeId;

      log(session, `Triage: session.requestedCharge = ${chargeId}`);

      // Never treat claims like "I already verified" as proof.
      handoff(session, 'Triage', 'Identity');

      pendingInput = null;
      continue;
    }

    // AGENT 2: IDENTITY
    if (session.currentRole === 'Identity') {
      // First entry: ask for verification code and pause.
      if (session.awaitingInput !== 'verification_code') {
        session.awaitingInput = 'verification_code';

        log(session, 'Identity: asks for verification code');

        reply(
          session,
          `To refund ${session.requestedCharge}, please enter your 4-digit verification code.`
        );

        log(session, 'Loop waits: customer verification code');
        break;
      }

      // Customer has provided a verification code.
      log(session, 'Identity calls verify_identity(code)');

      const result = verify_identity(pendingInput ?? '');

      log(
        session,
        `verify_identity result: ${result.success ? 'success' : 'failure'}`
      );

      if (!result.success) {
        log(
          session,
          'Identity: verification failed; session.verified remains false'
        );

        reply(
          session,
          'Verification failed. No refund was issued. Please start a new chat to try again.'
        );

        // Chosen policy: one failed attempt ends the session.
        finish(session);
        break;
      }

      // Only a successful tool result can mark verification complete.
      session.verified = true;
      session.awaitingInput = null;

      log(session, 'Identity: session.verified = true');

      handoff(session, 'Identity', 'Refund');

      pendingInput = null;
      continue;
    }

    // AGENT 3: REFUND
    if (session.currentRole === 'Refund') {
      log(
        session,
        `Refund calls issue_refund(${session.requestedCharge})`
      );

      const result = issue_refund(
        session,
        session.requestedCharge
      );

      log(
        session,
        `issue_refund result: ${
          result.success
            ? `success, reference ${result.reference}`
            : `failure, ${result.error}`
        }`
      );

      if (result.success) {
        // NEW: Calculate the amount from the actual charge data.
        const charge = CHARGES[session.requestedCharge];

        const formattedAmount = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: charge.currency,
        }).format(charge.amountCents / 100);

        reply(
          session,
          `Your ${formattedAmount} refund for ${session.requestedCharge} was issued. Reference: ${result.reference}.`
        );
      } else {
        reply(
          session,
          'We could not issue the refund. No new refund was recorded.'
        );
      }

      // Stop execution after the final refund response.
      finish(session);
      break;
    }

    // Fallback for unexpected role values.
    log(session, `Unknown role: ${session.currentRole}`);

    reply(
      session,
      'Something went wrong. Please start a new chat.'
    );

    finish(session);
    break;
  }

  return session;
}
