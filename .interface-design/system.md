# Interface Design System: The Financial Ledger

## Intent
- **Who**: Administrative staff, accountants, and condo board members managing finances. They are processing numbers rapidly and need high clarity without distractions.
- **What**: Reconciling payments, identifying debtors, managing funds across two currencies (USD/Bs). Efficiency and data density are paramount.
- **Feel**: Like modern Swiss accounting software. Cold, precise, and highly dense. White backgrounds, fine chalk-like borders, zero playful elements. Brutalist but elegant.

## Palette
- **Backgrounds (Surfaces)**: Pure white (`bg-white`) for main canvas to maximize contrast, off-white (`bg-slate-50`) for subtle separation of data areas.
- **Borders**: "Chalk" fine borders. `border-slate-200` for structure, `border-slate-300` for emphasis.
- **Text**: `text-slate-900` for primary data, `text-slate-500` for headers and metadata.
- **Semantic/Accents**:
  - Unpaid/Debt: `text-red-700 bg-red-50 ring-1 ring-inset ring-red-200 / border-red-200`
  - Paid/Success: `text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-200 / border-emerald-200`
  - Accent/Focus: monochrome `ring-slate-900`, `bg-slate-900 text-white` (avoiding generic blue/indigo).

## Typography
- **Primary**: Inter or Roboto (sans-serif, structural).
- **Data (Numbers)**: `font-mono` (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`). All financial figures MUST be monospaced to align vertically.
- **Scale**: Very dense. Base text `text-sm`, metadata `text-xs`, headers `text-[10px] font-bold uppercase tracking-widest text-slate-500`.

## Depth & Elevation
- **Strategy**: Borders-only. NO drop shadows (`shadow-none`) anywhere.
- **Surfaces**:
  - Base: `bg-white`
  - Inset (Tables/Grids): `bg-slate-50` with inset shadows if needed, or just plain.
  - Floating (Modals/Dropdowns): `bg-white` with a `border-2 border-slate-900` to simulate elevation through high contrast instead of soft blurring. Dropdowns can have sharp shadows like `shadow-[4px_4px_0_0_rgba(15,23,42,1)]` (brutalist shadow) or just intense borders. Let's stick to intense borders: `border border-slate-300 shadow-sm` is fine, but to keep 'Financial Ledger': `border border-slate-300 shadow-none`.

## Spacing
- Base unit: Strict 4px scale.
- Components are tight: `p-2` or `p-3` for cells. `gap-2` for list items. Large padding only used to frame the main content (`p-6` or `p-8`).

## Signature Elements
1. **Vertical Bimonetary Stack**: Instead of wide tables with duplicated columns, USD and Bs amounts are stacked vertically in a single cell using a small monospaced font.
```tsx
<div className="flex flex-col font-mono text-right">
  <span className="text-sm font-bold text-slate-900">$ 45.00</span>
  <span className="text-[10px] text-slate-500 font-medium">Bs 1642.50</span>
</div>
```
2. **Dense Borders Matrix**: Heavy use of `divide-y divide-slate-200` and explicit table rows/borders. Grids look like literal ledgers.
3. **Monochrome Badges**: Status badges use border styling rather than solid color fills. High contrast, sharp corners `rounded-sm` or `rounded`.
4. **Header Architecture**: Titles are huge, black (`font-black text-slate-900 text-3xl tracking-tight`), bordered underneath by a 1px `border-slate-200`.

## Architecture Notes
- Buttons: Flat, slightly rounded (`rounded-md`), high contrast (`bg-slate-900 text-white hover:bg-slate-800 focus:ring-2 focus:ring-slate-900 focus:ring-offset-2`).
- Inputs: `bg-white border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-sm`.
