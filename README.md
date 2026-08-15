# Code Improvement Challenge

Welcome! This is a take-home exercise for Senior Full Stack Engineer candidates.

## Context

Our platform helps real estate investors build and grow their wealth. You're being
handed an early, rough version of one of our screens. From now on, treat it as yours.

## The app

The starter app **already runs**. It covers the areas below — all functional on the
surface, none of it at the quality we'd ship. Your job is not to build these from
scratch, but to take what exists and bring it to the standard you'd expect of code
you own.

- **Portfolio summary (home):** a snapshot of the user's wealth — total portfolio
  value, total invested, monthly cashflow, and gain/loss.
- **Property list (home):** every property the user owns, with name, address, current
  value, and net monthly cashflow (income minus expenses). Each property opens a
  detail view.
- **Property detail:** the full financial breakdown of a property — purchase price,
  current value, monthly income, monthly expenses, and net cashflow.
- **Quick Edit (detail):** a form to update a property's current value and monthly
  income via `PATCH /api/properties/update`.

That's what the screens are *meant* to do. How well they actually do it is for you
to find out.

## Your task

Take this codebase to the quality you'd expect of something you own and put in front
of real users. We're deliberately **not** handing you a list of bugs or a checklist of
fixes — deciding what's wrong, what matters most, and what "production quality" means
here is a core part of the exercise. Restructure, refactor, rethink the data layer,
add dependencies — whatever you'd genuinely do.

You almost certainly won't get to everything in the time you spend, and that's fine.
We're far more interested in the judgment behind what you chose to do (and not do)
than in raw coverage. Aim for something like **3–4 focused hours** rather than a
weekend.

## What to hand back

1. Your improved code.
2. A short write-up — a page is plenty — covering: the main problems you found, how
   you prioritized them, what you changed and why, what you deliberately left alone,
   and any trade-offs or assumptions you made. This is how we understand your
   reasoning, and it's what we'll dig into together afterwards.

## How we evaluate

We care about **how** you work, not just a green happy path. Roughly, in order:

- **Ownership & judgment** — what you choose to fix, how you prioritize, where you draw
  the line, and whether you can stand behind those calls.
- **Diagnosis** — how well you understand the code and the data before changing them,
  and whether you fix causes rather than patch symptoms.
- **Code quality** — readability, naming, types, structure, and changes a teammate
  could review with confidence.
- **Data & API handling** — how you deal with messy, inconsistent, and unreliable
  inputs so the rest of the app can trust them.
- **Resilience** — how the app behaves while data is loading, when a request fails,
  and when there's genuinely nothing to show.
- **AI usage** — we expect you to use Cursor, Copilot, ChatGPT, Claude, etc. What we
  look for is how you leverage those tools to move faster without losing ownership:
  rules, skills, clear prompts, sensible diffs, and code you can explain and defend.
  Feel free to note in your write-up how you applied them.

After you submit, we'll have a short call where you walk us through your work and we
ask about your decisions.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Notes

- The starter code is intentionally rough — that's the point.
- Nothing here is off-limits: restructure, refactor, and add dependencies as you see fit.
- If something in this brief seems wrong to you, trust your judgment and tell us why.

Good luck!
