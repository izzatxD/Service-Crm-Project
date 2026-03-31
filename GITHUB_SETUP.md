# GitHub Setup

This file describes the recommended repository settings after CI is enabled.

## Branch Protection

Recommended target branch:

- `main`

Enable these settings:

1. Require a pull request before merging
2. Require approvals
3. Dismiss stale pull request approvals when new commits are pushed
4. Require review from Code Owners only after `.github/CODEOWNERS` is filled with real teams or users
5. Require conversation resolution before merging
6. Require status checks to pass before merging
7. Do not allow force pushes
8. Do not allow branch deletion

## Required Status Checks

Use these job names from the workflow:

- `Backend`
- `Frontend`

Workflow file:

- `.github/workflows/ci.yml`

## Code Owners

A starter example is included here:

- `.github/CODEOWNERS.example`

Before enabling Code Owner review:

1. Copy `.github/CODEOWNERS.example` to `.github/CODEOWNERS`
2. Replace placeholder owners with real GitHub users or teams
3. Commit the real `CODEOWNERS` file
4. Then enable "Require review from Code Owners"

## Pull Request Hygiene

Recommended repository settings:

- squash merge enabled
- merge commit disabled
- rebase merge optional
- auto-delete head branches enabled

## Issue Templates

Prepared issue templates:

- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/access_control_regression.yml`

These help keep bug reports and permission regressions reproducible.
