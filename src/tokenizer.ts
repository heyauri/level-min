import * as franc from "franc";
import * as langjudge from "langjudge";
import * as natural from "natural";
import { Segment, useDefault } from "segmentit";
import * as stopword from "stopword";
import * as utils from "./utils";

const fs = require("fs");
const path = require("path");

const segmentit = useDefault(new Segment());
const defaultTokenizer = new natural.WordTokenizer();

// Load all custom Chiness Dict
let baseDictDir = path.join(__dirname, "../dict");
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

//Don't Change the sequence. It is related to the language-type-detect function.
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

// more custom setting
let tokenizerConfig = {
    tokenizer: true,
    stemmer: true,
    stopword: true,
    customTokenizer: false,
    customStopword: false,
    customStemmer: false,
};

//To avoid duplicate operation of get keys.
let supportLangCodes = Object.keys(langCodes);
let supportLangNames = Object.keys(langNames);
const tokenizers = Object.keys(tokenizerFuns);
const stopwords = Object.keys(stopwordObjs);
let filters = [];

function loadCHSCustomDict(dict) {
    try {
        segmentit.loadDict(dict);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

function loadCHSCustomStopword(stopwords) {
    try {
        segmentit.loadStopwordDict(stopwords);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

function regulateLangCode(code) {
    return Reflect.has(langCodes, code) ? langCodes[code] : "Default";
}

function judge_type(types) {
    let langType = "Default";
    if (types.indexOf("Chinese") > -1) {
        langType = "Chinese";
    } else {
        for (let key of tokenizers) {
            if (types.indexOf(key) > -1) {
                return key;
            }
        }
    }
    return langType;
}

function langTypeDetect(sentence) {
    //language Detect
    let langType = franc(sentence, { only: supportLangCodes });
    let possibleTypes = langjudge.langAllContain(sentence);
    //This is the backup for some situations that the franc can not detect the language and return "und"
    if (langType === "und" || possibleTypes.indexOf("Chinese") > -1) {
        langType = judge_type(possibleTypes);
    } else {
        langType = regulateLangCode(langType);
    }
    return langType;
}

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

function configTokenizer(config) {
    for (let key of Object.keys(config)) {
        if (Reflect.has(tokenizerConfig, key)) {
            tokenizerConfig[key] = config[key];
        }
    }
}

let customStopwords, customTokenizer, customStemmer;

function setCustomTokenizer(tokenizer) {
    try {
        let res = tokenizer.tokenize("Hello world this is a test");
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

//filter should be a function that return true => the token will be kept or false => the token will be abandoned
function applyCustomTokenFilter(filter) {
    if (utils.isArray(filter)) {
        filter.forEach((f) => {
            applyCustomTokenFilter(f);
        });
    } else if (utils.isFunction(filter)) {
        filters.push(filter);
    }
}

function setCustomStemmer(stemmer) {
    try {
        let res = stemmer.stem("Hello world this is a test");
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

function tokenFilter(token) {
    for (let filter of filters) {
        if (!filter(token)) {
            return false;
        }
    }
    return true;
}

let regex_1 = /(‘|’|“|”|，|。|（|）|·|`|\(|\)|;|,)/g

function tokenize(paragraph) {
    if (!paragraph) return {};
    if (!utils.isString(paragraph)) {
        try {
            if (utils.isNumber(paragraph) || utils.isBoolean(paragraph)) {
                paragraph = paragraph.toString();
            }
            else if (utils.isArray(paragraph) || utils.isObject(paragraph)) {
                paragraph = JSON.stringify(paragraph);
            }
        } catch (e) {
            return {};
        }
    }
    let para = paragraph.replace("�", "").replace(regex_1, "\n");
    let sentences = para.split("\n");
    let result = {};
    for (let sentence of sentences) {
        if (typeof sentence !== "string") {
            if (utils.isNumber(sentence)) {
                return sentence.toString();
            } else {
                sentence = JSON.stringify(sentence);
            }
        }
        sentence = utils.toCDB(sentence);
        let langType = langTypeDetect(sentence);
        let tokens = [];
        try {
            if (tokenizerConfig.customTokenizer) {
                tokens = customTokenizer.tokenize(sentence);
            } else if (langType === "Chinese") {
                let arr = segmentit.doSegment(sentence, {
                    stripPunctuation: true,
                });
                for (let item of arr) {
                    tokens.push(item.w);
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

        tokens = tokens.map((token) => {
            return utils.toCDB(token.trim().toLowerCase());
        });
        //Stop words
        try {
            if (langType in stopwords) {
                tokens = stopword.removeStopwords(tokens, stopwordObjs[langType]);
            }
            if (tokenizerConfig.customStopword) {
                tokens = stopword.removeStopwords(tokens, customStopwords);
            }
        } catch (e) {
            console.error(e);
        }
        //Stemmers
        try {
            if (tokenizerConfig.customStemmer) {
                for (let k in tokens) {
                    tokens[k] = customStemmer.stem(tokens[k]);
                }
            } else if (langType in stemmerFuns) {
                let stemmer = stemmerFuns[langType];
                for (let k in tokens) {
                    tokens[k] = stemmer.stem(tokens[k]);
                }
            }
        } catch (e) {
            console.error(e);
        }
        //Custom filters
        if (filters.length > 0) {
            let tmp = [];
            for (let token of tokens) {
                if (tokenFilter(token)) {
                    tmp.push(token);
                }
            }
            tokens = tmp;
        }
        for (let item of tokens) {
            if (!Reflect.has(result, item)) {
                result[item] = 1;
            } else {
                result[item] += 1;
            }
        }
    }
    //console.log(langType,result);
    return result;
}

export { tokenize, configLanguages, langTypeDetect, setCustomStopwords, setCustomTokenizer, setCustomStemmer, configTokenizer, loadCHSCustomDict, loadCHSCustomStopword, applyCustomTokenFilter };
