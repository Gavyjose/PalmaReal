# AGENTS.md - Palma Real App

## Project Overview

React + Vite condo management system with Supabase backend. Includes admin/owner portals, payments, expenses, quotas, and reporting.

---

## Build / Lint / Test Commands

### Main Commands (in `palma-real-app/`)

```bash
npm install          # Install dependencies
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Lint all files
npm run lint -- src/Component.jsx  # Lint single file
```

---

## Code Style Guidelines

### General

- **Language**: JavaScript/JSX (React 19), ES modules
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite`
- **Routing**: React Router DOM v7
- **Backend**: Supabase (PostgreSQL) with RLS

### Imports

```javascript
// React core first
import React, { useState, useEffect, useRef } from 'react';

// External libraries
import { useNavigate } from 'react-router-dom';

// Internal
import Header from './components/Header';

// Lazy loading for routes
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
```

- Use named exports for components
- Order: React → External → Internal → CSS

### Naming

- Components: PascalCase (`Header.jsx`, `PaymentModal.jsx`)
- Files: camelCase utilities (`.js`), PascalCase components (`.jsx`)
- Functions: camelCase with verb prefixes (`handleAction`, `fetchData`)

### Component Patterns

```javascript
const Header = ({ title = "Default" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { return () => {}; }, []);

  const handleAction = () => { /* ... */ };

  return <header>{/* JSX with Tailwind */}</header>;
};

export default Header;
```

### State & Data

- React Context for auth (`AuthContext`)
- Local `useState` for component state
- SWR for server state/data fetching

### Error Handling

- Global handler in `main.jsx` for fatal errors
- Try/catch for async operations
- Console.log for debugging (follows existing pattern)

### Database

- Supabase client from `src/supabase.js`
- RLS policies enforced
- Migrations in `src/migrations/` and root `.sql` files

### Tailwind CSS

- v4 syntax, dark mode with `dark:` prefix
- Common colors: `emerald`, `slate`, `amber`, `blue`
- Use `material-icons` for icons

---

## Project Structure

```
palma-real-app/
├── src/
│   ├── components/     # Reusable UI components
│   ├── context/        # React Context (AuthContext)
│   ├── hooks/          # Custom hooks
│   ├── layouts/        # Layout components
│   ├── pages/          # Route components (lazy-loaded)
│   ├── utils/         # Utility functions
│   ├── migrations/    # Database migrations
│   ├── App.jsx        # Main app with routing
│   ├── main.jsx       # Entry point
│   └── supabase.js    # Supabase client
├── public/            # Static assets
├── scripts/           # Node.js scripts (BCV scraper)
├── package.json
├── vite.config.js
└── eslint.config.js
```

---

## Adding New Pages

1. Create component in `src/pages/`
2. Add lazy import in `App.jsx`
3. Add protected route in `App.jsx`
4. Add to sidebar navigation if needed

---

## Environment Variables

```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

---

## Notes

- Routes use Spanish: `/admin`, `/portal`, `/login`
- Roles: `MASTER`, `OPERADOR`, `VISOR`, `PROPIETARIO`
- Dark mode supported
