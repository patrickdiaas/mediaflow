"use client";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
  key: keyof T;
  label: string;
  align?: "left" | "right" | "center";
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface Props<T extends object> {
  columns: Column<T>[];
  data: T[];
  rowKey: keyof T;
}

export default function DataTable<T extends object>({ columns, data, rowKey }: Props<T>) {
  const [sortKey, setSortKey]   = useState<keyof T | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : data;

  const handleSort = (key: keyof T) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg/50">
            {columns.map(col => (
              <th
                key={String(col.key)}
                onClick={() => handleSort(col.key)}
                className={`px-4 py-3 text-xs font-medium text-text-secondary cursor-pointer select-none whitespace-nowrap ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                } hover:text-text-primary transition-colors`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key
                    ? sortDir === "asc"
                      ? <ChevronUp size={12} />
                      : <ChevronDown size={12} />
                    : <ChevronsUpDown size={12} className="opacity-30" />
                  }
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={String(row[rowKey])}
              className={`border-b border-border/50 transition-colors hover:bg-border/20 ${i % 2 === 0 ? "" : "bg-bg/20"}`}
            >
              {columns.map(col => (
                <td
                  key={String(col.key)}
                  className={`px-4 py-3 text-text-primary whitespace-nowrap ${
                    col.align === "right" ? "text-right font-mono" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-text-muted text-sm">
                Nenhum dado encontrado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
