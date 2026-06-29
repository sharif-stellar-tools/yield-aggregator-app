import { DollarSign, Activity } from 'lucide-react';
import type { VaultData } from '../types';

interface VaultCardProps {
  vault: VaultData;
  onClick: (vault: VaultData) => void;
  isSelected: boolean;
}

export const VaultCard = ({ vault, onClick, isSelected }: VaultCardProps) => {
  return (
    <div 
      className={`glass-panel hover-scale ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(vault)}
      style={{
        padding: '1.5rem',
        cursor: 'pointer',
        borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border)',
        boxShadow: isSelected ? '0 0 20px var(--glow-primary)' : ''
      }}
    >
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{vault.name}</h3>
        <div style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '0.25rem 0.75rem', 
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 500
        }}>
          {vault.asset}
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Activity size={18} color="var(--success)" />
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current APY</div>
            <div className="text-gradient-success" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {vault.currentApy}%
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DollarSign size={18} color="var(--accent-primary)" />
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Value Locked</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              ${vault.tvl.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
