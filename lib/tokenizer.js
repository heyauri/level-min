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
  "por": "Portuguese"
}; //Don't Change the sequence. It is related to the type detect fuction.

var tokenizer_obj = {
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
var stemmers_obj = {
  "English": _natural["default"].PorterStemmer,
  "French": _natural["default"].PorterStemmerFr,
  "Italian": _natural["default"].PorterStemmerIt,
  "Japanese": _natural["default"].StemmerJa,
  "Portugese": _natural["default"].PorterStemmerPt,
  "Russian": _natural["default"].PorterStemmerRu,
  "Cyrillic": _natural["default"].PorterStemmerRu,
  "Swedish": _natural["default"].PorterStemmerSv
};

function regulate_lang_code(code) {
  return code in code_obj ? code_obj[code] : "Default";
}

function judge_type(types) {
  var lang_type = "Default";

  if (types.indexOf("Chinese") > -1) {
    lang_type = "Chinese";
  } else {
    for (var key in tokenizer_obj) {
      if (types.indexOf(key) > -1) {
        return key;
      }
    }
  }

  return lang_type;
}

function _default(sentence) {
  //language Detect
  var lang_type = (0, _franc["default"])(sentence); //This is the backup for some situations that the franc can not detect the language and return "und"
  // console.log(lang_type);

  if (lang_type === "und") {
    var possible_types = _langjudge["default"].langAllContain(sentence);

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
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = arr[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var item = _step.value;
          tokens.push(item.w);
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
    } else {
      tokens = tokenizer_obj[lang_type].tokenize(sentence);
    }
  } catch (e) {
    console.error(e);
    tokens = defaultTokenizer.tokenize(sentence);
  } //TODO: Remove Stopwords
  //Stemmers


  try {
    if (lang_type in stemmers_obj) {
      var stemmer = stemmers_obj[lang_type];

      for (var k in tokens) {
        tokens[k] = stemmer.stem(tokens[k]);
      }
    }
  } catch (e) {
    console.error(e);
  }

  var result = {};
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = tokens[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var _item = _step2.value;

      if (!(_item in result)) {
        result[_item] = 1;
      } else {
        result[_item] += 1;
      }
    } //console.log(lang_type,result);

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

  return result;
}