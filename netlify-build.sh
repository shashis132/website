#!/usr/bin/env bash
# Stages the deployable website into dist/.
#
# The repository root also holds material that must not be published:
# qa/ (verification evidence), apps-script/ (the leads-sheet receiver) and
# the handover markdown. Netlify has no publish-time exclude, so the
# deployable files are copied out explicitly instead. Add new top-level
# content here when it is added to the repository.
set -euo pipefail

cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist

# Content directories.
cp -R assets business ca-firms pricing dist/

# Root files: fallback redirect page, crawler and answer-engine files,
# and the Netlify routing table.
cp index.html robots.txt sitemap.xml llms.txt llms-full.txt _redirects dist/

echo "dist/ staged:"
find dist -maxdepth 1 -mindepth 1 | sort
