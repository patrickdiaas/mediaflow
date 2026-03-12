"use client";
import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  rowKey: keyof T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any>>({ columns, data, rowKey }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      })
    : data;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-border/30">
            {columns.map(col => (
              <th
                key={String(col.key)}
                onClick={() => col.sortable !== false && handleSort(String(col.key))}
                className={`px-4 py-3 text-text-secondary font-medium whitespace-nowrap select-none ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                } ${col.sortable !== false ? "cursor-pointer hover:text-text-primary" : ""}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable !== false && sortKey === String(col.key) ? (
                    sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={String(row[rowKey])}
              className={`border-b border-border/50 hover:bg-border/20 transition-colors ${i % 2 === 0 ? "" : "bg-border/10"}`}
            >
              {columns.map(col => (
                <td
                  key={String(col.key)}
                  className={`px-4 py-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}
                >
                  {col.render ? col.render(row) : (
                    <span className="font-mono text-text-primary">{String(row[String(col.key)] ?? "—")}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
