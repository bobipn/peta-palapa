import type { Assumptions, Child, Level } from "./types";
import { isUniversityLevel } from "./inflation";

/** Indonesian academic year starts in July. Returns the AY start year containing `dateIso`. */
export function academicYearOf(dateIso: string): number {
  const [y, m] = dateIso.split("-").map(Number);
  return m >= 7 ? y : y - 1;
}

/** Absolute month index (year × 12 + month0). */
export function monthIndexOf(dateIso: string): number {
  const [y, m] = dateIso.split("-").map(Number);
  return y * 12 + (m - 1);
}

/**
 * Months from the plan date to the start (1 July) of academic year `ay`.
 * Payments for an academic year are assumed at its start.
 */
export function monthsUntilAyStart(ay: number, planDate: string): number {
  return ay * 12 + 6 - monthIndexOf(planDate);
}

/** Age in whole years on 1 July of `year`. */
export function ageOnJuly1(birthDate: string, year: number): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  let age = year - by;
  if (bm > 7 || (bm === 7 && bd > 1)) age -= 1;
  return age;
}

export function ageToday(birthDate: string, planDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [py, pm, pd] = planDate.split("-").map(Number);
  let age = py - by;
  if (pm < bm || (pm === bm && pd < bd)) age -= 1;
  return age;
}

