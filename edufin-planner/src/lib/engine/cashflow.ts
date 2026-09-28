import { formatNumber, formatPct, formatRp } from "../format";
import { monthsUntilAyStart } from "./educationPath";
import { stepFactor, type Withdrawal } from "./funding";
import { futureValue, monthlyRate, paymentForTarget, pvGrowingAnnuity } from "./tvm";
import type { Assumptions, Explain, Household, Person } from "./types";

/**
 * Integrated month-by-month household projection (≥ 30 years), aggregated per academic year.
 *
 * Per month:  Free cash flow = income − living expenses − debt service − education paid from cash
 *             Ending portfolio = beginning + FCF + investment return − education withdrawals
 * Education payments come from the education fund first; any shortfall is paid from cash flow.
 * A negative surplus is drawn from cash → general investments → retirement fund → education fund;
 * whatever remains is recorded as an unfunded deficit (a liability, flagged).
 * Annual growth (salary raises, price inflation) steps at each academic-year start (July).
 */

export interface CashflowRow {
  ay: number;
  label: string;
  months: number;
  partial: boolean;
  agePrimary: number;
  ageSpouse?: number;
  primaryWorking: boolean;
  income: number;
  employmentIncome: number;
  otherIncome: number;
  pensionIncome: number;
  livingExpenses: number;
  debtService: number;
  educationCost: number;
  educationFromFund: number;
  educationFromCashflow: number;
  /** Income − living − debt − education paid from cash flow. */
  fcf: number;
  eduContribution: number;
  retContribution: number;
  investmentReturn: number;
  drawdown: number;
  unfundedDeficit: number;
  beginInvestable: number;
  endCash: number;
  endEduFund: number;
  endRetFund: number;
  endGenInv: number;
  endInvestable: number;
  property: number;
  vehicles: number;
  otherAssets: number;
  loanBalance: number;
  liabilities: number;
  totalAssets: number;
  netWorth: number;
  flags: ("deficit" | "retirement_raid" | "education_raid" | "unfunded")[];
}

export interface RetirementResult {
  retirementAy: number;
  yearsToRetirement: number;
  yearsInRetirement: number;
  annualNeedAtRetirement: number;
  requiredCorpus: number;
  projectedAvailable: number;
  projectedRetFund: number;
  readiness: number;
  requiredMonthly: number;
  plannedMonthly: number;
  depletionAge: number | null;
  explain: Explain;
}

export interface CashflowResult {
  rows: CashflowRow[];
  startNetWorth: number;
  savingsCapacityMonthly: number;
  retirement: RetirementResult;
  firstDeficitAy: number | null;
  unfundedTotal: number;
  retirementRaidAy: number | null;
  educationRaidAy: number | null;
  warnings: string[];
}

export interface CashflowInput {
  household: Household;
  assumptions: Assumptions;
  currentAy: number;
  planDate: string;
  /** Nominal education cost per academic year (all children). */
  educationByAy: Map<number, number>;
  /** Remaining recurring cost of the current academic year, paid monthly from cash flow. */
  currentAyRemaining: number;
  withdrawals: Withdrawal[];
  eduMonthly: number;
  eduDelayMonths: number;
  /** Annual increase of the education contribution (step-up). */
  eduStepUp?: number;
  retMonthly: number;
  incomeMultiplier?: number;
}

interface Loan {
  balance: number;
  monthlyRate: number;
  payment: number;
}

const sumBy = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

export function horizonYears(h: Household, a: Assumptions): number {
  const toLife = a.lifeExpectancy - h.primary.age + 1;
  return Math.min(70, Math.max(a.projectionYears, toLife, 1));
}

export function monthlyLivingToday(h: Household): number {
  return sumBy(h.expenses, (e) => e.monthlyAmount);
}

export function monthlyDebtServiceToday(h: Household): number {
  return sumBy(h.liabilities, (l) => (l.outstanding > 0 ? l.monthlyPayment : 0));
}

