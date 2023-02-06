"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SRE = require("speech-rule-engine");
global.SRE = SRE;
global.sre = Object.create(SRE);
global.sre.Engine = {
    isReady: function () {
        return SRE.engineReady();
    }
};
//# sourceMappingURL=sre-node.js.map