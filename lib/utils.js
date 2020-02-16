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
exports.diffTokens = diffTokens;

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

function diffTokens(t_old, t_new) {
  var update_tokens = {};

  for (var _i2 = 0, _Object$keys2 = Object.keys(t_old); _i2 < _Object$keys2.length; _i2++) {
    var key = _Object$keys2[_i2];

    if (!(key in t_new)) {
      update_tokens[key] = -1;
      continue;
    }

    if (t_old[key] !== t_new[key]) {
      update_tokens[key] = t_new[key];
    }

    delete t_new[key];
  }

  for (var _i3 = 0, _Object$keys3 = Object.keys(t_new); _i3 < _Object$keys3.length; _i3++) {
    var _key = _Object$keys3[_i3];

    if (!(_key in t_old)) {
      update_tokens[_key] = t_new[_key];
    }
  }

  return update_tokens;
}