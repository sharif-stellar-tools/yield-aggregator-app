export const TESTNET_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const TESTNET_HORIZON_URL = 'https://horizon-testnet.stellar.org';

export interface StellarNetworkConfig {
  network: string;
  networkPassphrase: string;
  horizonUrl: string;
}

type EnvSource = Partial<Record<string, string | undefined>>;

function readProcessEnv(): EnvSource {
  if (typeof process === 'undefined' || !process.env) {
    return {};
  }
  return process.env;
}

function readNonEmpty(env: EnvSource, key: string): string | undefined {
  const value = env[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function getStellarNetworkConfig(env: EnvSource = readProcessEnv()): StellarNetworkConfig {
  return {
    network: readNonEmpty(env, 'STELLAR_NETWORK') ?? 'testnet',
    networkPassphrase: readNonEmpty(env, 'STELLAR_NETWORK_PASSPHRASE') ?? TESTNET_NETWORK_PASSPHRASE,
    horizonUrl: readNonEmpty(env, 'STELLAR_HORIZON_URL') ?? TESTNET_HORIZON_URL
  };
}
