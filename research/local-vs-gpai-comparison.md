# Local eduForge vs GPAI quadratic test

## Test prompt

`Solve x^2 - 5x + 6 = 0. Explain like a patient textbook teacher, show checks, and include common mistakes.`

## GPAI observed output

- Correct answer: `x = 2, 3`.
- Structure: Problem → Answer → Cross-checked → Solution → mistakes section → follow-up questions / quiz.
- Strengths: clear factoring path, direct substitution checks, useful mistake warnings.
- Weaknesses: copied text had duplicated math fragments, no stable reusable schema, limited practice/quiz depth.

## Local eduForge output

- Correct answer: `\(x=2\) or \(x=3\)`.
- Structure: Problem → Answer → Cross-check status → Solution → Verification → Revised mistakes AI detected → Follow-up questions → Quiz → Similar practice.
- Improvements:
  - Explicit "Cross-check status" before the solution body.
  - Teacher notes after each step.
  - Clean LaTeX markdown source.
  - Similar practice built into the final answer, not just a button.
  - Stable JSON fields for key concepts, mistakes, checks, quiz, visual plan, and follow-ups.

## Status

For this prompt, the local demo fallback matches GPAI's answer and follows the same educational result flow while adding stronger structure and practice. With NVIDIA env vars set, the same flow is powered by the selected model route and verifier pass.
