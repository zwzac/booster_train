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
