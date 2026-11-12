/**
 * Date formatting utilities for ArthraFinance
 * 
 * Strict format: D/M/YYYY (day/month/year), numeric values only.
 * Examples: 4/11/2026, 15/2/2026, 9/1/2026
 * 
 * - No month names (e.g. not "4 November 2026")
 * - No leading zeros (e.g. "4/11/2026", never "04/11/2026")
 * - Day first, month second, year last (never US M/D/YYYY)
 * - Safe against timezone shifts by parsing YYYY-MM-DD components directly
 */

export function formatDateDMY(input: string | Date | null | undefined): string {
  if (!input) return "—";

  // 1. If Date object
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return "—";
    const day = input.getDate();
    const month = input.getMonth() + 1;
    const year = input.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // 2. If string
  const str = String(input).trim();
  if (!str) return "—";

  // Check for ISO / SQL date: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return `${day}/${month}/${year}`;
  }

  // Check if already in D/M/YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    return `${day}/${month}/${year}`;
  }

  // Check if in string format with month names (e.g. "November 3, 2026" or "3 November 2026")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = parsed.getDate();
    const month = parsed.getMonth() + 1;
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Fallback
  return str;
}

/**
 * Parses user input in D/M/YYYY or DD/MM/YYYY format into ISO YYYY-MM-DD format for database storage.
 * Accepts delimiters '/', '-', or '.'.
 * Returns null if the string cannot be parsed into a valid date.
 */
export function parseDMYToISO(input: string | null | undefined): string | null {
  if (!input) return null;
  const str = input.trim();
  if (!str) return null;

  // If already in YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // D/M/YYYY or DD/MM/YYYY (day first, month second, year last)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

