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
slug: time-specific-comment
status: active
severity: low
max_open: 2
validate: ! grep -nEi '#.*\b(currently|today|right now|for now|at the moment)\b' <scope> && pytest <tests> -q
---

# Time-specific language in code comments

`AGENTS.md` ("Code Comments") says: **avoid time-specific language** — do not
use words like "now", "currently", "today" in comments because they become
outdated; comments should remain accurate regardless of when they are read.
A comment that says "currently X" is an unlabeled snapshot: readers cannot
tell whether it still holds.

## Recognise

`rg -nEi '#.*\b(currently|today|right now|for now|at the moment)\b' superset/<module>`
(and `//` / `*` for TypeScript). A genuine instance describes the *code's*
present behaviour or state of the codebase ("this helper currently mutates
...", "families wired today cover every key"). A finding is one module or
directory with 2–8 such comments so the fix is one small PR.

Exclusions: comments where the word describes **runtime** state rather than
the codebase ("the currently-visible filter values", "the now-timestamp"),
`TODO`/`FIXME` continuation lines (the TODO itself is the intended marker),
docstrings quoting user-facing text, changelog/`UPDATING.md` prose, and
license headers.

## Fix

Rewrite each comment as a timeless statement of the invariant: "this helper
mutates `json_body` in place" rather than "currently mutates". Where the
comment was really a TODO in disguise, make it a `TODO:` with the intent.
Comments only — no code changes.

## Validate

The grep proves the flagged wording is gone from the scoped files; the scoped
pytest run (the `tests/unit_tests/` module for the same path) proves the fix
did not accidentally touch code. Since only comments change, pytest is a
guard against clerical error rather than proof of behaviour.

## Seed finding (2026-09-11)

- superset/charts/data/api.py:208 ("this helper currently mutates ..."), :747
  ("Only support CSV streaming currently") — tests: tests/unit_tests/charts/data/
- superset/versioning/api_helpers.py:288, activity/visibility.py:167,
  activity/render.py:226, activity/queries.py:767, activity/windows.py:85 —
  tests: tests/unit_tests/versioning/
- Excluded: superset/versioning/diff.py:701 ("currently-visible filter
  values" describes runtime state).
