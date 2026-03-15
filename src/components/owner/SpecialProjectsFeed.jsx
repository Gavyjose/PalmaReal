import React from 'react';
import { formatNumber } from '../../utils/formatters';

const SpecialProjectsFeed = ({ projects }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.length > 0 ? projects.map((project) => {
        const progress = (project.collected / project.goal) * 100;
        return (
          <div 
            key={project.id} 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-4 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <p className="text-xs text-emerald-600 mb-1">Proyecto Especial</p>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase">{project.name}</h4>
              </div>
              <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center text-emerald-600">
                <span className="material-icons text-lg">engineering</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 line-clamp-2 mb-4">
              {project.description || 'Modernización y mejoras para el bienestar de la comunidad Palma Real.'}
            </p>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 uppercase">Recaudado</span>
                  <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">
                    ${formatNumber(project.collected)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-emerald-600">{Math.round(progress)}%</span>
                  <span className="text-xs text-slate-400">Meta: ${formatNumber(project.goal)}</span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-sm overflow-hidden">
                <div 
                  className="h-full bg-emerald-600"
                  style={{ width: `${Math.min(100, progress)}%` }}
                ></div>
              </div>
            </div>
          </div>
        );
      }) : (
        <div className="col-span-full bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-md flex flex-col items-center justify-center py-12 opacity-40">
           <span className="material-icons text-4xl mb-2">auto_awesome_motion</span>
           <p className="text-xs font-bold uppercase">No hay proyectos activos</p>
        </div>
      )}
    </div>
  );
};

export default SpecialProjectsFeed;
