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

    async create(key, value, options) {
        let doc_id = md5(key);
        let tokens = this.get_tokens(key, value, options);

        let doc_count = await this.db.get("0x000_doc_count").catch(e => {
            return e.type === "NotFoundError" ? 0 : false;
        });
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
                ops.push({"type": "put", "key": construct_index(obj["t"]), "value": JSON.stringify(obj)});
            }
            ops.push({
                "type": "put",
                "key": construct_key(doc_id),
                "value": JSON.stringify({"k": key, "v": JSON.stringify(value), "o": JSON.stringify(options)})
            });
            return ops;
        }).catch(e => {
            console.error("Oops...The Create operation is interrupted by an internal error.");
            return false;
        });

        console.log(tokens);
        console.log(ops);
        return new Promise((resolve, reject) => {
            this.db.batch(ops).then(info => {
                resolve(info);
            }).catch(e => {
                console.error(e);
                console.error("Oops...The Create operation is interrupted by an internal error.");
                reject(e);
            })
        });
    }

    async put(key, value, options) {
        let doc_id = md5(key);
        options = this.init_options(options);
        let obj = await this.db.get(construct_key(doc_id)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        options = this.init_options(options);
        if (!obj) {
            this.create(key, value, options)
        } else {
            console.log(obj);
        }


    }

}

module.exports = Min;