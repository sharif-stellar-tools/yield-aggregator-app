export interface RpcEndpointConfig {
  url: string;
  weight?: number;
}

export interface RpcLoadBalancerOptions {
  cooldownMs?: number;
  now?: () => number;
}

interface EndpointState {
  url: string;
  weight: number;
  failures: number;
  unhealthyUntil: number;
}

export class RpcLoadBalancer {
  private readonly endpointStates: EndpointState[];
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private weightedIndex = 0;

  constructor(endpoints: RpcEndpointConfig[], options: RpcLoadBalancerOptions = {}) {
    if (endpoints.length === 0) {
      throw new Error('At least one RPC endpoint is required');
    }

    this.endpointStates = endpoints.map((endpoint) => ({
      url: endpoint.url,
      weight: Math.max(1, Math.floor(endpoint.weight ?? 1)),
      failures: 0,
      unhealthyUntil: 0,
    }));
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  public getNextEndpoint(): string {
    const healthy = this.getHealthyEndpoints();
    if (healthy.length === 0) {
      throw new Error('No healthy RPC endpoints available');
    }

    const expanded = healthy.flatMap((endpoint) =>
      Array.from({ length: endpoint.weight }, () => endpoint),
    );
    const endpoint = expanded[this.weightedIndex % expanded.length];
    this.weightedIndex = (this.weightedIndex + 1) % expanded.length;
    return endpoint.url;
  }

  public markSuccess(url: string): void {
    const endpoint = this.endpointStates.find((state) => state.url === url);
    if (!endpoint) return;
    endpoint.failures = 0;
    endpoint.unhealthyUntil = 0;
  }

  public markFailure(url: string): void {
    const endpoint = this.endpointStates.find((state) => state.url === url);
    if (!endpoint) return;

    endpoint.failures += 1;
    endpoint.unhealthyUntil = this.now() + this.cooldownMs;
  }

  public getEndpointHealth(): Array<{ url: string; healthy: boolean; failures: number }> {
    const now = this.now();
    return this.endpointStates.map((endpoint) => ({
      url: endpoint.url,
      healthy: endpoint.unhealthyUntil <= now,
      failures: endpoint.failures,
    }));
  }

  public async withFailover<T>(executor: (endpointUrl: string) => Promise<T>): Promise<T> {
    const visited = new Set<string>();
    const attempts = this.endpointStates.length;
    let lastError: unknown;

    for (let i = 0; i < attempts; i += 1) {
      let endpointUrl: string;
      try {
        endpointUrl = this.getNextEndpoint();
      } catch {
        break;
      }

      if (visited.has(endpointUrl)) {
        continue;
      }
      visited.add(endpointUrl);

      try {
        const result = await executor(endpointUrl);
        this.markSuccess(endpointUrl);
        return result;
      } catch (error) {
        this.markFailure(endpointUrl);
        lastError = error;
      }
    }

    throw new Error(
      `All RPC endpoints failed${lastError instanceof Error ? `: ${lastError.message}` : ''}`,
    );
  }

  private getHealthyEndpoints(): EndpointState[] {
    const now = this.now();
    return this.endpointStates.filter((endpoint) => endpoint.unhealthyUntil <= now);
  }
}
