"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreEngine = void 0;
exports.verifySignature = verifySignature;
// Complex Core Engine Simulation 
const ethers_1 = require("ethers");
class CoreEngine {
    constructor() { console.log('Engine initialized'); }
    async processTx(txId) { return true; }
}
exports.CoreEngine = CoreEngine;
/**
 * Verifies an Ethereum signature against a message and expected signer address.
 * Handles edge cases: empty/null message, empty/null signature, invalid signature format.
 * @returns true if the signature is valid and matches the expected address, false otherwise.
 */
function verifySignature(message, signature, expectedAddress) {
    if (!message || !signature || !expectedAddress)
        return false;
    if (signature.length < 132)
        return false; // Ethereum signatures are 65 bytes = 130 hex chars + '0x'
    try {
        const recovered = ethers_1.ethers.utils.verifyMessage(message, signature);
        return recovered.toLowerCase() === expectedAddress.toLowerCase();
    }
    catch {
        return false;
    }
}
