import Level from "level"
import path from "path"
import md5 from "md5"
import * as utils from "./utils.js"
import tokenizer from "./tokenizer.js"

function construct_index(index) {
    return "0x001_" + index.toString();
}

function construct_key(key) {
    return "0x002_" + key.toString();
}

function stringify(value) {
    if (utils.isString(value)) {
        return value;
    } else if (utils.isNumber(value)) {
        return value.toString();
    } else if (utils.isArray(value) || utils.isObject(value)) {
        return JSON.stringify(value);
    }
}


class Min {
    constructor() {
        if (arguments.length > 0) {
            this.set_db(arguments[0], arguments[1])
        }
    }

    set_db(db_address, options) {
        try {
            if (db_address.indexOf("/") < 0 && db_address.indexOf("\\") < 0) {
                db_address = path.join(process.cwd(), db_address);
            }
            options = options || {};
            this.db = Level(db_address, options);
            console.log("Leveldb selected: " + db_address);
        } catch (e) {
            console.error("Leveldb setup failed at: " + db_address + " \nPlease check your db_address and options.");
            console.error(e);
        }
    }

    init_options(options) {
        if (!options) {
            options = {};
        }
        if (!("key_weight" in options) || !utils.isNumber(options["key_weight"])) {
            options["key_weight"] = 1;
        }
        if (!("value_weight_calc" in options)) {
            options["value_weight_calc"] = false;
        }
        if (!("default_value_weight" in options) || !utils.isNumber(options["default_value_weight"])) {
            options["default_value_weight"] = 1;
        }
        if (!("value_weights" in options) || !utils.isObject(options["value_weights"])) {
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

    async create(key, value, options, doc_count) {
        let doc_id = md5(key);
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
            ops.push({type: "put", key: "0x000_doc_count", value: (doc_count + 1).toString()});
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


    async update(key, value, options, doc_count, prev_obj) {
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
                    obj["l"] -= 1;
                    delete obj["v"][doc_id];
                    //there is no other doc related to this index, delete it
                    if (obj["l"] === 0 && Object.keys(obj["v"]).length === 0) {
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
        let doc_count = await this.get_doc_count();
        if (!doc_count && doc_count !== 0) {
            console.error("There are some internal errors inside the db about the docs' count, the PUT operation failed.");
            //TODO this.doc_count_fix()
            return Promise.reject(false);
        }
        let obj = await this.db.get(construct_key(doc_id)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        options = this.init_options(options);
        try {
            console.log(doc_count);
            doc_count = parseInt(doc_count);
            if (!obj) {
                return await this.create(key, value, options, doc_count)
            } else {
                obj = JSON.parse(obj);
                obj["v"] = JSON.parse(obj["v"]);
                obj["o"] = JSON.parse(obj["o"]);
                if (key === obj["k"] && value === obj["v"] && options === obj["o"]) {
                    return true;
                } else {
                    return await this.update(key, value, options, doc_count, obj);
                }
            }
        } catch (e) {
            return e;
        }

    }

    async del(key) {
        let doc_id = md5(key);
        let doc_count = await this.get_doc_count();
        if (!doc_count && doc_count !== 0) {
            console.error("There are some internal errors inside the db about the docs' count, the DEL operation failed.");
            //TODO this.doc_count_fix()
            return Promise.reject(false);
        }
        let obj = await this.db.get(construct_key(doc_id)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        try {
            doc_count = parseInt(doc_count);
            if (!obj) {
                return Promise.resolve("The input key is not exist.");
            } else {
                obj = JSON.parse(obj);
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
                        obj["l"] -= 1;
                        delete obj["v"][doc_id];
                        //there is no other doc related to this index, delete it
                        if (obj["l"] === 0 && Object.keys(obj["v"]).length === 0) {
                            ops.push({type: "del", key: construct_index(obj["t"])});
                        } else {
                            ops.push({type: "put", key: construct_index(obj["t"]), value: JSON.stringify(obj)});
                        }
                    }
                    ops.push({type: "del", key: construct_key(doc_id)});
                    ops.push({type: "put", key: "0x000_doc_count", value: (doc_count - 1).toString()});
                    return ops;
                }).catch(e => {
                    console.error("Oops...The Delete operation is interrupted by an internal error.");
                    return e;
                });
                return new Promise((resolve, reject) => {
                    if (ops instanceof EvalError) {
                        reject(ops);
                    }
                    this.db.batch(ops).then(info => {
                        resolve("Del: " + key + " successfully.");
                    }).catch(e => {
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

    async get(key) {
        let doc_id = md5(key);
        let obj = await this.db.get(construct_key(doc_id)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        try {
            obj = JSON.parse(obj);
            return {
                key: obj["k"],
                value: JSON.parse(obj["v"]),
                options: JSON.parse(obj["o"])
            };
        } catch (e) {
            console.error("Oops...The Get operation is interrupted by an internal error.");
            return e;
        }
    }

    get_all() {
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
}

module.exports = Min;