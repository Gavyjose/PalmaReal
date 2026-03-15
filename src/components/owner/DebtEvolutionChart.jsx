import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber } from '../../utils/formatters';

const DebtEvolutionChart = ({ debt, data }) => {
  // Simulación de datos si no hay suficientes
  const chartData = data?.length > 0 ? data : [
    { name: 'Ene', value: 450 },
    { name: 'Feb', value: 380 },
    { name: 'Mar', value: 520 },
    { name: 'Abr', value: 300 },
    { name: 'May', value: debt?.total || 150 },
  ];

  return (
    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 p-6 rounded-[2rem] shadow-xl h-[300px]">
      <div className="flex justify-between items-center mb-6">
         <h3 className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em]">Desempeño Financiero</h3>
         <span className="text-[9px] font-display-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest">En Tiempo Real</span>
      </div>
      <div className="w-full h-full pb-8">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.8)', 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                backdropFilter: 'blur(8px)'
              }}
              labelStyle={{ color: '#64748b', fontWeight: 800, marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}
              itemStyle={{ color: '#059669', fontWeight: 900, fontSize: '14px' }}
              formatter={(value) => [`$${formatNumber(value)}`, 'Deuda']}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#10b981" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DebtEvolutionChart;
