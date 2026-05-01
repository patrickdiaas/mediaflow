// Pacing de orçamento mensal: dado o orçamento, a estratégia (front_half_pct)
// e o dia atual do mês, calcula quanto JÁ deveria ter sido gasto se o ritmo
// estivesse dentro do plano. Compara com o gasto real e devolve um status.

export interface BudgetPacingInput {
  budget: number;
  frontHalfPct: number; // % do orçamento alocado nos primeiros 15 dias
  daysInMonth: number;  // 28..31
  dayOfMonth: number;   // 1..daysInMonth (clamp se passar)
  realSpend: number;
}

export type PacingStatus = "on_track" | "slightly_over" | "over" | "slightly_under" | "under";

export interface BudgetPacingResult {
  expectedSpend: number;          // quanto deveria ter sido gasto até hoje
  expectedSpendByEom: number;     // total previsto pelo plano (= budget)
  realSpend: number;
  remaining: number;              // budget - realSpend (pode ser negativo)
  daysRemaining: number;          // dias restantes até o fim do mês
  recommendedDailySpend: number;  // média recomendada pros dias restantes
  pacingRatio: number;            // realSpend / expectedSpend (1 = no ritmo)
  status: PacingStatus;
  statusLabel: string;
}

const FIRST_HALF_DAYS = 15;

export function calcExpectedSpend(budget: number, frontHalfPct: number, daysInMonth: number, dayOfMonth: number): number {
  const front = Math.max(0, Math.min(100, frontHalfPct)) / 100;
  const back  = 1 - front;
  const firstHalfDays = Math.min(FIRST_HALF_DAYS, daysInMonth);
  const secondHalfDays = daysInMonth - firstHalfDays;
  const day = Math.max(0, Math.min(daysInMonth, dayOfMonth));

  const frontBudget = budget * front;
  const backBudget  = budget * back;

  if (day <= firstHalfDays) {
    return frontBudget * (day / firstHalfDays);
  }
  const dayInBack = day - firstHalfDays;
  return frontBudget + (secondHalfDays > 0 ? backBudget * (dayInBack / secondHalfDays) : 0);
}

export function getPacingStatus(realSpend: number, expectedSpend: number): { status: PacingStatus; label: string } {
  if (expectedSpend <= 0) return { status: "on_track", label: "Mês ainda não começou" };
  const ratio = realSpend / expectedSpend;
  if (ratio >= 1.20) return { status: "over",            label: "Acima do ritmo (>20%)" };
  if (ratio >= 1.10) return { status: "slightly_over",   label: "Levemente acima (>10%)" };
  if (ratio >= 0.90) return { status: "on_track",        label: "No ritmo" };
  if (ratio >= 0.80) return { status: "slightly_under",  label: "Levemente abaixo (<10%)" };
  return { status: "under", label: "Atrasado (<20%)" };
}

export function calcBudgetPacing(input: BudgetPacingInput): BudgetPacingResult {
  const { budget, frontHalfPct, daysInMonth, dayOfMonth, realSpend } = input;
  const expectedSpend = calcExpectedSpend(budget, frontHalfPct, daysInMonth, dayOfMonth);
  const remaining = budget - realSpend;
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);
  const recommendedDailySpend = daysRemaining > 0 ? Math.max(0, remaining) / daysRemaining : 0;
  const pacingRatio = expectedSpend > 0 ? realSpend / expectedSpend : 0;
  const { status, label } = getPacingStatus(realSpend, expectedSpend);

  return {
    expectedSpend,
    expectedSpendByEom: budget,
    realSpend,
    remaining,
    daysRemaining,
    recommendedDailySpend,
    pacingRatio,
    status,
    statusLabel: label,
  };
}

// Helper: retorna { year, month (1..12), daysInMonth, dayOfMonth } baseado em uma data
export function getMonthInfo(d: Date = new Date()) {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = d.getDate();
  return { year, month, daysInMonth, dayOfMonth, yearMonth: `${year}-${String(month).padStart(2, "0")}` };
}
