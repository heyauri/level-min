const Min = require("./lib/main.js");
const utils = require("./lib/utils");
const min = new Min("data");

let tokenizer = min.tokenizer;

min.tokenizer.configLanguages(["Chinese","English","Japanese","Spanish","Russian","Italian"]);

min.tokenizer.setCustomStopwords(["avi","1080"]);



min.put("ttt",
    {"abc":1234,"a":"14515"},
    {"valueWeightCalc":true}).then(info=>{
        console.log(info);
}).catch(e=>{
        console.log(e);
})


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
