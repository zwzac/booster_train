const orchIdInput = document.getElementById('orch-id');
const trackIdInput = document.getElementById('track-id');
const trackTypeInput = document.getElementById('track-type');
const shortcutInput = document.getElementById('orch-shortcut');
const btnAddFrame = document.getElementById('btn-add-frame');
const btnClearFrames = document.getElementById('btn-clear-frames');
const btnImport = document.getElementById('btn-import');
const btnExport = document.getElementById('btn-export');
const fileInput = document.getElementById('file-input');

const framesEl = document.getElementById('frames');
const previewFrame = document.getElementById('robot-preview');
const thumbnailFrame = document.getElementById('robot-thumbnailer');
const movementPreview = document.getElementById('movement-preview');
const movementScale = document.getElementById('movement-scale');

const state = {
  frames: [],
  previewIndex: 0,
  previewReady: false,
  thumbnailReady: false,
  ignorePreviewMessages: false,
  currentPoseDegrees: new Array(10).fill(0),
  thumbnails: [],
  thumbnailQueue: [],
  thumbnailCaptureInProgress: false
};

if (movementPreview && movementScale) {
  let syncing = false;
  const syncScroll = (source, target) => {
    if (syncing) {
      return;
    }
    syncing = true;
    target.scrollLeft = source.scrollLeft;
    syncing = false;
  };
  movementPreview.addEventListener('scroll', () => syncScroll(movementPreview, movementScale));
  movementScale.addEventListener('scroll', () => syncScroll(movementScale, movementPreview));
}

const JOINT_NAMES = [
  'HEAD_ROLL',
  'HEAD_PITCH',
  'LEFT_SHOULDER_PITCH',
  'LEFT_SHOULDER_ROLL',
  'LEFT_ELBOW_PITCH',
  'LEFT_ELBOW_YAW',
  'RIGHT_SHOULDER_PITCH',
  'RIGHT_SHOULDER_ROLL',
  'RIGHT_ELBOW_PITCH',
  'RIGHT_ELBOW_YAW'
];

const JOINT_LABELS = [
  'Head Roll',
  'Head Pitch',
  'Left Shoulder Pitch',
  'Left Shoulder Roll',
  'Left Elbow Pitch',
  'Left Elbow Yaw',
  'Right Shoulder Pitch',
  'Right Shoulder Roll',
  'Right Elbow Pitch',
  'Right Elbow Yaw'
];

const JOINT_INDEX = JOINT_NAMES.reduce((acc, name, index) => {
  acc[name] = index;
  return acc;
}, {});

const JOINT_LIMITS = [
  { min: -56, max: 56 },
  { min: -16, max: 45 },
  { min: -186, max: 66 },
  { min: -92, max: 86 },
  { min: -126, max: 126 },
  { min: -118, max: 0 },
  { min: -186, max: 66 },
  { min: -86, max: 92 },
  { min: -126, max: 126 },
  { min: 0, max: 118 }
];

function buildPayload() {
  const orchId = orchIdInput.value.trim();
  const trackId = trackIdInput.value.trim();
  const trackType = Number(trackTypeInput.value) || 0;
  const shortcut = shortcutInput.value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  let cumulativeTs = 0;
  return {
    orch_id: orchId,
    track_id: trackId,
    track_type: trackType,
    shortcut,
    content: state.frames.map((frame) => ({
      ts: (cumulativeTs += Math.max(0, Number(frame.ts) || 0)),
      a: frame.a.map((deg) => Math.round((Number(deg) || 0) * 10))
    }))
  };
}

