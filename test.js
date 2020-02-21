const Min = require("./lib/main.js");
const utils =require("./lib/utils");
const min = new Min("data");

min.put("11",
    "this is a test of the language detect significant",
    {"valueWeightCalc":true}).then(info=>{
        console.log(info);

});
min.put("This is a test of",
    "了不起的修仙模拟器 Jack  Tom love chicken...",
    {"valueWeightCalc":true}).then(info=>{
    console.log(info);

});
min.put("1",
    "卧槽 这他妈的什么玩意呀",
    {"valueWeightCalc":true}).then(info=>{
    //console.log(info);
    //min.get_all();
    min.get("1").then(info=>{
        //console.log(info);
    })
});

min.search("卧槽了不起的修仙模拟器",10).then(res=>{
    console.log(res);
});

min.fixDocCount();