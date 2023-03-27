const { Level } = require("level");
import * as path from "path";
import * as md5 from "md5";
import * as deAsync from "deasync";
import * as utils from "./utils";
import * as tokenizer from "./tokenizer";
import { existsSync } from "fs";

function constructIndex(index) {
    return "0x001_" + index.toString();
}

function constructKey(key) {
    return "0x002_" + key.toString();
}

class Min {
    private optionsTable: { keyWeight: string; valueWeightCalc: string; defaultValueWeight: string; valueWeights: string };
    private compressOptionsTable: {};
    public tokenizer: { tokenize };
    public db: any;
    private docCount: number;
    constructor() {
        if (arguments.length > 0) {
            this.setDB(arguments[0], arguments[1]);
        }
        let obj = {
            keyWeight: "kw",
            valueWeightCalc: "vwc",
            defaultValueWeight: "dvw",
            valueWeights: "vw",
        };
        this.optionsTable = obj;

        this.compressOptionsTable = Object.keys(obj).reduce((prev, curr) => {
            prev[obj[curr]] = curr;
            return prev;
        }, {});
        this.tokenizer = tokenizer;
    }

    setDB(dbAddress, options) {
        try {
            options = options || {};
            if (!existsSync(dbAddress)) {
                if (!options["absoluteAddress"]) {
                    dbAddress = path.join(process.cwd(), dbAddress);
                }
            }
            this.db = new Level(dbAddress, options);
            let _this = this;
            let done = false;
            this.db.get("0x000_docCount", function (err, val) {
                if (!val && err && err.code === "LEVEL_NOT_FOUND") {
                    _this.docCount = 0;
                } else {
                    _this.docCount = parseInt(val) ? parseInt(val) : 0;
                }
                done = true;
            });
            /*
             *Covert the query of docCount from async to sync, to maintain its' consistency.
             */
            deAsync.loopWhile(() => {
                return !done;
            });
            console.log("Leveldb selected: " + dbAddress);
        } catch (e) {
            console.error("Leveldb setup failed at: " + dbAddress + " \nPlease check your dbAddress and options.");
            console.error(e);
        }
    }

    // Options -> a schema that contain the rules of token-frequency calculation.
    //        ["keyWeight"] -> the default weight of the tokens inside key
    //        ["valueWeightCalc"] -> if the token inside the value will be counted or not?
    //                                  True : False
    //        ["defaultValueWeight"] ->  the default weight of the tokens inside value
    //        ["valueWeights"] ->  The values for those spec key/index when the value is an Array/Object
    initOptions(options) {
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
    }

    compressOptions(options, decompress = false) {
        let res = {};
        let table = decompress ? this.compressOptionsTable : this.optionsTable;
        for (let key of Object.keys(options)) {
            if (key in table) res[table[key]] = options[key];
        }
        return res;
    }

