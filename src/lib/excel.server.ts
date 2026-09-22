import * as XLSX from "xlsx";

/**
 * Reusable Excel service. Any part of the app (reports page today, Telegram
 * report bot later) can pass named sheets and get a base64 .xlsx payload.
 */
export interface ExcelSheet {
  name: string;
  rows: Record<string, unknown>[];
}

export function buildWorkbookBase64(sheets: ExcelSheet[]): string {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ "Ma’lumot": "Yo‘q" }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  const out = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  return out as string;
}
