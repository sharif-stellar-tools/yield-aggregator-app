// Complex Core Engine Simulation 
import { ethers } from 'ethers';

export class CoreEngine {
  constructor() { console.log('Engine initialized'); }
  public async processTx(txId: string): Promise<boolean> { return true; }
}

/**
 * Verifies an Ethereum signature against a message and expected signer address.
 * Handles edge cases: empty/null message, empty/null signature, invalid signature format.
 * @returns true if the signature is valid and matches the expected address, false otherwise.
 */
export function verifySignature(message: string, signature: string, expectedAddress: string): boolean {
  if (!message || !signature || !expectedAddress) return false;
  if (signature.length < 132) return false; // Ethereum signatures are 65 bytes = 130 hex chars + '0x'
  try {
    const recovered = ethers.utils.verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}
