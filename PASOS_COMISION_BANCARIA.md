# Pasos para Activar Comisión Bancaria Automática

## 1. Ejecutar Migraciones en Supabase

Abre el **SQL Editor** en tu consola de Supabase y ejecuta:

```sql
-- Añadir campo de comisiones bancarias al periodo
ALTER TABLE condo_periods 
ADD COLUMN IF NOT EXISTS bank_commissions_bs NUMERIC(15,2) DEFAULT 0;

-- Añadir campo para identificar gasto de comisión bancaria
ALTER TABLE period_expenses 
ADD COLUMN IF NOT EXISTS is_bank_commission BOOLEAN DEFAULT FALSE;
```

---

## 2. Verificar que el Código está Actualizado

Asegúrate de tener los últimos cambios en:
- `src/pages/AccountStatement.jsx` - guarda comisiones al subir CSV
- `src/pages/AliquotsConfig.jsx` - muestra comisión en Listado Operativo

Si no tienes los cambios, sincroniza tu repositorio o pega el código actualizado.

---

## 3. Flujo de Uso

### Paso A: Subir Estado de Cuenta
1. Ve a **Conciliación Bancaria** (Estado de Cuenta)
2. Selecciona el **mes y año**
3. Carga el archivo **Excel/CSV** del estado de cuenta
4. Verifica en la **consola del navegador** (F12 → Console) que aparezca:
   ```
   ✅ Comisiones bancarias guardadas: Bs. X.XXX,XX
   ```

### Paso B: Ver en Listado Operativo
1. Ve a **Configuración de Alícuotas** → **Listado Operativo de Gastos**
2. Selecciona el **mismo mes y año**
3. Busca el item **"COMISIÓN BANCARIA"** que debe mostrar:
   - **Monto ($)**: equivalente en dólares
   - **Pagado (Bs)**: valor en bolívares (positivo)
   - **Estado**: PAGADO

---

## 4. Solución de Problemas

### No aparece el mensaje de confirmación
- Abre la consola del navegador (F12)
- Revisa si hay errores en rojo

### No aparece el item COMISIÓN BANCARIA
1. Verifica que `bank_commissions_bs` tenga valor en la tabla `condo_periods`
2. Ejecuta esta consulta en Supabase:
   ```sql
   SELECT period_name, bank_commissions_bs 
   FROM condo_periods 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

### Las comisiones están en 0
- Verifica que el archivo CSV/Excel contenga transacciones con palabras clave:
  - COMISION, COMIS., MANTENIMIENTO, USO DEL CANAL, SMS, ITF, GASTOS ADMINISTRATIVOS, CARGO POR MANTENIMIENTO, BANCAREA, BANCARIA

---

## 5. Cómo Funciona

```
Sube CSV → Detecta transacciones de comisión → Calcula total Bs
                      ↓
         Guarda en condo_periods.bank_commissions_bs
                      ↓
AliquotsConfig carga → Lee bank_commissions_bs
                      ↓
         Calcula equivalente $ (tasa BCV primer día)
                      ↓
         Muestra "COMISIÓN BANCARIA" en la lista
```
