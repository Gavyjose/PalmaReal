# 🏢 Palma Real App - Gestión de Condominio

Sistema administrativo moderno diseñado para la gestión bimonetaria y el seguimiento financiero de la comunidad de Palma Real. Construido con tecnología de vanguardia para ofrecer una experiencia fluida, rápida y segura.

## 🚀 Características Principales

- **Gestión Bimonetaria Inteligente**: Soporte para pagos en Bolívares (transferencia con tasa BCV) y Dólares (efectivo/Zelle).
- **Control de Cuotas Especiales**: Módulo para presupuestar proyectos extraordinarios (ej. impermeabilización) y seguimiento de pagos por unidad.
- **Matriz de Pagos Dinámica**: Visualización en tiempo real del estado de cada unidad y cuota.
- **Ordenamiento Natural**: Listados organizados según la lógica residencial real (Planta Baja a Piso 3).
- **Conciliación Bancaria**: Herramienta para procesar reportes bancarios y automatizar el registro de pagos.
- **Historial de Transacciones**: Registro detallado con capacidad de corrección y visualización de abonos parciales.
- **Modo Oscuro Integrado**: Interfaz premium adaptada a cualquier preferencia visual.

## 🛠️ Stack Tecnológico

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Backend/DB**: [Supabase](https://supabase.com/) (PostgreSQL + Auth)
- **Estilos**: Vanilla CSS + Tailwind CSS (Micro-utilities)
- **Iconos**: Google Material Icons

## 📋 Requisitos Previos

- [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada)
- [npm](https://www.npmjs.com/) o [yarn](https://yarnpkg.com/)

## ⚙️ Instalación y Configuración

Sigue estos pasos para poner en marcha el proyecto localmente:

### 1. Clonar el repositorio
```bash
git clone https://github.com/Gavyjose/PalmaReal.git
cd PalmaReal/palma-real-app
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto (basándote en el archivo de ejemplo si existe) y añade tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
```

### 4. Iniciar el servidor de desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

## 📦 Despliegue

Para generar una versión optimizada para producción:
```bash
npm run build
```

## 📄 Licencia

Este proyecto es de uso privado para la administración de Palma Real.

---
Desarrollado con ❤️ para Palma Real.
