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
- **Primary**: Sans-serif (Inter, Roboto, system-ui).
- **Data (Numbers)**: `font-mono` for all financial figures to align vertically.
- **Scale**: Dense. Base text `text-sm`, metadata `text-xs`, headers `text-xs font-bold uppercase`.

## Depth & Elevation
- **Strategy**: Borders-only. NO drop shadows (`shadow-none`) anywhere.
- **Surfaces**:
  - Base: `bg-white`
  - Inset (Tables/Grids): `bg-slate-50`
  - Floating (Modals/Dropdowns): `bg-white` with border `border-slate-300`.

## Spacing
- Base unit: 4px (Tailwind default).
- Components: `p-3` or `p-4` for cells. `gap-2` or `gap-4` for list items. Large padding only used to frame main content (`p-4` or `p-6`).

## Migration Complete - Components Updated

### Pages Fixed
- [x] AdminDashboard.jsx
- [x] Cobranzas.jsx
- [x] OwnerPortal.jsx
- [x] SpecialQuotas.jsx

### Components Fixed
- [x] OwnerOverviewCard.jsx
- [x] DebtEvolutionChart.jsx
- [x] PaymentHistoryTable.jsx
- [x] OwnerAnnouncements.jsx
- [x] SpecialProjectsFeed.jsx

## Design Tokens

### Border Radius
| Token | Use |
|-------|-----|
| `rounded-sm` | Badges, small elements |
| `rounded` | Buttons, inputs |
| `rounded-md` | Cards, panels |
| `rounded-lg` | Modals |

### Components Pattern
```jsx
// Card
<div className="bg-white border border-slate-200 rounded-md p-4">
  {/* content */}
</div>

// Table Header
<tr className="bg-slate-50 border-b border-slate-200">
  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Header</th>
</tr>

// Button Primary
<button className="px-4 py-2 bg-slate-900 text-white rounded font-bold text-sm hover:bg-slate-800">
  Action
</button>

// Input
<input className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-slate-900" />

// Metric Card
<div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
  <span className="text-xs font-bold text-emerald-600 uppercase">Label</span>
  <span className="text-xl font-mono font-bold text-emerald-700">$1,234</span>
</div>

// Status Badge
<span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold uppercase border border-emerald-200">
  Status
</span>
```

## Anti-Patterns (DO NOT USE)
- `rounded-[2rem]`, `rounded-[2.5rem]`, `rounded-[3rem]`
- `shadow-xl`, `shadow-2xl`, `shadow-3xl`
- `backdrop-blur-*`
- `bg-gradient-to-*`
- `animate-*`
- `font-display-*`
