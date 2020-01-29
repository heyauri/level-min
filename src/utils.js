export function getType(v) {
    return Object.prototype.toString.call(v)
}

export function isString(v) {
    return getType(v) === "[Object String]";
}

export function isNumber(v) {
    return getType(v) === "[Object Number]";
}

export function isObject(v) {
    return getType(v) === "[Object Object]";
}

export function mergeTokens(a, b) {
    try {
        for (let key in Object.keys(b)) {
            if (key in a) {
                if (isNumber(a[key]) && isNumber(b[key])) {
                    a[key] = a[key] + b[key]
                }
            } else {
                a[key] = b[key];
            }
        }
    } catch (e) {
        console.error("Oops..There are some errors in tokens' merging process.")
    }
}