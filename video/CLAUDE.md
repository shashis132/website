# Video pipeline: operating notes for Claude

Everything under `video/` is the GeniusCFO product-video pipeline. The
procedure (roles, gates, layout) is the `video-production` skill in
`.claude/skills/`; the agents are in `.claude/agents/`. This file holds the
facts about the environment that were learned the hard way. `README.md`
next to it is the plain-language handover for Shashi.

## What runs in the sandbox, verified 19 September 2026

- Node 22, Python 3.11, Remotion 4.0.526 pinned in `project/package.json`.
  Install with `cd video/project && npm ci` (or `npm i`) at the start of a
  session; `node_modules` is not committed.
- Rendering uses Playwright's **headless shell**, not the full Chromium:
  `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`.
  `remotion.config.ts` finds it. The full binary fails with "Old Headless
  mode has been removed".
- A 5-second 1080p render takes about 15 s; 1080p plus 720p about 30 s.
- ffmpeg is Remotion's bundled build: `cd video/project && npx remotion
  ffmpeg …` / `npx remotion ffprobe …`. It has libx264, aac, loudnorm,
  amix, adelay, volume, silencedetect. It lacks the `fps` filter, lavfi
  sources, the rawvideo muxer, ebur128, blackdetect, sidechaincompress.
  `tools/qc.py` and `tools/finalize.sh` are written around those gaps.
  Playwright's own ffmpeg under `/opt/pw-browsers/ffmpeg-*` is VP8-only.
- Fonts are bundled in `project/public/fonts/` (from the `@fontsource`
  packages) and loaded with `@remotion/fonts`; renders never fetch fonts.
- Network: npm, pypi and Google Fonts are reachable. `api.elevenlabs.io`,
  `drive.google.com` and Dropbox are blocked by the environment's network
  policy (the proxy answers 403 to CONNECT). See the two sections below.

## ElevenLabs

- The key must never be in the repo, in a file, or in chat. The scripts send
  `xi-api-key` from `ELEVENLABS_API_KEY` when that variable exists, and
  otherwise send no key and rely on the cloud environment's **API
  credential** (Update cloud environment → API credentials → Add credential:
  website `api.elevenlabs.io`, header `xi-api-key`, no prefix), which the
  proxy attaches after the request leaves the sandbox and which also lifts
  the network block for that host. Fallback on plans without API
  credentials: Network access → Custom → add `api.elevenlabs.io` (keep the
  default list ticked) and `ELEVENLABS_API_KEY=…` under Environment
  variables. Either way a **new session** is needed afterwards.
- `python3 video/tools/vo-generate.py --check` proves the key and shows the
  character balance. `--probe "text"` makes one short test line.
- Generation is cached by (text, voice, model, settings); unchanged lines
  are never re-sent. `gates.json` must say `"brief": "approved"` or the
  scripts refuse. Word timestamps come from the `with-timestamps` endpoint
  and land in `vo/manifest.json`; the composition builds its timeline from
  them (`src/lib/timeline.ts`).
- Music: `tools/music-generate.py` posts to `/v1/music`. Unverified until
  the first real run.

## Getting files in

- **Chat attachments do not reach the disk.** Confirmed again for this
  pipeline; do not ask for them.
- **Google Drive connector** (folder "Claude", id
  `1GKYvWR5uGEXDopAjNsSsbhak1mWnZICz`, owner marketing@geniuscfo.ai): list
  with `search_files` and `parentId = '<id>'`; Google Docs and PDFs with
  `read_file_content`; other files with `download_file_content`, which
  returns the bytes base64-encoded **inside the tool result**, so it is only
  workable for small files (a 3 MB video would be about 4 MB of base64 in
  context). Writing works the same way in reverse (`create_file` with
  `base64Content`), verified with an 82-byte PNG round trip.
- **Drop page** https://claude.ai/artifact/5wQQQ324xRHhoCwLdHy7to (private
  artifact, source in `video/tools/drop-page.html`): Shashi drags files in;
  each becomes an asset plus a row in the `uploads` collection. To pull:
  1. `ArtifactData` action `list`, collection `uploads`, on that URL. Each
     row has `name`, `project`, `note`, `mode` (`direct` or `wrapped`),
     `assets` (ids), `parts`, `pulled`.
  2. For each asset id: `Artifact` action `read` with `path: <id>`; the file
     is saved to disk with no context cost. A `direct` row is one file.
     A `wrapped` row is N JSON parts `{part, parts, data}` (base64 of a
     14 MiB slice each): decode and concatenate in order.
  3. Move the result to `video/inbox/<project>/<name>`, then `ArtifactData`
     `update` the row with `{"pulled": true}` so the page shows "Received by
     Claude".
- Anything a composition uses is copied into `project/public/<slug>/` and
  committed. Masters stay on Drive or the drop page; `inbox/` is ignored.

## Getting files out

- `SendUserFile` delivers takes, drafts and finals into the chat. Verified
  with a 120 KB clip; the ceiling for large finals is untested, so send the
  720p first.
- Renders are never committed. Voice mp3s, manifests, briefs and plans are.

## Composition conventions

- Design at 1920 wide and multiply every size by `width / 1920`; each
  composition is registered as `<Id>` (1920x1080) and `<Id>-720p`
  (1280x720) in `src/Root.tsx` through the `SIZES` map.
- Colours and fonts only from `src/brand/tokens.ts` (copied from the site's
  `assets/site.css`; change the site first, then the copy).
- Timing comes from `vo/manifest.json` via `buildTimeline()`; music level
  from `musicVolumeAt()`. Never hard-code a scene duration once a manifest
  exists.
- Drafts carry `<DraftOverlay>` (`--draft` in `tools/render.sh` sets
  `draft: true` in props) so review notes can name a scene and a timecode.
- Verify visually: `npx remotion ffmpeg -ss <s> -i <mp4> -frames:v 1 f.png`
  then Read the PNG. `tools/qc.py` checks size, duration, black frames and
  loudness; it does not judge composition.
