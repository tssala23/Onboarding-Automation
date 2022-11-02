#!/usr/bin/env bash
cd ${WORKING_DIR}/${TARGET_REPO}
gh auth login --with-token ${GITHUB_TOKEN}

gh pr create \
--title "[Automation] Resolve: ${SOURCE_REPO}/issues/${ISSUE_NUMBER}" \
--body "Resolve: https://github.com/${ORG_NAME}/${SOURCE_REPO}/issues/${ISSUE_NUMBER}" \
--head ${WORKING_BRANCH_PREFIX}-${SOURCE_REPO}_${ISSUE_NUMBER}:origin
