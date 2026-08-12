/**
 * projectHealthEngine.ts
 * -----------------------------------------------------------------------
 * THIS IS EXACTLY THE BUG YOU DESCRIBED:
 *
 *   src/dashboards/project/ProjectDashboard.tsx (line ~184):
 *     const variance = formData.actualCost - formData.plannedBudget;
 *     budgetStatus = variance > 0 ? 'Over Budget' : 'Under Budget'
 *
 * This only compares money spent so far to the TOTAL budget. A 3-month,
 * ₹30L project that has spent ₹15L by day 12 shows "Under Budget"
 * (15L < 30L) even though it has burned 50% of the money in 13% of the
 * timeline — i.e. it is on pace to finish at ~₹115L, wildly over budget.
 * The dashboard has no way to warn you until it's too late to react.
 *
 * FIX: Earned Value Management (EVM) — the standard project-management
 * technique for exactly this problem (used in construction, defense,
 * IT delivery, PMI/PMBOK). Three numbers:
 *
 *   PV (Planned Value)  = plannedBudget * (elapsedDays / totalPlannedDays)
 *                         "how much SHOULD be spent by now"
 *   AC (Actual Cost)    = actualCost
 *                         "how much IS spent"
 *   CPI (Cost Perf. Index) = PV / AC   (if PV data on earned-progress isn't
 *                         tracked, we use the schedule-based approximation
 *                         below, which is the practical version teams use
 *                         when "% complete" isn't separately logged)
 *
 * SPI (Schedule vs spend ratio) = AC / PV
 *   SPI > 1.15  -> spending meaningfully faster than the timeline implies
 *                  -> forecast an overspend, fire the popup NOW, not at
 *                     the end of the project.
 *
 *   Estimate At Completion (EAC) = AC / (elapsedDays / totalPlannedDays) * ...
 *   more precisely: EAC = plannedBudget * (AC / PV)   when PV > 0
 *   This projects "if you keep spending at this rate, what will the
 *   TOTAL final cost be" — the number your director actually cares about.
 */

import type { ProjectRecord } from '../types/project';

export interface ProjectHealthSignal {
  projectId: string;
  projectName: string;
  elapsedDays: number;
  totalPlannedDays: number;
  pctTimeElapsed: number;      // 0-100
  pctBudgetSpent: number;      // 0-100
  plannedValue: number;        // PV: what should be spent by now
  actualCost: number;          // AC: what has actually been spent
  spendPaceRatio: number;      // AC / PV  (>1 = spending faster than schedule)
  forecastFinalCost: number;   // EAC
  forecastOverrunAmount: number;
  forecastOverrunPct: number;
  riskLevel: 'On Track' | 'Watch' | 'At Risk' | 'Critical Overspend Forecast';
  shouldTriggerPopup: boolean;
  message: string;
}

function daysBetween(a: string, b: string): number {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Compute a real-time early-warning signal for a single running project.
 * This is designed to be called on every dashboard load / sync, not just
 * at project close, so the popup can fire while there's still time to
 * act (renegotiate scope, pause discretionary spend, escalate).
 */
export function computeProjectHealth(project: ProjectRecord, asOfDate: Date = new Date()): ProjectHealthSignal {
  const totalPlannedDays = Math.max(1, daysBetween(project.startDate, project.plannedEndDate));
  const elapsedDaysRaw = daysBetween(project.startDate, asOfDate.toISOString().slice(0, 10));
  const elapsedDays = Math.max(0, Math.min(elapsedDaysRaw, totalPlannedDays));

  const pctTimeElapsed = Math.round((elapsedDays / totalPlannedDays) * 100);
  const pctBudgetSpent = project.plannedBudget > 0 ? Math.round((project.actualCost / project.plannedBudget) * 100) : 0;

  // Planned Value: how much SHOULD have been spent by now if spend tracks
  // schedule linearly. (Linear is the standard default absent a phased
  // spend curve/milestone plan in the source data; if projectSheetsService
  // ever captures milestone-level planned spend, swap this for the real
  // milestone-weighted PV — the rest of the model is unaffected.)
  const plannedValue = project.plannedBudget * (elapsedDays / totalPlannedDays);

  const spendPaceRatio = plannedValue > 0 ? project.actualCost / plannedValue : (project.actualCost > 0 ? 2 : 0);

  // Forecast final cost (Estimate At Completion) — "if this pace continues,
  // what will the project actually cost when it's done?"
  const forecastFinalCost = plannedValue > 0
    ? Math.round(project.plannedBudget * spendPaceRatio)
    : project.actualCost;

  const forecastOverrunAmount = Math.max(0, forecastFinalCost - project.plannedBudget);
  const forecastOverrunPct = project.plannedBudget > 0 ? Math.round((forecastOverrunAmount / project.plannedBudget) * 100) : 0;

  let riskLevel: ProjectHealthSignal['riskLevel'] = 'On Track';
  let shouldTriggerPopup = false;

  // Require a minimum of ~10% time elapsed before judging pace — day 1-2
  // spend spikes (mobilization, upfront material purchase) are normal and
  // shouldn't trigger false alarms.
  const enoughDataToJudge = pctTimeElapsed >= 10;

  if (enoughDataToJudge) {
    if (spendPaceRatio >= 1.4) {
      riskLevel = 'Critical Overspend Forecast';
      shouldTriggerPopup = true;
    } else if (spendPaceRatio >= 1.15) {
      riskLevel = 'At Risk';
      shouldTriggerPopup = true;
    } else if (spendPaceRatio >= 1.0) {
      riskLevel = 'Watch';
    }
  }

  const message = shouldTriggerPopup
    ? `"${project.projectName}" has spent ${pctBudgetSpent}% of budget in only ${pctTimeElapsed}% of the timeline (day ${elapsedDays} of ${totalPlannedDays}). ` +
      `At this pace it is forecast to finish at ₹${forecastFinalCost.toLocaleString('en-IN')} — ` +
      `₹${forecastOverrunAmount.toLocaleString('en-IN')} (${forecastOverrunPct}%) over the ₹${project.plannedBudget.toLocaleString('en-IN')} planned budget. Review scope/spend now.`
    : `On pace: ${pctBudgetSpent}% spent vs ${pctTimeElapsed}% of timeline elapsed.`;

  return {
    projectId: project.id,
    projectName: project.projectName,
    elapsedDays,
    totalPlannedDays,
    pctTimeElapsed,
    pctBudgetSpent,
    plannedValue: Math.round(plannedValue),
    actualCost: project.actualCost,
    spendPaceRatio: Math.round(spendPaceRatio * 100) / 100,
    forecastFinalCost,
    forecastOverrunAmount,
    forecastOverrunPct,
    riskLevel,
    shouldTriggerPopup,
    message
  };
}

/** Run across the whole running portfolio; return only the ones that need attention, worst first. */
export function scanPortfolioForOverspendRisk(projects: ProjectRecord[]): ProjectHealthSignal[] {
  return projects
    .filter(p => p.status === 'Running')
    .map(p => computeProjectHealth(p))
    .filter(s => s.riskLevel !== 'On Track')
    .sort((a, b) => b.spendPaceRatio - a.spendPaceRatio);
}
