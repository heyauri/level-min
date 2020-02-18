"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = _default;

var _franc = _interopRequireDefault(require("franc"));

var _langjudge = _interopRequireDefault(require("langjudge"));

var _natural = _interopRequireDefault(require("natural"));

var _segmentit = require("segmentit");

var _stopword = _interopRequireDefault(require("stopword"));

var segmentit = (0, _segmentit.useDefault)(new _segmentit.Segment());
var defaultTokenizer = new _natural["default"].WordTokenizer();
var code_obj = {
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
}; //Don't Change the sequence. It is related to the language-type-detect function.

var tokenizer_funs = {
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
var stemmers_funs = {
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
var stopword_objs = {
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

var support_lang_codes = Object.keys(code_obj);
var tokenizers = Object.keys(tokenizer_funs);
var stopwords = Object.keys(stopword_objs);

function regulate_lang_code(code) {
  return code in code_obj ? code_obj[code] : "Default";
}

function judge_type(types) {
  var lang_type = "Default";

  if (types.indexOf("Chinese") > -1) {
    lang_type = "Chinese";
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

  return lang_type;
}

function _default(sentence) {
  //language Detect
  var lang_type = (0, _franc["default"])(sentence, {
    only: support_lang_codes
  });

  var possible_types = _langjudge["default"].langAllContain(sentence); //This is the backup for some situations that the franc can not detect the language and return "und"


  if (lang_type === "und" || possible_types.indexOf("Chinese") > -1) {
    lang_type = judge_type(possible_types);
  } else {
    lang_type = regulate_lang_code(lang_type);
  }

  var tokens = [];

  try {
    if (lang_type === "Chinese") {
      var arr = segmentit.doSegment(sentence, {
        stripPunctuation: true
      });
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = arr[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var item = _step2.value;
          tokens.push(item.w);
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
    } else {
      if (lang_type in tokenizers) {
        tokens = tokenizer_funs[lang_type].tokenize(sentence);
      } else {
        tokens = defaultTokenizer.tokenize(sentence);
      }
    }
  } catch (e) {
    console.error(e);
    tokens = defaultTokenizer.tokenize(sentence);
  } //Stopwords


  try {
    if (lang_type in stopwords) {
      tokens = _stopword["default"].removeStopwords(tokens, stopword_objs[lang_type]);
    }
  } catch (e) {
    console.error(e);
  } //Stemmers


  try {
    if (lang_type in stemmers_funs) {
      var stemmer = stemmers_funs[lang_type];

      for (var k in tokens) {
        tokens[k] = stemmer.stem(tokens[k]);
      }
    }
  } catch (e) {
    console.error(e);
  }

  var result = {};
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = tokens[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var _item = _step3.value;

      if (!(_item in result)) {
        result[_item] = 1;
      } else {
        result[_item] += 1;
      }
    } //console.log(lang_type,result);

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

  return result;
}