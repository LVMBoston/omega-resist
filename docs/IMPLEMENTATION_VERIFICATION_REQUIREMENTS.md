# Implementation Verification Requirements

This project requires **verification, not just implementation**.

Any request labeled as a "fix," "bug fix," or "correction" is considered incomplete unless the work is **demonstrably verified**.

---

## What "Verified" Means

A change is considered verified only if **at least one** of the following is provided:

1. **UI Evidence**
   - A screenshot or precise description of the corrected UI state
   - The output must correspond to a real, concrete example value

2. **Automated Test**
   - A unit, integration, or component test that asserts the expected behavior
   - The test must fail before the fix and pass after it

3. **Runtime Proof**
   - A console log or debug output showing:
     - raw input value(s)
     - relevant configuration (e.g., timezone, filters)
     - final computed/displayed value

Merely describing the code change is not sufficient.

---

## Required Structure for Fix Responses

When responding to a fix request, the implementation must include:

1. **Explicit Expected Output**
   - At least one concrete input and its exact expected output

2. **Implementation Summary**
   - What was changed
   - Where it was changed (file names)

3. **Verification Evidence**
   - One of the three verification methods above

Do not claim a fix is complete without including verification evidence.

---

## Prohibited Completion Language

The following phrases are not acceptable without verification:

- "Fixed."
- "This should now work."
- "The issue is resolved."
- "This corrects the behavior."

Use of these phrases without verification is considered incomplete work.

---

## Default Assumption

If verification is not provided, the fix is assumed **unverified** and may be rejected or reworked.

---

## Rationale

This project prioritizes correctness, trust, and semantic accuracy over speed.  
Verification protects against silent regressions and confident-but-incorrect fixes.
