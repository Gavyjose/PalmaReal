import React from 'react';
import { Outlet } from 'react-router-dom';
import OwnerSidebar from '../components/OwnerSidebar';

const OwnerLayout = () => {
    return (
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
            <OwnerSidebar />
            <main className="flex-1 overflow-y-auto p-8 relative">
                <Outlet />
            </main>
        </div>
    );
};
export default OwnerLayout;
