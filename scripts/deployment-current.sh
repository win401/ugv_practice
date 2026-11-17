#!/usr/bin/env bash
set -euo pipefail

service="${1:?Specify fe or be}"
expected_sha="${2:?Specify the checked-out commit}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

case "$service" in
  fe) app=FE; tests=FE/tests ;;
  be) app=BE; tests=BE/src/test ;;
  *) echo "Unknown service: $service" >&2; exit 2 ;;
esac
if [[ ! "$expected_sha" =~ ^([0-9a-f]{40}|[0-9a-f]{64})$ ]]; then
  echo "Expected a full commit SHA" >&2
  exit 2
fi

# Compare trees directly, including in shallow checkouts and manual runs.
git cat-file -e "${expected_sha}^{commit}"
git fetch --no-tags --depth=1 origin refs/heads/main
latest_sha="$(git rev-parse FETCH_HEAD)"

# Keep these deployment inputs aligned with fe_deploy/be_deploy in change-filters.yml.
paths=(
  "$app" ".github/workflows/deploy-${service}.yml" .gitattributes
  scripts/deployment-current.sh
  ":(exclude,glob)$app/*.md" ":(exclude,glob)$app/docs/**"
  ":(exclude,glob)$tests/**"
)
if git diff --quiet "$expected_sha" "$latest_sha" -- "${paths[@]}"; then
  echo 'current=true' >> "$GITHUB_OUTPUT"
  echo "$service deployment inputs match main ($latest_sha)"
else
  result=$?
  if [[ "$result" != 1 ]]; then exit "$result"; fi
  echo 'current=false' >> "$GITHUB_OUTPUT"
  echo "::notice::Skipping outdated $service deployment $expected_sha; main is $latest_sha"
fi
