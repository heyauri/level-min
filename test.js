const Min = require("./lib/main.js");
const utils = require("./lib/utils");
const min = new Min("data");

let tokenizer = min.tokenizer;

min.tokenizer.configLanguages(["Chinese","English","Japanese","Spanish","Russian","Italian"]);

min.tokenizer.loadCHSCustomDict(["农商行|0x0008|101000"]);
min.tokenizer.loadCHSCustomStopword(["大"]);
min.tokenizer.setCustomStopwords(["avi","1080"]);

min.tokenizer.applyCustomTokenFilter(function(str){ return str.length > 1 });

console.log(min.tokenizer.tokenize("其次，要保持良好心态，摆正工作态度。银行职员的心态往往是诱发各类金融犯罪的罪魁祸首，比如拜金主义思想会激发内心的贪欲，超前消费观念则会导致变异的社会心态，侥幸心理会使人胆大妄为，又比如当员工在工作中接触了数量众多的大客户时，产生了心理不平衡等等。因此，对于我们农商行的每一名员工来说，更加需要懂得调整调节自己的心态，始终保持一种良好的心境，不被歪风邪气所影响，廉洁自爱，踏踏实实做好本职工作。"));

min.put("ttt",
    {"abc":1234,"a":"14515","content":"其次，要保持良好心态，摆正工作态度。银行职员的心态往往是诱发各类金融犯罪的罪魁祸首，比如拜金主义思想会激发内心的贪欲，超前消费观念则会导致变异的社会心态，侥幸心理会使人胆大妄为，又比如当员工在工作中接触了数量众多的大客户时，产生了心理不平衡等等。因此，对于我们农商行的每一名员工来说，更加需要懂得调整调节自己的心态，始终保持一种良好的心境，不被歪风邪气所影响，廉洁自爱，踏踏实实做好本职工作。"},
    {"valueWeightCalc":true,"valueWeights":{"content":1}}).then(info=>{
        console.log(info);
}).catch(e=>{
        console.log(e);
});


/*
min.search("卧槽了不起的修仙模拟器", {cosineSimilarity:true}).then(res=> {
    console.log(res);
});


min.cleanUpdate("1",
    {1:"卧槽 11111这他妈的什么玩意呀"},
    {"valueWeightCalc":true}).then(info=>{
    //console.log(info);
    min.cleanGet("1").then(info=>{
        console.log(info);
    })
});


min.fixDocCount();


min.cleanGet("1122").then(info=>{
    console.log(info);
}).catch(e=>{
    console.log(e)
});
*/

setTimeout(()=>{
    min.printAll();
},500);
