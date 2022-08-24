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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var Level = require("level").Level;
var path = require("path");
var md5 = require("md5");
var deAsync = require("deasync");
var utils = require("./utils");
var tokenizer = require("./tokenizer");
var fs_1 = require("fs");
function constructIndex(index) {
    return "0x001_" + index.toString();
}
function constructKey(key) {
    return "0x002_" + key.toString();
}
var Min = (function () {
    function Min() {
        if (arguments.length > 0) {
            this.setDB(arguments[0], arguments[1]);
        }
        var obj = {
            keyWeight: "kw",
            valueWeightCalc: "vwc",
            defaultValueWeight: "dvw",
            valueWeights: "vw",
        };
        this.optionsTable = obj;
        this.compressOptionsTable = Object.keys(obj).reduce(function (prev, curr) {
            prev[obj[curr]] = curr;
            return prev;
        }, {});
        this.tokenizer = tokenizer;
    }
    Min.prototype.setDB = function (dbAddress, options) {
        try {
            if (!fs_1.existsSync(dbAddress)) {
                dbAddress = path.join(process.cwd(), dbAddress);
            }
            options = options || {};
            this.db = new Level(dbAddress, options);
            var _this_1 = this;
            var done_1 = false;
            this.db.get("0x000_docCount", function (err, val) {
                if (!val && err && err.code === "LEVEL_NOT_FOUND") {
                    _this_1.docCount = 0;
                }
                else {
                    _this_1.docCount = parseInt(val) ? parseInt(val) : 0;
                }
                done_1 = true;
            });
            deAsync.loopWhile(function () {
                return !done_1;
            });
            console.log("Leveldb selected: " + dbAddress);
        }
        catch (e) {
            console.error("Leveldb setup failed at: " + dbAddress + " \nPlease check your dbAddress and options.");
            console.error(e);
        }
    };
    Min.prototype.initOptions = function (options) {
        if (!options || !utils.isObject(options)) {
            options = {};
        }
        if ("keyWeight" in options && !utils.isNumber(options["keyWeight"])) {
            options["keyWeight"] = 1;
        }
        if ("defaultValueWeight" in options && !utils.isNumber(options["defaultValueWeight"])) {
            options["defaultValueWeight"] = 1;
        }
        if ("valueWeights" in options && !utils.isObject(options["valueWeights"])) {
            options["valueWeights"] = {};
        }
        return options;
    };
    Min.prototype.compressOptions = function (options, decompress) {
        if (decompress === void 0) { decompress = false; }
        var res = {};
        var table = decompress ? this.compressOptionsTable : this.optionsTable;
        for (var _i = 0, _a = Object.keys(options); _i < _a.length; _i++) {
            var key = _a[_i];
            if (key in table)
                res[table[key]] = options[key];
        }
        return res;
    };
    Min.prototype.getTokens = function (key, value, options) {
        var tokens = {};
        var tempTokens = {};
        if (options["keyWeight"]) {
            var tempTokens_1 = this.tokenizer.tokenize(key);
            utils.mergeTokens(tokens, tempTokens_1);
        }
        if (options["valueWeightCalc"]) {
            var defaultValueWeight = options["defaultValueWeight"] || 1;
            var valueWeights = options["valueWeights"] || {};
            if (utils.isString(value)) {
                tempTokens = this.tokenizer.tokenize(value);
                utils.mergeTokens(tokens, tempTokens, defaultValueWeight);
            }
            else if (utils.isObject(value)) {
                for (var _i = 0, _a = Object.keys(value); _i < _a.length; _i++) {
                    var key_1 = _a[_i];
                    if (Reflect.has(valueWeights, key_1) || defaultValueWeight > 0) {
                        tempTokens = this.tokenizer.tokenize(value[key_1]);
                        var weight = Reflect.has(valueWeights, key_1) ? valueWeights[key_1] : defaultValueWeight;
                        utils.mergeTokens(tokens, tempTokens, weight);
                    }
                }
            }
            else if (utils.isArray(value)) {
                for (var i = 0; i < value.length; i++) {
                    if (i in valueWeights || defaultValueWeight > 0) {
                        tempTokens = this.tokenizer.tokenize(value[i]);
                        var weight = i in valueWeights ? valueWeights[i] : defaultValueWeight;
                        utils.mergeTokens(tokens, tempTokens, weight);
                    }
                }
            }
            else if (utils.isNumber(value) || utils.isBoolean(value)) {
                try {
                    tokens[value.toString()] = defaultValueWeight;
                }
                catch (e) {
                    console.error(e);
                }
            }
        }
        return tokens;
    };
    Min.prototype.searchIndex = function (token) {
        var _this_1 = this;
        return new Promise(function (resolve, reject) {
            _this_1.db
                .get(constructIndex(token))
                .then(function (result) {
                resolve(JSON.parse(result));
            })
                .catch(function (e) {
                if (e.code === "LEVEL_NOT_FOUND") {
                    resolve({
                        t: token,
                        l: 0,
                        v: {},
                    });
                }
                else {
                    console.error("searchIndex", e);
                    reject(e);
                }
            });
        });
    };
    Min.prototype.getDocCount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.db.get("0x000_docCount").catch(function (e) {
                            return e.code === "LEVEL_NOT_FOUND" ? 0 : false;
                        })];
                    case 1: return [2, _a.sent()];
                }
            });
        });
    };
    Min.prototype.create = function (key, value, options) {
        return __awaiter(this, void 0, void 0, function () {
            var docId, tokens, promiseArr, _i, _a, token, ops;
            var _this_1 = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        docId = md5(key);
                        this.docCount += 1;
                        tokens = this.getTokens(key, value, options);
                        promiseArr = [];
                        for (_i = 0, _a = Object.keys(tokens); _i < _a.length; _i++) {
                            token = _a[_i];
                            promiseArr.push(this.searchIndex(token));
                        }
                        return [4, Promise.all(promiseArr)
                                .then(function (results) {
                                var ops = [];
                                for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
                                    var obj = results_1[_i];
                                    if (!(docId in obj["v"])) {
                                        obj["l"] += 1;
                                    }
                                    obj["v"][docId] = tokens[obj["t"]];
                                    ops.push({ type: "put", key: constructIndex(obj["t"]), value: JSON.stringify(obj) });
                                }
                                ops.push({
                                    type: "put",
                                    key: constructKey(docId),
                                    value: JSON.stringify({
                                        k: key,
                                        v: value,
                                        o: _this_1.compressOptions(options),
                                    }),
                                });
                                ops.push({ type: "put", key: "0x000_docCount", value: _this_1.docCount.toString() });
                                return ops;
                            })
                                .catch(function (e) {
                                console.error("Oops...The Create operation is interrupted by an internal error.");
                                return e;
                            })];
                    case 1:
                        ops = _b.sent();
                        return [2, new Promise(function (resolve, reject) {
                                if (ops instanceof Error) {
                                    _this_1.docCount -= 1;
                                    reject(ops);
                                }
                                _this_1.db
                                    .batch(ops)
                                    .then(function (info) {
                                    resolve("Put: " + key + " successfully.");
                                })
                                    .catch(function (e) {
                                    _this_1.docCount -= 1;
                                    console.error(e);
                                    console.error("Oops...The Create operation is interrupted by an internal error.");
                                    reject(e);
                                });
                            })];
                }
            });
        });
    };
    Min.prototype.update = function (key, value, options, prev_obj) {
        return __awaiter(this, void 0, void 0, function () {
            var docId, tokens, prevTokens, diffTokens, promiseArr, _i, _a, token, ops;
            var _this_1 = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        docId = md5(key);
                        tokens = this.getTokens(key, value, options);
                        prevTokens = this.getTokens(prev_obj["k"], prev_obj["v"], prev_obj["o"]);
                        diffTokens = utils.diffTokens(prevTokens, tokens);
                        promiseArr = [];
                        for (_i = 0, _a = Object.keys(diffTokens); _i < _a.length; _i++) {
                            token = _a[_i];
                            promiseArr.push(this.searchIndex(token));
                        }
                        tokens = diffTokens;
                        return [4, Promise.all(promiseArr)
                                .then(function (results) {
                                var ops = [];
                                for (var _i = 0, results_2 = results; _i < results_2.length; _i++) {
                                    var obj = results_2[_i];
                                    if (tokens[obj["t"]] <= 0) {
                                        delete obj["v"][docId];
                                        obj["l"] = Object.keys(obj["v"]).length;
                                        if (obj["l"] === 0) {
                                            ops.push({ type: "del", key: constructIndex(obj["t"]) });
                                            continue;
                                        }
                                    }
                                    else {
                                        if (!(docId in obj["v"])) {
                                            obj["l"] += 1;
                                        }
                                        obj["v"][docId] = tokens[obj["t"]];
                                    }
                                    ops.push({ type: "put", key: constructIndex(obj["t"]), value: JSON.stringify(obj) });
                                }
                                ops.push({
                                    type: "put",
                                    key: constructKey(docId),
                                    value: JSON.stringify({
                                        k: key,
                                        v: value,
                                        o: _this_1.compressOptions(options),
                                    }),
                                });
                                return ops;
                            })
                                .catch(function (e) {
                                console.error("Oops...The Create operation is interrupted by an internal error.");
                                return e;
                            })];
                    case 1:
                        ops = _b.sent();
                        return [2, new Promise(function (resolve, reject) {
                                if (ops instanceof Error) {
                                    reject(ops);
                                }
                                _this_1.db
                                    .batch(ops)
                                    .then(function (info) {
                                    resolve("Put: " + key + " successfully.");
                                })
                                    .catch(function (e) {
                                    console.error(e);
                                    console.error("Oops...The Create operation is interrupted by an internal error.");
                                    reject(e);
                                });
                            })];
                }
            });
        });
    };
    Min.prototype.put = function (key, value, options) {
        return __awaiter(this, void 0, void 0, function () {
            var docId, docCount, obj, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        docId = md5(key);
                        docCount = this.docCount;
                        if (!docCount && docCount !== 0) {
                            console.error("There are some internal errors inside the db about the docs' count, the PUT operation failed.");
                            console.error("Try this.fixDocCount()");
                            return [2, Promise.reject(false)];
                        }
                        return [4, this.db.get(constructKey(docId)).catch(function (e) {
                                if (e.code === "LEVEL_NOT_FOUND") {
                                    return false;
                                }
                            })];
                    case 1:
                        obj = _a.sent();
                        options = this.initOptions(options);
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 8, , 9]);
                        if (!!obj) return [3, 4];
                        return [4, this.create(key, value, options)];
                    case 3: return [2, _a.sent()];
                    case 4:
                        obj = JSON.parse(obj);
                        if (!(key === obj["k"] && value === obj["v"] && options === obj["o"])) return [3, 5];
                        return [2, true];
                    case 5: return [4, this.update(key, value, options, obj)];
                    case 6: return [2, _a.sent()];
                    case 7: return [3, 9];
                    case 8:
                        e_1 = _a.sent();
                        return [2, e_1];
                    case 9: return [2];
                }
            });
        });
    };
    Min.getDocId = function (key) {
        return md5(key);
    };
    Min.prototype.cleanUpdate = function (key, value) {
        return __awaiter(this, void 0, void 0, function () {
            var docId, obj, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        docId = md5(key);
                        return [4, this.db.get(constructKey(docId)).catch(function (e) {
                                if (e.code === "LEVEL_NOT_FOUND") {
                                    return false;
                                }
                            })];
                    case 1:
                        obj = _a.sent();
                        if (!obj)
                            return [2, Promise.reject(key.toString() + " is not exist inside the db.")];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        obj = JSON.parse(obj);
                        return [4, this.db.put(constructKey(docId), JSON.stringify(obj))];
                    case 3: return [2, _a.sent()];
                    case 4:
                        e_2 = _a.sent();
                        return [2, e_2];
                    case 5: return [2];
                }
            });
        });
    };
    Min.prototype.del = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var docId, docCount, obj, value, options, tokens, promiseArr, _i, _a, token, ops_1, e_3;
            var _this_1 = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        docId = md5(key);
                        docCount = this.docCount;
                        if (!docCount && docCount !== 0) {
                            console.error("There are some internal errors inside the db about the docs' count, the DEL operation failed.");
                            console.error("Try this.fixDocCount()");
                            return [2, Promise.reject(false)];
                        }
                        return [4, this.db.get(constructKey(docId)).catch(function (e) {
                                if (e.code === "LEVEL_NOT_FOUND") {
                                    return false;
                                }
                            })];
                    case 1:
                        obj = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 6, , 7]);
                        if (!!obj) return [3, 3];
                        return [2, Promise.resolve("The input key is not exist.")];
                    case 3:
                        obj = JSON.parse(obj);
                        this.docCount -= 1;
                        value = obj["v"];
                        options = obj["o"];
                        tokens = this.getTokens(key, value, options);
                        promiseArr = [];
                        for (_i = 0, _a = Object.keys(tokens); _i < _a.length; _i++) {
                            token = _a[_i];
                            promiseArr.push(this.searchIndex(token));
                        }
                        return [4, Promise.all(promiseArr)
                                .then(function (results) {
                                var ops = [];
                                for (var _i = 0, results_3 = results; _i < results_3.length; _i++) {
                                    var obj_1 = results_3[_i];
                                    delete obj_1["v"][docId];
                                    obj_1["l"] = Object.keys(obj_1["v"]).length;
                                    if (obj_1["l"] === 0) {
                                        ops.push({ type: "del", key: constructIndex(obj_1["t"]) });
                                    }
                                    else {
                                        ops.push({ type: "put", key: constructIndex(obj_1["t"]), value: JSON.stringify(obj_1) });
                                    }
                                }
                                ops.push({ type: "del", key: constructKey(docId) });
                                ops.push({ type: "put", key: "0x000_docCount", value: _this_1.docCount.toString() });
                                return ops;
                            })
                                .catch(function (e) {
                                console.error("Oops...The Delete operation is interrupted by an internal error.");
                                return e;
                            })];
                    case 4:
                        ops_1 = _b.sent();
                        return [2, new Promise(function (resolve, reject) {
                                if (ops_1 instanceof Error) {
                                    _this_1.docCount += 1;
                                    reject(ops_1);
                                }
                                _this_1.db
                                    .batch(ops_1)
                                    .then(function (info) {
                                    resolve("Del: " + key + " successfully.");
                                })
                                    .catch(function (e) {
                                    _this_1.docCount += 1;
                                    console.error(e);
                                    console.error("Oops...The Delete operation is interrupted by an internal error.");
                                    reject(e);
                                });
                            })];
                    case 5: return [3, 7];
                    case 6:
                        e_3 = _b.sent();
                        return [2, e_3];
                    case 7: return [2];
                }
            });
        });
    };
    Min.prototype.get = function (key, hash) {
        if (hash === void 0) { hash = false; }
        return __awaiter(this, void 0, void 0, function () {
            var docId, obj;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        docId = hash ? key : md5(key);
                        return [4, this.db.get(constructKey(docId)).catch(function (e) {
                                return e;
                            })];
                    case 1:
                        obj = _a.sent();
                        if (obj instanceof Error)
                            return [2, Promise.reject(obj)];
                        try {
                            obj = JSON.parse(obj);
                            return [2, {
                                    key: obj["k"],
                                    docId: docId,
                                    value: obj["v"],
                                    options: this.compressOptions(obj["o"], true),
                                }];
                        }
                        catch (e) {
                            console.error("Oops...The Get operation is interrupted by an internal error.");
                            return [2, e];
                        }
                        return [2];
                }
            });
        });
    };
    Min.prototype.cleanGet = function (key, hash) {
        if (hash === void 0) { hash = false; }
        return __awaiter(this, void 0, void 0, function () {
            var docId, obj;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        docId = hash ? key : md5(key);
                        return [4, this.db.get(constructKey(docId)).catch(function (e) {
                                return e;
                            })];
                    case 1:
                        obj = _a.sent();
                        if (obj instanceof Error)
                            return [2, Promise.reject(obj)];
                        try {
                            obj = JSON.parse(obj);
                            return [2, obj["v"]];
                        }
                        catch (e) {
                            console.error("Oops...The Get operation is interrupted by an internal error.");
                            return [2, e];
                        }
                        return [2];
                }
            });
        });
    };
    Min.prototype.search = function (content, ops) {
        return __awaiter(this, void 0, void 0, function () {
            var tokens, promiseArr, options, topK, _i, _a, token, docCount, results;
            var _this_1 = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        tokens = this.tokenizer.tokenize(content);
                        promiseArr = [];
                        options = ops || { cosineSimilarity: true };
                        topK = options["topK"] || 0;
                        for (_i = 0, _a = Object.keys(tokens); _i < _a.length; _i++) {
                            token = _a[_i];
                            promiseArr.push(this.searchIndex(token));
                        }
                        return [4, this.getDocCount()];
                    case 1:
                        docCount = _b.sent();
                        return [4, Promise.all(promiseArr)
                                .then(function (results) { return __awaiter(_this_1, void 0, void 0, function () {
                                var docs, _i, results_4, result, len, idf, tfs, _a, _b, docId, tf_norm, docIds, _c, docIds_1, docId;
                                var _this_1 = this;
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0:
                                            docs = {};
                                            for (_i = 0, results_4 = results; _i < results_4.length; _i++) {
                                                result = results_4[_i];
                                                len = result["l"];
                                                if (len === 0)
                                                    continue;
                                                idf = 1 + Math.log(docCount / (1 + len));
                                                tfs = result["v"];
                                                for (_a = 0, _b = Object.keys(tfs); _a < _b.length; _a++) {
                                                    docId = _b[_a];
                                                    tf_norm = 1 + Math.log(1 + Math.log(tfs[docId]));
                                                    docId in docs ? (docs[docId] += idf * tf_norm) : (docs[docId] = idf * tf_norm);
                                                }
                                            }
                                            docs = utils.sortByValue(docs);
                                            docIds = Object.keys(docs);
                                            if (topK && topK < docIds.length)
                                                docIds = docIds.slice(0, topK - 1);
                                            promiseArr = [];
                                            for (_c = 0, docIds_1 = docIds; _c < docIds_1.length; _c++) {
                                                docId = docIds_1[_c];
                                                promiseArr.push(this.get(docId, true));
                                            }
                                            return [4, Promise.all(promiseArr).then(function (res) {
                                                    for (var _i = 0, res_1 = res; _i < res_1.length; _i++) {
                                                        var obj = res_1[_i];
                                                        obj["score"] = docs[obj["docId"]];
                                                        if (options["cosineSimilarity"]) {
                                                            var resTokens = _this_1.getTokens(obj["key"], obj["value"], obj["options"]);
                                                            var cosValue = Math.abs(utils.cosineSimilarity(tokens, resTokens));
                                                            obj["score"] = Math.sqrt(cosValue) * obj["score"];
                                                        }
                                                    }
                                                    return res.sort(function (a, b) {
                                                        return b["score"] - a["score"];
                                                    });
                                                })];
                                        case 1: return [2, _d.sent()];
                                    }
                                });
                            }); })
                                .catch(function (e) {
                                return e;
                            })];
                    case 2:
                        results = _b.sent();
                        if (results instanceof Error) {
                            return [2, Promise.reject(results)];
                        }
                        else {
                            return [2, Promise.resolve(results)];
                        }
                        return [2];
                }
            });
        });
    };
    Min.prototype.printAll = function () {
        var e_4, _a;
        return __awaiter(this, void 0, void 0, function () {
            var _b, _c, data, e_4_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 5, 6, 11]);
                        _b = __asyncValues(this.db.iterator());
                        _d.label = 1;
                    case 1: return [4, _b.next()];
                    case 2:
                        if (!(_c = _d.sent(), !_c.done)) return [3, 4];
                        data = _c.value;
                        console.log(data);
                        _d.label = 3;
                    case 3: return [3, 1];
                    case 4: return [3, 11];
                    case 5:
                        e_4_1 = _d.sent();
                        e_4 = { error: e_4_1 };
                        return [3, 11];
                    case 6:
                        _d.trys.push([6, , 9, 10]);
                        if (!(_c && !_c.done && (_a = _b.return))) return [3, 8];
                        return [4, _a.call(_b)];
                    case 7:
                        _d.sent();
                        _d.label = 8;
                    case 8: return [3, 10];
                    case 9:
                        if (e_4) throw e_4.error;
                        return [7];
                    case 10: return [7];
                    case 11: return [2];
                }
            });
        });
    };
    Min.prototype.fixDocCount = function () {
        var e_5, _a;
        return __awaiter(this, void 0, void 0, function () {
            var docCount, pattern, db, _b, _c, key, e_5_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        docCount = 0;
                        pattern = /^0x002_/;
                        db = this.db;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 6, 7, 12]);
                        _b = __asyncValues(db.keys({ lte: "0x003_" }));
                        _d.label = 2;
                    case 2: return [4, _b.next()];
                    case 3:
                        if (!(_c = _d.sent(), !_c.done)) return [3, 5];
                        key = _c.value;
                        if (pattern.test(key))
                            docCount++;
                        _d.label = 4;
                    case 4: return [3, 2];
                    case 5: return [3, 12];
                    case 6:
                        e_5_1 = _d.sent();
                        e_5 = { error: e_5_1 };
                        return [3, 12];
                    case 7:
                        _d.trys.push([7, , 10, 11]);
                        if (!(_c && !_c.done && (_a = _b.return))) return [3, 9];
                        return [4, _a.call(_b)];
                    case 8:
                        _d.sent();
                        _d.label = 9;
                    case 9: return [3, 11];
                    case 10:
                        if (e_5) throw e_5.error;
                        return [7];
                    case 11: return [7];
                    case 12: return [2];
                }
            });
        });
    };
    return Min;
}());
module.exports = Min;
