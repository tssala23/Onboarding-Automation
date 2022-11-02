#!/usr/bin/env bash

echo "Setting up repository ${TARGET_REPO} clone for Org ${ORG_NAME}..."


git config --global user.email "robozome[bot]@users.noreply.github.com"
git config --global user.name "robozome[bot]"
git clone https://${ORG_NAME}:${GITHUB_TOKEN}@github.com/${ORG_NAME}/${TARGET_REPO}.git
cd ${TARGET_REPO}
git checkout -b ${WORKING_BRANCH_PREFIX}-${SOURCE_REPO}_${ISSUE_NUMBER}

echo "Git environment set up and cloning of repo completed."

echo "Executing script path ${WORKING_DIR}/${TARGET_REPO}/${SCRIPT_PATH}..."

${WORKING_DIR}/${TARGET_REPO}/${SCRIPT_PATH}

# TODO: Check exit code
if [ $? -eq 0 ]
then
  echo "Script path finished execution successfully."
  git push origin ${WORKING_BRANCH_PREFIX}-${SOURCE_REPO}_${ISSUE_NUMBER} -f
  exit 0
else
  echo "Script path finished failed execution. Check task/pod logs for details." >&2
  exit 1
fi
