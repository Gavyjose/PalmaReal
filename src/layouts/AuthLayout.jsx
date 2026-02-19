import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
    return (
        <div className="min-h-screen flex items-center justify-center font-display antialiased relative">
            {/* Background Image Container */}
            <div className="fixed inset-0 z-0 overflow-hidden">
                <img
                    alt="Edificio residencial moderno"
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZUHggYNdFys-1Nw0BFEIT5EK4mnvt36nK9xvWhjsvuJv2tAGu3QeKWsOVAXO_hl3SJix6-77MwkX7pa_FwDTw36YWgL3mFrm-WMAXkFPbzXgQXcJX9aXB0Qgl0iikdGEU4J4lahJz-EAZsAPkYoW26xcx_rexCe8sB7tbe1xl-uQvo_YpSz08LM3Htr3d6G_yAjJJ8k8tuvJQ6SILUnPxlHNn_Co2IQtQltLdZ6JvzFZmGfyGH8kaoM7ilta5oSLRfMoa7WAAZ3wY"
                />
                <div className="absolute inset-0 bg-overlay"></div>
            </div>

            {/* Main Content */}
            <main className="relative z-10 w-full max-w-md px-6 py-12">
                <Outlet />
            </main>
        </div>
    );
};

export default AuthLayout;
