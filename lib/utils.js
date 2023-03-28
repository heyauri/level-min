"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unzip = exports.zip = exports.toCDB = exports.parse = exports.stringify = exports.indexOperator = exports.cosineSimilarity = exports.sortByValue = exports.diffTokens = exports.mergeTokens = exports.isFunction = exports.isArray = exports.isObject = exports.isNumber = exports.isBoolean = exports.isString = exports.getType = void 0;
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
        for (var _i = 0, _a = Object.keys(b); _i < _a.length; _i++) {
            var key = _a[_i];
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
function diffTokens(t1, t2) {
    var t_old = __assign({}, t1), t_new = __assign({}, t2);
    var update_tokens = {};
    for (var _i = 0, _a = Object.keys(t_old); _i < _a.length; _i++) {
        var key = _a[_i];
        if (!(key in t_new)) {
            update_tokens[key] = -1;
            continue;
        }
        if (t_old[key] !== t_new[key]) {
            update_tokens[key] = t_new[key];
        }
        delete t_new[key];
    }
    for (var _b = 0, _c = Object.keys(t_new); _b < _c.length; _b++) {
        var key = _c[_b];
        if (!(key in t_old)) {
            update_tokens[key] = t_new[key];
        }
    }
    return update_tokens;
}
exports.diffTokens = diffTokens;
function sortByValue(obj, des) {
    if (des === void 0) { des = true; }
    return Object.keys(obj)
        .sort(function (a, b) {
        return des ? obj[b] - obj[a] : obj[a] - obj[b];
    })
        .reduce(function (prev, cur) {
        prev[cur] = obj[cur];
        return prev;
    }, {});
}
exports.sortByValue = sortByValue;
function cosineSimilarity(oa, ob) {
    var upper = 0, left = 0, right = 0;
    for (var _i = 0, _a = Object.keys(oa); _i < _a.length; _i++) {
        var key = _a[_i];
        if (key in ob) {
            upper += oa[key] * ob[key];
        }
        left += Math.pow(oa[key], 2);
    }
    for (var _b = 0, _c = Object.keys(ob); _b < _c.length; _b++) {
        var key = _c[_b];
        right += Math.pow(ob[key], 2);
    }
    return upper / (Math.sqrt(left) * Math.sqrt(right));
}
exports.cosineSimilarity = cosineSimilarity;
var fastJson = require("fast-json-stringify");
var indexSchema = {
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
            type: "string",
        },
    },
};
exports.indexOperator = {
    stringifyIndex: fastJson(indexSchema),
    updateIndexValue: function (v, key, val) {
        var idx = v.indexOf(key);
        if (idx < 0 && val > 0) {
            if (v.length) {
                return v + ",".concat(key, ":").concat(val);
            }
            else {
                return "".concat(key, ":").concat(val);
            }
        }
        if (idx > -1 && val > 0) {
            return v.replace(new RegExp("".concat(key, ":[0-9]+")), function (str) {
                return str.replace(/:[0-9]+$/, ":".concat(val));
            });
        }
        if (idx > -1 && val <= 0) {
            return v.replace(new RegExp("".concat(key, ":[0-9]+")), "").replace(/,+/gi, ",").replace(/^,/, "").replace(/,$/, "");
        }
        if (idx < 0 && val <= 0) {
            return v;
        }
    },
    getIndexLength: function (v) {
        var matches = v.match(/,/g);
        if (!matches && v.length == 0) {
            return 0;
        }
        if (!matches && v.length > 0) {
            return 1;
        }
        if (matches) {
            return matches.length + 1;
        }
    }
};
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
    var tmp = "";
    for (var i = 0; i < str.length; i++) {
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
var zlib = require("zlib");
exports.zip = zlib.gzipSync;
exports.unzip = zlib.gunzipSync;
