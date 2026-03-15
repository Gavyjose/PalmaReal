import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber } from '../../utils/formatters';

const DebtEvolutionChart = ({ debt, data }) => {
  const chartData = data?.length > 0 ? data : [
    { name: 'Ene', value: 450 },
    { name: 'Feb', value: 380 },
    { name: 'Mar', value: 520 },
    { name: 'Abr', value: 300 },
    { name: 'May', value: debt?.total || 150 },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-4 h-[250px]">
      <div className="flex justify-between items-center mb-4">
         <h3 className="text-xs font-bold text-slate-500 uppercase">Desempeño Financiero</h3>
         <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm uppercase">En Tiempo Real</span>
      </div>
      <div className="w-full h-full pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10, fontWeight: 600}}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10, fontWeight: 600}}
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '4px',
              }}
              labelStyle={{ color: '#64748b', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}
              itemStyle={{ color: '#059669', fontWeight: 700, fontSize: '14px' }}
              formatter={(value) => [`$${formatNumber(value)}`, 'Deuda']}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#059669" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorValue)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DebtEvolutionChart;
