"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getType = getType;
exports.isString = isString;
exports.isNumber = isNumber;
exports.isObject = isObject;
exports.isArray = isArray;
exports.mergeTokens = mergeTokens;

function getType(v) {
  return Object.prototype.toString.call(v);
}

function isString(v) {
  return getType(v) === "[object String]";
}

function isNumber(v) {
  return getType(v) === "[object Number]";
}

function isObject(v) {
  return getType(v) === "[object Object]";
}

function isArray(v) {
  return getType(v) === "[object Array]";
} //t : coefficient of the b value


function mergeTokens(a, b, t) {
  try {
    if (!t && t !== 0 || !isNumber(t)) t = 1;

    for (var _i = 0, _Object$keys = Object.keys(b); _i < _Object$keys.length; _i++) {
      var key = _Object$keys[_i];

      if (key in a) {
        if (isNumber(a[key]) && isNumber(b[key])) {
          a[key] = a[key] + b[key] * t;
        }
      } else {
        a[key] = b[key] * t;
      }
    }
  } catch (e) {
    console.error("Oops..There are some errors in tokens' merging process.");
  }
}