echo "feedback code"

curl \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  https://api.github.com/repos/${ORG_NAME}/${SOURCE_REPO}/issues/${ISSUE_NUMBER}/comments \
  -d '{"body":"Automation task completed."}'
