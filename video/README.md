# GeniusCFO product videos

This folder makes the product demo videos: script in, finished 1080p and
720p files out, with a narrated voice-over and music. Claude does the work;
you review at five points and say "approved" or give notes.

## How to give Claude things

- **Scripts, notes, voice ids, DNA documents:** put them in the Google Drive
  folder called **Claude** (as Google Docs or PDFs) and say so in chat.
- **Videos, screen recordings, audio, fonts, big images:** open the drop
  page https://claude.ai/artifact/5wQQQ324xRHhoCwLdHy7to, type the
  project name, drag the files in, then tell Claude in chat that they are
  there. Big files are split automatically. Do not attach files to chat
  messages: they never reach Claude's workspace.

## The five reviews

1. **Brief.** Claude turns your script into a shot table: what is on
   screen, the exact voice line, and the length of each scene. Approve it,
   or say what to change. Nothing costs anything before this.
2. **Voice.** Each line arrives as its own audio file, plus two alternate
   readings of the first line so you can pick the style. Approve, or name
   the lines to redo.
3. **Music.** Two candidate tracks. Pick one.
4. **Draft.** A 720p video marked DRAFT with a scene number and a clock in
   the corner, so notes can say "scene s04 at 0:32". As many rounds as
   needed.
5. **Final.** 1080p and 720p, sound levelled for the web, checked, and sent
   to you in chat.

## Set-up you did once

- ElevenLabs key stored on the cloud environment (never in chat).
- Google Drive connected in claude.ai.

## Where things are

- `projects/<name>/` the brief, gate status, script and voice lines.
- `project/` the video code (Remotion). `project/public/<name>/` the
  screenshots, voice and music a video uses.
- `renders/` finished files (not kept in GitHub; you get them in chat).
- `tools/` the scripts Claude runs to generate voice, render and check.