    getTokens(key, value, options) {
        let tokens = {};
        let tempTokens = {};
        if (options["keyWeight"]) {
            // @ts-ignore
            let tempTokens = this.tokenizer.tokenize(key);
            // @ts-ignore
            utils.mergeTokens(tokens, tempTokens);
        }
        if (options["valueWeightCalc"]) {
            let defaultValueWeight = options["defaultValueWeight"] || 1;
            let valueWeights = options["valueWeights"] || {};
            if (utils.isString(value)) {
                tempTokens = this.tokenizer.tokenize(value);
                utils.mergeTokens(tokens, tempTokens, defaultValueWeight);
            } else if (utils.isObject(value)) {
                for (let key of Object.keys(value)) {
                    if (Reflect.has(valueWeights, key) || defaultValueWeight > 0) {
                        tempTokens = this.tokenizer.tokenize(value[key]);
                        let weight = Reflect.has(valueWeights, key) ? valueWeights[key] : defaultValueWeight;
                        utils.mergeTokens(tokens, tempTokens, weight);
                    }
                }
            } else if (utils.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    if (i in valueWeights || defaultValueWeight > 0) {
                        tempTokens = this.tokenizer.tokenize(value[i]);
                        let weight = i in valueWeights ? valueWeights[i] : defaultValueWeight;
                        utils.mergeTokens(tokens, tempTokens, weight);
                    }
                }
            } else if (utils.isNumber(value) || utils.isBoolean(value)) {
                try {
                    tokens[value.toString()] = defaultValueWeight;
                } catch (e) {
                    console.error(e);
                }
            }
        }
        return tokens;
    }

    searchIndex(token) {
        return new Promise((resolve, reject) => {
            this.db
                .get(constructIndex(token))
                .then((result) => {
                    resolve(JSON.parse(result));
                })
                .catch((e) => {
                    if (e.code === "LEVEL_NOT_FOUND") {
                        // v: {docId:tf,...}
                        resolve({
                            t: token,
                            l: 0,
                            v: "",
                        });
                    } else {
                        console.error("searchIndex", e);
                        reject(e);
                    }
                });
        });
    }

    async getDocCount() {
        return await this.db.get("0x000_docCount").catch((e) => {
            return e.code === "LEVEL_NOT_FOUND" ? 0 : false;
        });
    }

    static async indexesPreProcess(promise, docId, tokens, ops) {
        let obj = await promise;
        if (obj["v"].indexOf(docId) < 0) {
            obj["l"] += 1;
        }
        obj["v"] = utils.indexOperator.updateIndexValue(obj["v"], docId, tokens[obj["t"]]);
        let da = { type: "put", key: constructIndex(obj["t"]), value: utils.indexOperator.stringifyIndex(obj) };
        ops.push(da);
        return Promise.resolve(obj);
    }

    async create(key, value, options) {
        let docId = md5(key);
        this.docCount += 1;
        let tokens = this.getTokens(key, value, options);
        let promiseArr = [];
        let ops = [];
        for (let token of Object.keys(tokens)) {
            promiseArr.push(Min.indexesPreProcess(this.searchIndex(token), docId, tokens, ops));
        }
        ops = await Promise.all(promiseArr)
            .then((results) => {
                ops.push({
                    type: "put",
                    key: constructKey(docId),
                    value: JSON.stringify({
                        k: key,
                        v: value,
                        o: this.compressOptions(options),
                    }),
                });
                ops.push({ type: "put", key: "0x000_docCount", value: this.docCount.toString() });
                return ops;
            })
            .catch((e) => {
                console.error("Oops...The Create operation is interrupted by an internal error.");
                return e;
            });
        return new Promise((resolve, reject) => {
            if (ops instanceof Error) {
                this.docCount -= 1;
                reject(ops);
            }
            this.db
                .batch(ops)
                .then((info) => {
                    resolve("Put: " + key + " successfully.");
                })
                .catch((e) => {
                    this.docCount -= 1;
                    console.error(e);
                    console.error("Oops...The Create operation is interrupted by an internal error.");
                    reject(e);
                });
        });
    }

    async update(key, value, options, prev_obj) {
        let docId = md5(key);
        let tokens = this.getTokens(key, value, options);
        let prevTokens = this.getTokens(prev_obj["k"], prev_obj["v"], prev_obj["o"]);
        let diffTokens = utils.diffTokens(prevTokens, tokens);
        let promiseArr = [];
        for (let token of Object.keys(diffTokens)) {
            promiseArr.push(this.searchIndex(token));
        }
        tokens = diffTokens;
        let ops = await Promise.all(promiseArr)
            .then((results) => {
                let ops = [];
                for (let obj of results) {
                    //DEL:
                    if (tokens[obj["t"]] <= 0) {
                        obj["v"] = utils.indexOperator.updateIndexValue(obj["v"], docId, 0);
                        obj["l"] = utils.indexOperator.getIndexLength(obj["v"]);
                        //there is no other doc related to this index, delete it
                        if (obj["l"] === 0) {
                            ops.push({ type: "del", key: constructIndex(obj["t"]) });
                            continue;
                        }
                    } else {
                        //UPDATE
                        obj["v"] = utils.indexOperator.updateIndexValue(obj["v"], docId, tokens[obj["t"]]);
                        obj["l"] = utils.indexOperator.getIndexLength(obj["v"]);
                    }
                    // indexes
                    ops.push({ type: "put", key: constructIndex(obj["t"]), value: utils.indexOperator.stringifyIndex(obj) });
                }
                ops.push({
                    type: "put",
                    key: constructKey(docId),
                    value: JSON.stringify({
                        k: key,
                        v: value,
                        o: this.compressOptions(options),
                    }),
                });
                return ops;
            })
            .catch((e) => {
                console.error("Oops...The Create operation is interrupted by an internal error.");
                return e;
            });
        return new Promise((resolve, reject) => {
            if (ops instanceof Error) {
                reject(ops);
            }
            this.db
                .batch(ops)
                .then((info) => {
                    resolve("Put: " + key + " successfully.");
                })
                .catch((e) => {
                    console.error(e);
                    console.error("Oops...The Create operation is interrupted by an internal error.");
                    reject(e);
                });
        });
    }

    async put(key, value, options) {
        let docId = md5(key);
        let docCount = this.docCount;
        if (!docCount && docCount !== 0) {
            console.error("There are some internal errors inside the db about the docs' count, the PUT operation failed.");
            console.error("Try this.fixDocCount()");
            return Promise.reject(false);
        }
        let obj = await this.db.get(constructKey(docId)).catch((e) => {
            if (e.code === "LEVEL_NOT_FOUND") {
                return false;
            }
        });
        options = this.initOptions(options);
        try {
            if (!obj) {
                return await this.create(key, value, options);
            } else {
                obj = JSON.parse(obj);
                obj["o"] = this.compressOptions(obj["o"], true);
                if (key === obj["k"] && value === obj["v"] && options === obj["o"]) {
                    return true;
                } else {
                    return await this.update(key, value, options, obj);
                }
            }
        } catch (e) {
            return e;
        }
    }

    static getDocId(key) {
        return md5(key);
    }

    // just update the value inside without re-index
    // It is a very dangerous operation: some indexes may remain till the world's end.
    async cleanUpdate(key, value) {
        let docId = md5(key);
        let obj = await this.db.get(constructKey(docId)).catch((e) => {
            if (e.code === "LEVEL_NOT_FOUND") {
                return false;
            }
        });
        if (!obj) return Promise.reject(key.toString() + " is not exist inside the db.");
        try {
            obj = JSON.parse(obj);
            return await this.db.put(constructKey(docId), JSON.stringify(obj));
        } catch (e) {
            return e;
        }
    }

    async del(key) {
        let docId = md5(key);
        let docCount = this.docCount;
        if (!docCount && docCount !== 0) {
            console.error("There are some internal errors inside the db about the docs' count, the DEL operation failed.");
            console.error("Try this.fixDocCount()");
            return Promise.reject(false);
        }
        let obj = await this.db.get(constructKey(docId)).catch((e) => {
            if (e.code === "LEVEL_NOT_FOUND") {
                return false;
            }
        });
        try {
            if (!obj) {
                return Promise.resolve("The input key is not exist.");
            } else {
                obj = JSON.parse(obj);
                this.docCount -= 1;
                let value = obj["v"];
                let options = obj["o"];
                let tokens = this.getTokens(key, value, options);
                let promiseArr = [];
                for (let token of Object.keys(tokens)) {
                    promiseArr.push(this.searchIndex(token));
                }
                let ops = await Promise.all(promiseArr)
                    .then((results) => {
                        let ops = [];
                        for (let obj of results) {
                            //DEL:
                            obj["v"] = utils.indexOperator.updateIndexValue(obj["v"], docId, 0);
                            obj["l"] = utils.indexOperator.getIndexLength(obj["v"]);
                            //there is no other doc related to this index, delete it
                            if (obj["l"] === 0) {
                                ops.push({ type: "del", key: constructIndex(obj["t"]) });
                            } else {
                                ops.push({ type: "put", key: constructIndex(obj["t"]), value: utils.indexOperator.stringifyIndex(obj) });
                            }
                        }
                        ops.push({ type: "del", key: constructKey(docId) });
                        ops.push({ type: "put", key: "0x000_docCount", value: this.docCount.toString() });
                        return ops;
                    })
                    .catch((e) => {
                        console.error("Oops...The Delete operation is interrupted by an internal error.");
                        return e;
                    });
                return new Promise((resolve, reject) => {
                    if (ops instanceof Error) {
                        this.docCount += 1;
                        reject(ops);
                    }
                    this.db
                        .batch(ops)
                        .then((info) => {
                            resolve("Del: " + key + " successfully.");
                        })
                        .catch((e) => {
                            this.docCount += 1;
                            console.error(e);
                            console.error("Oops...The Delete operation is interrupted by an internal error.");
                            reject(e);
                        });
                });
            }
        } catch (e) {
            return e;
        }
    }

    // Hash : True -> The input key is the md5 docId of the key.
    // Hash : False -> The origin key was input.
    async get(key, hash = false) {
        let docId = hash ? key : md5(key);
        let obj = await this.db.get(constructKey(docId)).catch((e) => {
            return e;
        });
        if (obj instanceof Error) return Promise.reject(obj);
        try {
            obj = JSON.parse(obj);
            return {
                key: obj["k"],
                docId: docId,
                value: obj["v"],
                options: this.compressOptions(obj["o"], true),
            };
        } catch (e) {
            console.error("Oops...The Get operation is interrupted by an internal error.");
            return e;
        }
    }

    // only focus on the value related to the key
    async cleanGet(key, hash = false) {
        let docId = hash ? key : md5(key);
        let obj = await this.db.get(constructKey(docId)).catch((e) => {
            return e;
        });
        if (obj instanceof Error) return Promise.reject(obj);
        try {
            obj = JSON.parse(obj);
            return obj["v"];
        } catch (e) {
            console.error("Oops...The Get operation is interrupted by an internal error.");
            return e;
        }
    }

    static async calTfIdf(promise, docCount, docs) {
        let result = await promise;
        let len = result["l"];
        if (len === 0) return Promise.resolve(0);
        let idf = 1 + Math.log(docCount / (1 + len));
        let tfs = result["v"];
        for (let item of tfs.split(",")) {
            let pair = item.split(":");
            let docId = pair[0], tf = pair[1];
            let tf_norm = 1 + Math.log1p(tf);
            console.log(result, tf, tf_norm, idf)
            docId in docs ? (docs[docId] += idf * tf_norm) : (docs[docId] = idf * tf_norm);
        }
        return Promise.resolve(docs);
    }

    //Search the content by tf-idf & cosine-similarity.
    async search(content, ops) {
        let tokens = this.tokenizer.tokenize(content);
        let promiseArr = [];
        // set cosineSimilarity to false to speed up the search operation.
        let options = ops || { cosineSimilarity: false };
        let limit = options["limit"] || 0;
        let docs = {};
        let docCount = await this.getDocCount();
        for (let token in tokens) {
            promiseArr.push(Min.calTfIdf(this.searchIndex(token), docCount, docs));
        }
        let results = await Promise.all(promiseArr)
            .then(async (res) => {
                docs = utils.sortByValue(docs);
                promiseArr = [];
                for (let docId in docs) {
                    promiseArr.push(this.get(docId, true));
                }
                return await Promise.all(promiseArr).then((res) => {
                    for (let obj of res) {
                        obj["score"] = docs[obj["docId"]];
                        // simply apply cosine-similarity
                        if (options["cosineSimilarity"]) {
                            let resTokens = this.getTokens(obj["key"], obj["value"], obj["options"]);
                            let cosValue = 0.01 + Math.abs(utils.cosineSimilarity(tokens, resTokens));
                            obj["score"] = Math.sqrt(cosValue) * obj["score"];
                        }
                    }
                    let final = res.sort((a, b) => {
                        return b["score"] - a["score"];
                    });
                    if (limit && limit < final.length) final = final.slice(0, limit - 1);
                    return final;
                });
            })
            .catch((e) => {
                return e;
            });
        if (results instanceof Error) {
            return Promise.reject(results);
        } else {
            return Promise.resolve(results);
        }
    }

    async printAll() {
        for await (const data of this.db.iterator()) {
            console.log(data);
        }
    }

    async fixDocCount() {
        let docCount = 0;
        let pattern = /^0x002_/;
        let db = this.db;
        for await (const key of db.keys({ lte: "0x003_", gte: "0x002_" })) {
            if (pattern.test(key)) docCount++;
        }
    }
}

module.exports = Min;
