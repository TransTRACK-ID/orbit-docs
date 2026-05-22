#!/bin/bash

curl -X POST https://notifier-devops.transtrack.id/send-release-notification \
-H "Content-Type: application/x-www-form-urlencoded" \
-d "email=$USER_EMAIL" \
-d "version_tag=$CI_COMMIT_TAG" \
-d "project_name=$CI_PROJECT_NAME" \
-d "release_note=$CI_COMMIT_TAG_MESSAGE" \
-d "environment=$ENVI"