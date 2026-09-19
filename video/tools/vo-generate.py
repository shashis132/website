#!/usr/bin/env python3
"""Generate voice-over lines with ElevenLabs, with word timestamps and a cache.

    python3 video/tools/vo-generate.py --check                  # is the key accepted? how many characters left?
    python3 video/tools/vo-generate.py --probe "Hello from GeniusCFO."  [--voice ID]   # one short test line
    python3 video/tools/vo-generate.py <slug> --dry-run         # what would be generated, and how many characters
    python3 video/tools/vo-generate.py <slug>                   # generate every line not already cached
    python3 video/tools/vo-generate.py <slug> --only s03 --force

Input  video/projects/<slug>/vo/lines.json:
    {"voice_id": "...", "model_id": "eleven_multilingual_v2",
     "settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "speed": 1.0},
     "lines": [{"id": "s01", "text": "..."}, ...]}
    A line may override "voice_id", "model_id" or "settings".
Output video/project/public/<slug>/vo/<id>.mp3 + <id>.alignment.json, and
       video/projects/<slug>/vo/manifest.json (also copied next to the mp3s).

Gate: generation for a project refuses unless video/projects/<slug>/gates.json
has "brief": "approved". --check and --probe need no project.

Auth: if ELEVENLABS_API_KEY is set it is sent as the xi-api-key header;
otherwise the request goes out without a key and the cloud environment's API
credential (the recommended setup) attaches it on the way out.
"""
import argparse, base64, hashlib, json, os, sys, time, urllib.request, urllib.error

API = "https://api.elevenlabs.io/v1"
HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.abspath(os.path.join(HERE, ".."))
PROBE_VOICE = "21m00Tcm4TlvDq8ikWAM"  # ElevenLabs stock voice, present on every account

def request(method, path, body=None, timeout=120):
    headers = {"accept": "application/json"}
    key = os.environ.get("ELEVENLABS_API_KEY")
    if key:
        headers["xi-api-key"] = key
    data = None
    if body is not None:
        headers["content-type"] = "application/json"
        data = json.dumps(body).encode("utf8")
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # network / proxy
        return 0, str(e).encode()

def check():
    status, body = request("GET", "/user/subscription")
    if status != 200:
        print(f"ElevenLabs not reachable or key rejected (HTTP {status}): {body[:300].decode('utf8','replace')}")
        sys.exit(1)
    s = json.loads(body)
    used, limit = s.get("character_count", 0), s.get("character_limit", 0)
    print(f"tier: {s.get('tier')}  characters used: {used:,} of {limit:,}  ({limit-used:,} left)")
    print(f"next reset: {time.strftime('%Y-%m-%d', time.gmtime(s.get('next_character_count_reset_unix', 0)))}")

def words_from_alignment(al):
    chars = al.get("characters", []); st = al.get("character_start_times_seconds", []); en = al.get("character_end_times_seconds", [])
    words, cur, start = [], "", None
    for c, s, e in zip(chars, st, en):
        if c.isspace():
            if cur: words.append({"text": cur, "start": start, "end": last_end}); cur = ""
            continue
        if not cur: start = s
        cur += c; last_end = e
    if cur: words.append({"text": cur, "start": start, "end": last_end})
    return words

def tts(text, voice_id, model_id, settings):
    body = {"text": text, "model_id": model_id, "voice_settings": settings}
    status, raw = request("POST", f"/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128", body, timeout=300)
    if status != 200:
        raise RuntimeError(f"HTTP {status}: {raw[:400].decode('utf8','replace')}")
    j = json.loads(raw)
    audio = base64.b64decode(j["audio_base64"])
    al = j.get("normalized_alignment") or j.get("alignment") or {}
    words = words_from_alignment(al)
    ends = al.get("character_end_times_seconds") or [0]
    return audio, words, float(ends[-1]) if ends else 0.0, al

def cache_key(text, voice_id, model_id, settings):
    return hashlib.sha256(json.dumps([text, voice_id, model_id, settings], sort_keys=True).encode()).hexdigest()[:16]

def probe(text, voice):
    out_dir = os.path.join(VIDEO, "renders", "_probe"); os.makedirs(out_dir, exist_ok=True)
    audio, words, dur, _ = tts(text, voice, "eleven_multilingual_v2", {"stability": 0.5, "similarity_boost": 0.75})
    path = os.path.join(out_dir, "probe.mp3")
    open(path, "wb").write(audio)
    print(f"ok: {len(audio)} bytes, {dur:.2f} s, {len(words)} words -> {path}")

def generate(slug, dry, force, only):
    pdir = os.path.join(VIDEO, "projects", slug)
    gates = json.load(open(os.path.join(pdir, "gates.json"))) if os.path.exists(os.path.join(pdir, "gates.json")) else {}
    if not dry and gates.get("brief") != "approved":
        print(f"refusing: video/projects/{slug}/gates.json does not say brief: approved"); sys.exit(2)
    spec = json.load(open(os.path.join(pdir, "vo", "lines.json")))
    out_dir = os.path.join(VIDEO, "project", "public", slug, "vo"); os.makedirs(out_dir, exist_ok=True)
    manifest = {"voice_id": spec["voice_id"], "model_id": spec.get("model_id", "eleven_multilingual_v2"), "lines": []}
    total_chars, todo = 0, 0
    for line in spec["lines"]:
        lid, text = line["id"], line["text"].strip()
        voice = line.get("voice_id", spec["voice_id"]); model = line.get("model_id", manifest["model_id"])
        settings = {**spec.get("settings", {}), **line.get("settings", {})}
        key = cache_key(text, voice, model, settings)
        mp3 = os.path.join(out_dir, f"{lid}.mp3"); alj = os.path.join(out_dir, f"{lid}.alignment.json")
        cached = os.path.exists(mp3) and os.path.exists(alj) and json.load(open(alj)).get("key") == key
        wanted = (only is None or lid in only)
        if cached and not (force and wanted):
            entry = json.load(open(alj)); status = "cached"
        elif not wanted:
            print(f"  {lid}: skipped (not in --only)"); continue
        else:
            total_chars += len(text); todo += 1; status = "generate"
            if dry:
                print(f"  {lid}: would generate {len(text)} chars: {text[:60]}..."); continue
            audio, words, dur, al = tts(text, voice, model, settings)
            open(mp3, "wb").write(audio)
            entry = {"key": key, "id": lid, "text": text, "voice_id": voice, "model_id": model, "settings": settings,
                     "duration": round(dur, 3), "words": words, "alignment": al}
            json.dump(entry, open(alj, "w"), indent=1)
        manifest["lines"].append({"id": lid, "text": text, "file": f"{slug}/vo/{lid}.mp3", "duration": entry["duration"], "words": entry["words"]})
        print(f"  {lid}: {status} ({entry['duration']:.2f} s)")
    if dry:
        print(f"dry run: {todo} lines, {total_chars} characters would be sent"); return
    json.dump(manifest, open(os.path.join(pdir, "vo", "manifest.json"), "w"), indent=1)
    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), indent=1)
    print(f"manifest: {len(manifest['lines'])} lines -> video/projects/{slug}/vo/manifest.json")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--probe")
    ap.add_argument("--voice", default=PROBE_VOICE)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    if a.check: check()
    elif a.probe: probe(a.probe, a.voice)
    elif a.slug: generate(a.slug, a.dry_run, a.force, a.only)
    else: ap.print_help()
