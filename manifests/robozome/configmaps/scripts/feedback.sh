#!/usr/bin/env bash

msg="Issue Form Automation Finished with no errors reported. See the Pull Request linked within this Issue for details."

if [ ${TASKS_STATUS} == "Failed" ]; then
  msg="Looks like one or more tasks returned failure."
fi

curl \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  https://api.github.com/repos/${ORG_NAME}/${SOURCE_REPO}/issues/${ISSUE_NUMBER}/comments \
  -d '{"body":"'"${msg}"'"}'
