'use client';

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';

export function DataTable<T>({ data, columns, onRowClick }: { data: T[]; columns: ColumnDef<T, unknown>[]; onRowClick?: (row: T) => void }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400 text-sm">
                No results
              </td>
            </tr>
          )}
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={onRowClick ? 'border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors' : 'border-b border-slate-100 last:border-0'}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-slate-700">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
