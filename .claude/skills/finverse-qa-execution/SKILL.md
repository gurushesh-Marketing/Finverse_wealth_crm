---
name: finverse-qa-execution
description: Evidence-led testing of Finverse CRM workflows, including role scope, state changes, keyboard use, and relevant mobile widths. Preload for QA lead and QA tester.
---

# Finverse QA execution

Start from the assigned action IDs and acceptance criteria. Choose the smallest
set of checks that could reveal a broken user outcome. Keep proposed scenarios
separate from checks actually executed.

For an executable check:

1. State the session fixture, role, vertical, team, record, and expected result.
2. Run the affected workflow with available Playwright or local browser tooling.
   A source review or written scenario is not a browser result.
3. Capture the command, exit status, observed UI result, and any relevant
   screenshot or trace path. Use synthetic data only.
4. Compare the observed state with validation, system effect, reporting effect,
   and exception rules in `docs/product/action_catalogue_v2.json`.
5. Report PASS, FAIL, or NOT RUN per check. For NOT RUN, name the missing
   prerequisite. For FAIL, provide reproduction steps and the narrowest
   useful evidence.

Prioritize direct-route and data-scope checks for role-sensitive features.
Test keyboard interaction and mobile width where the assigned workflow needs
them. Treat fixture isolation as a frontend contract, not production auth.

Done when every assigned acceptance criterion has an executed result or an
explicit NOT RUN reason, and the QA Lead can make a readiness decision from
the evidence.
