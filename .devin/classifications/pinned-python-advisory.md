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
slug: pinned-python-advisory
status: active
severity: medium
max_open: 1
validate: for p in <scope>; do pin=$(grep -ioE "^$p==[^ ;#]+" requirements/base.txt) && [ "$(grep -ihE "^$p==" requirements/base.txt requirements/development.txt | tr A-Z a-z | sort -u | wc -l)" -eq 1 ] && python3 -c "import json,sys,urllib.request as u;n,v=sys.argv[1].split('==');r=json.load(u.urlopen('https://api.osv.dev/v1/query',json.dumps({'package':{'name':n,'ecosystem':'PyPI'},'version':v}).encode()));ids=[x['id'] for x in r.get('vulns',[])];print(n,v,ids or 'clean');sys.exit(1 if ids else 0)" "$pin" && pip install -q --no-deps "$pin" || { echo "FAIL $p is unpinned, drifts between base and development, or still has OSV advisories"; exit 1; }; done && pytest <tests> -q
---

# Direct Python dependency pinned at a version with published, fixed advisories (not reachable in Superset)

`requirements/base.txt` and `requirements/development.txt` are the pins
Superset ships in its Docker image and CI. When a dependency that Superset
declares directly (`pyproject.toml` or `requirements/*.in`) is pinned at a
version with published OSV/GHSA advisories that a released upstream version
fixes, every downstream SCA scan of the image flags it, and any operator code
running in-process (`superset_config.py`, a custom security manager) inherits
the vulnerable library. The repo already treats this as worth fixing:
`pyproject.toml` raises floors explicitly to "close SCA" hits (the `Pillow` and
`PyJWT` comments). `SECURITY.md` ("Findings in third-party dependencies") keeps
pinned *direct* dependencies in scope as a concern, but it also says security
vulnerabilities must not be filed as public GitHub issues — so this class is,
by construction, limited to advisories whose prerequisites Superset's own code
does not meet. It is supply-chain hygiene, not a vulnerability report.

## Recognise

Batch-query `https://api.osv.dev/v1/querybatch` (ecosystem `PyPI`) with every
`name==version` pin in `requirements/base.txt`. A finding is **one package**
whose pin has at least one advisory with a `fixed` event, where:

- the package is a direct dependency (named in `pyproject.toml`
  `[project.dependencies]` or `requirements/base.in`), and
- a fixed release exists that is at least 7 days old on PyPI and satisfies
  every upper bound in `pyproject.toml` and in the pinned dependents'
  `requires_dist` (check FAB, `flask-jwt-extended`, `requests`, etc.), and
- for each advisory, the issue states the advisory's prerequisites and the
  Superset call sites (`rg "import <module>|from <module>" superset`) that show
  they are not met — e.g. every `jwt.decode` pins a single HMAC algorithm.

**Stop condition — do not file.** If any advisory's prerequisites *are* met by
Superset's code such that a principal in `SECURITY.md`'s role and capability
matrix gains an action the matrix does not entitle them to, that is a security
vulnerability: it goes to `security@superset.apache.org` per `SECURITY.md`,
never to a public issue. The scan reports it as skipped and stops.

Exclusions: transitive-only dependencies (`SECURITY.md`: report to the
dependency's maintainers); advisories with no fixed release; fixes that need
an upper-bound change in `pyproject.toml` that a comment there forbids (e.g.
`paramiko<4.0` for `sshtunnel`'s `DSSKey` — GHSA-r374-rxx8-8654 is not
actionable); `development.in`-only tooling; npm packages (a different
lockfile and audit tool).

## Fix

Bump the pin through the repo's own tooling, per `requirements/README.md`:
raise the floor in `pyproject.toml` (or `requirements/base.in`) to the fixed
version — keeping the existing "raise floor to match resolved pin" comment
convention — then regenerate with `./scripts/uv-pip-compile.sh` so
`base.txt` and `development.txt` move together and the resolver checks every
dependent's bounds. Do not hand-edit the `.txt` files. Target the lowest
release that clears every advisory and is at least 7 days old, not `latest`.
If the resolver moves any *other* package, list it in the PR. If the bump needs
an application code change (a removed private API, e.g.
`jwt.api_jwt._jwt_global_obj` used by `superset/security/manager.py`), stop and
ask rather than adapting call sites.

## Validate

For each package in `<scope>` the command proves: it is still pinned in
`base.txt`; `base.txt` and `development.txt` agree (the README requires shared
pins to match); OSV reports no advisory for the new pin (fails on the unfixed
tree, passes on a fixed one); and the new pin is installed before the tests run.
`<tests>` is the `tests/unit_tests/` modules that import or exercise the
package's call sites — e.g. for `pyjwt`: `tests/unit_tests/security/`,
`tests/unit_tests/websocket/test_channel.py`,
`tests/unit_tests/utils/oauth2_tests.py`.

What it does not prove: that the resolver output is exactly what
`uv-pip-compile.sh` would produce (the reviewer should see only the intended
pins move in the diff), or that code paths without unit tests still behave.
It needs network access to `api.osv.dev` and PyPI; without it the command fails
rather than passing. A new advisory published between the fix and the review
also fails it — that is intended.

## Seed finding (2026-10-01)

- `pyjwt==2.13.0` (`requirements/base.txt:311`, `development.txt:843`; direct
  via `pyproject.toml:106`). 13 advisories, all clear at 2.15.0 (PyPI
  2026-09-23; 2.14.0 clears 11), e.g. GHSA-ffc3-869f-jxw9, GHSA-p4g4-x82p-q773,
  GHSA-w2cx-738m-mc7w, GHSA-r6x4-923q-g947 (HMAC/asymmetric key confusion),
  GHSA-9j54-fg26-wv3r (empty PyJWK HMAC key), GHSA-9v7f-9g4p-ffgj (PyJWKClient
  redirects), GHSA-hxm8-2xgr-2p9m (raw-token revocation), GHSA-gvp8-978c-rx2q
  (reused `options` dict). Not reachable: every Superset decode
  (`security/manager.py:5548`, `websocket/channel.py:153`,
  `utils/oauth2.py:424`) pins a single HMAC algorithm with a string secret;
  no `PyJWK`/`PyJWKClient` use; no `options=` reuse; guest-token revocation is
  claim-based (`rev`, `iat`), and `token_sha256` in `security/guest_token.py`
  is audit-only. The remaining advisories are DoS, out of scope per
  `SECURITY.md`. FAB 5.2.2 and flask-jwt-extended 4.7.1 allow `PyJWT<3`;
  2.15.0 still exports `jwt.api_jwt._jwt_global_obj`.
- `urllib3==2.7.0` (`base.txt:434`, `development.txt:1189`; direct via
  `requirements/base.in:20`). GHSA-8988-9cw3-xx77 (HTTPS-proxy TLS settings
  mixed up — proxies are operator configuration), GHSA-vxq7-64xx-v4gw and
  GHSA-gh4c-6fx4-qh6g (DoS on malicious servers). All fixed in 2.8.0 (PyPI
  2026-09-15); `requests` 2.33.0 allows `urllib3<3`.
- Excluded: `paramiko==3.5.1` (fix needs >=5.0.0, capped `<4.0` in
  `pyproject.toml`).
