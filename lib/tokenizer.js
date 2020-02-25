"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tokenize = tokenize;
exports.configLanguages = configLanguages;
exports.langTypeDetect = langTypeDetect;
exports.setCustomStopwords = setCustomStopwords;

var _franc = _interopRequireDefault(require("franc"));

var _langjudge = _interopRequireDefault(require("langjudge"));

var _natural = _interopRequireDefault(require("natural"));

var _segmentit = require("segmentit");

var _stopword = _interopRequireDefault(require("stopword"));

var utils = _interopRequireWildcard(require("./utils.js"));

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
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = tokenizers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var key = _step.value;

        if (types.indexOf(key) > -1) {
          return key;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator["return"] != null) {
          _iterator["return"]();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
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
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = langList[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var lang = _step2.value;

      if (lang in supportLangNames) {
        newLangs.push(lang);
        newCodes.push(nameToCode[lang]);
      }
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
        _iterator2["return"]();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }

  supportLangNames = newLangs;
  supportLangCodes = newCodes;
}

var customStopwordExist = false;
var customStopwords = [];

function setCustomStopwords(stopwords) {
  if (utils.isArray(stopwords)) {
    if (stopwords.length > 0) {
      customStopwordExist = true;
      customStopwords = stopwords;
    } else {
      customStopwordExist = false;
    }
  } else {
    customStopwordExist = false;
  }
}

function tokenize(sentence) {
  var langType = langTypeDetect(sentence);
  var tokens = [];

  try {
    if (langType === "Chinese") {
      var arr = segmentit.doSegment(sentence, {
        stripPunctuation: true
      });
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = arr[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var item = _step3.value;
          tokens.push(item.w);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3["return"] != null) {
            _iterator3["return"]();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
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

    if (customStopwordExist) {
      tokens = _stopword["default"].removeStopwords(tokens, customStopwords);
    }
  } catch (e) {
    console.error(e);
  } //Stemmers


  try {
    if (langType in stemmerFuns) {
      var stemmer = stemmerFuns[langType];

      for (var k in tokens) {
        tokens[k] = stemmer.stem(tokens[k]);
      }
    }
  } catch (e) {
    console.error(e);
  }

  var result = {};
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = tokens[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var _item = _step4.value;

      if (!(_item in result)) {
        result[_item] = 1;
      } else {
        result[_item] += 1;
      }
    } //console.log(langType,result);

  } catch (err) {
    _didIteratorError4 = true;
    _iteratorError4 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion4 && _iterator4["return"] != null) {
        _iterator4["return"]();
      }
    } finally {
      if (_didIteratorError4) {
        throw _iteratorError4;
      }
    }
  }

  return result;
}