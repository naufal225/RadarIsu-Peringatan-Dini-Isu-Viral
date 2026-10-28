import type { ReactNode } from "react";

export type ProblemRow = { key: string; row: ReactNode; problem: ReactNode };

/** Tabel kecil baris bermasalah dari hasil unggah/impor (nomor baris + masalah), dengan catatan opsional di bawah. */
export function ProblemTable({ caption, rowHeader, problemHeader, rows, note }: { caption: string; rowHeader: string; problemHeader: string; rows: ProblemRow[]; note?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-control border border-line">
      <table className="w-full text-left text-table">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-paper text-ink-muted">
          <tr>
            <th scope="col" className="h-9 w-20 px-3 font-medium">
              {rowHeader}
            </th>
            <th scope="col" className="px-3 font-medium">
              {problemHeader}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.key} className="h-9">
              <td className="px-3 font-mono tabular-nums">{r.row}</td>
              <td className="px-3">{r.problem}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="border-t border-line px-3 py-2 text-caption text-ink-muted">{note}</p>}
    </div>
  );
}