function updatePreview() {
  return;
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

function radiansToTenthsDegrees(rad) {
  return Math.round((rad * 180) / Math.PI * 10);
}

function clampJoint(index, value) {
  const limits = JOINT_LIMITS[index];
  if (!limits) {
    return Math.round(value || 0);
  }
  const raw = Math.round(value || 0);
  return Math.min(limits.max, Math.max(limits.min, raw));
}

function buildJointMapFromFrame(frame) {
  const jointMap = {};
  JOINT_NAMES.forEach((name, index) => {
    const deg = clampJoint(index, Number(frame?.a?.[index] || 0));
    jointMap[name] = degreesToRadians(deg);
  });
  return jointMap;
}

function updateRobotPreviewFromFrame(frame) {
  if (!state.previewReady || !previewFrame?.contentWindow?.updateJoints || !frame) {
    return;
  }
  const jointMap = buildJointMapFromFrame(frame);
  state.ignorePreviewMessages = true;
  previewFrame.contentWindow.updateJoints(JSON.stringify(jointMap));
  setTimeout(() => {
    state.ignorePreviewMessages = false;
  }, 0);
}

function refreshPreview() {
  const frame = state.frames[state.previewIndex];
  if (!frame) {
    return;
  }
  let changed = false;
  frame.a = frame.a.map((value, index) => {
    const clamped = clampJoint(index, value);
    if (clamped !== value) {
      changed = true;
    }
    return clamped;
  });
  state.currentPoseDegrees = frame.a.slice();
  syncActiveFrameInputs();
  updateRobotPreviewFromFrame(frame);
  queueThumbnail(state.previewIndex);
  if (changed) {
    updatePreview();
  }
}

function queueThumbnail(index) {
  const frame = state.frames[index];
  if (!frame) {
    return;
  }
  const key = JSON.stringify(frame.a);
  const current = state.thumbnails[index];
  if (current && current.key === key) {
    return;
  }
  const exists = state.thumbnailQueue.some((item) => item.index === index && item.key === key);
  if (exists) {
    return;
  }
  state.thumbnailQueue.push({ index, key });
  processThumbnailQueue();
}

function queueMissingThumbnails() {
  state.frames.forEach((frame, index) => {
    if (!frame) {
      return;
    }
    const key = JSON.stringify(frame.a);
    const current = state.thumbnails[index];
    if (!current || current.key !== key) {
      queueThumbnail(index);
    }
  });
}

function processThumbnailQueue() {
  if (state.thumbnailCaptureInProgress) {
    return;
  }
  if (!state.thumbnailQueue.length) {
    return;
  }
  const rendererFrame = state.thumbnailReady && thumbnailFrame?.contentWindow?.updateJoints
    ? thumbnailFrame
    : null;
  if (!rendererFrame?.contentWindow?.updateJoints || !rendererFrame?.contentWindow?.takeSnapshot) {
    return;
  }
  const target = state.thumbnailQueue.shift();
  const frame = state.frames[target.index];
  if (!frame || JSON.stringify(frame.a) !== target.key) {
    processThumbnailQueue();
    return;
  }
  state.thumbnailCaptureInProgress = true;
  const jointMap = buildJointMapFromFrame(frame);
  rendererFrame.contentWindow.updateJoints(JSON.stringify(jointMap));
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const dataUrl = rendererFrame.contentWindow.takeSnapshot();
      state.thumbnails[target.index] = { key: target.key, dataUrl };
      state.thumbnailCaptureInProgress = false;
      renderMovementPreview();
      processThumbnailQueue();
    });
  });
}

function renderMovementPreview() {
  if (!movementPreview) {
    return;
  }
  movementPreview.innerHTML = '';
  if (movementScale) {
    movementScale.innerHTML = '';
  }
  if (!state.frames.length) {
    movementPreview.innerHTML = '<div class="empty">No frames to preview yet.</div>';
    return;
  }
  let cumulativeTs = 0;
  state.frames.forEach((frame, index) => {
    const card = document.createElement('div');
    card.className = 'movement-card';
    if (index === state.previewIndex) {
      card.classList.add('active');
    }
    card.addEventListener('click', () => {
      if (!state.frames[index]) {
        return;
      }
      state.previewIndex = index;
      state.currentPoseDegrees = state.frames[index].a.slice();
      renderFrames();
      refreshPreview();
    });

    const thumb = document.createElement('div');
    thumb.className = 'movement-thumb';
    const shot = state.thumbnails[index]?.dataUrl;
    if (shot) {
      const img = document.createElement('img');
      img.src = shot;
      img.alt = `Frame ${index + 1}`;
      thumb.appendChild(img);
    } else {
      thumb.textContent = 'Preview';
    }

    const meta = document.createElement('div');
    meta.className = 'movement-meta';
    const duration = Math.max(0, Number(frame.ts) || 0);
    cumulativeTs += duration;
    meta.innerHTML = `<span>Frame ${index + 1}</span><span>${duration} ms</span>`;

    card.appendChild(thumb);
    card.appendChild(meta);
    movementPreview.appendChild(card);

    if (movementScale) {
      const tick = document.createElement('span');
      tick.textContent = `${cumulativeTs} ms`;
      movementScale.appendChild(tick);
    }
  });
}

