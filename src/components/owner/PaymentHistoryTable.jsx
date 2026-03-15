import React from 'react';
import { formatNumber } from '../../utils/formatters';

const PaymentStatusBadge = ({ status }) => {
  const styles = {
    'Aprobado': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'Pendiente': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    'Rechazado': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    'default': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
  };
  
  const style = styles[status] || styles.default;
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-display-black uppercase tracking-widest border ${style}`}>
      {status}
    </span>
  );
};

const PaymentHistoryTable = ({ payments, filter, onFilterChange }) => {
  const filterButtons = [
    { id: 'all', label: 'Todos' },
    { id: 'ordinary', label: 'Ordinarios' },
    { id: 'special', label: 'Especiales' }
  ];

  return (
    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-[2rem] shadow-xl overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-white/20 dark:border-white/5 flex justify-between items-center bg-white/20">
        <div>
          <h3 className="text-sm font-display-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
            Historial de Operaciones
          </h3>
          <p className="text-[10px] text-slate-400 font-display-medium uppercase tracking-widest">Registro maestro bimonetario</p>
        </div>
        <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl backdrop-blur-md">
          {filterButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => onFilterChange(btn.id)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-display-black uppercase tracking-widest transition-all ${filter === btn.id ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="px-6 py-4 text-[9px] font-display-black text-slate-400 uppercase tracking-widest">Periodo / Fecha</th>
              <th className="px-6 py-4 text-[9px] font-display-black text-slate-400 uppercase tracking-widest text-right">Monto (USD)</th>
              <th className="px-6 py-4 text-[9px] font-display-black text-slate-400 uppercase tracking-widest">Referencia</th>
              <th className="px-6 py-4 text-[9px] font-display-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {payments.length > 0 ? payments.map((p, idx) => (
              <tr 
                key={p.id} 
                className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors group animate-in fade-in slide-in-from-left-2 duration-300"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-display-bold text-slate-700 dark:text-slate-200">{p.period || 'Múltiples'}</span>
                    <span className="text-[9px] text-slate-400 uppercase font-display-medium">{new Date(p.op_date || p.created_at).toLocaleDateString()}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs font-display-black text-emerald-600 dark:text-emerald-400">${formatNumber(p.amount_usd)}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{p.reference || 'N/A'}</span>
                    {p.receipt_url && (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-400 transition-colors">
                        <span className="material-icons text-xs">attach_file</span>
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <PaymentStatusBadge status={p.status} />
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center opacity-30">
                  <span className="material-icons text-3xl mb-2">history</span>
                  <p className="text-[10px] font-display-bold uppercase tracking-widest">No se encontraron pagos</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentHistoryTable;
