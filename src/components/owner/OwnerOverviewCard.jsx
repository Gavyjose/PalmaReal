import React from 'react';
import { Link } from 'react-router-dom';
import { formatNumber } from '../../utils/formatters';

const OwnerOverviewCard = ({ debt, unit, onOpenPaymentModal }) => {
  return (
    <div className="bg-emerald-600 text-white rounded-md border border-emerald-700 p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-emerald-100 text-xs font-bold uppercase mb-2">Pasivo Consolidado a la Fecha</p>
          <h2 className="text-4xl font-mono font-bold mb-3">
            ${formatNumber(debt.total)}
          </h2>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold uppercase">
              Mant: ${formatNumber(debt.ordinary)}
            </span>
            <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold uppercase">
              Esp: ${formatNumber(debt.special)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <button 
            onClick={() => debt.total > 0 && onOpenPaymentModal()}
            className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${debt.total > 0 ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white text-emerald-600'}`}
          >
            {debt.total > 0 ? 'Pago Pendiente' : 'Al Día'}
          </button>
          {debt.total <= 0 && (
            <Link 
              to={`/constancia/${unit?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold uppercase"
              title="Generar constancia PDF"
            >
              <span className="material-icons text-sm">workspace_premium</span>
              <span>Constancia</span>
            </Link>
          )}
          <p className="text-emerald-100 text-xs mt-1">
            Corte: {new Date().toLocaleDateString('es-VE')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OwnerOverviewCard;