export function levelSequence(child: Child): Level[] {
  const seq: Level[] = [];
  if (child.includeTK || child.currentLevel === "TK") seq.push("TK");
  const secondary = child.currentLevel === "SMA" || child.currentLevel === "SMK" ? child.currentLevel : child.secondaryTrack;
  seq.push("SD", "SMP", secondary);
  if (child.targetEducation === "D3") seq.push("D3");
  if (child.targetEducation === "S1" || child.targetEducation === "S2") seq.push("S1");
  if (child.targetEducation === "S2" || child.includeS2) {
    if (!seq.includes("S1")) seq.push("S1");
    seq.push("S2");
  }
  if (child.currentLevel !== "none" && !seq.includes(child.currentLevel)) {
    // e.g. currently in D3 while the target says S1: keep the current level in the path.
    const order: Level[] = ["TK", "SD", "SMP", "SMA", "SMK", "D3", "S1", "S2"];
    seq.push(child.currentLevel);
    seq.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  return seq;
}

export function gradeLabel(level: Level, gradeIndex: number): string {
  switch (level) {
    case "TK":
      return gradeIndex === 1 ? "TK A" : gradeIndex === 2 ? "TK B" : `TK tahun ${gradeIndex}`;
    case "SD":
      return `Kelas ${gradeIndex}`;
    case "SMP":
      return `Kelas ${gradeIndex + 6}`;
    case "SMA":
    case "SMK":
      return `Kelas ${gradeIndex + 9}`;
    default:
      return `Tahun ${gradeIndex}`;
  }
}

/** Convert a national grade number (e.g. SMP kelas 8) to the 1-based index within the level. */
export function gradeIndexFromNational(level: Level, national: number): number {
  switch (level) {
    case "SMP":
      return national - 6;
    case "SMA":
    case "SMK":
      return national - 9;
    default:
      return national;
  }
}

export interface TimelineRow {
  childId: string;
  ay: number;
  level: Level;
  gradeIndex: number;
  gradeLabel: string;
  /** First year of the level (entry fees apply). */
  isLevelEntry: boolean;
  age: number;
  isCurrent: boolean;
}

export interface Timeline {
  childId: string;
  rows: TimelineRow[];
  sdEntryYear: number | null;
  universityEntryYear: number | null;
  graduationYear: number | null;
  warnings: string[];
}

/** Natural SD entry: first academic year in which the child is at least `sdEntryAge` on 1 July. */
export function naturalSdEntryYear(birthDate: string, sdEntryAge: number): number {
  const by = Number(birthDate.slice(0, 4));
  for (let y = by; y < by + 30; y++) {
    if (ageOnJuly1(birthDate, y) >= sdEntryAge) return y;
  }
  return by + sdEntryAge;
}

export function buildTimeline(child: Child, a: Assumptions, currentAy: number): Timeline {
  const warnings: string[] = [];
  const seq = levelSequence(child);
  const dur = (l: Level) => Math.max(1, Math.round(a.levelDurations[l] ?? 1));

  let levelIdx: number;
  let grade: number;
  let ay: number;

  if (child.currentLevel !== "none") {
    levelIdx = seq.indexOf(child.currentLevel);
    const d = dur(child.currentLevel);
    const g = child.currentGrade ?? 1;
    if (g < 1 || g > d) warnings.push(`Kelas saat ini (${g}) di luar rentang ${child.currentLevel} 1–${d}; dibatasi.`);
    grade = Math.min(Math.max(1, g), d);
    ay = currentAy;
  } else {
    let sdEntry = child.targetSdEntryYear ?? naturalSdEntryYear(child.birthDate, a.sdEntryAge);
    if (sdEntry < currentAy) {
      warnings.push(
        `Berdasarkan usia, ${child.name} seharusnya sudah masuk SD pada TA ${sdEntry}/${sdEntry + 1}. Isi jenjang & kelas saat ini agar proyeksi akurat; sementara diasumsikan masuk SD TA ${currentAy}/${currentAy + 1}.`,
      );
      sdEntry = currentAy;
    }
    const sdIdx = seq.indexOf("SD");
    if (seq[0] === "TK") {
      const tkStart = sdEntry - dur("TK");
      if (tkStart >= currentAy) {
        levelIdx = 0;
        grade = 1;
        ay = tkStart;
      } else if (sdEntry > currentAy) {
        levelIdx = 0;
        grade = currentAy - tkStart + 1;
        ay = currentAy;
      } else {
        levelIdx = sdIdx;
        grade = 1;
        ay = sdEntry;
      }
    } else {
      levelIdx = sdIdx;
      grade = 1;
      ay = sdEntry;
    }
  }

  const rows: TimelineRow[] = [];
  let sdEntryYear: number | null = null;
  let universityEntryYear: number | null = null;

  while (levelIdx < seq.length) {
    const level = seq[levelIdx];
    const d = dur(level);
    const entering = grade === 1;
    if (entering && isUniversityLevel(level) && level !== "S2" && child.targetUniversityEntryYear) {
      if (child.targetUniversityEntryYear > ay) {
        ay = child.targetUniversityEntryYear;
      } else if (child.targetUniversityEntryYear < ay) {
        warnings.push(
          `Target masuk universitas TA ${child.targetUniversityEntryYear} lebih awal dari jalur normal (TA ${ay}); jalur normal dipakai.`,
        );
      }
    }
    for (let g = grade; g <= d; g++) {
      if (level === "SD" && g === 1) sdEntryYear = ay;
      if (isUniversityLevel(level) && level !== "S2" && g === 1) universityEntryYear = ay;
      rows.push({
        childId: child.id,
        ay,
        level,
        gradeIndex: g,
        gradeLabel: gradeLabel(level, g),
        isLevelEntry: g === 1,
        age: ageOnJuly1(child.birthDate, ay),
        isCurrent: ay === currentAy,
      });
      ay += 1;
    }
    levelIdx += 1;
    grade = 1;
  }

  return {
    childId: child.id,
    rows,
    sdEntryYear,
    universityEntryYear,
    graduationYear: rows.length ? rows[rows.length - 1].ay + 1 : null,
    warnings,
  };
}

/** The next level the child will enter after the current academic year — the school decision still open. */
export function nextEntryLevel(child: Child, a: Assumptions, currentAy: number): Level | undefined {
  return buildTimeline(child, a, currentAy).rows.find((r) => r.isLevelEntry && r.ay > currentAy)?.level;
}
