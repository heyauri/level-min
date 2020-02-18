import franc from "franc"
import langjudge from "langjudge"
import natural from "natural"
import {Segment, useDefault} from 'segmentit';
import stopword from "stopword"


const segmentit = useDefault(new Segment());
const defaultTokenizer = new natural.WordTokenizer();

const code_obj = {
    "cmn": "Chinese", "jpn": "Japanese", "spa": "Spanish", "eng": "English",
    "rus": "Russian", "fas": "Persian", "fra": "French", "vie": "Vietnamese",
    "swe": "Swedish", "ita": "Italian", "pol": "Polish", "por": "Portuguese",
    "nld": "Dutch", "ind": "Indonesian"
};

//Don't Change the sequence. It is related to the language-type-detect function.
const tokenizer_funs = {
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

const stemmers_funs = {
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

const stopword_objs = {
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


//To avoid duplicate operation of get keys.
const support_lang_codes = Object.keys(code_obj);
const tokenizers = Object.keys(tokenizer_funs);
const stopwords = Object.keys(stopword_objs);

function regulate_lang_code(code) {
    return code in code_obj ? code_obj[code] : "Default"
}

function judge_type(types) {
    let lang_type = "Default";
    if (types.indexOf("Chinese") > -1) {
        lang_type = "Chinese";
    }
    else {
        for (let key of tokenizers) {
            if (types.indexOf(key) > -1) {
                return key;
            }
        }
    }
    return lang_type;
}

export default function (sentence) {
    //language Detect
    let lang_type = franc(sentence,{only:support_lang_codes});
    let possible_types = langjudge.langAllContain(sentence);
    //This is the backup for some situations that the franc can not detect the language and return "und"
    if (lang_type === "und" || possible_types.indexOf("Chinese") > -1) {
        lang_type = judge_type(possible_types);
    } else {
        lang_type = regulate_lang_code(lang_type);
    }
    let tokens = [];
    try {
        if (lang_type === "Chinese") {
            let arr = segmentit.doSegment(sentence, {
                stripPunctuation: true
            });
            for (let item of arr) {
                tokens.push(item.w);
            }
        } else {
            if(lang_type in tokenizers){
                tokens = tokenizer_funs[lang_type].tokenize(sentence);
            }else{
                tokens = defaultTokenizer.tokenize(sentence);
            }
        }
    } catch (e) {
        console.error(e);
        tokens = defaultTokenizer.tokenize(sentence);
    }
    //Stopwords
    try{
        if(lang_type in stopwords){
            tokens = stopword.removeStopwords(tokens,stopword_objs[lang_type]);
        }
    }catch (e) {
        console.error(e);
    }
    //Stemmers
    try {
        if (lang_type in stemmers_funs) {
            let stemmer = stemmers_funs[lang_type];
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
    //console.log(lang_type,result);
    return result;
}