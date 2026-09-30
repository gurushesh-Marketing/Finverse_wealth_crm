---
name: finverse-reporting-contract
description: Define Finverse CRM KPIs and reporting roll-ups from source events, effective assignments, and documented periods. Preload for the data analyst.
---

# Finverse reporting contract

For each assigned KPI, state its source fact and grain before calculating a
number. Record the numerator, denominator, period boundary, event timestamp,
inclusion and exclusion rules, and treatment of corrections or reversals.

Attribute each fact using the assignment effective at the relevant event time.
Keep historical attribution when an employee transfers, is promoted, or leaves;
use current grants only to decide who may view the report now. For a Team Lead
with multiple teams, identify the team attached to each fact rather than
counting a person once per granted team.

Prove the definition with a small synthetic ledger and show the arithmetic.
Roll totals up from facts; do not sum dashboard cards or average percentages.
Reconcile individual, team, vertical, and company views using the same fact
set where those views are in scope.

Return the formula, worked example, edge cases, source action IDs, and every
unresolved policy marked [ASSUMPTION]. Do not invent product revenue rules or
claim fixture values are actual Finverse performance.
