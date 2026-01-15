# Booster Robot Interface Example

This example provides a minimal web UI plus a Node.js proxy that talks to the robot's
agent manager. It demonstrates the TCP JSON protocol (port 6868) and the agent manager
WebSocket feed (port 16888).

## What it does
- Fetch installed agents (`get_agents`)
- Fetch the active agent (`get_active_agent`)
- Send an agent event (`send_to_agent`)
- Forward robot WebSocket messages to the browser

## Requirements
- Node.js 18+
- Network access to the robot

## Setup
1) Install dependencies:

```bash
cd examples/robot-interface
npm install
```

2) Start the server (replace the IP):

```bash
ROBOT_IP=192.168.1.10 npm start
```

3) Open the UI:

```
http://localhost:3000
```

## Notes
- The TCP client sends a 4-byte little-endian length prefix, followed by UTF-8 JSON.
- The WebSocket proxy listens to `ws://<robot-ip>:16888`.
- Agent IDs and component IDs come from the robot responses.

## Next steps
- Add a dedicated action grid that uses the returned agent UI components.
- Layer in direct robot RPC controls if you want non-agent movement controls.
