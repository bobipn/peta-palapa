import { describe, expect, it } from "vitest";
import { csvTemplate, exportDbCsv, parseImport } from "./csv";
import { testDb } from "./engine/fixtures.test-helpers";
import { parseRupiah } from "./format";

describe("CSV import", () => {
  it("parses the template example row", () => {
    const rows = parseImport(csvTemplate(), testDb, "2026-09-27");
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    const s = rows[0].schedule!;
    expect(s.academicYear).toBe("2026/2027");
    expect(s.components.find((c) => c.code === "spp_monthly")?.frequency).toBe("monthly");
    expect(s.components.find((c) => c.code === "uang_pangkal")?.frequency).toBe("one_time");
    expect(s.provenance.verificationStatus).toBe("user_submitted");
  });

  it("rejects rows without provenance and verified rows without a URL", () => {
    const header = "school_id,school_name,city,province,level,academic_year,entry_fee,monthly_tuition,annual_fee,transport_fee,meal_fee,book_fee,activity_fee,source,source_date,verification_status,source_url";
    const text = [header, ",A,Kota Depok,Jawa Barat,SD,2026/2027,1,2,,,,,,,,,", ",B,Kota Depok,Jawa Barat,SD,2026/2027,1,2,,,,,,Brosur,,verified,"].join("\n");
    const rows = parseImport(text, testDb, "2026-09-27");
    expect(rows[0].errors.some((e) => e.includes("source"))).toBe(true);
    expect(rows[1].errors.some((e) => e.includes("source_url"))).toBe(true);
  });

  it("reports missing required columns", () => {
    const rows = parseImport("school_name,city\nX,Y", testDb, "2026-09-27");
    expect(rows[0].errors[0]).toMatch(/Kolom wajib/);
  });

  it("accepts Indonesian number formats and flags suspicious units", () => {
    expect(parseRupiah("Rp50.000.000")).toBe(50_000_000);
    expect(parseRupiah("7,5 jt")).toBe(7_500_000);
    expect(parseRupiah("1,2 M")).toBe(1_200_000_000);
    expect(parseRupiah("abc")).toBeNull();
    const header = "school_id,school_name,city,province,level,academic_year,entry_fee,monthly_tuition,annual_fee,transport_fee,meal_fee,book_fee,activity_fee,source,source_date,verification_status";
    const rows = parseImport(`${header}\n,C,Kota Bogor,Jawa Barat,SMA,2026-2027,"Rp10.000.000",60000000,,,,,,Situs sekolah,2026-07-01,Partially Verified`, testDb, "2026-09-27");
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].warnings.some((w) => w.includes("SPP bulanan"))).toBe(true);
    expect(rows[0].schedule!.provenance.verificationStatus).toBe("partially_verified");
  });

  it("round-trips the database export header", () => {
    const text = exportDbCsv(testDb);
    expect(text.split("\n")[0].startsWith("school_id,school_name,city")).toBe(true);
    expect(text.split("\n").length).toBe(testDb.fees.length + 1);
  });
});
