"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCustomTokenFilter = exports.loadCHSCustomStopword = exports.loadCHSCustomDict = exports.configTokenizer = exports.setCustomStemmer = exports.setCustomTokenizer = exports.setCustomStopwords = exports.langTypeDetect = exports.configLanguages = exports.tokenize = void 0;
const franc_1 = require("franc");
const langjudge = require("langjudge");
const natural = require("natural");
const segmentit_1 = require("segmentit");
const stopword = require("stopword");
const utils = require("../utils/utils");
const fs = require("fs");
const path = require("path");
const segmentit = (0, segmentit_1.useDefault)(new segmentit_1.Segment());
const defaultTokenizer = new natural.WordTokenizer();
let baseDictDir = path.join(__dirname, "../../dict");
for (let f of fs.readdirSync(baseDictDir)) {
    let fp = path.join(baseDictDir, f);
    let dict = utils.unzip(fs.readFileSync(fp)).toString();
    segmentit.loadDict(dict);
}
const langCodes = {
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
const langNames = Object.keys(langCodes).reduce((prev, curr) => {
    prev[langCodes[curr]] = curr;
    return prev;
}, {});
const tokenizerFuns = {
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
const stemmerFuns = {
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
const stopwordObjs = {
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
let tokenizerConfig = {
    tokenizer: true,
    stemmer: true,
    stopword: true,
    customTokenizer: false,
    customStopword: false,
    customStemmer: false,
};
let supportLangCodes = Object.keys(langCodes);
let supportLangNames = Object.keys(langNames);
const tokenizers = Object.keys(tokenizerFuns);
const stopwords = Object.keys(stopwordObjs);
let filters = [];
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
function judge_type(types) {
    let langType = "Default";
    if (types.indexOf("Chinese") > -1) {
        langType = "Chinese";
    }
    else {
        for (let key of tokenizers) {
            if (types.indexOf(key) > -1) {
                return key;
            }
        }
    }
    return langType;
}
function langTypeDetect(sentence) {
    let langType = (0, franc_1.franc)(sentence, { only: supportLangCodes });
    let possibleTypes = langjudge.langAllContain(sentence);
    if (langType === "und" || possibleTypes.indexOf("Chinese") > -1) {
        langType = judge_type(possibleTypes);
    }
    else {
        langType = utils.regulateLangCode(langType, langCodes);
    }
    return langType;
}
exports.langTypeDetect = langTypeDetect;
function configLanguages(langList) {
    let newCodes = [];
    let newLangs = [];
    for (let lang of langList) {
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
    for (let key of Object.keys(config)) {
        if (Reflect.has(tokenizerConfig, key)) {
            tokenizerConfig[key] = config[key];
        }
    }
}
exports.configTokenizer = configTokenizer;
let customStopwords, customTokenizer, customStemmer;
function setCustomTokenizer(tokenizer) {
    try {
        let res = tokenizer.tokenize("Hello world this is a test");
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
        filter.forEach((f) => {
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
        let res = stemmer.stem("Hello world this is a test");
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
    for (let filter of filters) {
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
    sentence = utils.toCDB(sentence);
    let langType = langTypeDetect(sentence);
    let tokens = [];
    try {
        if (tokenizerConfig.customTokenizer) {
            tokens = customTokenizer.tokenize(sentence);
        }
        else if (langType === "Chinese") {
            let arr = segmentit.doSegment(sentence, {
                stripPunctuation: true,
            });
            for (let item of arr) {
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
    tokens = tokens.map((token) => {
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
            for (let k in tokens) {
                tokens[k] = customStemmer.stem(tokens[k]);
            }
        }
        else if (langType in stemmerFuns) {
            let stemmer = stemmerFuns[langType];
            for (let k in tokens) {
                tokens[k] = stemmer.stem(tokens[k]);
            }
        }
    }
    catch (e) {
        console.error(e);
    }
    if (filters.length > 0) {
        let tmp = [];
        for (let token of tokens) {
            if (tokenFilter(token)) {
                tmp.push(token);
            }
        }
        tokens = tmp;
    }
    let result = {};
    for (let item of tokens) {
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
