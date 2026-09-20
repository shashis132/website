Remotion Agent Skills, vendored from the official Claude Code plugin.

Source:  https://github.com/remotion-dev/claude-code-plugin
Version: 4.0.526
Added:   20 September 2026
Licence: MIT

Vendored rather than installed as a plugin because a plugin declared in
.claude/settings.json needs an interactive trust prompt that a Claude Code
web session has nobody to answer, so it silently never installs. Files in
.claude/skills/ load with no fetch and no prompt.

To update: re-copy the skills/ folder from that repository at the tag you
want. Do not hand-edit these files; the next update overwrites them.
