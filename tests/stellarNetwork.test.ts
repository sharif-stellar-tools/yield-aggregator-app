import { expect } from 'chai';
import {
  getStellarNetworkConfig,
  TESTNET_HORIZON_URL,
  TESTNET_NETWORK_PASSPHRASE
} from '../src/config/stellarNetwork';

describe('getStellarNetworkConfig', () => {
  it('falls back to Stellar Testnet settings when environment values are missing', () => {
    expect(getStellarNetworkConfig({})).to.deep.equal({
      network: 'testnet',
      networkPassphrase: TESTNET_NETWORK_PASSPHRASE,
      horizonUrl: TESTNET_HORIZON_URL
    });
  });

  it('uses explicit passphrase and Horizon URL overrides', () => {
    expect(
      getStellarNetworkConfig({
        STELLAR_NETWORK: 'standalone',
        STELLAR_NETWORK_PASSPHRASE: 'Standalone Network ; February 2017',
        STELLAR_HORIZON_URL: 'http://localhost:8000'
      })
    ).to.deep.equal({
      network: 'standalone',
      networkPassphrase: 'Standalone Network ; February 2017',
      horizonUrl: 'http://localhost:8000'
    });
  });

  it('treats blank environment values as missing', () => {
    expect(
      getStellarNetworkConfig({
        STELLAR_NETWORK: ' ',
        STELLAR_NETWORK_PASSPHRASE: '',
        STELLAR_HORIZON_URL: '   '
      })
    ).to.deep.equal({
      network: 'testnet',
      networkPassphrase: TESTNET_NETWORK_PASSPHRASE,
      horizonUrl: TESTNET_HORIZON_URL
    });
  });
});
