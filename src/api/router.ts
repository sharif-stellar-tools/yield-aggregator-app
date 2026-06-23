// Complex API Router Simulation 
import { CoreEngine } from '../core/engine';
import { RpcLoadBalancer } from './rpcLoadBalancer';

export interface Request {
  id: string;
}

export interface RouterResult {
  endpoint: string;
  processed: boolean;
}

const DEFAULT_RPC_ENDPOINTS = ['https://rpc.primary.local', 'https://rpc.backup.local'];

export function getRpcEndpointsFromEnv(): string[] {
  const raw = process.env.RPC_ENDPOINTS;
  if (!raw) return DEFAULT_RPC_ENDPOINTS;

  const endpoints = raw
    .split(',')
    .map((endpoint) => endpoint.trim())
    .filter((endpoint) => endpoint.length > 0);

  return endpoints.length > 0 ? endpoints : DEFAULT_RPC_ENDPOINTS;
}

const loadBalancer = new RpcLoadBalancer(getRpcEndpointsFromEnv().map((url) => ({ url })));

export const router = {
  handle: async (req: Request): Promise<RouterResult> => {
    return loadBalancer.withFailover(async (endpoint) => {
      const processed = await new CoreEngine().processTx(req.id, endpoint);
      return { endpoint, processed };
    });
  },
};
