import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';

const PasswordRecovery = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);

    const handleRecovery = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login`,
            });

            if (error) throw error;

            setMessage({
                text: 'Si tu correo está registrado, recibirás las instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada o correos no deseados.',
                type: 'success'
            });
            setEmail('');
        } catch (error) {
            console.error(error);
            setMessage({
                text: 'Ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo.',
                type: 'error'
            });
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

            {/* Recovery Card */}
            <div className="bg-background-dark/80 backdrop-blur-xl border border-primary/20 p-8 rounded-xl shadow-2xl">
                <div className="mb-8">
                    <h2 className="text-white text-xl font-semibold">Recuperar Contraseña</h2>
                    <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                        Ingresa el correo electrónico asociado a tu cuenta para recibir un enlace de recuperación.
                    </p>
                </div>

                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg text-sm flex items-start space-x-3 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border border-red-500/50 text-red-500'}`}>
                        <span className="material-icons mt-0.5 text-[18px]">
                            {message.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <p className="leading-relaxed">{message.text}</p>
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleRecovery}>
                    {/* Email Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 block" htmlFor="email">Correo Electrónico</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-icons text-slate-500 text-lg group-focus-within:text-primary transition-colors">email</span>
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

                    {/* Submit Button */}
                    <button
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="flex items-center space-x-2">
                                <span className="material-icons animate-spin text-lg">sync</span>
                                <span>Enviando...</span>
                            </div>
                        ) : (
                            <>
                                <span>Enviar Enlace</span>
                                <span className="material-icons text-lg">send</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Bottom Link */}
                <div className="mt-8 text-center border-t border-slate-700/50 pt-6">
                    <Link className="text-slate-400 hover:text-white text-sm font-medium transition-colors inline-flex items-center space-x-2 group" to="/login">
                        <span className="material-icons text-lg transition-transform group-hover:-translate-x-1">arrow_back</span>
                        <span>Volver al inicio de sesión</span>
                    </Link>
                </div>
            </div>

            {/* Footer Info */}
            <footer className="mt-8 text-center text-slate-500 text-xs tracking-wide">
                <p>© 2026 Condominios Elite v2.4.0</p>
                <div className="mt-2 flex justify-center space-x-4">
                    <Link className="hover:text-slate-300 transition-colors" to="#">Términos</Link>
                    <span>•</span>
                    <Link className="hover:text-slate-300 transition-colors" to="#">Privacidad</Link>
                    <span>•</span>
                    <Link className="hover:text-slate-300 transition-colors" to="#">Soporte</Link>
                </div>
            </footer>
        </>
    );
};

export default PasswordRecovery;
