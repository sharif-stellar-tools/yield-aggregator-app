import { useState, useEffect } from 'react';
import { Layers, RefreshCcw } from 'lucide-react';
import { VaultCard } from './components/VaultCard';
import { ApyChart } from './components/ApyChart';
import { IndexerService } from './services/indexer';
import type { VaultData, GlobalData } from './types';

function App() {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [selectedVault, setSelectedVault] = useState<VaultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [vData, gData] = await Promise.all([
        IndexerService.getVaults(),
        IndexerService.getGlobalData()
      ]);
      setVaults(vData);
      setGlobalData(gData);
      if (vData.length > 0 && !selectedVault) {
        setSelectedVault(vData[0]);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="container animate-fade-in">
      <header className="flex justify-between items-center" style={{ marginBottom: '3rem' }}>
        <div className="flex items-center gap-4">
          <div className="glass-panel" style={{ padding: '0.75rem', borderRadius: '12px' }}>
            <Layers color="var(--accent-primary)" size={28} />
          </div>
          <div>
            <h1 className="text-gradient" style={{ fontSize: '2rem', margin: 0 }}>Yield Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Real-time Vault Analytics</p>
          </div>
        </div>
        
        <div className="glass-panel flex items-center gap-6" style={{ padding: '1rem 2rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Global TVL
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {isLoading ? '...' : `$${globalData?.totalTvl.toLocaleString()}`}
            </div>
          </div>
          <button 
            onClick={loadData}
            className="hover-scale"
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--border)', 
              color: 'var(--text-primary)',
              padding: '0.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCcw size={18} color={isLoading ? 'var(--text-secondary)' : 'var(--text-primary)'} className={isLoading ? 'animate-spin' : ''} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }}/>
          </button>
        </div>
      </header>

      <main className="flex flex-col gap-8">
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: 600 }}>Active Vaults</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {isLoading ? (
              // Skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-panel" style={{ height: '160px', opacity: 0.5, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
              ))
            ) : (
              vaults.map((vault) => (
                <VaultCard 
                  key={vault.id} 
                  vault={vault} 
                  isSelected={selectedVault?.id === vault.id}
                  onClick={setSelectedVault} 
                />
              ))
            )}
          </div>
        </section>

        <section>
          <ApyChart vault={selectedVault} />
        </section>
      </main>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}

export default App;
