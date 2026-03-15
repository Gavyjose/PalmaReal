# UI Migration: Financial Ledger

## Objetivo
Migrar la interfaz actual al sistema de diseño "Financial Ledger" - frío, preciso, denso, sin sombras ni efectos decorativos.

## Reglas de Migración

### ❌ ELIMINAR
| Pattern | Reemplazar con |
|---------|---------------|
| `rounded-[2rem]` | `rounded-md` |
| `rounded-[2.5rem]` | `rounded` |
| `rounded-[3rem]` | `rounded-lg` |
| `shadow-xl`, `shadow-2xl`, `shadow-3xl` | `shadow-none` |
| `backdrop-blur-*` | Eliminar |
| `bg-gradient-to-*` | Color sólido |
| `animate-in`, `animate-pulse`, `animate-spin` | Eliminar |
| `transition-all duration-*` | `transition-colors` |

### ✅ USAR
| Pattern | Uso |
|---------|-----|
| `rounded-sm` | Inputs, botones pequeños |
| `rounded` | Badges, elementos pequeños |
| `rounded-md` | Cards, paneles |
| `rounded-lg` | Modals |
| `border-slate-200` | Separación estándar |
| `border-slate-300` | Énfasis |
| `bg-white` | Superficie base |
| `bg-slate-50` | Superficie alternativa |
| `font-mono` | Números financieros |

## Pages a Corregir (por prioridad)

1. **AdminDashboard.jsx** - Métricas principales
2. **Cobranzas.jsx** - Tabla de cobranzas
3. **OwnerPortal.jsx** - Portal del propietario
4. **SpecialQuotas.jsx** - Cuotas especiales

## Componentes a Corregir

1. Sidebar.jsx
2. Header.jsx
3. PaymentModal.jsx
4. OwnerPaymentModal.jsx
5. OwnerOverviewCard.jsx

## Verificación

Después de aplicar, verificar:
- [ ] Sin `rounded-[` en el código
- [ ] Sin `shadow-` que no sea `shadow-none`
- [ ] Sin `backdrop-blur`
- [ ] Sin `animate-`
- [ ] Sin gradientes decorativos
