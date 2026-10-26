const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 엑셀에서 한글이 깨지지 않도록 BOM을 붙인 CSV 문자열 */
export function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/** 브라우저에서 CSV 파일 내려받기 */
export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const blob = new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
