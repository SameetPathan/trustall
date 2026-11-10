"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type ICellRendererParams,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AgCharts } from "ag-charts-react";
import { AllCommunityModule as AllChartsModule, type AgChartOptions } from "ag-charts-community";
import type { LedgerSale } from "./OwnerDashboard";
import { money } from "@/lib/client-image";

ModuleRegistry.registerModules([AllCommunityModule]);

interface Row {
  id: string;
  when: Date | null;
  status: string;
  items: string;
  units: number;
  tip: number; // dollars, for sorting and filtering
  total: number;
  channel: string;
  customer: string;
  cart: string;
}

const STATUS_LABEL: Record<string, string> = { PAID: "Paid", INVOICED: "Invoiced", REFUNDED: "Refunded" };
const STATUS_TONE: Record<string, string> = {
  Paid: "bg-leaf text-white",
  Invoiced: "bg-yolk text-ink",
  Refunded: "bg-tomato text-white",
};

function toRow(s: LedgerSale): Row {
  const corrected = s.items.some((i) => i.editedByCustomer);
  return {
    id: s.id,
    when: new Date(s.createdAt),
    status: STATUS_LABEL[s.status] ?? s.status,
    items: s.items.map((i) => `${i.quantity} × ${i.name}`).join(", "),
    units: s.items.reduce((a, i) => a + i.quantity, 0),
    tip: s.tipCents / 100,
    total: s.totalCents / 100,
    channel: s.source === "AGENT" ? "Assistant invoice" : s.customerEmail ? "Invoice me" : "PayPal checkout",
    customer: s.customerEmail ?? "",
    cart: s.source === "AGENT" ? "Sent by owner" : !s.photoId ? "Picked by hand" : corrected ? "Photo, customer corrected" : "Photo, accepted as read",
  };
}

const theme = themeQuartz.withParams({
  accentColor: "#1f8f52",
  backgroundColor: "#fffdf7",
  foregroundColor: "#211a15",
  headerBackgroundColor: "#fff3dc",
  headerTextColor: "#75695b",
  headerFontWeight: 700,
  fontFamily: "inherit",
  fontSize: 15,
  borderColor: "#eedfc2",
  rowHoverColor: "#fff6e3",
  wrapperBorderRadius: 28,
  spacing: 9,
});

