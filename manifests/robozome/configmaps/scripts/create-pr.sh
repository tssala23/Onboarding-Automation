#!/usr/bin/env bash
cd ${WORKING_DIR}/${TARGET_REPO}
echo ${GITHUB_TOKEN} | gh auth login --with-token

# Check if Pull Request for this branch already exists
gh pr view > ${WORKING_DIR}/gh_pr.log
IS_OPEN=$(cat ${WORKING_DIR}/gh_pr.log | grep OPEN | wc -l)
if [ ${IS_OPEN} -gt 0 ]; then
  echo "PR already exists"
  msg="PR for this issue form already exists, any changes were pushed to the branch associated with this PR. You can find this PR linked within this issue thread. To create a new PR, please close the old PR and try again."
  curl \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    https://api.github.com/repos/${ORG_NAME}/${SOURCE_REPO}/issues/${ISSUE_NUMBER}/comments \
    -d '{"body":"'"${msg}"'"}'
else
  echo "PR does not exist, creating..."
  gh pr create \
  --title "[Automation] Resolve: ${SOURCE_REPO}/issues/${ISSUE_NUMBER}" \
  --body "Resolve: https://github.com/${ORG_NAME}/${SOURCE_REPO}/issues/${ISSUE_NUMBER}" \
  --head ${WORKING_BRANCH_PREFIX}-${SOURCE_REPO}_${ISSUE_NUMBER}
fi
