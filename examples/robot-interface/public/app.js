const agentsOutput = document.getElementById('agents-output');
const eventOutput = document.getElementById('event-output');
const wsOutput = document.getElementById('ws-output');

const btnGetAgents = document.getElementById('btn-get-agents');
const btnGetActive = document.getElementById('btn-get-active');
const btnSendEvent = document.getElementById('btn-send-event');

const agentIdInput = document.getElementById('agent-id');
const agentEventInput = document.getElementById('agent-event');
const componentIdInput = document.getElementById('component-id');
const componentStateInput = document.getElementById('component-state');

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

btnGetAgents.addEventListener('click', async () => {
  agentsOutput.textContent = 'Loading...';
  try {
    const data = await postJson('/api/get_agents');
    agentsOutput.textContent = pretty(data);
  } catch (err) {
    agentsOutput.textContent = String(err);
  }
});

btnGetActive.addEventListener('click', async () => {
  agentsOutput.textContent = 'Loading...';
  try {
    const data = await postJson('/api/get_active_agent');
    agentsOutput.textContent = pretty(data);
  } catch (err) {
    agentsOutput.textContent = String(err);
  }
});

btnSendEvent.addEventListener('click', async () => {
  eventOutput.textContent = 'Sending...';
  const agent_id = agentIdInput.value.trim();
  const event = agentEventInput.value.trim();
  const component_id = componentIdInput.value.trim();
  const state = componentStateInput.value.trim();

  try {
    const data = await postJson('/api/send_to_agent', {
      agent_id,
      event,
      component_id: component_id || undefined,
      state: state === '' ? undefined : Number(state)
    });
    eventOutput.textContent = pretty(data);
  } catch (err) {
    eventOutput.textContent = String(err);
  }
});

function appendWsLine(line) {
  const next = `${new Date().toISOString()} ${line}`;
  wsOutput.textContent = `${next}\n${wsOutput.textContent}`.slice(0, 4000);
}

const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProto}//${location.host}/ws`;
const ws = new WebSocket(wsUrl);

ws.addEventListener('open', () => appendWsLine('connected'));
ws.addEventListener('close', () => appendWsLine('disconnected'));
ws.addEventListener('message', (evt) => appendWsLine(evt.data));
ws.addEventListener('error', () => appendWsLine('error'));
