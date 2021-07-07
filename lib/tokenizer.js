"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _typeof = require("@babel/runtime/helpers/typeof");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tokenize = tokenize;
exports.configLanguages = configLanguages;
exports.langTypeDetect = langTypeDetect;
exports.setCustomStopwords = setCustomStopwords;
exports.setCustomTokenizer = setCustomTokenizer;
exports.setCustomStemmer = setCustomStemmer;
exports.configTokenizer = configTokenizer;

var _franc = _interopRequireDefault(require("franc"));

var _langjudge = _interopRequireDefault(require("langjudge"));

var _natural = _interopRequireDefault(require("natural"));

var _segmentit = require("segmentit");

var _stopword = _interopRequireDefault(require("stopword"));

var utils = _interopRequireWildcard(require("./utils.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var segmentit = (0, _segmentit.useDefault)(new _segmentit.Segment());
var defaultTokenizer = new _natural["default"].WordTokenizer();
var codeObj = {
  "cmn": "Chinese",
  "jpn": "Japanese",
  "spa": "Spanish",
  "eng": "English",
  "rus": "Russian",
  "fas": "Persian",
  "fra": "French",
  "vie": "Vietnamese",
  "swe": "Swedish",
  "ita": "Italian",
  "pol": "Polish",
  "por": "Portuguese",
  "nld": "Dutch",
  "ind": "Indonesian"
};
var nameToCode = Object.keys(codeObj).reduce(function (prev, curr) {
  prev[codeObj[curr]] = curr;
  return prev;
}, {}); //Don't Change the sequence. It is related to the language-type-detect function.

var tokenizerFuns = {
  "Japanese": new _natural["default"].TokenizerJa(),
  "English": new _natural["default"].AggressiveTokenizer(),
  "Spanish": new _natural["default"].AggressiveTokenizerEs(),
  "Russian": new _natural["default"].AggressiveTokenizerRu(),
  "Cyrillic": new _natural["default"].AggressiveTokenizerRu(),
  "Persian": new _natural["default"].AggressiveTokenizerFa(),
  "French": new _natural["default"].AggressiveTokenizerFr(),
  "Vietnamese": new _natural["default"].AggressiveTokenizerVi(),
  "Swedish": new _natural["default"].AggressiveTokenizerSv(),
  "Italian": new _natural["default"].AggressiveTokenizerIt(),
  "Polish": new _natural["default"].AggressiveTokenizerPl(),
  "Portuguese": new _natural["default"].AggressiveTokenizerPt(),
  "Default": defaultTokenizer
};
var stemmerFuns = {
  "English": _natural["default"].PorterStemmer,
  "French": _natural["default"].PorterStemmerFr,
  "Italian": _natural["default"].PorterStemmerIt,
  "Japanese": _natural["default"].StemmerJa,
  "Portuguese": _natural["default"].PorterStemmerPt,
  "Russian": _natural["default"].PorterStemmerRu,
  "Cyrillic": _natural["default"].PorterStemmerRu,
  "Swedish": _natural["default"].PorterStemmerSv,
  "Dutch": _natural["default"].PorterStemmerNl,
  "Indonesian": _natural["default"].StemmerId
};
var stopwordObjs = {
  "Japanese": _stopword["default"].ja,
  "English": _stopword["default"].en,
  "Spanish": _stopword["default"].es,
  "Russian": _stopword["default"].ru,
  "Cyrillic": _stopword["default"].ru,
  "Persian": _stopword["default"].fa,
  "French": _stopword["default"].fr,
  "Vietnamese": _stopword["default"].vi,
  "Swedish": _stopword["default"].sv,
  "Italian": _stopword["default"].it,
  "Polish": _stopword["default"].pl,
  "Portuguese": _stopword["default"].pt,
  "Chinese": _stopword["default"].zh
}; // more custom setting

var tokenizerConfig = {
  tokenizer: true,
  stemmer: true,
  stopword: true,
  customTokenizer: false,
  customStopword: false,
  customStemmer: false
}; //To avoid duplicate operation of get keys.

var supportLangCodes = Object.keys(codeObj);
var supportLangNames = Object.keys(nameToCode);
var tokenizers = Object.keys(tokenizerFuns);
var stopwords = Object.keys(stopwordObjs);

function regulateLangCode(code) {
  return code in codeObj ? codeObj[code] : "Default";
}

function judge_type(types) {
  var langType = "Default";

  if (types.indexOf("Chinese") > -1) {
    langType = "Chinese";
  } else {
    var _iterator = _createForOfIteratorHelper(tokenizers),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var key = _step.value;

        if (types.indexOf(key) > -1) {
          return key;
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
  }

  return langType;
}

function langTypeDetect(sentence) {
  //language Detect
  var langType = (0, _franc["default"])(sentence, {
    only: supportLangCodes
  });

  var possibleTypes = _langjudge["default"].langAllContain(sentence); //This is the backup for some situations that the franc can not detect the language and return "und"


  if (langType === "und" || possibleTypes.indexOf("Chinese") > -1) {
    langType = judge_type(possibleTypes);
  } else {
    langType = regulateLangCode(langType);
  }

  return langType;
}

function configLanguages(langList) {
  var newCodes = [];
  var newLangs = [];

  var _iterator2 = _createForOfIteratorHelper(langList),
      _step2;

  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      var lang = _step2.value;

      if (lang in supportLangNames) {
        newLangs.push(lang);
        newCodes.push(nameToCode[lang]);
      }
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }

  supportLangNames = newLangs;
  supportLangCodes = newCodes;
}

function configTokenizer(config) {
  for (var _i = 0, _Object$keys = Object.keys(config); _i < _Object$keys.length; _i++) {
    var key = _Object$keys[_i];

    if (key in tokenizerConfig) {
      tokenizerConfig[key] = config[key];
    }
  }
}

var customStopwords, customTokenizer, customStemmer;

function setCustomTokenizer(tokenizer) {
  try {
    var res = tokenizer.tokenize("Hello world this is a test");

    if (utils.isObject(res)) {
      customTokenizer = tokenizer;
      tokenizerConfig.customTokenizer = true;
      console.log("The internal tokenizer have already switched to the custom one.");
    } else {
      console.error("The output from custom-tokenizer is not the required format. Setting fail.");
    }
  } catch (e) {
    console.error(e);
    console.error("Oops... The operation of switching the tokenizer have encountered an error.");
  }
}

function setCustomStopwords(stopwords) {
  if (utils.isArray(stopwords)) {
    if (stopwords.length > 0) {
      tokenizerConfig.customStopword = true;
      customStopwords = stopwords;
    }
  }
}

function setCustomStemmer(stemmer) {
  try {
    var res = stemmer.stem("Hello world this is a test");

    if (utils.isString(res)) {
      customStemmer = stemmer;
      tokenizerConfig.customStemmer = true;
      console.log("The internal stemmer have already switched to the custom one.");
    } else {
      console.error("The output from custom-stemmer is not the required format. Setting fail.");
    }
  } catch (e) {
    console.error(e);
    console.error("Oops... The operation of switching the stemmer have encountered an error.");
  }
}

function tokenize(sentence) {
  if (typeof sentence !== "string") {
    if (utils.isNumber(sentence)) {
      return sentence.toString();
    } else {
      sentence = JSON.stringify(sentence);
    }
  }

  var langType = langTypeDetect(sentence);
  var tokens = [];

  try {
    if (tokenizerConfig.customTokenizer) {
      tokens = customTokenizer.tokenize(sentence);
    } else if (langType === "Chinese") {
      var arr = segmentit.doSegment(sentence, {
        stripPunctuation: true
      });

      var _iterator3 = _createForOfIteratorHelper(arr),
          _step3;

      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var item = _step3.value;
          tokens.push(item.w);
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }
    } else {
      if (langType in tokenizers) {
        tokens = tokenizerFuns[langType].tokenize(sentence);
      } else {
        tokens = defaultTokenizer.tokenize(sentence);
      }
    }
  } catch (e) {
    console.error(e);
    tokens = defaultTokenizer.tokenize(sentence);
  }

  tokens = tokens.map(function (token) {
    return token.trim().toLowerCase();
  }); //Stopwords

  try {
    if (langType in stopwords) {
      tokens = _stopword["default"].removeStopwords(tokens, stopwordObjs[langType]);
    }

    if (tokenizerConfig.customStopword) {
      tokens = _stopword["default"].removeStopwords(tokens, customStopwords);
    }
  } catch (e) {
    console.error(e);
  } //Stemmers


  try {
    if (tokenizerConfig.customStemmer) {
      for (var k in tokens) {
        tokens[k] = customStemmer.stem(tokens[k]);
      }
    } else if (langType in stemmerFuns) {
      var stemmer = stemmerFuns[langType];

      for (var _k in tokens) {
        tokens[_k] = stemmer.stem(tokens[_k]);
      }
    }
  } catch (e) {
    console.error(e);
  }

  var result = {};

  var _iterator4 = _createForOfIteratorHelper(tokens),
      _step4;

  try {
    for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
      var _item = _step4.value;

      if (!(_item in result)) {
        result[_item] = 1;
      } else {
        result[_item] += 1;
      }
    } //console.log(langType,result);

  } catch (err) {
    _iterator4.e(err);
  } finally {
    _iterator4.f();
  }

  return result;
}