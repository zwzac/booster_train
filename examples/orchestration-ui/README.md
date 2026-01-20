# Booster Orchestration Frame Editor

This example is a local web UI that lets you create upper-body orchestration
frames and export them to JSON.

## What it does
- Edit frames with a live URDF preview
- Export/import JSON for offline editing

## Requirements
- Python 3.10+

## Setup
1) Install dependencies:

```bash
cd booster_train/examples/orchestration-ui
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

2) Start the server:

```bash
python app.py
```

3) Open the UI:

```
http://localhost:3000
```

## Notes
- Frame inputs use degrees to match the preview sliders. Export converts to tenths of degrees.
- The preview iframe is served from `public/urdf_render` copied from the Android assets.

## Upload to robot (scp)
The mobile app sends orchestration JSON to the robot via the agent RPC
(`orchestration_operation` with `orch_set_track_data`). The on-robot storage
path is managed by the robot agent and is not visible in the Android app code.

If you already know the robot's orchestration directory, copy the exported file
with `scp`:

```bash
scp orch-track-<orch_id>.json <user>@<robot-host>:/path/to/orchestration/
```

If you do not know the path yet, create a test orchestration from the mobile
app, then inspect the robot filesystem to locate the stored JSON and reuse that
directory for future uploads.
