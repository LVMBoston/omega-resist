# Plan: Fix AI Draft Generation Failure

## 1. Confirm the exact failure path
 a. Reproduce the bug on the published site for BUGTEST, not just in preview, because you already hard-reset and published.
 b. Capture the browser-side failure from Console and Network so I can confirm whether the request is being blocked before it leaves the page.
 c. Compare the request headers the page is sending with the headers the AI drafting backend currently allows.

## 2. Fix the backend request handling
 a. Update the AI drafting backend function to use the standard browser-safe CORS setup used elsewhere in this project.
 b. Expand the allowed request headers if the browser is sending headers that the current function does not allow.
 c. Make sure the preflight response and every success/error response return the same CORS headers, so the browser does not block the real POST.
 d. Re-test until the POST reaches the backend and the function logs show an actual invocation.

## 3. Fix the client-side error handling
 a. Improve the generate action so it surfaces the real failure reason instead of always showing the generic red "try again" toast.
 b. Distinguish between these cases in the UI: blocked request, network failure, backend validation error, rate limit, credit exhaustion, and empty AI response.
 c. Add temporary diagnostic logging while testing so I can prove whether the failure is happening in the page, in transit, or in the backend.

## 4. Verify the full user flow
 a. Test the BUGTEST campaign at the Campaign-Level Messaging Overrides card, where you reported the issue.
 b. Confirm that clicking Generate creates a real draft in the field instead of returning the red toast.
 c. Verify both one-off generation and the bulk generate flow, because they share the same path.
 d. Re-check the published site after the fix, since that is the environment you are using.

## 5. Technical details
 a. The current evidence points to a browser-side block, not an AI-model failure: the preflight succeeds, but the real generation request never reaches the backend.
 b. The most likely causes are a CORS header mismatch or a client-side request failure inside the browser SDK call.
 c. If the browser is sending newer platform/runtime headers, I will align this function with the broader allow-list already used by other working backend functions in this project.
 d. I will keep the fix scoped to the AI drafting path only; I will not change unrelated campaign logic.

## 6. Deliverables
 a. A backend fix so the request can reach the AI drafting service from the published site.
 b. A UI fix so errors say what actually went wrong.
 c. End-to-end verification in the browser showing the draft appears correctly.
 d. A decision document update saved as a new plan record for this bug fix, or an update to the existing AI drafting controls decision if that is the better fit.

## 7. Questions
 a. No more answers are required from you right now — I have enough to implement this plan.