---
name: bcv-scraper
description: Integra la tasa oficial del BCV (Banco Central de Venezuela) en proyectos Node.js + Supabase. Incluye scraping diario automático desde Telegram via OCR, carga histórica de hasta 60 días, y función SQL para manejo de días no hábiles (fines de semana y feriados).
---

# BCV Scraper Skill

## Descripción

Este skill implementa la obtención automática de la tasa de cambio oficial del BCV (Bs/USD) para proyectos venezolanos. Usa el canal público de Telegram `@DolarOficialBCV` como fuente, extrae el valor via OCR (Tesseract.js), y lo guarda en Supabase.

## Stack Requerido

- **Runtime:** Node.js 18+
- **Base de datos:** Supabase (PostgreSQL)
- **Fuente de datos:** Canal de Telegram `@DolarOficialBCV`
- **OCR:** Tesseract.js (español)

---

## PASO 1 — Prerrequisitos

### 1.1 Credenciales de Telegram API
1. Ve a [https://my.telegram.org](https://my.telegram.org)
2. Inicia sesión con tu número de teléfono
3. Ve a **"API Development Tools"**
4. Crea una nueva aplicación (nombre y descripción son libres)
5. Copia `api_id` y `api_hash`

### 1.2 Variables de entorno necesarias
Agrega estas variables al archivo `.env` del proyecto:

```env
# Supabase
VITE_SUPABASE_URL=https://[tu-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...   # Settings → API → service_role (secret)

# Telegram
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abc123def456...
TELEGRAM_PHONE=+584121234567
TELEGRAM_SESSION=                     # Se genera automáticamente al primer login
```

> ⚠️ Usa siempre la `service_role` key (NO la `anon` key) para el scraper, ya que es un proceso de servidor y necesita saltarse el RLS de Supabase.

---

## PASO 2 — Instalar Dependencias

```bash
npm install telegram tesseract.js node-cron @supabase/supabase-js dotenv
```

Si el proyecto es de tipo `"type": "module"` en `package.json` (ESM), los scripts ya funcionan con `import`. Si es CommonJS, cambia los `import` por `require`.

---

## PASO 3 — Crear la Tabla en Supabase

Ejecuta el script `scripts/create_exchange_rates.sql` en **Supabase → SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_date DATE NOT NULL,
    rate_value DECIMAL(12,4) NOT NULL,
    provider TEXT DEFAULT 'BCV',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rate_date, provider)
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_rates_all"
ON exchange_rates FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(rate_date DESC);
```

---

## PASO 4 — Crear Función SQL para Días No Hábiles

Ejecuta en **Supabase → SQL Editor**. Esta función devuelve la tasa del día solicitado o, si no existe (fines de semana, feriados), la del último día hábil anterior:

```sql
CREATE OR REPLACE FUNCTION get_bcv_rate(p_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
    SELECT rate_value
    FROM exchange_rates
    WHERE rate_date <= p_date
      AND provider = 'BCV'
    ORDER BY rate_date DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;
```

**Uso desde la app:**
```js
// Tasa de hoy (o del último día hábil)
const { data } = await supabase.rpc('get_bcv_rate');

// Tasa para una fecha específica
const { data } = await supabase.rpc('get_bcv_rate', { p_date: '2026-02-22' });
```

---

## PASO 5 — Scripts del Scraper

Copia los tres archivos de `scripts/` a la raíz de tu proyecto:

| Archivo | Propósito |
|---|---|
| `scripts/bcv_first_login.js` | **Ejecutar UNA sola vez** para autenticar Telegram y generar `TELEGRAM_SESSION` |
| `scripts/bcv_historical.js` | Carga masiva de los últimos ~60 días (ejecutar una vez al inicio) |
| `scripts/bcv_scheduler.js` | Scheduler diario automático (mantener corriendo en producción) |

---

## PASO 6 — Primer Login (Una sola vez)

La primera vez necesitas autenticar tu cuenta de Telegram para generar la `TELEGRAM_SESSION`:

```bash
node scripts/bcv_first_login.js
```

El script te pedirá:
1. Tu número de teléfono (con código de país: `+58412...`)
2. El código que Telegram te envía por SMS o la app
3. Tu contraseña 2FA (si tienes activada)

Al finalizar imprimirá la `TELEGRAM_SESSION`. Cópiala y pégala en el `.env`:
```env
TELEGRAM_SESSION=1AQAOMTQ5...
```

---

## PASO 7 — Carga Histórica (Una sola vez)

Con el `.env` completo, carga los últimos ~60 días:

```bash
node scripts/bcv_historical.js
```

Tardará ~3-5 minutos (OCR de 80 imágenes). Verás:
```
✅ [2026-02-20] Bs. 402.3343
✅ [2026-02-19] Bs. 398.7456
...
📊 Resumen: ✅ Guardadas: 44 | ⏭️ Saltadas: 12 | ❌ Errores: 0
```

---

## PASO 8 — Scheduler Diario (Producción)

Agrega el comando al `package.json`:
```json
"scripts": {
    "bcv-scheduler": "node scripts/bcv_scheduler.js",
    "bcv-history":   "node scripts/bcv_historical.js"
}
```

Corre el scheduler en una terminal separada (o como proceso de fondo):
```bash
npm run bcv-scheduler
```

**Horario:** Corre automáticamente cada hora en punto, de lunes a viernes, entre 8am y 5pm (hora Venezuela / `America/Caracas`).

Para producción en un servidor Linux, usa **PM2**:
```bash
npm install -g pm2
pm2 start scripts/bcv_scheduler.js --name bcv-scheduler
pm2 save
pm2 startup
```

---

## Notas Importantes

- El canal `@DolarOficialBCV` es público. No necesitas unirte para leerlo.
- El BCV **no publica los fines de semana ni feriados**. La función `get_bcv_rate()` maneja esto automáticamente.
- Si el BCV cambia el formato de sus imágenes, puede ser necesario ajustar el regex en `parseTextBCV()`.
- La `TELEGRAM_SESSION` es permanente hasta que cierres sesión desde Telegram. No necesitas regenerarla.
