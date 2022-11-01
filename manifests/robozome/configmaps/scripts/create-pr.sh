#!/usr/bin/env bash
gh auth login --with-token ${GITHUB_TOKEN}
gh pr create --title "The bug is fixed" --body "Everything works again"
