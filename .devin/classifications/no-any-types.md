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
slug: no-any-types
status: active
severity: low
max_open: 2
validate: cd superset-frontend && ! grep -nE ':\s*any\b|<any>|as any\b|Record<string,\s*any>' <scope> && npm run type && npm run test -- --testPathPattern '<scope>'
---

# Explicit `any` in TypeScript under a bounded directory

`AGENTS.md` and `.cursor/rules/dev-standard.mdc` both say **NO `any` types —
use proper TypeScript types**. Each `any` disables the compiler for everything
it flows into, so the rule is only useful if the existing debt is paid down.
The repo has hundreds of sites; this class files them one small directory at a
time so each fix is reviewable.

## Recognise

`rg -n ':\s*any\b|<any>|as any\b|Record<string,\s*any>' superset-frontend/src/<dir>`
where `<dir>` is a single component or feature directory. A finding is one
directory with roughly 3–15 occurrences across ≤ 6 files, where the correct
type is discoverable from context (an existing interface in
`@superset-ui/core`, a prop type already exported by a sibling, an inferred
return type).

Exclusions: `*.d.ts` shims, `packages/` and `plugins/` (separate lint
configs), `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
sites that carry a written justification, generic constraints like
`<T = any>` in library-style utilities, and anything whose real type would
require refactoring an API boundary (file that as a separate discussion, not
under this class).

## Fix

Replace each `any` with the narrowest accurate type — reuse existing exported
types before inventing new ones (`AGENTS.md`: "reuse existing types"). Use
`unknown` plus narrowing only when the value is genuinely opaque. Do not
change runtime behaviour, do not widen unrelated signatures, and stop and ask
if a single `any` fans out into more than a couple of files.

## Validate

The grep proves the pattern is gone from the scoped files, `npm run type`
proves the replacements type-check, and the scoped Jest run executes the
colocated `*.test.tsx` files for the directory. Directories without colocated
tests are only proven by type check; the issue must say so.

## Seed finding (2026-09-11)

- superset-frontend/src/components/Chart/DrillBy/ — 5 sites:
  DrillByChart.tsx:30, DrillByModal.tsx:163, DrillBySubmenu.tsx:96–97,
  DrillByChart.test.tsx:39. Colocated tests: DrillByChart/DrillByModal/DrillBySubmenu `.test.tsx`.
- superset-frontend/src/dashboard/components/PropertiesModal/index.tsx:584
  (`handleThemeChange = (value: any)`), covered by PropertiesModal.test.tsx.