/** The ledger as an AG Grid: sort, filter, search, live totals for whatever is filtered, CSV export. */
export default function SalesGrid(props: { sales: LedgerSale[]; currency: string }) {
  const api = useRef<GridApi<Row> | null>(null);
  const [search, setSearch] = useState("");
  const [totals, setTotals] = useState<Row[]>([]);
  const fmt = useCallback((dollars: number) => money(Math.round(dollars * 100), props.currency), [props.currency]);

  const rows = useMemo(() => props.sales.map(toRow), [props.sales]);

  const columns = useMemo<ColDef<Row>[]>(
    () => [
      {
        field: "when",
        headerName: "Time",
        filter: "agDateColumnFilter",
        sort: "desc",
        minWidth: 170,
        valueFormatter: (p: ValueFormatterParams<Row, Date | null>) =>
          p.value ? p.value.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 130,
        cellRenderer: (p: ICellRendererParams<Row, string>) =>
          p.node.rowPinned ? <strong>{p.value}</strong> : p.value ? <span className={`pill ${STATUS_TONE[p.value] ?? ""}`}>{p.value}</span> : null,
      },
      { field: "items", headerName: "Items", flex: 2, minWidth: 260, tooltipField: "items" },
      { field: "units", headerName: "Units", filter: "agNumberColumnFilter", type: "rightAligned", maxWidth: 110 },
      {
        field: "tip",
        headerName: "Tip",
        filter: "agNumberColumnFilter",
        type: "rightAligned",
        maxWidth: 110,
        valueFormatter: (p: ValueFormatterParams<Row, number>) => (p.value ? fmt(p.value) : p.node?.rowPinned ? fmt(0) : ""),
      },
      {
        field: "total",
        headerName: "Total",
        filter: "agNumberColumnFilter",
        type: "rightAligned",
        minWidth: 120,
        cellClass: "font-bold tabular",
        valueFormatter: (p: ValueFormatterParams<Row, number>) => (p.value == null ? "" : fmt(p.value)),
      },
      { field: "channel", headerName: "Paid through", minWidth: 160 },
      { field: "cart", headerName: "How the cart was built", minWidth: 220 },
      { field: "customer", headerName: "Customer email", minWidth: 220 },
    ],
    [fmt],
  );

  // Totals row follows the filter: it adds up exactly the rows on show. Refunds are not counted as takings.
  const recompute = useCallback(() => {
    const grid = api.current;
    if (!grid) return;
    let count = 0;
    let units = 0;
    let tip = 0;
    let total = 0;
    grid.forEachNodeAfterFilter((node) => {
      const r = node.data;
      if (!r) return;
      count++;
      if (r.status === "Refunded") return;
      units += r.units;
      tip += r.tip;
      total += r.total;
    });
    setTotals([
      {
        id: "totals",
        when: null,
        status: "Totals",
        items: `${count} ${count === 1 ? "sale" : "sales"} shown, refunds left out of the sums`,
        units,
        tip,
        total,
        channel: "",
        customer: "",
        cart: "",
      },
    ]);
  }, []);

  const chart = useMemo<AgChartOptions>(() => {
    const byProduct = new Map<string, { product: string; revenue: number; units: number }>();
    for (const s of props.sales) {
      if (s.status !== "PAID") continue;
      for (const i of s.items) {
        const e = byProduct.get(i.productId) ?? { product: i.name, revenue: 0, units: 0 };
        e.revenue += (i.quantity * i.unitPriceCents) / 100;
        e.units += i.quantity;
        byProduct.set(i.productId, e);
      }
    }
    return {
      data: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue),
      background: { fill: "transparent" },
      series: [
        {
          type: "bar",
          direction: "horizontal",
          xKey: "product",
          yKey: "revenue",
          yName: "Paid revenue",
          fill: "#ec4d30",
          cornerRadius: 6,
        },
      ],
    };
  }, [props.sales]);
  const hasPaid = props.sales.some((s) => s.status === "PAID");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="grid-search" className="sr-only">
          Search sales
        </label>
        <input
          id="grid-search"
          className="field min-w-48 flex-1"
          placeholder="Search sales: honey, refunded, an email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn-plain"
          onClick={() => {
            api.current?.setFilterModel(null);
            setSearch("");
          }}
        >
          Clear filters
        </button>
        <button className="btn-plain" onClick={() => api.current?.exportDataAsCsv({ fileName: "trustall-sales.csv" })}>
          Download CSV
        </button>
      </div>

      <div className="card mt-3 overflow-hidden" style={{ height: 520 }}>
        <AgGridReact<Row>
          theme={theme}
          rowData={rows}
          columnDefs={columns}
          getRowId={(p) => p.data.id}
          defaultColDef={{ sortable: true, filter: true, resizable: true, floatingFilter: false, flex: 1, minWidth: 120 }}
          quickFilterText={search}
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={[20, 50, 100]}
          pinnedBottomRowData={totals}
          tooltipShowDelay={300}
          animateRows
          onGridReady={(e) => {
            api.current = e.api;
            recompute();
          }}
          onFilterChanged={recompute}
          onRowDataUpdated={recompute}
          overlayNoRowsTemplate="No sales match. Clear the filters to see everything."
        />
      </div>
      <p className="mt-2 text-sm text-moss">Click a column heading to sort. Use the menu in a heading to filter. The totals row adds up only what is shown.</p>

      {hasPaid && (
        <section className="card mt-6 p-5">
          <h2 className="text-xl">Paid revenue by product</h2>
          <div style={{ height: Math.max(180, 60 + (chart.data?.length ?? 0) * 42) }}>
            <AgCharts options={chart} modules={[AllChartsModule]} style={{ height: "100%" }} />
          </div>
        </section>
      )}
    </div>
  );
}
