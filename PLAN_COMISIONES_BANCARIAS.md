# Plan: Sincronización de Comisiones Bancarias

## Objetivo
Al subir el estado de cuenta en **Conciliación Bancaria**, extraer el acumulado de comisiones bancarias y guardarlo en el periodo correspondiente. Luego, en el **Listado Operativo de Gastos**, mostrar automáticamente un item "COMISIÓN BANCARIA" con:
- Valor en Bs (positivo)
- Equivalente en $ (calculado con tasa BCV del primer día del mes)

---

## Análisis del Sistema Actual

### Módulos Involucrados

| Archivo | Función | Estado Actual |
|---------|---------|---------------|
| `AccountStatement.jsx` | Conciliación Bancaria | Calcula `bankCommissions` desde CSV (en memoria) |
| `Expenses.jsx` | Generación de gastos | Crea item virtual "COMISIÓN BANCARIA (AUTO)" solo en memoria |
| `AliquotsConfig.jsx` | Listado Operativo | Lee gastos desde `period_expenses` (NO incluye comisión automática) |

### Datos Existentes
- Las comisiones se detectan por palabras clave: `COMISION`, `COMIS.`, `MANTENIMIENTO`, `USO DEL CANAL`, `SMS`, `ITF`, `GASTOS ADMINISTRATIVOS`, `CARGO POR MANTENIMIENTO`, `BANCAREA`, `BANCARIA`
- La tasa BCV del primer día del mes ya se obtiene correctamente en Expenses.jsx (líneas 96-104)

---

## Plan de Implementación

### Fase 1: Migración de Base de Datos

**Objetivo:** Guardar el acumulado de comisiones bancarias por periodo.

```sql
ALTER TABLE condo_periods 
ADD COLUMN IF NOT EXISTS bank_commissions_bs NUMERIC(15,2) DEFAULT 0;
```

---

### Fase 2: AccountStatement.jsx - Guardar Comisiones

**Ubicación:** Luego de procesar y mostrar el estado de cuenta (después de `mutateAccountData()`)

**Cambios:**
1. Identificar el `period_id` del mes/año seleccionado
2. Calcular `totalCommissions` (ya existe en código)
3. Guardar en `condo_periods`:

```javascript
const periodName = `${selectedYear}-${selectedMonth.padStart(2, '0')}`;
const { data: period } = await supabase
  .from('condo_periods')
  .select('id')
  .eq('period_name', periodName)
  .single();

if (period) {
  await supabase
    .from('condo_periods')
    .update({ bank_commissions_bs: totalCommissions })
    .eq('id', period.id);
}
```

---

### Fase 3: AliquotsConfig.jsx - Mostrar Comisión Bancaria

**Cambios en carga de datos:**
1. Al cargar `period_expenses`, también traer `bank_commissions_bs` desde `condo_periods`
2. Si `bank_commissions_bs > 0`, agregar/actualizar gasto:

```javascript
// Calcular tasa BCV primer día del mes
const firstDay = `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`;
const { data: bcvRate } = await supabase
  .from('exchange_rates')
  .select('rate_value')
  .lte('rate_date', firstDay)
  .order('rate_date', { ascending: false })
  .limit(1)
  .maybeSingle();

const rate = bcvRate?.rate_value || 1;

// Crear o actualizar gasto comisión bancaria
const commissionExpense = {
  description: 'COMISIÓN BANCARIA',
  amount: bankCommissionsBs / rate,        // Equivalente en $
  amount_bs: bankCommissionsBs,             // Valor en Bs (positivo)
  amount_usd_at_payment: bankCommissionsBs / rate,
  payment_status: 'PAGADO',
  bank_reference: 'ESTADO DE CUENTA',
  is_bank_commission: true                  // Flag para identificar
};
```

**Cambios en UI:**
- Mostrar el gasto de comisión bancaria con formato especial
- Evitar que se pueda eliminar este gasto manualmente

---

## Flujo de Usuario

```
1. Usuario sube CSV del estado de cuenta en Conciliación Bancaria
        ↓
2. Sistema detecta transacciones con palabras clave de comisión
        ↓
3. Sistema calcula total de comisiones en Bs
        ↓
4. Sistema guarda valor en condo_periods.bank_commissions_bs
        ↓
5. Usuario entra a Listado Operativo de Gastos (AliquotsConfig)
        ↓
6. Sistema carga bank_commissions_bs y crea gasto automático
        ↓
7. Usuario ve:
   - Concepto: COMISIÓN BANCARIA
   - Monto ($): (Bs / tasa BCV primer día)
   - Pagado (Bs): X.XXX Bs (positivo)
   - Estado: PAGADO
```

---

## Consideraciones

1. **Actualización automática:** Al subir un nuevo estado de cuenta, se actualiza el valor en el periodo
2. **Tasa BCV:** Se usa la tasa disponible más cercana al primer día del mes
3. **Visualización:** El valor en Bs se muestra como positivo (no como egresos negativos)
4. **Persistencia:** El valor queda guardado, no se pierde al recargar la página

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/supabase_migration.sql` | Nueva columna `bank_commissions_bs` |
| `src/pages/AccountStatement.jsx` | Guardar comisiones al subir CSV |
| `src/pages/AliquotsConfig.jsx` | Cargar y mostrar comisión bancaria |

---

## Orden de Implementación Recomendado

1. **Primero:** Ejecutar migración SQL
2. **Segundo:** Modificar AccountStatement.jsx
3. **Tercero:** Modificar AliquotsConfig.jsx
4. **Cuarto:** Probar flujo completo

---

¿Apruebas este plan para proceder con la implementación?
