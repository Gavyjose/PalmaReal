import React from 'react';

const OwnerAnnouncements = ({ announcements }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
          Comunicados
        </h3>
        <button className="text-xs font-bold text-emerald-600 uppercase hover:underline cursor-pointer">Ver Todos</button>
      </div>
      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
        {announcements.length > 0 ? announcements.map((news) => (
          <div 
            key={news.id} 
            className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-colors cursor-pointer"
          >
            <h4 className="text-xs font-bold text-slate-800 dark:text-white mb-1 uppercase">{news.title}</h4>
            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{news.content}</p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 uppercase">
                {new Date(news.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-8 opacity-40">
            <span className="material-icons text-3xl mb-2">notifications_off</span>
            <p className="text-xs font-bold uppercase">No hay avisos recientes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerAnnouncements;
