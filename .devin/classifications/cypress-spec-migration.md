<!--
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
-->
---
slug: cypress-spec-migration
status: active
severity: low
max_open: 1
validate: test ! -e superset-frontend/cypress-base/cypress/e2e/<file> && cd superset-frontend && npx tsc --noEmit -p playwright/tsconfig.json && npx playwright test --list <scope>
---

# Cypress spec still without a Playwright equivalent

`AGENTS.md` states **Cypress is deprecated** and the repo is migrating E2E
coverage to Playwright (`superset-frontend/playwright/tests/`);
`.cursor/rules/dev-standard.mdc` calls Cypress the "last resort". Every spec
left in `superset-frontend/cypress-base/cypress/e2e/` is a test that will
silently disappear when Cypress is removed unless it is ported first.

## Recognise

List `cypress-base/cypress/e2e/**/*.test.{js,ts}` and, for each, check
whether a Playwright spec under `playwright/tests/` already exercises the same
user flow (by name and by the assertions made). A finding is **one** Cypress
spec whose flows are not covered, small enough (≤ ~200 lines, ≤ ~10 `it`
blocks) to port in one PR.

Exclusions: specs whose flows already have a Playwright spec (file that as
"delete the redundant Cypress spec" only if a human asks), specs that depend on
Cypress-only plugins with no Playwright counterpart, and specs covering
features flagged off by default.

## Fix

Write `playwright/tests/<area>/<name>.spec.ts` using the existing page-object
and helper conventions in `playwright/tests/` (see `chart/chart-test-helpers.ts`,
`dashboard/`), porting each `it` to a `test`. Delete the Cypress spec in the
same PR. Do not weaken assertions to make the port pass; if a flow cannot be
reproduced, keep that `it` in Cypress and say why in the PR.

## Validate

The command proves the Cypress file is gone, the Playwright tree type-checks,
and Playwright can discover the new spec. It does **not** run the E2E tests
(they need a live Superset backend the remediation sandbox does not have), so
the reviewer must run `npm run playwright:test <scope>` locally before merging.

## Seed finding (2026-09-11)

- superset-frontend/cypress-base/cypress/e2e/explore/chart.test.js (157 lines:
  chart save / save-as / add-to-dashboard flows). `playwright/tests/chart/`
  contains only chart-list.spec.ts and handlebars-format-date.spec.ts — no
  save-flow coverage.
