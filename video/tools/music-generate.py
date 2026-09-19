#!/usr/bin/env python3
"""Generate a music bed with ElevenLabs Music.

    python3 video/tools/music-generate.py <slug> --prompt "..." --seconds 62 --name bed-a [--dry-run]

Writes video/project/public/<slug>/music/<name>.mp3. Same gate and auth rules
as vo-generate.py. The request shape (POST /v1/music with prompt and
music_length_ms) is from ElevenLabs' published API and is unverified here
until the first real run; if it fails, read the error and adjust once.
"""
import argparse, json, os, sys, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); VIDEO = os.path.abspath(os.path.join(HERE, ".."))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug"); ap.add_argument("--prompt", required=True); ap.add_argument("--seconds", type=float, required=True)
    ap.add_argument("--name", default="bed"); ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    pdir = os.path.join(VIDEO, "projects", a.slug)
    gates = json.load(open(os.path.join(pdir, "gates.json"))) if os.path.exists(os.path.join(pdir, "gates.json")) else {}
    if not a.dry_run and gates.get("brief") != "approved":
        print("refusing: gates.json does not say brief: approved"); sys.exit(2)
    body = {"prompt": a.prompt, "music_length_ms": int(a.seconds * 1000)}
    if a.dry_run:
        print("would POST /v1/music with", json.dumps(body)); return
    headers = {"accept": "audio/mpeg", "content-type": "application/json"}
    key = os.environ.get("ELEVENLABS_API_KEY")
    if key: headers["xi-api-key"] = key
    req = urllib.request.Request("https://api.elevenlabs.io/v1/music", data=json.dumps(body).encode(), method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=600) as r: audio = r.read()
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read()[:400].decode('utf8','replace')}"); sys.exit(1)
    out_dir = os.path.join(VIDEO, "project", "public", a.slug, "music"); os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{a.name}.mp3"); open(path, "wb").write(audio)
    print(f"ok: {len(audio)} bytes -> {path}")

if __name__ == "__main__": main()
