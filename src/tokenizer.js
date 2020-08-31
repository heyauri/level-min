import franc from "franc"
import langjudge from "langjudge"
import natural from "natural"
import {Segment, useDefault} from 'segmentit';
import stopword from "stopword"
import * as utils from "./utils.js"


const segmentit = useDefault(new Segment());
const defaultTokenizer = new natural.WordTokenizer();

const codeObj = {
    "cmn": "Chinese", "jpn": "Japanese", "spa": "Spanish", "eng": "English",
    "rus": "Russian", "fas": "Persian", "fra": "French", "vie": "Vietnamese",
    "swe": "Swedish", "ita": "Italian", "pol": "Polish", "por": "Portuguese",
    "nld": "Dutch", "ind": "Indonesian"
};

const nameToCode = Object.keys(codeObj).reduce((prev, curr) => {
    prev[codeObj[curr]] = curr;
    return prev;
}, {});

//Don't Change the sequence. It is related to the language-type-detect function.
const tokenizerFuns = {
    "Japanese": new natural.TokenizerJa(),
    "English": new natural.AggressiveTokenizer(),
    "Spanish": new natural.AggressiveTokenizerEs(),
    "Russian": new natural.AggressiveTokenizerRu(),
    "Cyrillic": new natural.AggressiveTokenizerRu(),
    "Persian": new natural.AggressiveTokenizerFa(),
    "French": new natural.AggressiveTokenizerFr(),
    "Vietnamese": new natural.AggressiveTokenizerVi(),
    "Swedish": new natural.AggressiveTokenizerSv(),
    "Italian": new natural.AggressiveTokenizerIt(),
    "Polish": new natural.AggressiveTokenizerPl(),
    "Portuguese": new natural.AggressiveTokenizerPt(),
    "Default": defaultTokenizer
};

const stemmerFuns = {
    "English": natural.PorterStemmer,
    "French": natural.PorterStemmerFr,
    "Italian": natural.PorterStemmerIt,
    "Japanese": natural.StemmerJa,
    "Portuguese": natural.PorterStemmerPt,
    "Russian": natural.PorterStemmerRu,
    "Cyrillic": natural.PorterStemmerRu,
    "Swedish": natural.PorterStemmerSv,
    "Dutch": natural.PorterStemmerNl,
    "Indonesian": natural.StemmerId,
};

const stopwordObjs = {
    "Japanese": stopword.ja,
    "English": stopword.en,
    "Spanish": stopword.es,
    "Russian": stopword.ru,
    "Cyrillic": stopword.ru,
    "Persian": stopword.fa,
    "French": stopword.fr,
    "Vietnamese": stopword.vi,
    "Swedish": stopword.sv,
    "Italian": stopword.it,
    "Polish": stopword.pl,
    "Portuguese": stopword.pt,
    "Chinese": stopword.zh
};

// more custom setting
let tokenizerConfig = {
    tokenizer: true,
    stemmer: true,
    stopword: true,
    customTokenizer: false,
    customStopword: false,
    customStemmer: false
};


//To avoid duplicate operation of get keys.
let supportLangCodes = Object.keys(codeObj);
let supportLangNames = Object.keys(nameToCode);
const tokenizers = Object.keys(tokenizerFuns);
const stopwords = Object.keys(stopwordObjs);

function regulateLangCode(code) {
    return code in codeObj ? codeObj[code] : "Default"
}

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
    //language Detect
    let langType = franc(sentence, {only: supportLangCodes});
    let possibleTypes = langjudge.langAllContain(sentence);
    //This is the backup for some situations that the franc can not detect the language and return "und"
    if (langType === "und" || possibleTypes.indexOf("Chinese") > -1) {
        langType = judge_type(possibleTypes);
    } else {
        langType = regulateLangCode(langType);
    }
    return langType
}

function configLanguages(langList) {
    let newCodes = [];
    let newLangs = [];
    for (let lang of langList) {
        if (lang in supportLangNames) {
            newLangs.push(lang);
            newCodes.push(nameToCode[lang]);
        }
    }
    supportLangNames = newLangs;
    supportLangCodes = newCodes;
}

function configTokenizer(config) {
    for (let key of Object.keys(config)) {
        if (key in tokenizerConfig ) {
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
            console.log("The internal tokenizer have already switched to the custom one.")
        } else {
            console.error("The output from custom-tokenizer is not the required format. Setting fail.")
        }
    } catch (e) {
        console.error(e);
        console.error("Oops... The operation of switching the tokenizer have encountered an error.")
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
        let res = stemmer.stem("Hello world this is a test");
        if (utils.isString(res)) {
            customStemmer = stemmer;
            tokenizerConfig.customStemmer = true;
            console.log("The internal stemmer have already switched to the custom one.")
        } else {
            console.error("The output from custom-stemmer is not the required format. Setting fail.")
        }
    } catch (e) {
        console.error(e);
        console.error("Oops... The operation of switching the stemmer have encountered an error.")
    }
}


function tokenize(sentence) {
    if(typeof sentence !== "string")
    {
        if (utils.isNumber(sentence)) {
            return sentence.toString();
        }else{
            sentence = JSON.stringify(sentence);
        }
    }
    let langType = langTypeDetect(sentence);
    let tokens = [];
    try {
        if (tokenizerConfig.customTokenizer) {
            tokens = customTokenizer.tokenize(sentence)
        } else if (langType === "Chinese") {
            let arr = segmentit.doSegment(sentence, {
                stripPunctuation: true
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

    tokens = tokens.map(token => {
        return token.trim().toLowerCase();
    });
    //Stopwords
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
        if (tokenizerConfig.customStemmer){
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
    } catch (e) {
        console.error(e);
    }
    let result = {};
    for (let item of tokens) {
        if (!(item in result)) {
            result[item] = 1;
        } else {
            result[item] += 1;
        }
    }
    //console.log(langType,result);
    return result;
}

export {
    tokenize,
    configLanguages,
    langTypeDetect,
    setCustomStopwords,
    setCustomTokenizer,
    setCustomStemmer,
    configTokenizer
}
