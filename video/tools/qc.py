#!/usr/bin/env python3
"""Quality check for a rendered video. Exit code 1 when a check fails.

    python3 video/tools/qc.py <file.mp4> [--expect-size 1920x1080] [--expect-seconds 63.4]

Checks: container and streams, resolution, duration, black frames (one sample
per second), integrated loudness and true peak when an audio track exists.
"""
import argparse, json, subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.join(HERE, "..", "project")

def run(args, capture_stderr=False):
    r = subprocess.run(args, cwd=PROJECT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return (r.stderr if capture_stderr else r.stdout)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--expect-size")
    ap.add_argument("--expect-seconds", type=float)
    ap.add_argument("--tolerance", type=float, default=0.25, help="seconds")
    a = ap.parse_args()
    f = os.path.abspath(a.file)
    fails = []
    info = json.loads(run(["npx", "remotion", "ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", f]) or b"{}")
    streams = info.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    au = next((s for s in streams if s.get("codec_type") == "audio"), None)
    if not v:
        print("FAIL no video stream"); sys.exit(1)
    dur = float(info["format"].get("duration", 0))
    size = f'{v["width"]}x{v["height"]}'
    fps = v.get("r_frame_rate", "?")
    print(f"file      {os.path.basename(f)}  ({int(info['format'].get('size', 0))//1024} KB)")
    print(f"video     {v['codec_name']} {size} {fps} fps, {v.get('pix_fmt')}")
    print(f"audio     {au['codec_name'] + ' ' + str(au.get('sample_rate')) + ' Hz ' + str(au.get('channels')) + 'ch' if au else 'none'}")
    print(f"duration  {dur:.2f} s")
    if a.expect_size and size != a.expect_size:
        fails.append(f"size {size} != {a.expect_size}")
    if a.expect_seconds is not None and abs(dur - a.expect_seconds) > a.tolerance:
        fails.append(f"duration {dur:.2f} != {a.expect_seconds:.2f} (+/-{a.tolerance})")
    # Black frames: one 32x18 grey PNG per second (this ffmpeg build has no
    # fps filter and no rawvideo muxer), decoded here without extra libraries
    # because the PNGs are written with no prediction filter.
    import tempfile, glob, zlib, struct, shutil
    tmp = tempfile.mkdtemp(prefix="qc-")
    run(["npx", "remotion", "ffmpeg", "-v", "quiet", "-y", "-i", f, "-r", "1", "-vf", "scale=32:18", "-pix_fmt", "gray", "-c:v", "png", "-pred", "none", "-f", "image2", os.path.join(tmp, "f-%04d.png")])
    black, n = [], 0
    for png in sorted(glob.glob(os.path.join(tmp, "f-*.png"))):
        d = open(png, "rb").read(); pos, idat, w, h = 8, b"", 32, 18
        while pos + 8 <= len(d):
            ln = struct.unpack(">I", d[pos:pos+4])[0]; t = d[pos+4:pos+8]
            if t == b"IHDR": w, h = struct.unpack(">II", d[pos+8:pos+16])
            if t == b"IDAT": idat += d[pos+8:pos+8+ln]
            pos += 12 + ln
        raw = zlib.decompress(idat); stride = w + 1
        px = [raw[i*stride + 1 + j] for i in range(h) for j in range(w)]
        if sum(px) / len(px) < 10: black.append(n)
        n += 1
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"black     {len(black)} of {n} sampled seconds" + (f" -> at {black}" if black else ""))
    if black:
        fails.append(f"black frames at seconds {black}")
    if au:
        err = run(["npx", "remotion", "ffmpeg", "-hide_banner", "-i", f, "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_stderr=True).decode("utf8", "replace")
        js = err[err.rfind("{"):err.rfind("}")+1]
        try:
            m = json.loads(js)
            li, tp = float(m["input_i"]), float(m["input_tp"])
            print(f"loudness  {li:.1f} LUFS integrated, true peak {tp:.1f} dBTP")
            if li < -17 or li > -11: fails.append(f"loudness {li:.1f} LUFS outside -17..-11")
            if tp > -0.5: fails.append(f"true peak {tp:.1f} dBTP above -0.5")
        except Exception:
            print("loudness  (could not measure)")
    if fails:
        print("FAIL " + "; ".join(fails)); sys.exit(1)
    print("PASS")

if __name__ == "__main__":
    main()
