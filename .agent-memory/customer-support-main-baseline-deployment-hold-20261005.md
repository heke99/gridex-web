# Temporary Web main automatic Git deployment hold

Date: 2026-10-05. Owner: root; author: sc047_test_review.
Source claim: Web PR #45, comment5999609479. Base:
`ff950425b6922df88817f840dc5a395cbceab8eb`.
Isolated branch: `codex/customer-support-main-deployment-hold-20261005`.
Worktree: `/workspace/gridex-web-main-deployment-hold-20261005`.

## Concrete reason and effect

The retained review
`/workspace/gridex-staff-api-completion-review-20261005/quality/staff-api/tenant-split-independent-completion-20261005/web45-merge-deployment-impact-review.md`
identifies an actual root Customer dependency in Web45
`ac1c6ca09bcc49cae519e14c5d6550c63c8117d3`: the existing customer
overview awaits the new support list as a mandatory parallel operation.
The support operations require Customer support scopes, an active same-company
Customer binding and, conditionally, an assertion if an enforcing Customer
provider exists. The target deployment's complete Customer read/write path is
not qualified. Passing source CI does not establish that runtime readiness.

The only configuration addition is
`git.deploymentEnabled: { "main": false }`. This temporarily prevents automatic
Git deployments from main, allowing source integration to be handled separately
from publication of the changed root Customer consumers. Other branches retain
Vercel's default automatic Git deployment behavior. This configuration does not
block explicit CLI/API deployments or promotions; those remain separate root
actions. Existing production traffic and scheduled jobs are not changed by this
local source edit.

The two repository GitHub Actions workflows are OpenAPI compatibility and the
Web quality gate. Inspection found no production deployment step in either.
The install/build commands, region and five cron definitions are preserved
exactly. No Customer client, binding, environment, provider, domain or hosted
configuration is changed. The original Web worktree remains untouched.

## Skill routing and source validation

Applied `vercel:deployments-cicd` and the repository's
`ci-cd-and-automation` skill for the Git deployment boundary. This is a two-file
configuration delivery, with no API, database, UI or broad audit change.

Official documentation read on 2026-10-05:
- https://vercel.com/docs/project-configuration/git-configuration confirms the
  per-branch boolean object and default true for unspecified branches.
- https://openapi.vercel.sh/vercel.json, official `properties.git` schema,
  permits `deploymentEnabled` as a boolean or an object with boolean values.

PASS at 17:30 UTC: Python JSON parsing and `jsonschema.Draft4Validator` validation
against the complete official `properties.git` subtree retrieved through the
web connector, schema lines369-430. Full-schema curl retrieval failed because
this workspace could not connect; full-schema validation is not claimed.
The validated subtree was held only in
`/tmp/gridex-web-deployment-hold-git-schema-20261005.json`, SHA256
`e5dc23b37e3fa9db9f13c26616756e0315bf01d58b3849237c210ce9beacf347`.

The same command compared parsed unchanged fields and then removed the sole
added block from current text and compared it with `git show
ff950425b6922df88817f840dc5a395cbceab8eb:vercel.json`: both checks passed.
Baseline config SHA256:
`62267d0114a6158bdf4ff55476c6a78aeb58d703a778b0cc902bc64ebd6577c0`.
Changed config SHA256:
`54227ef19c3bc80334a844c2ec2c4598bb4b213cf282a0f8327ce85a1dc62044`.
PASS: `git diff --check`; exact two-file scope and whitespace/newline checks
also include the new untracked checkpoint. Original Web worktree status is clean
at the same ff950425 base.

No new mirror test, dependency installation or dependency reuse was needed.
Application tests, build and remote CI are not claimed by this configuration
validation; the root owner retains publication and required CI qualification.

## Current state and next action

Only `vercel.json` and this new scoped checkpoint are changed. Root's concrete
configuration review is GO: exact branch entry, official documentation/schema,
preserved baseline bytes and absence of a GitHub Actions production deploy step
were accepted. Root authorized a local commit of these two files only. No push,
PR, merge, deployment or hosted write was made. Root owns the small hold PR,
required CI, publication and production receipt; the local commit ID will be
reported in the author handoff.
Root must verify the hold in the integrated source tree and confirm that the
existing production deployment remains unchanged before removing the boundary.

Restore automatic main deployments only through a separate reviewed source
change after root has qualified the actual Customer support read/write path,
its permissions, active bindings and applicable assertion policy. Remove this
temporary main entry (and the empty git object if it has no other settings),
preserving unrelated configuration. A later release action still requires the
root owner's deployment decision; removing the hold is not evidence of target
readiness.

## Publication and reviewed contract integration, 17:47 UTC

The isolated two-file commit `ed19961ab31ad52901defe4a23db7b08a1404278`
was published as draft Web PR #47. Root's artifact attachment attempt timed out;
the canonical review URL is https://github.com/heke99/gridex-web/pull/47.

An authentic PR #46 compatibility failure exposed the unchanged main baseline's
old website contract: local `2026-10-02.4`, manifest/live `2026-10-04.1`.
The independently reviewed Web #45 head
`ac1c6ca09bcc49cae519e14c5d6550c63c8117d3` already contains the frozen matching
contracts and generated SDK. A hold-only #47 would encounter the same stale
baseline. Root therefore integrated that immutable reviewed source with a
normal, non-force merge into this root-owned branch; no retained source branch
was rewritten. The merge had no conflicts. Its immutable source history remains
part of this delivery, rather than duplicating the SDK synchronization.

The full final PR integrates the reviewed #45 Customer/support source and the
temporary Git deployment hold together. The initial two-file description above
records the hold's own delta, not the expanded PR's total diff. Relative to #45,
only `vercel.json` and this checkpoint differ. The hold exists in the same tree
as the changed Customer consumer, so source integration does not require an
intermediate unprotected main tree. Fresh combined-head compatibility, Web
quality and support/native-delivery CI are required before merge. Earlier #45
CI and #46's successful 32-case production build remain historical evidence.

A read-only production receipt before publication showed the active ready main
deployment still using `ff950425b6922df88817f840dc5a395cbceab8eb`.
No production deploy, promotion, environment write or identity operation was
performed. Root will compare the post-merge production receipt and then merge
the new main normally into published #46, preserving its stronger ownership and
stable-identity fences and both package script registrations.
