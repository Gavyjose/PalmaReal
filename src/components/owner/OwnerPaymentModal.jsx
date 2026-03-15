import React from 'react';
import { formatNumber } from '../../utils/formatters';

const OwnerPaymentModal = ({ 
  isOpen, 
  onClose, 
  unit, 
  pendingPeriods, 
  selectedPeriods, 
  onTogglePeriod,
  totalSelectedUsd,
  paymentMethod,
  onPaymentMethodChange,
  opDate,
  onOpDateChange,
  amountBs,
  onAmountBsChange,
  cashAmountUsd,
  onCashAmountUsdChange,
  bcvRate,
  onBcvRateChange,
  isEditingRate,
  onIsEditingRateChange,
  reference,
  onReferenceChange,
  status,
  submitting,
  onSubmit,
  previewUrl,
  ocrProcessing,
  ocrValidation,
  onFileChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
      
      <div 
        className="relative w-full max-w-6xl max-h-[95vh] overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] border border-white/20 dark:border-white/5 rounded-[3rem] flex flex-col animate-in zoom-in-95 duration-500" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Columna Izquierda: Cálculo de Conformidad */}
          <div className="w-full lg:w-5/12 flex flex-col border-r border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-transparent">
            <div className="p-10">
              <p className="text-micro text-emerald-500 mb-1">Paso 01</p>
              <h3 className="text-2xl font-display-black text-slate-900 dark:text-white uppercase tracking-tight">Selección de Deuda</h3>
              <p className="text-[10px] text-slate-400 font-display-bold uppercase tracking-[0.1em] mt-1">Unidad {unit?.tower}-{unit?.number}</p>
            </div>

            <div className="flex-1 px-10 space-y-3 overflow-y-auto custom-scrollbar pr-4">
              {pendingPeriods.length === 0 ? (
                <div className="text-center py-20 opacity-30 flex flex-col items-center">
                  <span className="material-icons text-6xl mb-4">task_alt</span>
                  <p className="text-[10px] font-display-black uppercase tracking-widest">Sin compromisos pendientes</p>
                </div>
              ) : (
                pendingPeriods.map(period => {
                  const isSelected = selectedPeriods.find(p => p.id === period.id);
                  const pendingDebt = period.amount - (period.paid_amount || 0);
                  
                  return (
                    <div 
                      key={period.id} 
                      onClick={() => onTogglePeriod(period)}
                      className={`p-6 border transition-all duration-300 cursor-pointer flex items-center justify-between rounded-2xl group ${isSelected ? 'bg-emerald-500 text-white border-emerald-400 shadow-xl shadow-emerald-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 hover:border-emerald-500/50 shadow-sm'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-white border-white scale-110' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                          {isSelected && <span className="material-icons text-emerald-600 text-sm font-black">check</span>}
                        </div>
                        <div>
                          <p className={`text-xs font-display-black uppercase tracking-wide ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{period.period_name}</p>
                          <p className={`text-[9px] font-display-black uppercase tracking-widest ${isSelected ? 'text-emerald-100' : 'text-slate-400 opacity-60'}`}>
                            {period.type === 'SPECIAL' ? 'Cuota Especial' : 'Mantenimiento Mensual'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-display-black tabular-nums ${isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>${formatNumber(pendingDebt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-10 mt-auto bg-gradient-to-t from-slate-100/50 dark:from-slate-900/50 to-transparent">
              <div className="flex justify-between items-end">
                <span className="text-micro text-slate-400">Base Consolidada</span>
                <span className="text-4xl font-display-black text-slate-900 dark:text-white tabular-nums tracking-tighter">$ {formatNumber(totalSelectedUsd)}</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Instrumentation */}
          <div className="w-full lg:w-7/12 flex flex-col relative bg-white dark:bg-slate-950">
            <button onClick={onClose} className="absolute top-10 right-10 w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-center transition-all border border-slate-100 dark:border-white/5 z-10 hover:rotate-90">
              <span className="material-icons text-slate-400 text-base">close</span>
            </button>

            <div className="p-10">
              <p className="text-micro text-emerald-500 mb-1">Paso 02</p>
              <h3 className="text-2xl font-display-black text-slate-900 dark:text-white uppercase tracking-tight">Instrumentación</h3>
              <p className="text-[10px] text-slate-400 font-display-bold uppercase tracking-[0.1em] mt-1">Liquidación Contable</p>
            </div>

            {status && (
              <div className={`mx-10 p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 shadow-xl ${status.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                <span className="material-icons">{status.type === 'success' ? 'verified' : 'report_problem'}</span>
                <p className="text-[11px] font-display-black uppercase tracking-widest">{status.msg}</p>
              </div>
            )}

            <div className="flex-1 p-10 space-y-8 overflow-y-auto custom-scrollbar">
              {/* TABS PREMIUM */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5">
                {[
                  {id: 'TRANSFER', label: 'Transferencia / PM', icon: 'account_balance'},
                  {id: 'CASH', label: 'Efectivo Divisas', icon: 'payments'}
                ].map(method => (
                  <button 
                    key={method.id}
                    onClick={() => onPaymentMethodChange(method.id)}
                    className={`flex-1 py-4 text-[10px] font-display-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 rounded-xl ${paymentMethod === method.id ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="material-icons text-base">{method.icon}</span> {method.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-micro text-slate-400 ml-1">Fecha de la Operación</label>
                  <div className="relative group">
                    <input
                      type="date"
                      value={opDate}
                      onChange={(e) => onOpDateChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 text-sm font-display-bold text-slate-700 dark:text-white outline-none focus:border-emerald-500/50 transition-all uppercase"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 material-icons text-slate-300 text-base pointer-events-none group-focus-within:text-emerald-500">event</span>
                  </div>
                </div>

                {paymentMethod === 'TRANSFER' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-micro text-slate-400">Tasa Referencial</label>
                      <button 
                        onClick={() => onIsEditingRateChange(!isEditingRate)}
                        className={`text-[8px] font-display-black uppercase tracking-tighter px-2 py-0.5 rounded-md transition-all ${isEditingRate ? 'bg-emerald-500 text-white' : 'text-emerald-500 hover:bg-emerald-50'}`}
                      >
                        {isEditingRate ? 'BLOQUEAR' : 'EDITAR'}
                      </button>
                    </div>
                    <div className="relative group">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-display-black text-slate-300">BS</span>
                      <input
                        type="number" step="0.0001"
                        value={bcvRate}
                        disabled={!isEditingRate}
                        onChange={(e) => onBcvRateChange(parseFloat(e.target.value) || 0)}
                        className={`w-full bg-slate-50 dark:bg-slate-900 border pl-12 p-5 text-lg font-display-black text-slate-700 dark:text-white outline-none transition-all rounded-2xl ${isEditingRate ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 dark:border-white/5'}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-micro text-slate-400 ml-1">Monto de la Transacción ({paymentMethod === 'TRANSFER' ? 'BS' : 'USD'})</label>
                <div className="relative group">
                  <span className="absolute left-8 top-1/2 -translate-y-1/2 text-3xl font-display-black text-emerald-500 opacity-40">
                    {paymentMethod === 'TRANSFER' ? 'Bs' : '$'}
                  </span>
                  <input
                    type="number" step="0.01" 
                    placeholder="0.00"
                    value={paymentMethod === 'TRANSFER' ? amountBs : cashAmountUsd}
                    onChange={(e) => paymentMethod === 'TRANSFER' ? onAmountBsChange(e.target.value) : onCashAmountUsdChange(e.target.value)}
                    className="w-full bg-emerald-50/20 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] pl-20 p-8 text-5xl font-display-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500 shadow-inner tracking-tighter"
                  />
                  {paymentMethod === 'TRANSFER' && (
                     <div className="absolute right-8 bottom-4 text-micro text-emerald-500/60 font-display-bold">
                        Equivalente: ${formatNumber(totalSelectedUsd)}
                     </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 items-start">
                 <div className="space-y-3">
                    <label className="text-micro text-slate-400 ml-1">Comprobante Digital</label>
                    <input type="file" accept="image/*" onChange={onFileChange} className="hidden" id="modal-upload" />
                    <label htmlFor="modal-upload" className={`w-full h-40 rounded-[2rem] border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center group/label relative ${previewUrl ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 dark:border-white/5 hover:border-emerald-500/50 bg-slate-50 dark:bg-slate-900'}`}>
                      {previewUrl ? (
                        <div className="relative w-full h-full p-4">
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-xl" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/label:opacity-100 transition-opacity flex items-center justify-center">
                             <span className="material-icons text-white">sync</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                           <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/label:text-emerald-500 transition-colors">
                              <span className="material-icons">add_a_photo</span>
                           </div>
                           <span className="text-[9px] font-display-black uppercase tracking-widest text-slate-400">Digitalizar Captura</span>
                        </div>
                      )}
                      {ocrProcessing && <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex flex-col items-center justify-center gap-3"><div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div><span className="text-micro text-emerald-500 animate-pulse">Analizando Red...</span></div>}
                    </label>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-micro text-slate-400 ml-1">Referencia Bancaria</label>
                      <div className="relative">
                        <input
                          value={reference}
                          onChange={(e) => onReferenceChange(e.target.value)}
                          className={`w-full border p-5 text-xl font-display-black tracking-[0.2em] outline-none transition-all rounded-2xl uppercase ${ocrValidation ? (ocrValidation.match ? 'border-emerald-500 bg-emerald-500/5' : 'border-rose-500 bg-rose-500/5') : 'border-slate-200 dark:border-white/5 focus:border-emerald-500 focus:bg-emerald-50/10 dark:bg-slate-900'}`}
                          placeholder="REFERENCIA" type="text"
                        />
                        {ocrValidation && (
                          <span className={`absolute right-5 top-1/2 -translate-y-1/2 material-icons ${ocrValidation.match ? 'text-emerald-500' : 'text-rose-500'} scale-125`}>
                            {ocrValidation.match ? 'verified' : 'report_problem'}
                          </span>
                        )}
                      </div>
                    </div>
                    {ocrValidation && !ocrValidation.match && (
                      <p className="text-[9px] font-display-bold text-rose-500 uppercase tracking-widest animate-bounce">La referencia no coincide con la imagen detectada</p>
                    )}
                 </div>
              </div>
            </div>

            <div className="p-0 flex h-28 border-t border-slate-100 dark:border-white/5">
              <button 
                onClick={onClose}
                className="w-48 h-full border-r border-slate-100 dark:border-white/5 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all font-display-black"
              >
                Abortar
              </button>
              <button 
                onClick={onSubmit}
                disabled={submitting || (selectedPeriods.length === 0 || (paymentMethod === 'TRANSFER' ? !amountBs : !cashAmountUsd) || !reference || !previewUrl)}
                className={`flex-1 h-full flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden group ${submitting || (selectedPeriods.length === 0 || (paymentMethod === 'TRANSFER' ? !amountBs : !cashAmountUsd) || !reference || !previewUrl) ? 'bg-slate-50 dark:bg-slate-950 text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)]'}`}
              >
                {submitting ? (
                  <div className="flex items-center gap-3">
                     <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                     <span className="text-[11px] font-display-black uppercase tracking-widest">Transmitiendo...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 z-10">
                      <span className="material-icons group-hover:scale-125 transition-transform">send</span>
                      <span className="text-[12px] font-display-black uppercase tracking-[0.2em]">Ejecutar Notificación</span>
                    </div>
                    {(selectedPeriods.length === 0 || (paymentMethod === 'TRANSFER' ? !amountBs : !cashAmountUsd) || !reference || !previewUrl) && (
                      <span className="text-[8px] font-display-bold opacity-40 uppercase tracking-tighter">Faltan Requerimientos Bancarios</span>
                    )}
                  </>
                )}
                {!submitting && !(selectedPeriods.length === 0 || (paymentMethod === 'TRANSFER' ? !amountBs : !cashAmountUsd) || !reference || !previewUrl) && (
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerPaymentModal;
