import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            await signIn(email, password);
            navigate('/admin');
        } catch (error) {
            setError('Error al iniciar sesión. Verifica tus credenciales.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Logo Section */}
            <div className="flex flex-col items-center mb-8">
                <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-xl shadow-lg mb-4">
                    <span className="material-icons text-white text-3xl">apartment</span>
                </div>
                <h1 className="text-white text-2xl font-bold tracking-tight">Gestión Residencial</h1>
                <p className="text-primary/70 font-medium">Condominios Elite</p>
            </div>

            {/* Login Card */}
            <div className="bg-background-dark/80 backdrop-blur-xl border border-primary/20 p-8 rounded-xl shadow-2xl">
                <div className="mb-8">
                    <h2 className="text-white text-xl font-semibold">Bienvenido de nuevo</h2>
                    <p className="text-slate-400 text-sm">Inicia sesión para administrar tu propiedad</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                        {error}
                    </div>
                )}

                <form className="space-y-5" onSubmit={handleLogin}>
                    {/* Email Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 block" htmlFor="email">Correo Electrónico</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-icons text-slate-500 text-lg group-focus-within:text-primary">email</span>
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-3 bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                                id="email"
                                name="email"
                                placeholder="nombre@ejemplo.com"
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-slate-300 block" htmlFor="password">Contraseña</label>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-icons text-slate-500 text-lg group-focus-within:text-primary">lock</span>
                            </div>
                            <input
                                className="block w-full pl-10 pr-10 py-3 bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                                id="password"
                                name="password"
                                placeholder="••••••••"
                                required
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button className="absolute inset-y-0 right-0 pr-3 flex items-center" type="button">
                                <span className="material-icons text-slate-500 hover:text-slate-300 text-lg cursor-pointer">visibility</span>
                            </button>
                        </div>
                    </div>

                    {/* Utilities */}
                    <div className="flex items-center justify-between py-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary focus:ring-offset-slate-900"
                                type="checkbox"
                            />
                            <span className="text-sm text-slate-400">Mantener sesión iniciada</span>
                        </label>
                    </div>

                    {/* Submit Button */}
                    <button
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <span>Cargando...</span>
                        ) : (
                            <>
                                <span>Iniciar Sesión</span>
                                <span className="material-icons text-lg">login</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Bottom Link */}
                <div className="mt-8 text-center">
                    <Link className="text-primary hover:text-primary/80 text-sm font-semibold transition-colors" to="#">
                        ¿Olvidaste tu contraseña?
                    </Link>
                </div>
            </div>

            {/* Footer Info */}
            <footer className="mt-8 text-center text-slate-500 text-xs tracking-wide">
                <p>© 2026 Condominios Elite v2.4.0</p>
                <div className="mt-2 flex justify-center space-x-4">
                    <Link className="hover:text-slate-300" to="#">Términos</Link>
                    <span>•</span>
                    <Link className="hover:text-slate-300" to="#">Privacidad</Link>
                    <span>•</span>
                    <Link className="hover:text-slate-300" to="#">Soporte</Link>
                </div>
            </footer>
        </>
    );
};

export default Login;
