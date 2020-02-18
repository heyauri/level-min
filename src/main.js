import Level from "level"
import path from "path"
import md5 from "md5"
import deAsync from "deasync"
import * as utils from "./utils.js"
import tokenizer from "./tokenizer.js"

function construct_index(index) {
    return "0x001_" + index.toString();
}

function construct_key(key) {
    return "0x002_" + key.toString();
}

class Min {
    constructor() {
        if (arguments.length > 0) {
            this.set_db(arguments[0], arguments[1]);
        }
    }

    set_db(db_address, options) {
        try {
            if (db_address.indexOf("/") < 0 && db_address.indexOf("\\") < 0) {
                db_address = path.join(process.cwd(), db_address);
            }
            options = options || {};
            this.db = Level(db_address, options);
            let _this = this;
            let done = false;
            this.db.get("0x000_doc_count", function (err, val) {
                if (!val && err) {
                    if (err.type === "NotFoundError") {
                        _this.doc_count = 0;
                    } else {
                        throw err;
                    }
                } else {
                    _this.doc_count = parseInt(val) ? parseInt(val) : 0;
                }
                done = true;
            });
            /*
              Covert the query of doc_count from async to sync, to maintain its' consistency.
             */
            deAsync.loopWhile(() => {
                return !done;
            });
            console.log("Leveldb selected: " + db_address);
        } catch (e) {
            console.error("Leveldb setup failed at: " + db_address + " \nPlease check your db_address and options.");
            console.error(e);
        }
    }

    // Options -> a schema that contain the rules of token-frequency calculation.
    //        ["key_weight"] -> the default weight of the tokens inside key
    //        ["value_weight_calc"] -> if the token inside the value will be counted or not?
    //                                  True : False
    //        ["default_value_weight"] ->  the default weight of the tokens inside value
    //        ["value_weights"] ->  The values for those spec key/index when the value is an Array/Object
    init_options(options) {
        if (!options) {
            options = {};
        }
        if (("key_weight" in options) && !utils.isNumber(options["key_weight"])) {
            options["key_weight"] = 1;
        }
        if (("default_value_weight" in options) && !utils.isNumber(options["default_value_weight"])) {
            options["default_value_weight"] = 1;
        }
        if (("value_weights" in options) && !utils.isObject(options["value_weights"])) {
            options["value_weights"] = {};
        }
        return options;
    }


