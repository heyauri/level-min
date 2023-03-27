export function getType(v) {
    return Object.prototype.toString.call(v);
}

export function isString(v) {
    return getType(v) === "[object String]";
}

export function isBoolean(v) {
    return getType(v) === "[object Boolean]";
}

export function isNumber(v) {
    return getType(v) === "[object Number]";
}

export function isObject(v) {
    return getType(v) === "[object Object]";
}

export function isArray(v) {
    return getType(v) === "[object Array]";
}

export function isFunction(v) {
    return getType(v) === "[object Function]";
}

//t : coefficient(weight) of the b value
export function mergeTokens(a, b, t) {
    try {
        if ((!t && t !== 0) || !isNumber(t)) t = 1;
        for (let key of Object.keys(b)) {
            if (key in a) {
                if (isNumber(a[key]) && isNumber(b[key])) {
                    a[key] = a[key] + b[key] * t;
                }
            } else {
                a[key] = b[key] * t;
            }
        }
    } catch (e) {
        console.error("Oops..There are some errors in tokens' merging process.", e);
    }
}

export function diffTokens(t1, t2) {
    let t_old = { ...t1 }, t_new = { ...t2 };
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

export function sortByValue(obj, des = true) {
    return Object.keys(obj)
        .sort((a, b) => {
            return des ? obj[b] - obj[a] : obj[a] - obj[b];
        })
        .reduce((prev, cur) => {
            prev[cur] = obj[cur];
            return prev;
        }, {});
}

export function cosineSimilarity(oa, ob) {
    let upper = 0,
        left = 0,
        right = 0;
    for (let key of Object.keys(oa)) {
        if (key in ob) {
            upper += oa[key] * ob[key];
        }
        left += oa[key] ** 2;
    }
    for (let key of Object.keys(ob)) {
        right += ob[key] ** 2;
    }
    return upper / (Math.sqrt(left) * Math.sqrt(right));
}

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
            type: "string",
        },
    },
};

export const indexOperator = {
    stringifyIndex: fastJson(indexSchema),
    updateIndexValue: function (v, key, val) {
        let idx = v.indexOf(key);
        if (idx < 0 && val > 0) {
            if (v.length) {
                return v + `,${key}:${val}`
            } else {
                return `${key}:${val}`;
            }
        }
        if (idx > -1 && val > 0) {
            return v.replace(new RegExp(`${key}:[0-9]+`), function (str) {
                return str.replace(/:[0-9]+$/, `:${val}`);
            })
        }
        if (idx > -1 && val <= 0) {
            return v.replace(new RegExp(`${key}:[0-9]+`), "").replace(/,+/gi, ",").replace(/^,/, "").replace(/,$/, "");
        }
        if (idx < 0 && val <= 0) {
            return v;
        }
    },
    getIndexLength: function (v) {
        let matches = v.match(/,/g);
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
}

export function stringify(input) {
    return isString(input) ? input : JSON.stringify(input);
}

export function parse(input: string) {
    try {
        return JSON.parse(input);
    } catch (e) {
        return input;
    }
}

export function toCDB(str) {
    let tmp = "";
    for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) > 65281 && str.charCodeAt(i) < 65373) {
            tmp += String.fromCharCode(str.charCodeAt(i) - 65248);
        } else if (str.charCodeAt(i) == 12288) {
            //空格
            tmp += String.fromCharCode(str.charCodeAt(i) - 12288 + 32);
        } else {
            tmp += String.fromCharCode(str.charCodeAt(i));
        }
    }
    return tmp;
}

const zlib = require("zlib");
export const zip = zlib.gzipSync;
export const unzip = zlib.gunzipSync;
