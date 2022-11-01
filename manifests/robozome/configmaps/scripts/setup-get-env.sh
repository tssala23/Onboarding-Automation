#!/usr/bin/env bash

echo "Setting up repository ${TARGET_REPO} clone for Org ${ORG_NAME}..."

DEFAULT_BRANCH=$( curl \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  https://api.github.com/repos/${ORG_NAME}/${TARGET_REPO} 2>/dev/null \
  | yq e '.default_branch' - | sed 's/\"//g' )
echo -n ${DEFAULT_BRANCH} > /mnt/shared/default_branch

git config --global user.email "$APP_ID+robozome[bot]@users.noreply.github.com"
git config --global user.name "robozome[bot]"

git clone https://github.com/${ORG_NAME}/${TARGET_REPO}.git

echo "Git environment set up and cloning of repo completed."
