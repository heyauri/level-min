"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const tokenizer = require("./tokenizer");
class ConfigManager {
    constructor() {
        this.options = {};
        this.compressedOptions = "";
        this.tokens = [];
    }
    initOptions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.options = options || {};
            this.compressedOptions = yield this.compressOptions(this.options);
            this.tokens = yield this.getTokens(this.compressedOptions);
        });
    }
    compressOptions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options)
                return "";
            return JSON.stringify(options);
        });
    }
    getTokens(compressedOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!compressedOptions)
                return [];
            try {
                const tokens = yield tokenizer.tokenize(compressedOptions);
                return tokens;
            }
            catch (error) {
                console.error("Token generation failed:", error);
                return [];
            }
        });
    }
    getOptions() {
        return this.options;
    }
    getCompressedOptions() {
        return this.compressedOptions;
    }
    getTokensList() {
        return this.tokens;
    }
    updateOptions(newOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            this.options = Object.assign(Object.assign({}, this.options), newOptions);
            this.compressedOptions = yield this.compressOptions(this.options);
            this.tokens = yield this.getTokens(this.compressedOptions);
        });
    }
    resetOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            this.options = {};
            this.compressedOptions = "";
            this.tokens = [];
        });
    }
}
exports.ConfigManager = ConfigManager;