function syncActiveFrameInputs() {
  const frame = state.frames[state.previewIndex];
  if (!frame) {
    return;
  }
  const inputs = framesEl.querySelectorAll(
    `input[data-index="${state.previewIndex}"][data-joint]`
  );
  inputs.forEach((input) => {
    if (document.activeElement === input) {
      return;
    }
    const joint = Number(input.dataset.joint);
    if (!Number.isFinite(joint)) {
      return;
    }
    const next = clampJoint(joint, frame.a[joint]);
    if (frame.a[joint] !== next) {
      frame.a[joint] = next;
    }
    input.value = String(next);
  });
}

function makeFrame(ts) {
  return {
    ts,
    a: state.currentPoseDegrees.map((value, index) => clampJoint(index, value))
  };
}

function renderFrames() {
  framesEl.innerHTML = '';
  const frame = state.frames[state.previewIndex];
  if (!frame) {
    framesEl.innerHTML = '<div class="empty">Add frames to begin editing.</div>';
  } else {
    const card = document.createElement('div');
    card.className = 'frame-card active';

    const header = document.createElement('div');
    header.className = 'frame-header';
    header.innerHTML = `<span>Frame ${state.previewIndex + 1} of ${state.frames.length}</span>`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ghost';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      state.frames.splice(state.previewIndex, 1);
      if (state.previewIndex >= state.frames.length) {
        state.previewIndex = Math.max(0, state.frames.length - 1);
      }
      state.currentPoseDegrees = state.frames[state.previewIndex]?.a?.slice() || new Array(10).fill(0);
      renderFrames();
      updatePreview();
      refreshPreview();
    });
    header.appendChild(removeBtn);

    const grid = document.createElement('div');
    grid.className = 'frame-grid';

    const tsLabel = document.createElement('label');
    tsLabel.innerHTML = `duration (ms)<input data-index="${state.previewIndex}" data-field="ts" type="number" value="${frame.ts}">`;
    grid.appendChild(tsLabel);

    frame.a.forEach((value, jointIndex) => {
      const label = document.createElement('label');
      const jointLabel = JOINT_LABELS[jointIndex] || `J${jointIndex + 1}`;
      const limits = JOINT_LIMITS[jointIndex] || {};
      label.innerHTML = `${jointLabel}<input data-index="${state.previewIndex}" data-joint="${jointIndex}" type="number" step="1" min="${limits.min ?? ''}" max="${limits.max ?? ''}" value="${value}">`;
      grid.appendChild(label);
    });

    card.appendChild(header);
    card.appendChild(grid);
    framesEl.appendChild(card);
  }
  queueMissingThumbnails();
  renderMovementPreview();
}

framesEl.addEventListener('input', (event) => {
  const input = event.target;
  if (input.tagName !== 'INPUT') {
    return;
  }
  const index = Number(input.dataset.index);
  if (!Number.isFinite(index) || !state.frames[index]) {
    return;
  }
  if (input.dataset.field === 'ts') {
    state.frames[index].ts = Number(input.value) || 0;
  }
  if (input.dataset.joint !== undefined) {
    const joint = Number(input.dataset.joint);
    if (Number.isFinite(joint)) {
      const raw = input.value.trim();
      if (raw === '' || raw === '-' || raw === '+') {
        return;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return;
      }
      state.frames[index].a[joint] = parsed;
    }
  }
  updatePreview();
  if (index === state.previewIndex) {
    state.currentPoseDegrees = state.frames[index].a.slice();
    refreshPreview();
  }
});