    get_tokens(key, value, options) {
        let tokens = {};
        let temp_tokens = {};
        if (options["key_weight"]) {
            let temp_tokens = tokenizer(key);
            utils.mergeTokens(tokens, temp_tokens);
        }
        if (options["value_weight_calc"]) {
            let default_value_weight = options["default_value_weight"];
            let value_weights = options["value_weights"];
            if (utils.isString(value)) {
                temp_tokens = tokenizer(value);
                utils.mergeTokens(tokens, temp_tokens, default_value_weight);
            } else if (utils.isObject(value)) {
                for (let key of Object.keys(value)) {
                    if (key in value_weights || default_value_weight > 0) {
                        temp_tokens = tokenizer(value[key]);
                        let weight = key in value_weights ? value_weights[key] : default_value_weight;
                        utils.mergeTokens(tokens, temp_tokens, weight);
                    }
                }
            } else if (utils.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    if (i in value_weights || default_value_weight > 0) {
                        temp_tokens = tokenizer(value[i]);
                        let weight = i in value_weights ? value_weights[i] : default_value_weight;
                        utils.mergeTokens(tokens, temp_tokens, weight);
                    }
                }
            } else if (utils.isNumber(value) || utils.isBoolean(value)){
                try {
                    tokens[value.toString()]= default_value_weight;
                }catch (e) {
                    console.error(e);
                }
            }
        }
        return tokens;
    }

    search_index(token) {
        return new Promise((resolve, reject) => {
            this.db.get(construct_index(token)).then(result => {
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

    async get_doc_count() {
        return await this.db.get("0x000_doc_count").catch(e => {
            return e.type === "NotFoundError" ? 0 : false;
        })
    }

    async create(key, value, options) {
        let doc_id = md5(key);
        this.doc_count += 1;
        let tokens = this.get_tokens(key, value, options);
        let promise_arr = [];
        for (let token of Object.keys(tokens)) {
            promise_arr.push(this.search_index(token));
        }
        let ops = await Promise.all(promise_arr).then((results) => {
            let ops = [];
            for (let obj of results) {
                if (!(doc_id in obj["v"])) {
                    obj["l"] += 1;
                }
                obj["v"][doc_id] = tokens[obj["t"]];
                ops.push({type: "put", key: construct_index(obj["t"]), value: JSON.stringify(obj)});
            }
            ops.push({
                type: "put",
                key: construct_key(doc_id),
                value: JSON.stringify({k: key, v: JSON.stringify(value), o: JSON.stringify(options)})
            });
            ops.push({type: "put", key: "0x000_doc_count", value: (this.doc_count).toString()});
            return ops;
        }).catch(e => {
            console.error("Oops...The Create operation is interrupted by an internal error.");
            return e;
        });
        return new Promise((resolve, reject) => {
            if (ops instanceof EvalError) {
                this.doc_count -= 1;
                reject(ops);
            }
            this.db.batch(ops).then(info => {
                resolve("Put: " + key + " successfully.");
            }).catch(e => {
                this.doc_count -= 1;
                console.error(e);
                console.error("Oops...The Create operation is interrupted by an internal error.");
                reject(e);
            })
        });
    }


    async update(key, value, options, prev_obj) {
        let doc_id = md5(key);
        let tokens = this.get_tokens(key, value, options);
        let prev_tokens = this.get_tokens(prev_obj["k"], prev_obj["v"], prev_obj["o"]);

        let diff_tokens = utils.diffTokens(prev_tokens, tokens);
        let promise_arr = [];
        for (let token of Object.keys(diff_tokens)) {
            promise_arr.push(this.search_index(token));
        }
        tokens = diff_tokens;
        let ops = await Promise.all(promise_arr).then((results) => {
            let ops = [];
            for (let obj of results) {
                //DEL:
                if (tokens[obj["t"]] <= 0) {
                    delete obj["v"][doc_id];
                    obj["l"] = Object.keys(obj["v"]).length;
                    //there is no other doc related to this index, delete it
                    if (obj["l"] === 0) {
                        ops.push({type: "del", key: construct_index(obj["t"])});
                        continue;
                    }
                } else {
                    //UPDATE
                    if (!(doc_id in obj["v"])) {
                        obj["l"] += 1;
                    }
                    obj["v"][doc_id] = tokens[obj["t"]];
                }
                ops.push({type: "put", key: construct_index(obj["t"]), value: JSON.stringify(obj)});
            }

            ops.push({
                type: "put",
                key: construct_key(doc_id),
                value: JSON.stringify({k: key, v: JSON.stringify(value), o: JSON.stringify(options)})
            });
            return ops;
        }).catch(e => {
            console.error("Oops...The Create operation is interrupted by an internal error.");
            return e;
        });
        return new Promise((resolve, reject) => {
            if (ops instanceof EvalError) {
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
        let doc_id = md5(key);
        let doc_count = this.doc_count;
        if (!doc_count && doc_count !== 0) {
            console.error("There are some internal errors inside the db about the docs' count, the PUT operation failed.");
            console.error("Try this.fix_doc_count()");
            return Promise.reject(false);
        }
        let obj = await this.db.get(construct_key(doc_id)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        options = this.init_options(options);
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

    async del(key) {
        let doc_id = md5(key);
        let doc_count = this.doc_count;
        if (!doc_count && doc_count !== 0) {
            console.error("There are some internal errors inside the db about the docs' count, the DEL operation failed.");
            console.error("Try this.fix_doc_count()");
            return Promise.reject(false);
        }
        let obj = await this.db.get(construct_key(doc_id)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        try {
            if (!obj) {
                return Promise.resolve("The input key is not exist.");
            } else {
                obj = JSON.parse(obj);
                this.doc_count -= 1;
                let value = JSON.parse(obj["v"]);
                let options = JSON.parse(obj["o"]);
                let tokens = this.get_tokens(key, value, options);
                let promise_arr = [];
                for (let token of Object.keys(tokens)) {
                    promise_arr.push(this.search_index(token));
                }
                let ops = await Promise.all(promise_arr).then((results) => {
                    let ops = [];
                    for (let obj of results) {
                        //DEL:
                        delete obj["v"][doc_id];
                        obj["l"] = Object.keys(obj["v"]).length;
                        //there is no other doc related to this index, delete it
                        if (obj["l"] === 0) {
                            ops.push({type: "del", key: construct_index(obj["t"])});
                        } else {
                            ops.push({type: "put", key: construct_index(obj["t"]), value: JSON.stringify(obj)});
                        }
                    }
                    ops.push({type: "del", key: construct_key(doc_id)});
                    ops.push({type: "put", key: "0x000_doc_count", value: (this.doc_count).toString()});
                    return ops;
                }).catch(e => {
                    console.error("Oops...The Delete operation is interrupted by an internal error.");
                    return e;
                });
                return new Promise((resolve, reject) => {
                    if (ops instanceof EvalError) {
                        this.doc_count += 1;
                        reject(ops);
                    }
                    this.db.batch(ops).then(info => {
                        resolve("Del: " + key + " successfully.");
                    }).catch(e => {
                        this.doc_count += 1;
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

    // Hash : True -> The input key is the md5 doc_id of the key.
    // Hash : False -> The origin key was input.
    async get(key ,hash =false) {
        let doc_id = hash? key:md5(key);
        let obj = await this.db.get(construct_key(doc_id)).catch(e => {
                return e;
        });
        if (obj instanceof EvalError) return Promise.reject(obj);
        try {
            obj = JSON.parse(obj);
            return {
                key: obj["k"],
                doc_id:doc_id,
                value: JSON.parse(obj["v"]),
                options: JSON.parse(obj["o"])
            };
        } catch (e) {
            console.error("Oops...The Get operation is interrupted by an internal error.");
            return e;
        }
    }
    //Search the content by tf-idf.
    async search(content, topK) {
        let tokens = tokenizer(content);
        let promise_arr = [];
        for (let token of Object.keys(tokens)) {
            promise_arr.push(this.search_index(token));
        }
        let doc_count = await this.get_doc_count();
        let results = await Promise.all(promise_arr).then(async results => {
            let docs = {};
            for (let result of results) {
                let len = result["l"];
                if (len === 0) continue;
                let idf = 1 + Math.log(doc_count / (1 + len));
                let tfs = result["v"];
                for (let doc_id of Object.keys(tfs)) {
                    let tf_norm = 1 + Math.log(1 + Math.log(tfs[doc_id]));
                    doc_id in docs ? docs[doc_id] += idf * tf_norm : docs[doc_id] = idf * tf_norm;
                }
            }
            docs = utils.sortByValue(docs);
            let doc_ids = Object.keys(docs);
            if (topK && topK < doc_ids.length)  doc_ids=doc_ids.slice(0,topK-1);
            promise_arr=[];
            for (let doc_id of doc_ids){
                promise_arr.push(this.get(doc_id,true))
            }
            return await Promise.all(promise_arr).then(res=>{
                for(let obj of res){
                    obj["score"] = docs[obj["doc_id"]];
                }
                return res.sort((a,b)=>{ return b["score"] - a["score"]});
            });
        }).catch(e => {
            return e;
        });
        if (results instanceof EvalError) {
            return Promise.reject(results);
        }else{
            return Promise.resolve(results);
        }
    }

    print_all() {
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

    fix_doc_count(){
        let doc_count = 0;
        let pattern = /^0x002_/;
        let db=this.db;
        this.db.createReadStream()
            .on('data', function (data) {
                if(pattern.test(data.key)) doc_count++;
            })
            .on('error', function (err) {
                console.log('Oh my!', err)
            })
            .on('end', function () {
                db.put("0x000_doc_count",doc_count).then(info=>{
                    console.log("Rescan complete. The doc_count is "+doc_count.toString());
                })
            })
    }
}

module.exports = Min;