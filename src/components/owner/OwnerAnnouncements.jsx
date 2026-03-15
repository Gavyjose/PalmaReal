import React from 'react';

const OwnerAnnouncements = ({ announcements }) => {
  return (
    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 p-6 rounded-[2rem] shadow-xl group hover:shadow-2xl transition-all">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-display-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          Comunicados
        </h3>
        <button className="text-[10px] font-display-black text-emerald-500 uppercase tracking-widest hover:underline cursor-pointer">Ver Todos</button>
      </div>
      <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar-thin pr-2">
        {announcements.length > 0 ? announcements.map((news, idx) => (
          <div 
            key={news.id} 
            className="p-4 bg-white/60 dark:bg-slate-800/60 rounded-2xl border border-white/40 dark:border-white/5 group/news hover:scale-[1.02] transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <h4 className="text-sm font-display-bold text-slate-800 dark:text-white mb-1 group-hover/news:text-emerald-500 transition-colors uppercase tracking-tight">{news.title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2 font-display-medium">{news.content}</p>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-display-black text-slate-300 uppercase tracking-widest">
                {new Date(news.created_at).toLocaleDateString()}
              </span>
              <span className="material-icons text-slate-300 text-xs opacity-0 group-hover/news:opacity-100 transition-opacity">arrow_forward</span>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-12 opacity-30">
            <span className="material-icons text-4xl mb-2">notifications_off</span>
            <p className="text-[10px] font-display-bold uppercase tracking-widest">No hay avisos recientes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerAnnouncements;
