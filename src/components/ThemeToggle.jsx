import React, { useState, useEffect } from 'react';

const ThemeToggle = () => {
    const [isDark, setIsDark] = useState(() => {
        // Al inicializar, revisamos si hay una preferencia guardada o si el sistema prefiere oscuro
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            return savedTheme === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        // Aplicamos el tema al elemento raíz cuando cambia el estado
        console.log("Applying theme:", isDark ? 'dark' : 'light');
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.style.colorScheme = 'dark';
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.style.colorScheme = 'light';
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    return (
        <button
            onClick={() => setIsDark(!isDark)}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
        >
            <span className="material-icons text-xl">
                {isDark ? 'light_mode' : 'dark_mode'}
            </span>
        </button>
    );
};

export default ThemeToggle;
