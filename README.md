# 🌴 Palma Real - Sistema de Gestión Residencial Premium

Este es un sistema avanzado de gestión para condominios, diseñado con una estética industrial "Ledger Style" y un enfoque robusto en datos bimonetarios (USD/Bs), automatización de tasas y reconciliación bancaria.

---

## 🚀 Guía de Instalación Paso a Paso

Sigue este orden lógico para asegurar que el sistema funcione correctamente desde el primer momento.

### 1. Clonación del Repositorio
Clona el proyecto en tu máquina local utilizando Git:

```bash
git clone https://github.com/Gavyjose/PalmaReal.git
cd PalmaReal
```

### 2. Instalación de Dependencias
El proyecto utiliza **Vite** y **React 19**. Navega a la carpeta de la aplicación e instala los paquetes necesarios:

```bash
cd palma-real-app
npm install
```

### 3. Configuración de Supabase (Backend)
Para que el sistema tenga datos, debes configurar tu proyecto en [Supabase](https://supabase.com/):

1. **Crea un Proyecto**: Regístrate y crea un nuevo proyecto de base de datos.
2. **Tablas e Infraestructura**: Dirígete al editor SQL de Supabase y ejecuta los archivos de migración en este orden:
   - `src/migrations/apply_best_practices.sql` (Estructura base)
   - `src/migrations/create_rbac_tables.sql` (Roles y permisos)
   - `src/migrations/repair_user_profiles.sql` (Sincronización de perfiles)
   - `src/migrations/fix_payments_rls.sql` (Políticas de seguridad)
3. **Bucket de Almacenamiento**: Crea un bucket llamado `receipts` con acceso público para guardar los comprobantes de pago.

### 4. Variables de Entorno
Configura la conexión creando un archivo `.env` en `palma-real-app/`:

```env
# Supabase
VITE_SUPABASE_URL=tu_url_de_supabase_aqui
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui

# Integración Telegram (Opcional para alertas de pagos/gastos)
VITE_TELEGRAM_BOT_TOKEN=token_del_bot_generado_por_BotFather
VITE_TELEGRAM_CHAT_ID=id_del_grupo_o_chat_de_notificaciones

# Configuración de Tasa BCV
VITE_BCV_API_URL= (Opcional si usas una API externa para la tasa)
```

---

## ⚙️ Integraciones y Automatización

### 📈 Tasa BCV Automatizada
El sistema cuenta con un servicio inteligente para obtener la tasa oficial:
- **Scraping de Telegram**: Extrae la tasa de canales oficiales cuando la web del BCV está caída.
- **Fallbacks**: Si no hay datos, aplica una lógica de seguridad sobre el último valor conocido.

### 🔍 OCR (Reconocimiento de Recibos)
Implementado con `tesseract.js`. Al cargar un comprobante, el sistema:
1. Extrae el número de referencia.
2. Valida contra la base de datos para evitar duplicados.
3. Precarga los montos detectados.

---

## 🛠️ Tecnologías Utilizadas

- **Core**: React 19 + Vite
- **Estándar de Diseño**: Tailwind CSS v4 (Custom Ledger Palette)
- **Base de Datos & Auth**: Supabase (PostgreSQL)
- **Iconos**: Material Icons & Lucide React
- **Gráficas**: Recharts para visualización de métricas financieras

---

## 🧑‍💻 Comandos Disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Genera la versión de producción optimizada.
- `npm run preview`: Previsualiza la build de producción localmente.

---

## 📄 Notas de Versión
**v1.1.0 - Ledger Edition**:
- Refactorización total de la interfaz a estilo "Admin Ledger".
- Modulo de Cuotas Especiales con seguimiento de proyectos activos/cerrados.
- Optimización de carga de comprobantes vía OCR.
- Sistema de seguridad RBAC (Role Based Access Control) refinado.

---

Desarrollado con ❤️ por **Gavy Jose**.
