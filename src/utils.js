export function getType(v) {
    return Object.prototype.toString.call(v)
}

export function isString(v) {
    return getType(v) === "[object String]";
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

//t : coefficient of the b value
export function mergeTokens(a, b, t) {
    try {
        if((!t && t !== 0)||!isNumber(t)) t = 1;
        for (let key of Object.keys(b)) {
            if (key in a) {
                if (isNumber(a[key]) && isNumber(b[key])) {
                    a[key] = a[key] + b[key] * t
                }
            } else {
                a[key] = b[key] * t;
            }
        }
    } catch (e) {
        console.error("Oops..There are some errors in tokens' merging process.")
    }
}