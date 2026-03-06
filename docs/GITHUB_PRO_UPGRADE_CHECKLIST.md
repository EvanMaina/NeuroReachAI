# GitHub Pro Upgrade Checklist

> **Status:** Pending — GitHub Free plan does not support branch protection on private repos.
> **When:** After upgrading to GitHub Pro ($4/month) or GitHub Team.

## Why Upgrade?

GitHub Free does **not** support:
- Branch protection rules on private repositories
- Required status checks before merging
- Required PR reviews before merging
- Restricting who can push to protected branches

Without these protections, anyone with write access can push directly to `main` (production) or `staging`, bypassing CI checks entirely.

---

## Post-Upgrade Steps

### 1. Protect `main` Branch (Production)

Go to **Settings → Branches → Add branch protection rule** (or use GitHub API):

| Setting | Value |
|---------|-------|
| **Branch name pattern** | `main` |
| **Require a pull request before merging** | ✅ Yes |
| **Required approving reviews** | 1 (minimum) |
| **Dismiss stale PR reviews when new commits are pushed** | ✅ Yes |
| **Require status checks to pass before merging** | ✅ Yes |
| **Required status checks** | `✅ CI Status` |
| **Require branches to be up to date before merging** | ✅ Yes |
| **Require conversation resolution before merging** | ✅ Yes |
| **Restrict who can push to matching branches** | ✅ Only deploy via PR merge |
| **Do not allow bypassing the above settings** | ✅ Yes (even for admins) |
| **Allow force pushes** | ❌ No |
| **Allow deletions** | ❌ No |

**CLI (after upgrade):**
```bash
gh api repos/EvanMaina/NeuroReachAI/branches/main/protection \
  --method PUT \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["✅ CI Status"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null
}
EOF
```

### 2. Protect `staging` Branch

| Setting | Value |
|---------|-------|
| **Branch name pattern** | `staging` |
| **Require a pull request before merging** | ✅ Yes |
| **Required approving reviews** | 1 |
| **Require status checks to pass before merging** | ✅ Yes |
| **Required status checks** | `✅ CI Status` |
| **Allow force pushes** | ❌ No |
| **Allow deletions** | ❌ No |

### 3. Protect `dev` Branch (Optional)

| Setting | Value |
|---------|-------|
| **Branch name pattern** | `dev` |
| **Require status checks to pass before merging** | ✅ Yes |
| **Required status checks** | `✅ CI Status` |
| **Require a pull request before merging** | Optional (team preference) |

### 4. Re-enable Staging Auto-Deploy

After Phase 9 creates staging infrastructure, uncomment the push trigger in `.github/workflows/deploy-staging.yml`:

```yaml
# Change this:
on:
  # DISABLED: Staging deploy is disabled until Phase 9 creates staging infrastructure
  # push:
  #   branches: [staging]
  workflow_dispatch:

# To this:
on:
  push:
    branches: [staging]
  workflow_dispatch:
```

Also update the staging workflow environment variables to point to separate staging ECS services/cluster.

### 5. Make Lint Checks Blocking (After Cleanup)

Once existing lint issues in the codebase are fixed, update `.github/workflows/ci.yml`:

1. **Remove `|| true`** from Flake8 step (backend-lint job)
2. **Remove `|| true`** from ESLint step (frontend-lint job)
3. **Update ci-status** critical check list to include lint checks:

```yaml
# Change from:
if [[ "${{ needs.frontend-build.result }}" == "failure" ]] || \
   [[ "${{ needs.docker-build.result }}" == "failure" ]]; then

# To:
if [[ "${{ needs.backend-lint.result }}" == "failure" ]] || \
   [[ "${{ needs.frontend-lint.result }}" == "failure" ]] || \
   [[ "${{ needs.frontend-build.result }}" == "failure" ]] || \
   [[ "${{ needs.docker-build.result }}" == "failure" ]]; then
```

### 6. Enforce Changelog Requirement

Uncomment `exit 1` in the changelog-check job in `ci.yml`:

```yaml
# Change:
# exit 1

# To:
exit 1
```

---

## Recommended Git Workflow (Post-Upgrade)

```
feature-branch → PR → dev → PR → staging → PR → main (production)
```

1. Create feature branch from `dev`
2. Open PR to `dev` → CI runs → merge after review
3. When ready for staging: PR from `dev` → `staging` → CI + staging deploy
4. When ready for production: PR from `staging` → `main` → CI + production deploy

---

## Cost

| Plan | Price | Key Feature |
|------|-------|-------------|
| GitHub Free | $0 | No branch protection on private repos |
| **GitHub Pro** | **$4/user/month** | Branch protection, required reviews, required checks |
| GitHub Team | $4/user/month | Same + team management features |

**Recommendation:** GitHub Pro is sufficient for a single developer. Upgrade to Team when you add more team members.

---

## Current Workaround (Without Pro)

While on Free plan:
- **Self-discipline:** Always use PRs, never push directly to `main`
- **CI still runs:** Deploy workflow calls CI first — if CI fails, deploy won't proceed
- **Manual verification:** Check GitHub Actions status before merging

The CI pipeline still provides safety even without branch protection — the deploy workflow (`deploy-production.yml`) calls CI as a prerequisite. A direct push to `main` will trigger the deploy, but the deploy **will fail at the CI stage** if critical checks don't pass (frontend-build, docker-build).
