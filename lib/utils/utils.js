"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.judgeType = exports.regulateLangCode = exports.hashQuery = exports.percentile = exports.generateTransactionId = exports.constructKey = exports.constructIndex = exports.unzip = exports.zip = exports.toCDB = exports.parse = exports.stringify = exports.stringifyIndex = exports.cosineSimilarity = exports.sortByValue = exports.diffTokens = exports.mergeTokens = exports.isFunction = exports.isArray = exports.isObject = exports.isNumber = exports.isBoolean = exports.isString = exports.getType = exports.generateSha1Hash = exports.generateDocId = void 0;
const crypto_1 = require("crypto");
function generateDocId(key) {
    return (0, crypto_1.createHash)('md5').update(key).digest('hex');
}
exports.generateDocId = generateDocId;
function generateSha1Hash(data) {
    return (0, crypto_1.createHash)('sha1').update(data).digest('hex');
}
exports.generateSha1Hash = generateSha1Hash;
function getType(v) {
    return Object.prototype.toString.call(v);
}
exports.getType = getType;
function isString(v) {
    return getType(v) === "[object String]";
}
exports.isString = isString;
function isBoolean(v) {
    return getType(v) === "[object Boolean]";
}
exports.isBoolean = isBoolean;
function isNumber(v) {
    return getType(v) === "[object Number]";
}
exports.isNumber = isNumber;
function isObject(v) {
    return getType(v) === "[object Object]";
}
exports.isObject = isObject;
function isArray(v) {
    return getType(v) === "[object Array]";
}
exports.isArray = isArray;
function isFunction(v) {
    return getType(v) === "[object Function]";
}
exports.isFunction = isFunction;
function mergeTokens(a, b, t) {
    try {
        if ((!t && t !== 0) || !isNumber(t))
            t = 1;
        for (let key of Object.keys(b)) {
            if (key in a) {
                if (isNumber(a[key]) && isNumber(b[key])) {
                    a[key] = a[key] + b[key] * t;
                }
            }
            else {
                a[key] = b[key] * t;
            }
        }
    }
    catch (e) {
        console.error("Oops..There are some errors in tokens' merging process.", e);
    }
}
exports.mergeTokens = mergeTokens;
function diffTokens(t_old, t_new) {
    let update_tokens = {};
    for (let key of Object.keys(t_old)) {
        if (!(key in t_new)) {
            update_tokens[key] = -1;
            continue;
        }
        if (t_old[key] !== t_new[key]) {
            update_tokens[key] = t_new[key];
        }
        delete t_new[key];
    }
    for (let key of Object.keys(t_new)) {
        if (!(key in t_old)) {
            update_tokens[key] = t_new[key];
        }
    }
    return update_tokens;
}
exports.diffTokens = diffTokens;
function sortByValue(obj, des = true) {
    return Object.keys(obj)
        .sort((a, b) => {
        return des ? obj[b] - obj[a] : obj[a] - obj[b];
    })
        .reduce((prev, cur) => {
        prev[cur] = obj[cur];
        return prev;
    }, {});
}
exports.sortByValue = sortByValue;
function cosineSimilarity(oa, ob) {
    let upper = 0, left = 0, right = 0;
    for (let key of Object.keys(oa)) {
        if (key in ob) {
            upper += oa[key] * ob[key];
        }
        left += Math.pow(oa[key], 2);
    }
    for (let key of Object.keys(ob)) {
        right += Math.pow(ob[key], 2);
    }
    return upper / (Math.sqrt(left) * Math.sqrt(right));
}
exports.cosineSimilarity = cosineSimilarity;
const fastJson = require("fast-json-stringify");
const indexSchema = {
    title: "indexSchema",
    type: "object",
    properties: {
        t: {
            type: "string",
        },
        l: {
            type: "number",
        },
        v: {
            type: "object",
            patternProperties: {
                ".*": {
                    type: "number",
                },
            },
        },
    },
};
exports.stringifyIndex = fastJson(indexSchema);
function stringify(input) {
    return isString(input) ? input : JSON.stringify(input);
}
exports.stringify = stringify;
function parse(input) {
    try {
        return JSON.parse(input);
    }
    catch (e) {
        return input;
    }
}
exports.parse = parse;
function toCDB(str) {
    let tmp = "";
    for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) > 65281 && str.charCodeAt(i) < 65373) {
            tmp += String.fromCharCode(str.charCodeAt(i) - 65248);
        }
        else if (str.charCodeAt(i) == 12288) {
            tmp += String.fromCharCode(str.charCodeAt(i) - 12288 + 32);
        }
        else {
            tmp += String.fromCharCode(str.charCodeAt(i));
        }
    }
    return tmp;
}
exports.toCDB = toCDB;
const zlib = require("zlib");
exports.zip = zlib.gzipSync;
exports.unzip = zlib.gunzipSync;
function constructIndex(index) {
    return "0x001_" + index.toString();
}
exports.constructIndex = constructIndex;
function constructKey(key) {
    return "0x002_" + key.toString();
}
exports.constructKey = constructKey;
function generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
exports.generateTransactionId = generateTransactionId;
function percentile(sortedArray, p) {
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}
exports.percentile = percentile;
function hashQuery(query) {
    return query.replace(/\s+/g, ' ').trim().toLowerCase();
}
exports.hashQuery = hashQuery;
function regulateLangCode(code, langCodes) {
    return Reflect.has(langCodes, code) ? langCodes[code] : "Default";
}
exports.regulateLangCode = regulateLangCode;
function judgeType(types, tokenizers) {
    let langType = "Default";
    if (types.indexOf("Chinese") > -1) {
        langType = "Chinese";
    }
    else {
        for (let key of tokenizers) {
            if (types.indexOf(key) > -1) {
                return key;
            }
        }
    }
    return langType;
}
exports.judgeType = judgeType;
