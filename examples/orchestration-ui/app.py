import json
import os
import secrets
import time

import paramiko
from flask import Flask, jsonify, request, send_from_directory


app = Flask(__name__, static_folder="public", static_url_path="")


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


def _sftp_exists(sftp, path):
    try:
        sftp.stat(path)
        return True
    except (FileNotFoundError, OSError):
        return False


def _sftp_mkdirs(sftp, path):
    parts = path.strip("/").split("/")
    current = ""
    for part in parts:
        current = f"{current}/{part}"
        if not _sftp_exists(sftp, current):
            sftp.mkdir(current)


def _read_json_file(sftp, path, default):
    if not _sftp_exists(sftp, path):
        return default
    with sftp.open(path, "r") as handle:
        raw = handle.read()
    text = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
    if not text.strip():
        return default
    return json.loads(text)


def _write_json_file(sftp, path, payload):
    data = json.dumps(payload, indent=2, ensure_ascii=True)
    with sftp.open(path, "w") as handle:
        handle.write(f"{data}\n")


def _normalize_shortcut(value):
    if isinstance(value, list):
        return [str(entry).strip() for entry in value if str(entry).strip()]
    if isinstance(value, str):
        parts = [part.strip() for part in value.replace(",", "+").split("+")]
        return [part for part in parts if part]
    return []


def _ensure_track_entry(tracks, track_id, track_type):
    for entry in tracks:
        if entry.get("track_id") == track_id:
            entry["track_type"] = track_type
            return
    tracks.append({"track_id": track_id, "track_type": track_type})


@app.post("/api/publish")
def publish():
    data = request.get_json(silent=True) or {}
    robot = data.get("robot") or {}
    payload = data.get("payload") or {}
    host = (robot.get("host") or "").strip()
    username = (robot.get("username") or "").strip()
    password = robot.get("password") or ""

    if not host or not username or not password:
        return jsonify({"error": "Robot host, username, and password are required."}), 400

    content = payload.get("content")
    if not isinstance(content, list) or not content:
        return jsonify({"error": "Payload content must be a non-empty list."}), 400

    orch_id = (payload.get("orch_id") or "").strip() or secrets.token_hex(16)
    track_id = (payload.get("track_id") or "").strip() or secrets.token_hex(16)
    try:
        track_type = int(payload.get("track_type") or 0)
    except (TypeError, ValueError):
        track_type = 0

    shortcut = _normalize_shortcut(payload.get("shortcut"))
    name = (payload.get("name") or "").strip() or orch_id

    base_dir = "/opt/BoosterAgent/agent_storage/com.boosterobotics.teaching"
    orch_dir = f"{base_dir}/orchestrations/{orch_id}"
    track_dir = f"{orch_dir}/track_{track_id}"
    track_path = f"{track_dir}/{track_id}.json"
    index_path = f"{base_dir}/orchestrations.json"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=host, username=username, password=password, timeout=10)
        sftp = client.open_sftp()
        _sftp_mkdirs(sftp, track_dir)
        _write_json_file(sftp, track_path, content)

        orch_index = _read_json_file(sftp, index_path, {"orch_list": []})
        if not isinstance(orch_index, dict):
            orch_index = {"orch_list": []}
        orch_list = orch_index.get("orch_list")
        if not isinstance(orch_list, list):
            orch_list = []
            orch_index["orch_list"] = orch_list

        orch_entry = next((entry for entry in orch_list if entry.get("id") == orch_id), None)
        if orch_entry is None:
            orch_entry = {
                "activated": False,
                "allow_delete": True,
                "create_time": int(time.time()),
                "icon_name": "",
                "id": orch_id,
                "name": name,
                "shortcut": shortcut,
                "tracks": []
            }
            orch_list.append(orch_entry)
        else:
            orch_entry["name"] = name or orch_entry.get("name") or orch_id
            orch_entry["shortcut"] = shortcut

        tracks = orch_entry.get("tracks")
        if not isinstance(tracks, list):
            tracks = []
            orch_entry["tracks"] = tracks
        _ensure_track_entry(tracks, track_id, track_type)

        _write_json_file(sftp, index_path, orch_index)
    except (OSError, ValueError) as exc:
        return jsonify({"error": f"SSH publish failed: {exc}"}), 500
    finally:
        try:
            client.close()
        except Exception:
            pass

    return jsonify(
        {
            "orch_id": orch_id,
            "track_id": track_id,
            "track_type": track_type,
            "published": True
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    print(f"UI server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port)
