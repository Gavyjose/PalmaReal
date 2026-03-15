import React from 'react';
import { formatNumber } from '../../utils/formatters';

const SpecialProjectsFeed = ({ projects }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {projects.length > 0 ? projects.map((project, idx) => {
        const progress = (project.collected / project.goal) * 100;
        return (
          <div 
            key={project.id} 
            className="group relative p-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-500 flex flex-col justify-between active-premium-card overflow-hidden animate-in zoom-in-95 duration-500"
            style={{ animationDelay: `${idx * 150}ms` }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <p className="text-micro text-emerald-500 mb-1">Proyecto Especial</p>
                <h4 className="text-sm font-display-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">{project.name}</h4>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <span className="material-icons text-lg">engineering</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-6 font-display-medium leading-relaxed">
              {project.description || 'Modernización y mejoras para el bienestar de la comunidad Palma Real.'}
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[9px] font-display-black text-slate-400 uppercase tracking-widest">Recaudado</span>
                  <span className="text-sm font-display-black text-slate-700 dark:text-slate-200">
                    ${formatNumber(project.collected)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-display-black text-emerald-500 uppercase tracking-widest">{Math.round(progress)}%</span>
                  <span className="text-[9px] font-display-medium text-slate-400 uppercase tracking-widest text-right">Meta: ${formatNumber(project.goal)}</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  style={{ width: `${Math.min(100, progress)}%` }}
                ></div>
              </div>
            </div>
          </div>
        );
      }) : (
        <div className="col-span-full bg-white/20 dark:bg-slate-900/20 backdrop-blur-md rounded-[2.5rem] border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center py-20 opacity-40">
           <span className="material-icons text-5xl mb-3">auto_awesome_motion</span>
           <p className="text-[10px] font-display-black uppercase tracking-[0.2em]">No hay proyectos activos</p>
        </div>
      )}
    </div>
  );
};

export default SpecialProjectsFeed;
