import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import type { VaultData } from '../types';

interface ApyChartProps {
  vault: VaultData | null;
}

export const ApyChart = ({ vault }: ApyChartProps) => {
  if (!vault) {
    return (
      <div className="glass-panel flex items-center justify-center" style={{ height: '400px', width: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Select a vault to view its APY trends</p>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '2rem', height: '450px', width: '100%' }}>
      <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>
        <span className="text-gradient">{vault.name}</span> Historical APY
      </h3>
      
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={vault.historicalApy} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorApy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            tickFormatter={(value) => `${value}%`}
            domain={['dataMin - 1', 'dataMax + 1']}
            tickMargin={10}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              color: 'var(--text-primary)'
            }}
            itemStyle={{ color: 'var(--accent-primary)', fontWeight: 600 }}
            formatter={(value: any) => [`${value}%`, 'APY']}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
          />
          <Area 
            type="monotone" 
            dataKey="apy" 
            stroke="var(--accent-primary)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorApy)" 
            activeDot={{ r: 6, fill: 'var(--accent-secondary)', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
