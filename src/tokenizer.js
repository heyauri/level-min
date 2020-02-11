import franc from "franc"
import langjudge from "langjudge"
import natural from "natural"
import {Segment, useDefault} from 'segmentit';


const segmentit = useDefault(new Segment());
const defaultTokenizer = new natural.WordTokenizer();

const code_obj = {
    "cmn": "Chinese", "jpn": "Japanese", "spa": "Spanish", "eng": "English",
    "rus": "Russian", "fas": "Persian", "fra": "French", "vie": "Vietnamese",
    "swe": "Swedish", "ita": "Italian", "pol": "Polish", "por": "Portuguese"
};

//Don't Change the sequence. It is related to the type detect fuction.
const tokenizer_obj = {
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

const stemmers_obj = {
    "English":natural.PorterStemmer,
    "French":natural.PorterStemmerFr,
    "Italian":natural.PorterStemmerIt,
    "Japanese":natural.StemmerJa,
    "Portugese":natural.PorterStemmerPt,
    "Russian":natural.PorterStemmerRu,
    "Cyrillic":natural.PorterStemmerRu,
    "Swedish":natural.PorterStemmerSv
};

function regulate_lang_code(code) {
    return code in code_obj ? code_obj[code] : "Default"
}

function judge_type(types) {
    let lang_type = "Default";
    if (types.indexOf("Chinese") > -1) {
        lang_type = "Chinese";
    }
    else {
        for (let key in tokenizer_obj) {
            if (types.indexOf(key) > -1) {
                return key;
            }
        }
    }
    return lang_type;
}

export default function (sentence) {
    //language Detect
    let lang_type = franc(sentence);
    //This is the backup for some situations that the franc can not detect the language and return "und"
    // console.log(lang_type);
    if (lang_type === "und") {
        let possible_types = langjudge.langAllContain(sentence);
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
            tokens = tokenizer_obj[lang_type].tokenize(sentence);
        }
    } catch (e) {
        console.error(e);
        tokens = defaultTokenizer.tokenize(sentence);
    }

    //TODO: Remove Stopwords

    //Stemmers
    try{
        if(lang_type in stemmers_obj){
            let stemmer = stemmers_obj[lang_type];
            for(let k in tokens){
                tokens[k]=stemmer.stem(tokens[k]);
            }
        }
    }catch (e) {
        console.error(e);
    }

    let result = {};
    for(let item of tokens){
        if(!(item in result)){
            result[item]=1;
        }else {
            result[item]+=1;
        }
    }

    //console.log(lang_type,result);
    return result;
}