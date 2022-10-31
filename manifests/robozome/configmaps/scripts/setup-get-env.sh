#!/bin/bash

DEFAULT_BRANCH=$( curl \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  https://api.github.com/repos/${ORG_NAME}/${REPO_NAME} 2>/dev/null \
  | yq e '.default_branch' - | sed 's/\"//g' )
echo -n ${DEFAULT_BRANCH} > /mnt/shared/default_branch

git config --global user.email "$APP_ID+robozome[bot]@users.noreply.github.com"
git config --global user.name "robozome[bot]"

git clone ${REPO_NAME}
