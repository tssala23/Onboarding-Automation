#!/usr/bin/env bash

echo "Setting up repository ${TARGET_REPO} clone for Org ${ORG_NAME}..."

git config --global user.email ${APP_USER_ID}+${APP_SLUG}[bot]@users.noreply.github.com
git config --global user.name "${APP_SLUG}[bot]"
git clone https://${ORG_NAME}:${GITHUB_TOKEN}@github.com/${ORG_NAME}/${TARGET_REPO}.git
cd ${TARGET_REPO}
default_branch=$(git remote show origin | grep 'HEAD branch' | cut -d' ' -f5)
working_branch=${WORKING_BRANCH_PREFIX}-${SOURCE_REPO}_${ISSUE_NUMBER}
git checkout -b ${working_branch}

echo "Git environment set up and cloning of repo completed."

echo "Executing script path ${WORKING_DIR}/${TARGET_REPO}/${SCRIPT_PATH}..."

${WORKING_DIR}/${TARGET_REPO}/${SCRIPT_PATH}

if [ $? -eq 0 ]
then
  diff=$(git diff ${working_branch}..${default_branch} | wc -l)
  echo "Script path finished execution successfully."
  if [  $diff -ne 0 ]
  then
    echo "Changes detected. Pushing branch ${working_branch}"
    git push origin ${working_branch} -f
  else
    echo "No changes detected. No branch was pushed."
  fi
  exit 0
else
  echo "Script path finished failed execution. Check task/pod logs for details." >&2
  exit 1
fi
