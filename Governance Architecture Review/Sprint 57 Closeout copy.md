# **Sprint 57 — Governance Determinism Hardening v1**

**Status:** ✅ Merged  
 **Branch:** `sprint-57-governance-determinism-hardening-v1`  
 **Primary Objective:** Eliminate evidence drift fragility and stabilize CI governance determinism.

---

# **1\. Executive Summary**

Sprint 57 successfully hardened canonical evidence generation and resolved the recurring “evidence drift” CI failure that had been destabilizing multiple prior sprints.

However, the sprint exposed a deeper structural tension in the governance system:

* Evidence determinism is now stable.

* Governance mode enforcement (structured vs autonomous) remains brittle from a UX perspective.

* CI failures are now clearly separated into:

  * Deterministic evidence mismatch (solved)

  * Mixed execution mode policy violations (architectural constraint)

  * External GitHub API instability (transient infrastructure noise)

The system is now behaving deterministically — but developer ergonomics around PR boundaries remain friction-heavy.

---

# **2\. What Was Originally Failing**

Across multiple sprints we encountered:

### **A. Evidence Drift Failures**

CI step:

Generate canonical evidence (CI)  
Assert evidence idempotent

Failure message:

Evidence drift detected — canonical evidence must be committed.

Root causes:

* Non-stable canonical JSON ordering

* Minor metadata inconsistencies

* Evidence being generated differently in CI vs local

* Lack of explicit PR number handling

* Fragile CLI argument parsing

* Implicit reliance on GitHub event metadata

This created a recurring cycle:

* Merge PR

* CI fails

* Regenerate evidence

* Commit fix

* CI fails again

* Repeat

This was psychologically destabilizing because governance was meant to ensure reliability — yet it was the primary source of instability.

---

# **3\. What Sprint 57 Actually Fixed**

## **3.1 Deterministic Evidence Emission**

We hardened:

* `governance-emit-ci.ts`

* PR metadata resolution

* Explicit PR number handling

* Canonical JSON generation

* Hash calculation via stable canonical stringify

* SHA logging clarity

We ensured:

* Canonical JSON is computed consistently

* The same hash is derived locally and in CI

* Evidence JSON written matches computed canonical string

* Drift detection compares canonicalized versions only

### **Result:**

Evidence drift failures are now deterministic and explainable.

When drift appears, it reflects a true mismatch between:

* PR file set

* Generated evidence.json

Not random ordering artifacts.

---

## **3.2 Clarified Execution Mode Enforcement**

We hit repeated failures of:

Mode policy violation: mixed execution modes detected

This happens when a PR touches both:

* Structured paths (`control-plane/`, `.github/`, governance code)

* Autonomous paths (`docs/`, swarm contexts, etc.)

Policy rule:

One PR \= One execution mode.

This is not a determinism bug.  
 This is a structural constraint of governance architecture.

Sprint 57 clarified:

* Mixed mode detection is working as designed.

* Evidence can be perfect and CI will still fail if modes are mixed.

* Docs changes must be separated or policy relaxed.

---

## **3.3 GitHub API Flakiness**

We encountered:

* 502 from GitHub API in PR body check

* 500 from GitHub during `actions/checkout`

These were:

* External GitHub outages

* Not caused by our code

* Resolved via rerun

Important lesson:  
 Governance CI must tolerate external API instability (future improvement opportunity: retry logic).

---

# **4\. What We Learned (Technically)**

## **4.1 Evidence Determinism Was a Real Bug**

That part was not overengineering.  
 It required hardening and now behaves correctly.

## **4.2 Mixed Execution Mode Is Not a Bug — It's Policy**

The system enforces:

* Structured code changes must not co-exist with autonomous path edits in the same PR.

The friction arises because:

* Docs are classified as autonomous

* Governance code is structured

* Small refactors often touch both

The architecture is internally consistent but externally inconvenient.

## **4.3 Governance Failures Now Fall Into Clear Buckets**

1. Canonical evidence mismatch (fixed)

2. Mixed execution modes (workflow constraint)

3. Unowned paths warnings (non-blocking)

4. GitHub API instability (external)

5. Tier labeling / PR body contract enforcement

This clarity is progress.

---

# **5\. What We Learned (Architecturally)**

The system is:

* Deterministic ✔

* Enforcing policy boundaries ✔

* CI reproducible ✔

* Emotionally taxing when friction appears ✔

The biggest takeaway:

The governance engine is no longer unstable — it is strict.

There is a difference.

Previously, failures were nondeterministic and recursive.  
 Now failures are explainable and policy-driven.

That is a meaningful shift.

---

# **6\. Emotional / Strategic Reflection**

You raised a legitimate concern:

Are we over-architecting basic oversight?

That concern was rational.

What Sprint 57 revealed:

* The determinism layer was necessary.

* The pain now comes from mode separation ergonomics.

* This is a UX problem, not a cryptographic or determinism flaw.

The system is viable.  
 The workflow needs refinement.

This is no longer existential instability.  
 It is governance UX friction.

---

# **7\. Current System State (Post-Sprint 57\)**

### **Evidence Generation**

* Stable

* Canonical

* SHA reproducible

* CI and local match

### **PR Body Enforcement**

* Working

* Deterministic

* Requires GH API stability

### **Mode Enforcement**

* Working

* Strict

* Requires PR discipline

### **Branch State**

* Sprint 57 merged

* No stray docs diffs

* No evidence drift on main

* Local branches cleaned

---

# **8\. Outstanding Friction Points**

1. Mixed execution mode PRs require splitting

2. Docs classification increases friction

3. GH API calls lack retry logic

4. Developers must understand mode boundaries manually

These are ergonomics issues — not correctness issues.

---

# **9\. Recommended Direction for Sprint 58**

We should now focus on:

## **Governance Reliability v2 — Ergonomic Hardening**

Objectives:

1. Improve mixed-mode developer UX:

   * Better preflight warnings

   * Clearer local validation

   * Possibly auto-detection before commit

2. Add retry logic to GitHub API calls:

   * Treat 502/503/504 as retryable

   * Avoid failing CI for transient issues

3. Optional: Reevaluate docs classification:

   * Should docs truly be autonomous?

   * Or should docs be tier-0 structured?

   * Clarify that policy intentionally

4. Add local “governance dry run” command:

   * Simulate full CI validation locally

   * Prevent surprise CI failures

This sprint should not relax determinism.  
 It should improve workflow resilience.

---

# **10\. Final Assessment**

Sprint 57 achieved its primary objective:

✅ Canonical evidence drift is solved.  
 ✅ Determinism is stable.  
 ✅ CI reproducibility is restored.  
 ✅ Failures are explainable.

The system is not unstable.

The system is now strict and explicit.

The next evolution is usability, not rollback.

