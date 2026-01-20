import os

from flask import Flask, send_from_directory


app = Flask(__name__, static_folder="public", static_url_path="")


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    print(f"UI server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port)
