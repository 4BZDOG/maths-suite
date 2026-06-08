# Handoff — Word-Problem Variants (2026-06-08)

## What was done

Added real-world contextual word problems (20–30% chance per question) to 8
generator topics in `generators/mathsQuestionGen.js`. Previously, many topics
and difficulty levels only produced bare mathematical expressions (e.g.
"Calculate $3 + 5$"). Now they also produce narrative questions (e.g. "A factory
produces 342 items on Monday and 158 on Tuesday. What is the total
production?").

### Topics updated

| Topic | Difficulty | What was added |
|-------|-----------|----------------|
| **Integers** | Medium, Hard | Word problems for add, subtract, multiply, divide |
| **Decimals** | Medium | Multiply word problems |
| **Decimals** | Hard | 3-number addition, division, subtraction, multiply word problems |
| **Rounding** | Easy | Nearest whole number and nearest 100 word problems |
| **Rounding** | Medium | Estimation word problems |
| **Fractions** | Medium | Subtraction and multiplication word problems |
| **Fractions** | Hard | Division word problems |
| **Statistics** | Easy, Medium, Hard | Narrative wrappers for mean, median, mode, range, IQR, missing-value |
| **Non-linear** | Easy, Medium, Hard | Contextual scenarios for parabola features and identify-graph |

### Design decisions

- Word-problem frequency is 20–30% (varies by operation), keeping the majority
  of questions as traditional calculation exercises — this matches the existing
  pattern in Easy-level generators.
- Statistics uses a shared `STAT_STORIES` object with templates per measure type,
  combined with the existing `DATA_CONTEXTS` list for contextual variety.
- Non-linear uses science/engineering contexts (projectile paths, modelling) to
  motivate the otherwise abstract parabola questions.
- No answer logic was changed — only the `clue` text varies.

## What was NOT done

- **Algebra** — already had 35–75% word problems; more could be added to
  Medium/Hard solve operations, but it's lower priority.
- **Geometry** — limited word problems could be added to Easy perimeter and
  Medium Pythagoras; most geometry already has implicit context via diagrams.
- **Trigonometry** — Applications and Bearings already have 100% word problems;
  find-side/find-angle are inherently diagram-based.
- **Probability, Financial Maths, Ratios & Rates, Percentages** — already have
  excellent (75–100%) word-problem coverage across all difficulties.

## Tests

All 54 tests pass. Build succeeds. No answer logic changes.

## Branch

`claude/loving-davinci-LvsxC` — pushed to origin.
