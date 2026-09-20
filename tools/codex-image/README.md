# Codex image generation — smoke test

This folder proves one thing before anything bigger gets built: that Codex,
signed in with your normal ChatGPT account, can generate an image and save
it to a file, with no OpenAI API key and no separate billing.

It does **not** yet contain the reusable image pipeline. That gets built
only after this test passes, which is the order Shashi asked for.

## Why this runs on your Windows PC and not in Claude's cloud

Claude's cloud container is blocked from reaching OpenAI. Every OpenAI
address (`auth.openai.com`, `chatgpt.com`, `api.openai.com`, `openai.com`)
is refused by the company network policy, so the ChatGPT sign-in cannot
even start there. That container is also wiped when the session ends and
has no secure place to keep a login, so a personal ChatGPT account should
not be signed in there regardless.

Your own PC has neither problem.

## What to do

1. **Install Node.js** if you have never installed it.
   Go to <https://nodejs.org>, click the big green **LTS** button, open the
   downloaded file and click Next/Install through every screen, accepting
   the defaults. Restart your PC afterwards.

2. **Download this folder.** On GitHub, open
   `tools/codex-image`, and download `RUN-SMOKE-TEST.cmd` and
   `smoke-test.ps1` into one new folder on your Desktop called
   `codex-image`.

3. **Double-click `RUN-SMOKE-TEST.cmd`.**
   A black window opens and works through six steps.

4. **Sign in when asked.** At step 4 it pauses and says a browser window
   will open. Press Enter, sign in with your normal ChatGPT account in the
   browser, then return to the black window. This happens once — it
   remembers you next time.

5. **Read the result.** At the end it prints either
   `RESULT: SMOKE TEST PASSED` or `RESULT: SMOKE TEST FAILED`.
   On success it opens the generated picture so you can look at it.

6. **Tell Claude what it said.** If it failed, the window names a run-log
   file — send that to Claude.

## What it checks

| # | Check |
|---|-------|
| 1 | The request used your ChatGPT account login, not an API key |
| 2 | Codex's own built-in image generation was actually invoked |
| 3 | A real image file was produced and opens |
| 4 | No separately billed image service and no API key were used |
| 5 | No prompt typing or file copying was needed from you |

If any check fails the script stops and says so. It will never quietly
swap in a downloaded picture, an API call, or a placeholder drawn by code.

## Where things are kept

- **Your ChatGPT login**: `C:\Users\<you>\.codex` — your Windows profile.
  It is never written into this repository and never leaves your PC.
- **Generated images and run logs**: the `output` folder next to the
  script. These are ignored by git and are not published to the website.

`tools/` is excluded from the website deployment, so nothing here is
reachable at geniuscfo.ai.
