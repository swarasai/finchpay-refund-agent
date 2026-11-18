import { createSession, submitChatMessage } from './agent.js';

let session = createSession();
const transcript = document.querySelector('#transcript');
const trace = document.querySelector('#trace');
const form = document.querySelector('#chat-form');
const input = document.querySelector('#message');
const send = document.querySelector('#send');

function render() {
  transcript.replaceChildren();
  for (const message of session.transcript) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${message.sender}`;
    bubble.textContent = message.text; // No untrusted HTML injection.
    transcript.append(bubble);
  }
  trace.textContent = session.trace.join('\n');
  input.disabled = session.status === 'ended';
  send.disabled = session.status === 'ended';
  input.placeholder = session.status === 'ended' ? 'Chat ended — select New chat' : 'Type a message…';
  transcript.scrollTop = transcript.scrollHeight;
  trace.scrollTop = trace.scrollHeight;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  submitChatMessage(session, input.value);
  input.value = '';
  render();
  input.focus();
});

document.querySelector('#new-chat').addEventListener('click', () => {
  session = createSession(); // All session-specific state, including refunds, is reset.
  render();
  input.focus();
});

render();
