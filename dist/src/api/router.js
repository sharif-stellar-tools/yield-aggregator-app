"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// Complex API Router Simulation 
const engine_1 = require("../core/engine");
exports.router = {
    handle: (req) => {
        new engine_1.CoreEngine().processTx(req.id);
    }
};