framesEl.addEventListener('change', (event) => {
  const input = event.target;
  if (input.tagName !== 'INPUT' || input.dataset.joint === undefined) {
    return;
  }
  const index = Number(input.dataset.index);
  const joint = Number(input.dataset.joint);
  if (!Number.isFinite(index) || !Number.isFinite(joint) || !state.frames[index]) {
    return;
  }
  const raw = input.value.trim();
  if (raw === '' || raw === '-' || raw === '+') {
    return;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return;
  }
  const clamped = clampJoint(joint, parsed);
  state.frames[index].a[joint] = clamped;
  input.value = String(clamped);
  if (index === state.previewIndex) {
    state.currentPoseDegrees = state.frames[index].a.slice();
    refreshPreview();
  }
  updatePreview();
});

function stopFrameClick(event) {
  const target = event.target;
  if (target.tagName === 'INPUT' || target.closest('label')) {
    event.stopPropagation();
  }
}

framesEl.addEventListener('click', stopFrameClick);
framesEl.addEventListener('mousedown', stopFrameClick);
framesEl.addEventListener('pointerdown', stopFrameClick);

framesEl.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }
  const input = event.target;
  if (input.tagName !== 'INPUT') {
    return;
  }
  input.blur();
});

btnAddFrame.addEventListener('click', () => {
  const nextTs = 20;
  state.frames.push(makeFrame(nextTs));
  state.previewIndex = state.frames.length - 1;
  renderFrames();
  updatePreview();
  refreshPreview();
});

btnClearFrames.addEventListener('click', () => {
  state.frames = [];
  state.thumbnails = [];
  state.thumbnailQueue = [];
  state.thumbnailCaptureInProgress = false;
  renderFrames();
  updatePreview();
});

btnImport.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const frames = Array.isArray(json)
      ? json
      : Array.isArray(json.content)
        ? json.content
        : [];
    let prevTs = 0;
    let useCumulative = true;
    for (let i = 0; i < frames.length; i += 1) {
      const rawTs = Number(frames[i]?.ts) || 0;
      if (rawTs < prevTs) {
        useCumulative = false;
        break;
      }
      prevTs = rawTs;
    }
    prevTs = 0;
    state.frames = frames.map((frame) => ({
      ts: (() => {
        const rawTs = Number(frame.ts) || 0;
        if (!useCumulative) {
          return Math.max(0, rawTs);
        }
        const duration = Math.max(0, rawTs - prevTs);
        prevTs = rawTs;
        return duration;
      })(),
      a: Array.isArray(frame.a)
        ? frame.a.map((v, i) => {
          const value = Number(v) || 0;
          const deg = Math.abs(value) > 180 ? value / 10 : value;
          return clampJoint(i, Math.round(deg));
        })
        : new Array(10).fill(0)
    }));
    state.previewIndex = 0;
    state.currentPoseDegrees = state.frames[0]?.a?.slice() || new Array(10).fill(0);
    state.thumbnails = [];
    state.thumbnailQueue = [];
    state.thumbnailCaptureInProgress = false;
    renderFrames();
    updatePreview();
    refreshPreview();
  } catch (err) {
    payloadPreview.textContent = `Import failed: ${err}`;
  }
});

btnExport.addEventListener('click', () => {
  const payload = buildPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orch-track-${payload.orch_id || 'unknown'}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

trackIdInput.addEventListener('input', updatePreview);
trackTypeInput.addEventListener('input', updatePreview);
orchIdInput.addEventListener('input', updatePreview);
shortcutInput.addEventListener('input', updatePreview);

previewFrame.addEventListener('load', () => {
  state.previewReady = true;
  refreshPreview();
});

if (thumbnailFrame) {
  thumbnailFrame.addEventListener('load', () => {
    state.thumbnailReady = true;
    queueMissingThumbnails();
  });
}

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (previewFrame?.contentWindow && event.source !== previewFrame.contentWindow) {
    return;
  }
  if (data.type !== 'urdf_joint_update') {
    return;
  }
  if (state.ignorePreviewMessages) {
    return;
  }
  const index = JOINT_INDEX[data.joint];
  if (!Number.isFinite(index)) {
    return;
  }
  const deg = clampJoint(index, Math.round((Number(data.rad) || 0) * 180 / Math.PI));
  state.currentPoseDegrees[index] = deg;
  const activeFrame = state.frames[state.previewIndex];
  if (activeFrame) {
    activeFrame.a[index] = deg;
    syncActiveFrameInputs();
    updatePreview();
  }
});

renderFrames();
updatePreview();
