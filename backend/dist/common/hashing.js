"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createId = void 0;
const crypto_1 = require("crypto");
const createId = (s) => (0, crypto_1.createHash)('sha1').update(s).digest('hex').slice(0, 24);
exports.createId = createId;
//# sourceMappingURL=hashing.js.map