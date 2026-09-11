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
slug: asf-license-header
status: active
severity: low
max_open: 2
validate: for f in <scope>; do head -3 "$f" | grep -q "Licensed to the Apache Software Foundation" || { echo "missing/misplaced header: $f"; exit 1; }; done && cd superset-frontend && npm run type
---

# Source files with a missing or misplaced ASF license header

`AGENTS.md` ("Apache License Headers") requires the standard Apache Software
Foundation header on every code file, and `scripts/check_license.sh` (Apache
RAT) enforces it in CI. Files that omit the header, or that place `import`
statements *above* it, break that invariant and are the kind of thing RAT
exclusions and hand review keep missing.

## Recognise

- **Missing**: a `.py`, `.sh`, `.ts`, `.tsx`, `.js` file with no line matching
  `Licensed to the Apache Software Foundation` anywhere in its first 20 lines.
  `rg -L "Licensed to the Apache" --type-add 'code:*.{py,sh,ts,tsx}' -t code`
  narrowed to a directory finds them.
- **Misplaced**: the header exists but is not at the top — typically one or
  more `import` lines precede the `/**` comment. Detect with: first three lines
  contain `^import` *and* the file contains the header text later.
- A finding is one directory or one cohesive group of files (≤ ~10), so a fix
  is a single mechanical PR.

Exclusions: generated files (`*.d.ts` under `node_modules`, `package-lock.json`,
build output), files listed in `.rat-excludes`, empty `__init__.py` files that
are genuinely zero bytes (RAT tolerates them), vendored third-party code,
fixtures/data files.

## Fix

Insert the standard header (copy from a sibling file of the same language)
as the very first lines; for misplaced headers, move the comment block above
the imports without changing anything else. No logic changes. Do not touch
`.rat-excludes`.

## Validate

The frontmatter command checks each fixed file starts with the header in its
first three lines, then runs the frontend type check so a botched move of a
comment block (e.g. one that swallowed an import) is caught. It does not run
RAT itself (needs a Maven download that the sandbox blocks). For Python/shell
files the type check is irrelevant but harmless; behaviour is unaffected by
definition since only comments move.

## Seed finding (2026-09-11)

Misplaced (imports before header), all TypeScript:
- superset-frontend/src/filters/components/types.ts
- superset-frontend/src/features/cssTemplates/types.ts
- superset-frontend/src/features/databases/types.ts
- superset-frontend/src/features/datasets/types.ts
- superset-frontend/src/features/themes/types.ts
- superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/state.ts
- superset-frontend/src/dashboard/constants.ts

Missing entirely:
- .devcontainer/build-and-push-image.sh
- .devcontainer/setup-dev.sh
- .devcontainer/start-superset.sh
- tests/unit_tests/distributed_lock/__init__.py (non-empty, no header)
