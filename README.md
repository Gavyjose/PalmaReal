# 🌴 Palma Real - Sistema de Gestión Residencial Premium

Este es un sistema avanzado de gestión para condominios, diseñado con una estética industrial premium y un enfoque robusto en datos bimonetarios y automatización.

## 🚀 Guía de Inicio Rápido

### 1. Requisitos Previos
- **Node.js**: v18.0.0 o superior
- **Git**: Para clonación y control de versiones
- **Supabase Account**: Para la base de datos y autenticación
- **Telegram Bot Token**: (Opcional) Para notificaciones automáticas

---

### 2. Clonación e Instalación

Clona el repositorio en tu máquina local:

```bash
git clone https://github.com/Gavyjose/PalmaReal.git
cd PalmaReal/palma-real-app
```

Instala las dependencias necesarias:

```bash
npm install
```

---

### 3. Configuración de Variables de Entorno

Crea un archivo `.env` en la raíz de la carpeta `palma-real-app`:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase

# Integración Telegram (Opcional para alertas)
VITE_TELEGRAM_BOT_TOKEN=tu_token_de_bot
VITE_TELEGRAM_CHAT_ID=tu_id_de_chat

# Configuración BCV (Watchdog de tasa de cambio)
BCV_UPDATE_CRON="0 */6 * * *"
```

---

### 4. Configuración de la Base de Datos (Supabase)

Para poner en marcha el corazón del sistema, sigue este orden lógico en el editor SQL de Supabase:

1. **Esquema Base**: Ejecuta `src/migrations/apply_best_practices.sql` para crear las tablas de unidades, pagos y propietarios.
2. **Seguridad (RBAC)**: Ejecuta `src/migrations/create_rbac_tables.sql` para establecer roles y permisos.
3. **Perfiles**: Ejecuta `src/migrations/repair_user_profiles.sql` para asegurar la sincronización de usuarios.
4. **Políticas RLS**: Ejecuta `src/migrations/fix_payments_rls.sql` para proteger los datos financieros.
5. **Ajustes Finales**: Aplica las migraciones adicionales en `src/migrations/` según sea necesario (Comisiones, Históricos, etc.).

---

### 5. Integraciones y Automatización

- **Tasa BCV Automatizada**: El sistema incluye un servicio de monitoreo en `scripts/bcv/`. Puedes iniciarlo con:
  ```bash
  npm run bcv:watch
  ```
- **OCR (Reconocimiento de Recibos)**: Implementado vía `tesseract.js` para procesar comprobantes de transferencia automáticamente.
- **Exportación**: Soporte nativo para reportes en PDF y Excel vía `xlsx` y `papaparse`.

---

### 6. Ejecución en Desarrollo

Para iniciar el servidor de desarrollo con Vite:

```bash
npm run dev
```

El portal estará disponible en `http://localhost:5173`.

---

## 🛠️ Tecnologías Principales

- **Frontend**: React 19 + Vite + Tailwind CSS v4 (Industrial Theme)
- **Base de Datos**: Supabase (PostgreSQL)
- **Gráficas**: Recharts
- **Iconografía**: React Icons
- **Procesamiento**: Tesseract.js (OCR) + Telegram SDK

---

## 📄 Notas de Versión
**v1.0.0**: Nueva interfaz premium, portal bimonetario del propietario, y sistema de seguridad refinado.
