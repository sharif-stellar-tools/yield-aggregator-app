import { expect } from 'chai';
import { RpcLoadBalancer } from '../src/api/rpcLoadBalancer';

describe('RpcLoadBalancer', () => {
  it('cycles through endpoints in weighted round-robin order', () => {
    const balancer = new RpcLoadBalancer([
      { url: 'https://rpc-a.local', weight: 2 },
      { url: 'https://rpc-b.local', weight: 1 },
    ]);

    const picks = Array.from({ length: 6 }, () => balancer.getNextEndpoint());
    expect(picks).to.deep.equal([
      'https://rpc-a.local',
      'https://rpc-a.local',
      'https://rpc-b.local',
      'https://rpc-a.local',
      'https://rpc-a.local',
      'https://rpc-b.local',
    ]);
  });

  it('fails over to next endpoint when current one errors', async () => {
    const balancer = new RpcLoadBalancer([
      { url: 'https://rpc-a.local' },
      { url: 'https://rpc-b.local' },
    ]);

    const attempts: string[] = [];
    const result = await balancer.withFailover(async (endpointUrl) => {
      attempts.push(endpointUrl);
      if (endpointUrl === 'https://rpc-a.local') {
        throw new Error('temporary RPC failure');
      }
      return 'ok';
    });

    expect(result).to.equal('ok');
    expect(attempts).to.deep.equal(['https://rpc-a.local', 'https://rpc-b.local']);
  });

  it('marks failed endpoint unhealthy until cooldown expires', async () => {
    let now = 1_000;
    const balancer = new RpcLoadBalancer(
      [
        { url: 'https://rpc-a.local' },
        { url: 'https://rpc-b.local' },
      ],
      { cooldownMs: 100, now: () => now },
    );

    balancer.markFailure('https://rpc-a.local');

    // While A is cooling down, traffic should be routed to B.
    expect(balancer.getNextEndpoint()).to.equal('https://rpc-b.local');

    now += 101;
    const next = balancer.getNextEndpoint();
    expect(['https://rpc-a.local', 'https://rpc-b.local']).to.include(next);
    expect(balancer.getEndpointHealth().find((e) => e.url === 'https://rpc-a.local')?.healthy).to
      .equal(true);
  });

  it('throws when all endpoints fail in failover path', async () => {
    const balancer = new RpcLoadBalancer([
      { url: 'https://rpc-a.local' },
      { url: 'https://rpc-b.local' },
    ]);

    let caught: unknown;
    try {
      await balancer.withFailover(async () => {
        throw new Error('down');
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).to.be.instanceOf(Error);
    expect((caught as Error).message).to.match(/All RPC endpoints failed/);
  });
});
