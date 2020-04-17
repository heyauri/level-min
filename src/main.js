import Level from "level"
import path from "path"
import md5 from "md5"
import deAsync from "deasync"
import * as utils from "./utils.js"
import * as tokenizer from "./tokenizer.js"

function constructIndex(index) {
    return "0x001_" + index.toString();
}

function constructKey(key) {
    return "0x002_" + key.toString();
}

class Min {
    constructor() {
        if (arguments.length > 0) {
            this.setDB(arguments[0], arguments[1]);
        }
        let obj= this.optionsTable={
            keyWeight:"kw",
            valueWeightCalc:"vwc",
            defaultValueWeight:"dvw",
            valueWeights:"vw",
        };
        this.compressOptionsTable = Object.keys(obj).reduce((prev,curr)=>{
            prev[obj[curr]]=curr;
            return prev;
        },{});
        this.tokenizer = tokenizer;
    }

    setDB(dbAddress, options) {
        try {
            if (dbAddress.indexOf("/") < 0 && dbAddress.indexOf("\\") < 0) {
                dbAddress = path.join(process.cwd(), dbAddress);
            }
            options = options || {};
            this.db = Level(dbAddress, options);
            let _this = this;
            let done = false;
            this.db.get("0x000_docCount", function (err, val) {
                if (!val && err) {
                    if (err.type === "NotFoundError") {
                        _this.docCount = 0;
                    } else {
                        throw err;
                    }
                } else {
                    _this.docCount = parseInt(val) ? parseInt(val) : 0;
                }
                done = true;
            });
            /*
              Covert the query of docCount from async to sync, to maintain its' consistency.
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
        if (("keyWeight" in options) && !utils.isNumber(options["keyWeight"])) {
            options["keyWeight"] = 1;
        }
        if (("defaultValueWeight" in options) && !utils.isNumber(options["defaultValueWeight"])) {
            options["defaultValueWeight"] = 1;
        }
        if (("valueWeights" in options) && !utils.isObject(options["valueWeights"])) {
            options["valueWeights"] = {};
        }
        return options;
    }

    compressOptions(options,decompress=false){
        let res={};
        let table = decompress? this.compressOptionsTable :this.optionsTable;
        for(let key of Object.keys(options)){
            if(key in table) res[table[key]] = options[key];
        }
        return res;
    }


    getTokens(key, value, options) {
        let tokens = {};
        let tempTokens = {};
        if (options["keyWeight"]) {
            let tempTokens = this.tokenizer.tokenize(key);
            utils.mergeTokens(tokens, tempTokens);
        }
        if (options["valueWeightCalc"]) {
            let defaultValueWeight = options["defaultValueWeight"];
            let valueWeights = options["valueWeights"];
            if (utils.isString(value)) {
                tempTokens = this.tokenizer.tokenize(value);
                utils.mergeTokens(tokens, tempTokens, defaultValueWeight);
            } else if (utils.isObject(value)) {
                for (let key of Object.keys(value)) {
                    if (key in valueWeights || defaultValueWeight > 0) {
                        tempTokens = this.tokenizer.tokenize(value[key]);
                        let weight = key in valueWeights ? valueWeights[key] : defaultValueWeight;
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
            } else if (utils.isNumber(value) || utils.isBoolean(value)){
                try {
                    tokens[value.toString()]= defaultValueWeight;
                }catch (e) {
                    console.error(e);
                }
            }
        }
        return tokens;
    }

    searchIndex(token) {
        return new Promise((resolve, reject) => {
            this.db.get(constructIndex(token)).then(result => {
                resolve(JSON.parse(result));
            }).catch(e => {
                if (e.type === "NotFoundError") {
                    // v: {docId:tf,...}
                    resolve({
                        t: token,
                        l: 0,
                        v: {}
                    });
                } else {
                    console.error(e);
                    reject(e);
                }
            });
        });
    }

    async getDocCount() {
        return await this.db.get("0x000_docCount").catch(e => {
            return e.type === "NotFoundError" ? 0 : false;
        })
    }

    async create(key, value, options) {
        let docId = md5(key);
        this.docCount += 1;
        let tokens = this.getTokens(key, value, options);
        let promiseArr = [];
        for (let token of Object.keys(tokens)) {
            promiseArr.push(this.searchIndex(token));
        }
        let ops = await Promise.all(promiseArr).then((results) => {
            let ops = [];
            for (let obj of results) {
                if (!(docId in obj["v"])) {
                    obj["l"] += 1;
                }
                obj["v"][docId] = tokens[obj["t"]];
                ops.push({type: "put", key: constructIndex(obj["t"]), value: JSON.stringify(obj)});
            }
            ops.push({
                type: "put",
                key: constructKey(docId),
                value: JSON.stringify({k: key, v: JSON.stringify(value), o: JSON.stringify(this.compressOptions(options))})
            });
            ops.push({type: "put", key: "0x000_docCount", value: (this.docCount).toString()});
            return ops;
        }).catch(e => {
            console.error("Oops...The Create operation is interrupted by an internal error.");
            return e;
        });
        return new Promise((resolve, reject) => {
            if (ops instanceof Error) {
                this.docCount -= 1;
                reject(ops);
            }
            this.db.batch(ops).then(info => {
                resolve("Put: " + key + " successfully.");
            }).catch(e => {
                this.docCount -= 1;
                console.error(e);
                console.error("Oops...The Create operation is interrupted by an internal error.");
                reject(e);
            })
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
        let ops = await Promise.all(promiseArr).then((results) => {
            let ops = [];
            for (let obj of results) {
                //DEL:
                if (tokens[obj["t"]] <= 0) {
                    delete obj["v"][docId];
                    obj["l"] = Object.keys(obj["v"]).length;
                    //there is no other doc related to this index, delete it
                    if (obj["l"] === 0) {
                        ops.push({type: "del", key: constructIndex(obj["t"])});
                        continue;
                    }
                } else {
                    //UPDATE
                    if (!(docId in obj["v"])) {
                        obj["l"] += 1;
                    }
                    obj["v"][docId] = tokens[obj["t"]];
                }
                ops.push({type: "put", key: constructIndex(obj["t"]), value: JSON.stringify(obj)});
            }

            ops.push({
                type: "put",
                key: constructKey(docId),
                value: JSON.stringify({k: key, v: JSON.stringify(value), o: JSON.stringify(this.compressOptions(options))})
            });
            return ops;
        }).catch(e => {
            console.error("Oops...The Create operation is interrupted by an internal error.");
            return e;
        });
        return new Promise((resolve, reject) => {
            if (ops instanceof Error) {
                reject(ops);
            }
            this.db.batch(ops).then(info => {
                resolve("Put: " + key + " successfully.");
            }).catch(e => {
                console.error(e);
                console.error("Oops...The Create operation is interrupted by an internal error.");
                reject(e);
            })
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
        let obj = await this.db.get(constructKey(docId)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        options = this.initOptions(options);
        try {
            if (!obj) {
                return await this.create(key, value, options)
            } else {
                obj = JSON.parse(obj);
                obj["v"] = JSON.parse(obj["v"]);
                obj["o"] = JSON.parse(obj["o"]);
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

    static getDocId(key){
        return md5(key);
    }

    // just update the value inside without reindexing
    // It is a very dangerous operation: some indexes may remain till the world's end.
    async cleanUpdate(key,value) {
        let docId = md5(key);
        let obj = await this.db.get(constructKey(docId)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        if (!obj) return Promise.reject(key.toString()+" is not exist inside the db.");
        try {
            obj = JSON.parse(obj);
            obj["v"] = JSON.stringify(value);
            return await this.db.put(constructKey(docId),JSON.stringify(obj));
        }catch (e) {
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
        let obj = await this.db.get(constructKey(docId)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        try {
            if (!obj) {
                return Promise.resolve("The input key is not exist.");
            } else {
                obj = JSON.parse(obj);
                this.docCount -= 1;
                let value = JSON.parse(obj["v"]);
                let options = JSON.parse(obj["o"]);
                let tokens = this.getTokens(key, value, options);
                let promiseArr = [];
                for (let token of Object.keys(tokens)) {
                    promiseArr.push(this.searchIndex(token));
                }
                let ops = await Promise.all(promiseArr).then((results) => {
                    let ops = [];
                    for (let obj of results) {
                        //DEL:
                        delete obj["v"][docId];
                        obj["l"] = Object.keys(obj["v"]).length;
                        //there is no other doc related to this index, delete it
                        if (obj["l"] === 0) {
                            ops.push({type: "del", key: constructIndex(obj["t"])});
                        } else {
                            ops.push({type: "put", key: constructIndex(obj["t"]), value: JSON.stringify(obj)});
                        }
                    }
                    ops.push({type: "del", key: constructKey(docId)});
                    ops.push({type: "put", key: "0x000_docCount", value: (this.docCount).toString()});
                    return ops;
                }).catch(e => {
                    console.error("Oops...The Delete operation is interrupted by an internal error.");
                    return e;
                });
                return new Promise((resolve, reject) => {
                    if (ops instanceof Error) {
                        this.docCount += 1;
                        reject(ops);
                    }
                    this.db.batch(ops).then(info => {
                        resolve("Del: " + key + " successfully.");
                    }).catch(e => {
                        this.docCount += 1;
                        console.error(e);
                        console.error("Oops...The Delete operation is interrupted by an internal error.");
                        reject(e);
                    })
                });
            }
        } catch (e) {
            return e;
        }
    }

    // Hash : True -> The input key is the md5 docId of the key.
    // Hash : False -> The origin key was input.
    async get(key ,hash =false) {
        let docId = hash? key:md5(key);
        let obj = await this.db.get(constructKey(docId)).catch(e => {
                return e;
        });
        if (obj instanceof Error) return Promise.reject(obj);
        try {
            obj = JSON.parse(obj);
            return {
                key: obj["k"],
                docId:docId,
                value: JSON.parse(obj["v"]),
                options: this.compressOptions(JSON.parse(obj["o"]),true)
            };
        } catch (e) {
            console.error("Oops...The Get operation is interrupted by an internal error.");
            return e;
        }
    }

    // only focus on the value related to the key
    async cleanGet(key , hash=false){
        let docId = hash? key:md5(key);
        let obj = await this.db.get(constructKey(docId)).catch(e => {
            return e;
        });
        if (obj instanceof Error) return Promise.reject(obj);
        try {
            obj = JSON.parse(obj);
            return JSON.parse(obj["v"])
        } catch (e) {
            console.error("Oops...The Get operation is interrupted by an internal error.");
            return e;
        }
    }

    //Search the content by tf-idf.
    async search(content, topK) {
        let tokens = this.tokenizer.tokenize(content);
        let promiseArr = [];
        for (let token of Object.keys(tokens)) {
            promiseArr.push(this.searchIndex(token));
        }
        let docCount = await this.getDocCount();
        let results = await Promise.all(promiseArr).then(async results => {
            let docs = {};
            for (let result of results) {
                let len = result["l"];
                if (len === 0) continue;
                let idf = 1 + Math.log(docCount / (1 + len));
                let tfs = result["v"];
                for (let docId of Object.keys(tfs)) {
                    let tf_norm = 1 + Math.log(1 + Math.log(tfs[docId]));
                    docId in docs ? docs[docId] += idf * tf_norm : docs[docId] = idf * tf_norm;
                }
            }
            docs = utils.sortByValue(docs);
            let docIds = Object.keys(docs);
            if (topK && topK < docIds.length)  docIds=docIds.slice(0,topK-1);
            promiseArr=[];
            for (let docId of docIds){
                promiseArr.push(this.get(docId,true))
            }
            return await Promise.all(promiseArr).then(res=>{
                for(let obj of res){
                    obj["score"] = docs[obj["docId"]];
                }
                return res.sort((a,b)=>{ return b["score"] - a["score"]});
            });
        }).catch(e => {
            return e;
        });
        if (results instanceof Error) {
            return Promise.reject(results);
        }else{
            return Promise.resolve(results);
        }
    }

    printAll() {
        this.db.createReadStream()
            .on('data', function (data) {
                console.log(data.key, '=', data.value)
            })
            .on('error', function (err) {
                console.log('Oh my!', err)
            })
            .on('close', function () {
                console.log('Stream closed')
            })
            .on('end', function () {
                console.log('Stream ended')
            })
    }

    fixDocCount(){
        let docCount = 0;
        let pattern = /^0x002_/;
        let db=this.db;
        this.db.createReadStream()
            .on('data', function (data) {
                if(pattern.test(data.key)) docCount++;
            })
            .on('error', function (err) {
                console.log('Oh my!', err)
            })
            .on('end', function () {
                db.put("0x000_docCount",docCount).then(info=>{
                    console.log("Rescan complete. The docCount is "+docCount.toString());
                })
            })
    }
}

module.exports = Min;