export function monthlyIncomeToday(h: Household): number {
  const p = (x?: Person) => (x ? x.monthlyIncome + x.annualBonus / 12 + x.otherMonthlyIncome : 0);
  return p(h.primary) + p(h.spouse);
}

export function runCashflow(input: CashflowInput): CashflowResult {
  const { household: h, assumptions: a, currentAy: B, planDate } = input;
  const mult = input.incomeMultiplier ?? 1;
  const H = horizonYears(h, a);
  const warnings: string[] = [];
  const rCash = monthlyRate(a.returns.cash);
  const rGen = monthlyRate(a.returns.general);
  const rEdu = monthlyRate(a.returns.education);
  const rRetPre = monthlyRate(a.returns.retirement);
  const rRetPost = monthlyRate(a.returns.postRetirement);
  const gInf = a.inflation.general;

  // Opening balances
  let cash = sumBy(h.assets.filter((x) => x.type === "cash" || x.type === "emergency_fund"), (x) => x.value);
  let edu = sumBy(h.assets.filter((x) => x.type === "education_fund"), (x) => x.value);
  let ret = sumBy(h.assets.filter((x) => x.type === "retirement_fund"), (x) => x.value);
  let gen = sumBy(h.assets.filter((x) => x.type === "investment"), (x) => x.value);
  const growing = h.assets
    .filter((x) => x.type === "property" || x.type === "vehicle" || x.type === "other")
    .map((x) => ({
      type: x.type,
      value: x.value,
      rate: monthlyRate(x.growth ?? (x.type === "property" ? gInf : x.type === "vehicle" ? -0.1 : 0)),
    }));
  const loans: Loan[] = h.liabilities
    .filter((l) => l.outstanding > 0)
    .map((l) => ({ balance: l.outstanding, monthlyRate: l.annualRate / 12, payment: l.monthlyPayment }));
  for (const l of h.liabilities) {
    if (l.outstanding > 0 && l.monthlyPayment <= (l.outstanding * l.annualRate) / 12) {
      warnings.push(`Cicilan "${l.label}" tidak menutup bunga — saldo utang akan membesar.`);
    }
  }
  const startNetWorth =
    cash + edu + ret + gen + sumBy(growing, (g) => g.value) - sumBy(loans, (l) => l.balance);

  const mStart = (ay: number) => monthsUntilAyStart(ay, planDate);
  const lastWithdrawal = input.withdrawals.reduce((mx, w) => Math.max(mx, w.month), 0);
  const withdrawalsByMonth = new Map<number, number>();
  for (const w of input.withdrawals) withdrawalsByMonth.set(w.month, (withdrawalsByMonth.get(w.month) ?? 0) + w.amount);
  const step = 12 / a.contributionFrequency;
  const eduPerPeriod = input.eduMonthly * step;
  const remainingCurrentMonths = Math.max(0, mStart(B + 1) - 1);
  const currentAyMonthly = remainingCurrentMonths > 0 ? input.currentAyRemaining / remainingCurrentMonths : 0;

  const primaryRetAy = B + Math.max(0, h.primary.targetRetirementAge - h.primary.age);
  const mRet = Math.max(0, mStart(primaryRetAy));
  const people = [h.primary, ...(h.spouse ? [h.spouse] : [])];

  const rows: CashflowRow[] = [];
  let unfunded = 0;
  let firstDeficitAy: number | null = null;
  let retirementRaidAy: number | null = null;
  let educationRaidAy: number | null = null;
  let depletionAge: number | null = null;
  let eduFundClosed = false;
  let projectedAvailable = 0;
  let projectedRetFund = 0;
  let captured = false;
  const capture = (livingMonthly: number) => {
    const emergencyTarget = a.emergencyFundTargetMonths * livingMonthly;
    projectedAvailable = ret + gen + Math.max(0, cash - emergencyTarget);
    projectedRetFund = ret;
    captured = true;
  };
  if (mRet <= 0) capture(monthlyLivingToday(h) * a.retirementExpenseRatio);

  const investable = () => cash + edu + ret + gen;

  for (let k = 0; k < H; k++) {
    const ay = B + k;
    const from = k === 0 ? 1 : mStart(ay);
    const to = mStart(ay + 1) - 1;
    const yIdx = k;
    const agePrimary = h.primary.age + yIdx;
    const working = (p: Person) => p.age + yIdx < p.targetRetirementAge;
    const primaryWorking = working(h.primary);
    const retiredHousehold = !primaryWorking;
    const row: CashflowRow = {
      ay,
      label: `${ay}/${String((ay + 1) % 100).padStart(2, "0")}`,
      months: Math.max(0, to - from + 1),
      partial: k === 0,
      agePrimary,
      ageSpouse: h.spouse ? h.spouse.age + yIdx : undefined,
      primaryWorking,
      income: 0,
      employmentIncome: 0,
      otherIncome: 0,
      pensionIncome: 0,
      livingExpenses: 0,
      debtService: 0,
      educationCost: k === 0 ? input.currentAyRemaining : input.educationByAy.get(ay) ?? 0,
      educationFromFund: 0,
      educationFromCashflow: 0,
      fcf: 0,
      eduContribution: 0,
      retContribution: 0,
      investmentReturn: 0,
      drawdown: 0,
      unfundedDeficit: 0,
      beginInvestable: investable(),
      endCash: 0,
      endEduFund: 0,
      endRetFund: 0,
      endGenInv: 0,
      endInvestable: 0,
      property: 0,
      vehicles: 0,
      otherAssets: 0,
      loanBalance: 0,
      liabilities: 0,
      totalAssets: 0,
      netWorth: 0,
      flags: [],
    };

    // Monthly amounts for this academic year (growth steps at AY start).
    let employment = 0;
    let other = 0;
    let pension = 0;
    for (const p of people) {
      if (working(p)) employment += (p.monthlyIncome + p.annualBonus / 12) * mult * Math.pow(1 + p.incomeGrowth, yIdx);
      else pension += (p.pensionMonthly ?? 0) * Math.pow(1 + gInf, yIdx);
      other += p.otherMonthlyIncome * mult * Math.pow(1 + gInf, yIdx);
    }
    const living =
      sumBy(h.expenses, (e) => e.monthlyAmount * Math.pow(1 + (e.growth ?? gInf), yIdx)) *
      (retiredHousehold ? a.retirementExpenseRatio : 1);

    const flag = (f: CashflowRow["flags"][number]) => {
      if (!row.flags.includes(f)) row.flags.push(f);
    };

    for (let m = from; m <= to; m++) {
      // Snapshot what is available at the start of retirement (before that month's flows).
      if (!captured && m >= mRet) capture(living);

      // 1. Investment growth
      const gCash = cash * rCash;
      const gGen = gen * rGen;
      const gEdu = edu * rEdu;
      const gRet = ret * (m >= mRet ? rRetPost : rRetPre);
      cash += gCash;
      gen += gGen;
      edu += gEdu;
      ret += gRet;
      row.investmentReturn += gCash + gGen + gEdu + gRet;
      for (const g of growing) g.value *= 1 + g.rate;

      // 2. Debt service
      let debt = 0;
      for (const l of loans) {
        if (l.balance <= 0) continue;
        const interest = l.balance * l.monthlyRate;
        const pay = Math.min(l.payment, l.balance + interest);
        l.balance = l.balance + interest - pay;
        if (l.balance < 1) l.balance = 0;
        debt += pay;
      }

      // 3. Education fund: contributions, withdrawals
      let eduFromCash = k === 0 ? currentAyMonthly : 0;
      let eduContrib = 0;
      if (m <= lastWithdrawal && m > input.eduDelayMonths && (m - input.eduDelayMonths) % step === 0) {
        eduContrib = eduPerPeriod * stepFactor(m, input.eduDelayMonths, a.contributionFrequency, input.eduStepUp);
        edu += eduContrib;
      }
      const wd = withdrawalsByMonth.get(m) ?? 0;
      if (wd > 0) {
        const paid = Math.min(edu, wd);
        edu -= paid;
        row.educationFromFund += paid;
        eduFromCash += wd - paid;
      }
      if (!eduFundClosed && lastWithdrawal > 0 && m >= lastWithdrawal) {
        gen += edu; // leftover education money rejoins general investments
        edu = 0;
        eduFundClosed = true;
      }

      // 4. Retirement contributions (while the primary earner works)
      const retContrib = m < mRet ? input.retMonthly : 0;
      ret += retContrib;

      // 5. Surplus / deficit
      const income = employment + other + pension;
      const fcf = income - living - debt - eduFromCash;
      let surplus = fcf - eduContrib - retContrib;
      if (surplus >= 0) {
        gen += surplus * a.surplusInvestShare;
        cash += surplus * (1 - a.surplusInvestShare);
      } else {
        let need = -surplus;
        const take = (bal: number) => {
          const t = Math.min(bal, need);
          need -= t;
          return t;
        };
        let t = take(cash);
        cash -= t;
        row.drawdown += t;
        t = take(gen);
        gen -= t;
        row.drawdown += t;
        if (need > 0) {
          t = take(ret);
          if (t > 0) {
            ret -= t;
            row.drawdown += t;
            if (!retiredHousehold) {
              flag("retirement_raid");
              if (retirementRaidAy === null) retirementRaidAy = ay;
            }
          }
        }
        if (need > 0) {
          t = take(edu);
          if (t > 0) {
            edu -= t;
            row.drawdown += t;
            flag("education_raid");
            if (educationRaidAy === null) educationRaidAy = ay;
          }
        }
        if (need > 0) {
          unfunded += need;
          row.unfundedDeficit += need;
          flag("unfunded");
          if (retiredHousehold && depletionAge === null) depletionAge = agePrimary;
        }
        surplus = 0;
      }

      row.employmentIncome += employment;
      row.otherIncome += other;
      row.pensionIncome += pension;
      row.income += income;
      row.livingExpenses += living;
      row.debtService += debt;
      row.educationFromCashflow += eduFromCash;
      row.fcf += fcf;
      row.eduContribution += eduContrib;
      row.retContribution += retContrib;

    }

    // A year is in deficit when income does not cover expenses plus planned investing over the year
    // (a lumpy July payment met from savings within a surplus year is not a deficit).
    if (row.months > 0 && row.fcf - row.eduContribution - row.retContribution < 0) {
      flag("deficit");
      if (firstDeficitAy === null) firstDeficitAy = ay;
    }
    row.endCash = cash;
    row.endEduFund = edu;
    row.endRetFund = ret;
    row.endGenInv = gen;
    row.endInvestable = investable();
    row.property = sumBy(growing.filter((g) => g.type === "property"), (g) => g.value);
    row.vehicles = sumBy(growing.filter((g) => g.type === "vehicle"), (g) => g.value);
    row.otherAssets = sumBy(growing.filter((g) => g.type === "other"), (g) => g.value);
    row.loanBalance = sumBy(loans, (l) => l.balance);
    row.liabilities = row.loanBalance + unfunded;
    row.totalAssets = row.endInvestable + row.property + row.vehicles + row.otherAssets;
    row.netWorth = row.totalAssets - row.liabilities;
    rows.push(row);
  }
  if (!captured) {
    // Retirement falls beyond the projection horizon: use the last row as the best available proxy.
    const last = rows[rows.length - 1];
    projectedAvailable = last ? last.endRetFund + last.endGenInv : 0;
    projectedRetFund = last ? last.endRetFund : 0;
    warnings.push("Usia pensiun berada di luar horizon proyeksi; nilai dana pensiun memakai tahun terakhir proyeksi.");
  }

  const retirement = retirementAnalysis(h, a, B, planDate, projectedAvailable, projectedRetFund, input.retMonthly, depletionAge);
  const today = monthlyIncomeToday(h) * mult - monthlyLivingToday(h) - monthlyDebtServiceToday(h) - currentAyMonthly;

  return {
    rows,
    startNetWorth,
    savingsCapacityMonthly: today,
    retirement,
    firstDeficitAy,
    unfundedTotal: unfunded,
    retirementRaidAy,
    educationRaidAy,
    warnings,
  };
}

