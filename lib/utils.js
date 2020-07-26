"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getType = getType;
exports.isString = isString;
exports.isBoolean = isBoolean;
exports.isNumber = isNumber;
exports.isObject = isObject;
exports.isArray = isArray;
exports.mergeTokens = mergeTokens;
exports.diffTokens = diffTokens;
exports.sortByValue = sortByValue;
exports.cosineSimilarity = cosineSimilarity;

function getType(v) {
  return Object.prototype.toString.call(v);
}

function isString(v) {
  return getType(v) === "[object String]";
}

function isBoolean(v) {
  return getType(v) === "[object Boolean]";
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

function sortByValue(obj) {
  var des = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  return Object.keys(obj).sort(function (a, b) {
    return des ? obj[b] - obj[a] : obj[a] - obj[b];
  }).reduce(function (prev, cur) {
    prev[cur] = obj[cur];
    return prev;
  }, {});
}

function cosineSimilarity(oa, ob) {
  var upper = 0,
      left = 0,
      right = 0;

  for (var _i4 = 0, _Object$keys4 = Object.keys(oa); _i4 < _Object$keys4.length; _i4++) {
    var key = _Object$keys4[_i4];

    if (key in ob) {
      upper += oa[key] * ob[key];
    }

    left += Math.pow(oa[key], 2);
  }

  for (var _i5 = 0, _Object$keys5 = Object.keys(ob); _i5 < _Object$keys5.length; _i5++) {
    var _key2 = _Object$keys5[_i5];
    right += Math.pow(ob[_key2], 2);
  }

  return upper / (Math.sqrt(left) * Math.sqrt(right));
}