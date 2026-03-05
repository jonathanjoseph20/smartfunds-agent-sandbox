# **Sprint Closeout / Context Transition — Evidence Drift \+ `affectedPaths` Doom Loop (PRs \#76 / \#77 \+ post-merge fallout)**

## **0\) High-level status (where we are right now)**

* We attempted to permanently eliminate recurring **“Evidence drift detected”** CI failures by fixing canonical evidence generation \+ idempotence guarantees.  
* **PR \#77** (“fix/evidence affectedpaths final”) was merged and checks were green at the time.  
* Despite that, the same class of failure continues to reappear:  
  * CI “Assert evidence idempotent” fails because `governance/evidence.json` differs after `governance:emit` runs.  
  * On `main` (non-PR context), `governance:emit` can produce **invalid evidence** because `affectedPaths` becomes empty (`[]`) and the validator rejects it (“must not be empty”).  
* We tried multiple “certain fixes” after the merge (including NO-OP guard approaches and ad-hoc patch scripts). None have produced a stable end state. Several attempts created new breakage (example: `execGit is not a function` from `changed-files.ts` after an overwrite).

**Conclusion:** The current governance/evidence pipeline has become **too fragile and too coupled to context** (PR vs non-PR, changed files resolution, self-referential paths) to patch incrementally with confidence. A refactor (or redesign of the contract surface and/or CI enforcement strategy) is warranted.

---

## **1\) Original intent of this sprint**

**Goal:** Stop the recurring “evidence drift” CI loop by making `governance:emit` deterministic and idempotent across environments, so that:

* CI-generated evidence matches committed evidence (no drift).  
* Re-running `governance:emit` without meaningful changes does not change `governance/evidence.json`.  
* The “Assert evidence idempotent” step becomes boring and reliable.

This is consistent with the larger “contract surface hardening” direction described in prior docs: reduce fragile mutation surfaces, make evidence deterministic and schema-valid, and avoid UX hazards like manual PR-body formatting (previous “printf/body-file” guidance exists for that exact reason).

Context Transition Docs (20)

Context Transition Docs (17)

---

## **2\) What actually happened (symptoms observed)**

### **A) CI failure: evidence drift**

Repeated failure in GitHub Actions:

* Job/step: **Generate canonical evidence (CI) → Assert evidence idempotent**  
* Failure pattern: `git diff --exit-code -- governance/evidence.json` fails after CI runs evidence generation.  
* The diff frequently showed `affectedPaths` changing in ways that are “self-referential” or context-dependent, e.g.:  
  * Adding/removing `governance/evidence.json` from the `affectedPaths` list.  
  * Changes in ordering / membership that should not happen if canonicalization is stable.

### **B) Local behavior diverged from CI behavior (or from expectations)**

On local runs:

* We saw cases where running:  
  * `npm run governance:emit`  
  * then `git diff --exit-code -- governance/evidence.json`  
    would show evidence changing (meaning emit was **not idempotent** in practice).  
* We also saw the reverse: locally it sometimes looked clean after a sequence, but CI still failed.

### **C) Non-PR context failure on main: invalid evidence**

When running on `main` (or any state where the “diff against main” is empty), `governance:emit` sometimes produced evidence where:

* `affectedPaths: []`  
* and the tooling rejected it: **“Generated evidence is invalid. evidence.affectedPaths must not be empty.”**

This is important because it means the evidence contract is currently treated as requiring a non-empty diff, which is not true in “sanity check” contexts (and it’s also a footgun for local verification).

---

## **3\) PR \#77 (merged) and why it didn’t end the loop**

**PR \#77** was intended to fix the `affectedPaths` instability once and for all.

What it appeared to target:

* Make `affectedPaths` reflect the real changed files deterministically.  
* Avoid self-referential inclusion of `governance/evidence.json` (or at least handle it consistently).  
* Ensure canonical output is stable.

Why it didn’t end it:

* The loop simply changed shape:  
  * When excluding `governance/evidence.json`, `affectedPaths` could become empty in some contexts.  
  * When including it, the system can oscillate (“evidence includes itself because evidence changed”).  