export function retirementAnalysis(
  h: Household,
  a: Assumptions,
  currentAy: number,
  planDate: string,
  projectedAvailable: number,
  projectedRetFund: number,
  plannedMonthly: number,
  depletionAge: number | null,
): RetirementResult {
  const p = h.primary;
  const yearsToRetirement = Math.max(0, p.targetRetirementAge - p.age);
  const retirementAy = currentAy + yearsToRetirement;
  const yearsInRetirement = Math.max(0, a.lifeExpectancy - p.targetRetirementAge);
  const g = a.inflation.general;
  const living = sumBy(h.expenses, (e) => e.monthlyAmount * 12 * Math.pow(1 + (e.growth ?? g), yearsToRetirement));
  const needGross = living * a.retirementExpenseRatio;
  const pensionAndOther =
    ((p.pensionMonthly ?? 0) + p.otherMonthlyIncome + (h.spouse?.otherMonthlyIncome ?? 0)) * 12 * Math.pow(1 + g, yearsToRetirement);
  const annualNeed = Math.max(0, needGross - pensionAndOther);
  const r = a.returns.postRetirement;
  const requiredCorpus = pvGrowingAnnuity(annualNeed, r, g, yearsInRetirement, true);
  const readiness = requiredCorpus > 0 ? projectedAvailable / requiredCorpus : 1;

  const months = Math.max(0, monthsUntilAyStart(retirementAy, planDate) - 1);
  const ret0 = sumBy(h.assets.filter((x) => x.type === "retirement_fund"), (x) => x.value);
  const gen0 = sumBy(h.assets.filter((x) => x.type === "investment"), (x) => x.value);
  const rm = monthlyRate(a.returns.retirement);
  const existingFv = futureValue(ret0, rm, months) + futureValue(gen0, monthlyRate(a.returns.general), months);
  const requiredMonthly = months > 0 ? paymentForTarget(requiredCorpus, existingFv, rm, months) : 0;

  const explain: Explain = {
    title: "Kebutuhan dana pensiun",
    inputs: [
      { label: "Pengeluaran hidup saat pensiun (tahun pertama)", value: formatRp(needGross), note: `${formatPct(a.retirementExpenseRatio, 0)} dari pengeluaran sebelum pensiun` },
      { label: "Pensiun & pendapatan lain", value: formatRp(pensionAndOther) },
      { label: "Kebutuhan bersih tahun pertama (E)", value: formatRp(annualNeed) },
      { label: "Lama pensiun (N)", value: `${yearsInRetirement} tahun` },
      { label: "Return setelah pensiun (r)", value: formatPct(r) },
      { label: "Inflasi (g)", value: formatPct(g) },
    ],
    formula: "Corpus = E × [1 − ((1+g)/(1+r))^N] / (r − g) × (1 + r)   (anuitas tumbuh, dibayar di awal tahun)",
    substitution: `${formatRp(annualNeed)} × [1 − (${formatNumber(1 + g, 3)}/${formatNumber(1 + r, 3)})^${yearsInRetirement}] / (${formatPct(r)} − ${formatPct(g)}) × ${formatNumber(1 + r, 3)}`,
    assumptions: [
      `Usia pensiun target ${p.targetRetirementAge}, harapan hidup ${a.lifeExpectancy} (asumsi).`,
      "Penghasilan kerja pasangan setelah pensiun tidak diperhitungkan (konservatif).",
      "Dana tersedia = dana pensiun + investasi umum + kas di atas dana darurat pada saat pensiun (proyeksi).",
    ],
    result: `${formatRp(requiredCorpus)} · tersedia ${formatRp(projectedAvailable)} (${formatPct(readiness, 0)})`,
  };

  return {
    retirementAy,
    yearsToRetirement,
    yearsInRetirement,
    annualNeedAtRetirement: annualNeed,
    requiredCorpus,
    projectedAvailable,
    projectedRetFund,
    readiness,
    requiredMonthly,
    plannedMonthly,
    depletionAge,
    explain,
  };
}
