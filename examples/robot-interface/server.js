const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 3000;
const ROBOT_IP = process.env.ROBOT_IP || '192.168.1.10';
const AGENT_TCP_PORT = 6868;
const AGENT_WS_PORT = 16888;

const publicDir = path.join(__dirname, 'public');

function sendAgentRequest(request, params, agentReq) {
  return new Promise((resolve, reject) => {
    const payload = {
      request,
      language: 'en',
      app_api_level: 110,
      app_platform: 'Node'
    };

    if (params) {
      payload.params = params;
    }
    if (agentReq) {
      payload.agent_req = agentReq;
    }

    const json = JSON.stringify(payload);
    const data = Buffer.from(json, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(data.length, 0);

    const socket = new net.Socket();
    const chunks = [];
    let expectedLen = null;

    socket.setTimeout(8000);
    socket.connect(AGENT_TCP_PORT, ROBOT_IP, () => {
      socket.write(header);
      socket.write(data);
    });

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const all = Buffer.concat(chunks);

      if (expectedLen === null && all.length >= 4) {
        expectedLen = all.readUInt32LE(0);
      }

      if (expectedLen !== null && all.length >= expectedLen + 4) {
        const body = all.slice(4, 4 + expectedLen).toString('utf8');
        socket.destroy();
        resolve(body);
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('TCP request timed out'));
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

function sendJson(res, status, obj) {
  const payload = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(publicDir, filePath);

    if (!filePath.startsWith(publicDir)) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = ext === '.css'
        ? 'text/css'
        : ext === '.js'
          ? 'application/javascript'
          : 'text/html';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/get_agents') {
    try {
      const raw = await sendAgentRequest('get_agents');
      sendJson(res, 200, { raw: JSON.parse(raw) });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/get_active_agent') {
    try {
      const raw = await sendAgentRequest('get_active_agent');
      sendJson(res, 200, { raw: JSON.parse(raw) });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/send_to_agent') {
    const body = await parseBody(req);
    const params = { agent_id: body.agent_id };
    const agentReq = { event: body.event };

    if (body.component_id) {
      agentReq.component_id = body.component_id;
    }
    if (body.state !== undefined) {
      agentReq.state = body.state;
    }

    try {
      const raw = await sendAgentRequest('send_to_agent', params, agentReq);
      sendJson(res, 200, { raw: JSON.parse(raw) });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ noServer: true });

let robotWs = null;
let robotWsConnected = false;
let robotWsTimer = null;

function connectRobotWs() {
  if (robotWsConnected || robotWs) {
    return;
  }

  const url = `ws://${ROBOT_IP}:${AGENT_WS_PORT}`;
  robotWs = new WebSocket(url);

  robotWs.on('open', () => {
    robotWsConnected = true;
    console.log(`Robot WS connected: ${url}`);
  });

  robotWs.on('message', (data) => {
    const message = data.toString();
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  robotWs.on('close', () => {
    robotWsConnected = false;
    robotWs = null;
    console.log('Robot WS closed, retrying in 3s');
    robotWsTimer = setTimeout(connectRobotWs, 3000);
  });

  robotWs.on('error', (err) => {
    console.error('Robot WS error', err.message);
  });
}

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  ws.send('connected to proxy');
  connectRobotWs();
});

server.listen(PORT, () => {
  console.log(`UI server on http://localhost:${PORT}`);
  console.log(`Proxying robot at ${ROBOT_IP}`);
});