* The “PR context” and “main/non-PR context” appear to have **different behavior** for changed file resolution, and the system is not robust to both.  
* There’s a deeper architectural coupling: evidence generation depends on “changed files,” but “changed files” depends on git range assumptions, PR metadata, and/or helper functions that behave differently outside PR events.

---

## **4\) PR \#76 (abandoned) and why it matters**

There was also an open PR (\#76) that got stuck/abandoned due to similar governance loops.

Even though \#76 is closed/abandoned, it matters because it confirms:

* This is not a one-off.  
* We can’t treat these failures as “just fix the evidence file once.”  
* The governance pipeline is effectively generating **systemic developer deadlocks** (time sink, repeated loops, trust erosion).

---

## **5\) Hypotheses we tried (and what we learned)**

### **Hypothesis 1: Evidence drift is just canonical JSON ordering / formatting**

**Attempt:** canonicalization/ordering fixes; ensure sorted arrays, stable stringify, etc.  
**Outcome:** Not sufficient. Drift is not just ordering—membership changes in `affectedPaths` still occur.

### **Hypothesis 2: The drift comes from self-referential inclusion of the evidence file**

**Attempt:** sanitize `affectedPaths` by removing `governance/evidence.json` (and similar generated artifacts).  
**Outcome:** This can “fix” one failure mode, but creates another:

* In some contexts removing evidence leaves `affectedPaths` empty → validator fails.

### **Hypothesis 3: The drift is caused by “PR vs non-PR” context and diff range computation**

**Attempt:** create NO-OP guard (“if no changed files, skip emit and do not rewrite evidence”).  
**Outcome:** This is directionally correct, but our patching attempts didn’t land cleanly due to:

* Not having a stable anchor point in the file for injection.  
* Mismatch between the assumed code shape and the actual file contents.  
* Overwrites that created additional runtime errors.

### **Hypothesis 4: The loop is “just a workflow / PR body / label issue”**

**Attempt:** Use “bulletproof PR body creation” patterns (printf → temp file → `gh pr edit --body-file`) and ensure tier labels are correct. This approach is documented as a known fix for UI-mangling and “body became a comment” issues.

Context Transition Docs (17)

**Outcome:** This solves a *different class of problem* (PR-body fragility), not the core evidence drift/idempotence issue. It helps governance metadata correctness, but doesn’t stop evidence.json mutation loops.

### **Hypothesis 5: Quick local “cleanup” is enough (git clean/reset, regenerate, recommit)**

**Attempt:** repeatedly:

* remove untracked files  
* regenerate evidence  
* commit evidence changes  
* rerun  
  **Outcome:** Temporarily “green” states occur, but the issue returns, especially across context switches (branch → main, PR → local, CI → local).

---

## **6\) Critical failure modes (root causes likely)**

Here’s what a fresh reviewer should focus on—this is where the bug *actually lives*:

### **Root Cause Candidate A: “Changed files from main” is not well-defined across contexts**

* In PR runs, the diff range is meaningful.  
* On main, `main...HEAD` can be empty (or degenerate).  
* The evidence generator appears to assume it will always get a non-empty set, then enforces that assumption via validation.

**Smell:** Evidence schema/contract enforces “non-empty affectedPaths,” but reality includes valid “no-op / no change” runs.

### **Root Cause Candidate B: Evidence contract is being used as both “audit artifact” and “live computed derivative”**

If the system demands that evidence.json always equals “computed changed files,” then:

* The act of writing evidence.json creates a change that can feed back into the next computation unless carefully excluded.  
* Excluding it can create empty set problems.

This indicates a design issue: **evidence.json is a derived artifact, but it is also inside the diff surface.**

### **Root Cause Candidate C: Tooling isn’t resilient to partial failure**

The workflow step fails hard and suggests committing evidence, but this doesn’t help if the generator can’t produce a stable fixed point.

---

## **7\) Current unfinished state**

As of the last attempts:

* CI is still capable of failing with “Evidence drift detected”.  
* Local runs can still:  
  * rewrite `governance/evidence.json` unexpectedly, or  
  * produce invalid evidence (`affectedPaths: []`) depending on context.  
* At least one attempted “overwrite” introduced a new runtime error:  
  * `TypeError: execGit is not a function` from `control-plane/governance/changed-files.ts` when running `governance:emit`.  
* We are no longer in a place where incremental edits are trustworthy without a more systematic refactor \+ tests that explicitly cover:  
  * PR context vs main context  
  * empty diff  
  * self-referential generated files  
  * idempotence across 2+ consecutive runs

---

## **8\) Recommendation: stop patching holes; do a deliberate refactor**

Given the time spent and repeated regressions, the right move is:

### **Recommendation A (fastest “get unblocked”)**

**Demote `governance:emit` idempotence from a hard-fail to a soft signal** temporarily, so core development can proceed while the governance refactor happens.

That means:

* In CI, do not hard fail the entire PR when evidence drift is detected.  
* Instead: emit a warning artifact and/or comment, or gate only on “tier ≥ X” PRs.

This is consistent with your stated priority: “close this and move on to big picture reevaluation.”

### **Recommendation B (proper fix during refactor)**

Redesign evidence generation around a fixed-point principle:

* If `changedFiles` is empty, **do not rewrite evidence** OR write a deterministic sentinel (but then update schema to permit it).  
* Treat generated artifacts as explicitly excluded from `affectedPaths` *and* make emptiness acceptable in non-PR contexts.  
* Make `changed-files` resolution explicit:  
  * PR context: use base/head from event payload or GH API.  
  * Local context: allow an explicit range arg (or default to `origin/main...HEAD` but treat empty as valid).

### **Recommendation C (force test coverage around the failure modes)**

Add unit/integration tests that assert:

* `governance:emit` is idempotent across 2 consecutive runs given:  
  * non-empty diff  
  * empty diff  
* self-referential file exclusion does not cause invalid evidence  
* main vs PR resolution logic does not diverge silently

---

## **9\) If you abandon this sprint right now, what happens?**

Practically:

* You stop spending cycles chasing a moving target.  
* You accept that “governance evidence idempotence” is currently unstable.  
* You start a governance refactor sprint with a clear mandate:  
  * simplify or re-scope enforcement,  
  * reduce contract surfaces,  
  * add tests for the known failure modes,  
  * improve ergonomics (so tier-0/1 don’t feel like tier-3 surgery).

The cost:

* You may leave CI in a state where some PRs will intermittently fail until the refactor lands.  
* But that is *already the current cost* — except today you’re paying it in time and frustration.

Given the observed pattern, abandoning further micro-patching is rational.

---

## **10\) What a third-party reviewer should look at first**

Point them at these exact questions:

1. **Where does `changedFiles` come from?**  
   * How does it behave in PR workflows vs local vs main?  
2. **Is `governance/evidence.json` treated as a generated artifact?**  
   * Is it excluded from diffs consistently?  
   * If excluded, can `affectedPaths` become empty and does schema permit it?  
3. **What is the intended meaning of “affectedPaths must not be empty”?**  
   * Is that a real invariant, or an accidental policy that breaks valid states?  
4. **What is the fixed-point behavior?**  
   * After evidence is updated once, does the next run converge to “no change,” or does it oscillate?  
5. **Where are the tests for these?**  
   * If none exist, that’s why this keeps coming back.

---

## **11\) Deliverable from this closeout**

This closeout is intentionally written so a new model/engineer can:

* understand the failure loop,  
* see why “just regenerate evidence” doesn’t converge,  
* and prioritize a refactor that restores forward progress.

If you want, paste this directly into:

* `docs/sprints/sprint-58-closeout.md` (or whatever sprint number you’re on),  
* and I’ll also produce a **next sprint spec** titled something like:

“Governance Reset: Evidence \+ Mode Enforcement Minimal Reliable Core”

…but the key is: **stop spending cycles trying to patch the current loop without a redesign \+ tests.**

