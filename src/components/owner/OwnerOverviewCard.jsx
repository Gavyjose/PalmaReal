import React from 'react';
import { Link } from 'react-router-dom';
import { formatNumber } from '../../utils/formatters';

const OwnerOverviewCard = ({ debt, unit, onOpenPaymentModal }) => {
  return (
    <div className="relative group p-8 rounded-[2.5rem] bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-2xl shadow-emerald-900/20 overflow-hidden active-premium-card transition-all duration-500">
      <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
        <span className="material-icons text-9xl">account_balance_wallet</span>
      </div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          <p className="text-emerald-100/80 text-[10px] font-display-black uppercase tracking-[0.2em] mb-2">Pasivo Consolidado a la Fecha</p>
          <h2 className="text-6xl font-display-black tracking-tighter leading-none mb-4">
            ${formatNumber(debt.total)}
          </h2>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-display-black uppercase tracking-widest border border-white/20">
              Mantenimiento: ${formatNumber(debt.ordinary)}
            </div>
            <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-display-black uppercase tracking-widest border border-white/20">
              Especiales: ${formatNumber(debt.special)}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2 animate-in fade-in slide-in-from-right-4 duration-700">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => debt.total > 0 && onOpenPaymentModal()}
              className={`px-4 py-1.5 rounded-full text-[10px] font-display-black uppercase tracking-widest shadow-lg transition-all ${debt.total > 0 ? 'bg-rose-500 hover:bg-rose-400 text-white animate-pulse hover:scale-105 cursor-pointer' : 'bg-white text-emerald-600 cursor-default'}`}
            >
              {debt.total > 0 ? 'Pago Pendiente' : 'Al Día'}
            </button>
          </div>
          {debt.total <= 0 && (
            <Link 
              to={`/constancia/${unit?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-4 py-2 mt-1 rounded-xl bg-emerald-700/50 hover:bg-emerald-600 text-white transition-all shadow-lg hover:shadow-emerald-900/40 border border-emerald-500/30"
              title="Generar constancia PDF"
            >
              <span className="material-icons text-sm group-hover:-translate-y-0.5 transition-transform">workspace_premium</span>
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Constancia Solvencia</span>
            </Link>
          )}
          <p className="text-emerald-100/60 text-[9px] font-display-medium mt-1 uppercase tracking-widest">
            Corte realizado: {new Date().toLocaleDateString('es-VE')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OwnerOverviewCard;
