---
name: video-production
description: Produce a GeniusCFO product video from a script with Remotion, ElevenLabs voice-over and music, through five approval gates with Shashi. Use when asked to start, continue, revise or deliver a video under video/, to generate voice-over or music, to pull assets from Drive or the drop page, or to render drafts and finals.
---
# Video production procedure

The main session is the **Director**. The Executive and Worker agents are
defined in `.claude/agents/`. Environment facts and gotchas live in
`video/CLAUDE.md`; read it before acting.

## Roles

- **Director** (you, Fable): owns the brief, the gates, quality judgement
  and the conversation with Shashi. Never writes scene code; keeps its own
  context clean for the whole project.
- **Executive** (`subagent_type: executive`, Opus at extra-high effort): one
  per video. Plans, delegates, reviews, fixes.
- **Worker** (`subagent_type: worker`, Opus at medium effort): one bounded
  task each. Spawned by the Executive, or by you for a small standalone job
  such as pulling assets or running QC.

## Where things live

```
video/projects/<slug>/        brief.md  gates.json  script.md  plan.md  vo/lines.json  vo/manifest.json
video/project/public/<slug>/  screens/  vo/  music/      assets the composition loads via staticFile()
video/project/src/compositions/<Slug>.tsx   registered twice in src/Root.tsx: "<Id>" and "<Id>-720p"
video/renders/<slug>/         drafts and finals; not committed, delivered with SendUserFile
video/inbox/<slug>/           raw pulls from Drive or the drop page; not committed
```

Copy `video/projects/_template/` to start a project.

## gates.json

```json
{"brief": "pending", "vo": "pending", "music": "pending", "draft": "pending", "final": "pending"}
```

A gate moves to `approved` only when Shashi says so in chat. Record the
date next to it in `notes.md`. The credit-spending scripts refuse to run
while `brief` is pending. Never mark a gate approved yourself.

## The gates, in order

1. **Intake → brief.** Collect script, assets, voice id, DNA docs. Write
   `brief.md`: a shot table with columns id (`s01`…), on screen, voice line
   (verbatim), estimated seconds, assets, music cue; plus format, total
   length, tone notes from the DNA docs, and open questions. Deliver the
   brief in chat in plain language and stop.
2. **Voice.** After `brief` is approved: write `vo/lines.json` from the
   brief. Run `python3 video/tools/vo-generate.py <slug> --dry-run` and
   tell Shashi the character count. Generate. Send every mp3 with
   SendUserFile, plus two alternate deliveries of the first line only
   (different stability/style), so the delivery style is chosen cheaply.
   Stop. On notes, regenerate only the named lines with `--only`.
3. **Music.** Two candidates: `music-generate.py` from a brief derived from
   the audio DNA (tempo, key, mood, no vocals), or a track Shashi supplies.
   Send both. Stop.
4. **Draft.** Spawn the Executive with the slug. It builds the composition
   from `vo/manifest.json` (timing comes from the voice, never hard-coded),
   renders `--draft` (720p, DRAFT overlay with scene id and timecode) and
   runs QC. Look at three frames yourself before sending. Send the draft and
   stop. Repeat on notes; each round is a new draft file with a version
   number in its name.
5. **Final.** `video/tools/render.sh <Id> <slug>` (1080p and 720p), then
   `video/tools/finalize.sh` on each, then `python3 video/tools/qc.py
   --expect-size --expect-seconds` on each, then look at three frames of
   the 1080p file. Send both files. Commit briefs, plan, lines, manifest,
   voice and music files. Stop.

Each gate ends your turn. Say what was delivered, what you need, and
nothing else.

## Intake routes

- **Google Drive folder "Claude"** (connector): `search_files` with
  `parentId`, `read_file_content` for Docs and PDFs, `download_file_content`
  only for files under about 500 KB. Bigger files do not fit through the
  connector; ask for them on the drop page instead.
- **Drop page** https://claude.ai/artifact/5wQQQ324xRHhoCwLdHy7to: any
  type, any size. Pull procedure is in `video/CLAUDE.md`.

## Credits and keys

Voice and music generation are the only paid calls. They are cached by
content: unchanged lines are never regenerated. The ElevenLabs key is never
written to the repo, a file, or chat; `video/CLAUDE.md` says how it reaches
the scripts.
