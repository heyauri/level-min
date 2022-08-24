"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCustomTokenFilter = exports.loadCHSCustomStopword = exports.loadCHSCustomDict = exports.configTokenizer = exports.setCustomStemmer = exports.setCustomTokenizer = exports.setCustomStopwords = exports.langTypeDetect = exports.configLanguages = exports.tokenize = void 0;
var franc = require("franc");
var langjudge = require("langjudge");
var natural = require("natural");
var segmentit_1 = require("segmentit");
var stopword = require("stopword");
var utils = require("./utils");
var fs = require("fs");
var path = require("path");
var segmentit = segmentit_1.useDefault(new segmentit_1.Segment());
var defaultTokenizer = new natural.WordTokenizer();
var baseDictDir = path.join(__dirname, "../dict");
for (var _i = 0, _a = fs.readdirSync(baseDictDir); _i < _a.length; _i++) {
    var f = _a[_i];
    var fp = path.join(baseDictDir, f);
    var dict = utils.unzip(fs.readFileSync(fp)).toString();
    segmentit.loadDict(dict);
}
var langCodes = {
    cmn: "Chinese",
    jpn: "Japanese",
    spa: "Spanish",
    eng: "English",
    rus: "Russian",
    fas: "Persian",
    fra: "French",
    vie: "Vietnamese",
    swe: "Swedish",
    ita: "Italian",
    pol: "Polish",
    por: "Portuguese",
    nld: "Dutch",
    ind: "Indonesian",
};
var langNames = Object.keys(langCodes).reduce(function (prev, curr) {
    prev[langCodes[curr]] = curr;
    return prev;
}, {});
var tokenizerFuns = {
    Japanese: new natural.TokenizerJa(),
    English: new natural.AggressiveTokenizer(),
    Spanish: new natural.AggressiveTokenizerEs(),
    Russian: new natural.AggressiveTokenizerRu(),
    Cyrillic: new natural.AggressiveTokenizerRu(),
    Persian: new natural.AggressiveTokenizerFa(),
    French: new natural.AggressiveTokenizerFr(),
    Vietnamese: new natural.AggressiveTokenizerVi(),
    Swedish: new natural.AggressiveTokenizerSv(),
    Italian: new natural.AggressiveTokenizerIt(),
    Polish: new natural.AggressiveTokenizerPl(),
    Portuguese: new natural.AggressiveTokenizerPt(),
    Default: defaultTokenizer,
};
var stemmerFuns = {
    English: natural.PorterStemmer,
    French: natural.PorterStemmerFr,
    Italian: natural.PorterStemmerIt,
    Japanese: natural.StemmerJa,
    Portuguese: natural.PorterStemmerPt,
    Russian: natural.PorterStemmerRu,
    Cyrillic: natural.PorterStemmerRu,
    Swedish: natural.PorterStemmerSv,
    Dutch: natural.PorterStemmerNl,
    Indonesian: natural.StemmerId,
};
var stopwordObjs = {
    Japanese: stopword.ja,
    English: stopword.en,
    Spanish: stopword.es,
    Russian: stopword.ru,
    Cyrillic: stopword.ru,
    Persian: stopword.fa,
    French: stopword.fr,
    Vietnamese: stopword.vi,
    Swedish: stopword.sv,
    Italian: stopword.it,
    Polish: stopword.pl,
    Portuguese: stopword.pt,
    Chinese: stopword.zh,
};
var tokenizerConfig = {
    tokenizer: true,
    stemmer: true,
    stopword: true,
    customTokenizer: false,
    customStopword: false,
    customStemmer: false,
};
var supportLangCodes = Object.keys(langCodes);
var supportLangNames = Object.keys(langNames);
var tokenizers = Object.keys(tokenizerFuns);
var stopwords = Object.keys(stopwordObjs);
var filters = [];
function loadCHSCustomDict(dict) {
    try {
        segmentit.loadDict(dict);
        return true;
    }
    catch (e) {
        console.error(e);
        return false;
    }
}
exports.loadCHSCustomDict = loadCHSCustomDict;
function loadCHSCustomStopword(stopwords) {
    try {
        segmentit.loadStopwordDict(stopwords);
        return true;
    }
    catch (e) {
        console.error(e);
        return false;
    }
}
exports.loadCHSCustomStopword = loadCHSCustomStopword;
function regulateLangCode(code) {
    return Reflect.has(langCodes, code) ? langCodes[code] : "Default";
}
function judge_type(types) {
    var langType = "Default";
    if (types.indexOf("Chinese") > -1) {
        langType = "Chinese";
    }
    else {
        for (var _i = 0, tokenizers_1 = tokenizers; _i < tokenizers_1.length; _i++) {
            var key = tokenizers_1[_i];
            if (types.indexOf(key) > -1) {
                return key;
            }
        }
    }
    return langType;
}
function langTypeDetect(sentence) {
    var langType = franc(sentence, { only: supportLangCodes });
    var possibleTypes = langjudge.langAllContain(sentence);
    if (langType === "und" || possibleTypes.indexOf("Chinese") > -1) {
        langType = judge_type(possibleTypes);
    }
    else {
        langType = regulateLangCode(langType);
    }
    return langType;
}
exports.langTypeDetect = langTypeDetect;
function configLanguages(langList) {
    var newCodes = [];
    var newLangs = [];
    for (var _i = 0, langList_1 = langList; _i < langList_1.length; _i++) {
        var lang = langList_1[_i];
        if (Reflect.has(langNames, lang)) {
            newLangs.push(lang);
            newCodes.push(langNames[lang]);
        }
    }
    supportLangNames = newLangs;
    supportLangCodes = newCodes;
}
exports.configLanguages = configLanguages;
function configTokenizer(config) {
    for (var _i = 0, _a = Object.keys(config); _i < _a.length; _i++) {
        var key = _a[_i];
        if (Reflect.has(tokenizerConfig, key)) {
            tokenizerConfig[key] = config[key];
        }
    }
}
exports.configTokenizer = configTokenizer;
var customStopwords, customTokenizer, customStemmer;
function setCustomTokenizer(tokenizer) {
    try {
        var res = tokenizer.tokenize("Hello world this is a test");
        if (utils.isObject(res)) {
            customTokenizer = tokenizer;
            tokenizerConfig.customTokenizer = true;
            console.log("The internal tokenizer have already switched to the custom one.");
        }
        else {
            console.error("The output from custom-tokenizer is not the required format. Setting fail.");
        }
    }
    catch (e) {
        console.error(e);
        console.error("Oops... The operation of switching the tokenizer have encountered an error.");
    }
}
exports.setCustomTokenizer = setCustomTokenizer;
function setCustomStopwords(stopwords) {
    if (utils.isArray(stopwords)) {
        if (stopwords.length > 0) {
            tokenizerConfig.customStopword = true;
            customStopwords = stopwords;
        }
    }
}
exports.setCustomStopwords = setCustomStopwords;
function applyCustomTokenFilter(filter) {
    if (utils.isArray(filter)) {
        filter.forEach(function (f) {
            applyCustomTokenFilter(f);
        });
    }
    else if (utils.isFunction(filter)) {
        filters.push(filter);
    }
}
exports.applyCustomTokenFilter = applyCustomTokenFilter;
function setCustomStemmer(stemmer) {
    try {
        var res = stemmer.stem("Hello world this is a test");
        if (utils.isString(res)) {
            customStemmer = stemmer;
            tokenizerConfig.customStemmer = true;
            console.log("The internal stemmer have already switched to the custom one.");
        }
        else {
            console.error("The output from custom-stemmer is not the required format. Setting fail.");
        }
    }
    catch (e) {
        console.error(e);
        console.error("Oops... The operation of switching the stemmer have encountered an error.");
    }
}
exports.setCustomStemmer = setCustomStemmer;
function tokenFilter(token) {
    for (var _i = 0, filters_1 = filters; _i < filters_1.length; _i++) {
        var filter = filters_1[_i];
        if (!filter(token)) {
            return false;
        }
    }
    return true;
}
function tokenize(sentence) {
    if (typeof sentence !== "string") {
        if (utils.isNumber(sentence)) {
            return sentence.toString();
        }
        else {
            sentence = JSON.stringify(sentence);
        }
    }
    var langType = langTypeDetect(sentence);
    var tokens = [];
    try {
        if (tokenizerConfig.customTokenizer) {
            tokens = customTokenizer.tokenize(sentence);
        }
        else if (langType === "Chinese") {
            var arr = segmentit.doSegment(sentence, {
                stripPunctuation: true,
            });
            for (var _i = 0, arr_1 = arr; _i < arr_1.length; _i++) {
                var item = arr_1[_i];
                tokens.push(item.w);
            }
        }
        else {
            if (langType in tokenizers) {
                tokens = tokenizerFuns[langType].tokenize(sentence);
            }
            else {
                tokens = defaultTokenizer.tokenize(sentence);
            }
        }
    }
    catch (e) {
        console.error(e);
        tokens = defaultTokenizer.tokenize(sentence);
    }
    tokens = tokens.map(function (token) {
        return utils.toCDB(token.trim().toLowerCase());
    });
    try {
        if (langType in stopwords) {
            tokens = stopword.removeStopwords(tokens, stopwordObjs[langType]);
        }
        if (tokenizerConfig.customStopword) {
            tokens = stopword.removeStopwords(tokens, customStopwords);
        }
    }
    catch (e) {
        console.error(e);
    }
    try {
        if (tokenizerConfig.customStemmer) {
            for (var k in tokens) {
                tokens[k] = customStemmer.stem(tokens[k]);
            }
        }
        else if (langType in stemmerFuns) {
            var stemmer = stemmerFuns[langType];
            for (var k in tokens) {
                tokens[k] = stemmer.stem(tokens[k]);
            }
        }
    }
    catch (e) {
        console.error(e);
    }
    if (filters.length > 0) {
        var tmp = [];
        for (var _a = 0, tokens_1 = tokens; _a < tokens_1.length; _a++) {
            var token = tokens_1[_a];
            if (tokenFilter(token)) {
                tmp.push(token);
            }
        }
        tokens = tmp;
    }
    var result = {};
    for (var _b = 0, tokens_2 = tokens; _b < tokens_2.length; _b++) {
        var item = tokens_2[_b];
        if (!Reflect.has(result, item)) {
            result[item] = 1;
        }
        else {
            result[item] += 1;
        }
    }
    return result;
}
exports.tokenize = tokenize;
