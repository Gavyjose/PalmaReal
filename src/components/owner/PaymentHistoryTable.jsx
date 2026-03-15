import React from 'react';
import { formatNumber } from '../../utils/formatters';

const PaymentStatusBadge = ({ status }) => {
  const styles = {
    'Aprobado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Pendiente': 'bg-amber-100 text-amber-700 border-amber-200',
    'Rechazado': 'bg-red-100 text-red-700 border-red-200',
    'default': 'bg-slate-100 text-slate-600 border-slate-200'
  };
  
  const style = styles[status] || styles.default;
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${style}`}>
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2">
            Historial de Operaciones
          </h3>
          <p className="text-xs text-slate-500">Registro maestro bimonetario</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded">
          {filterButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => onFilterChange(btn.id)}
              className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${filter === btn.id ? 'bg-white dark:bg-slate-700 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Periodo / Fecha</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Monto (USD)</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Referencia</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {payments.length > 0 ? payments.map((p, idx) => (
              <tr 
                key={p.id} 
                className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.period || 'Múltiples'}</span>
                    <span className="text-xs text-slate-400">{new Date(p.op_date || p.created_at).toLocaleDateString()}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs font-mono font-bold text-emerald-600">${formatNumber(p.amount_usd)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 truncate max-w-[100px]">{p.reference || 'N/A'}</span>
                    {p.receipt_url && (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-emerald-500">
                        <span className="material-icons text-xs">attach_file</span>
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <PaymentStatusBadge status={p.status} />
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="px-4 py-8 text-center opacity-40">
                  <span className="material-icons text-3xl mb-2">history</span>
                  <p className="text-xs font-bold uppercase">No se encontraron pagos</p>
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
