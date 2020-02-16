const Min = require("./lib/main.js");

const min = new Min("data");

min.put("11",
    "this is a test of the language detect significant",
    {"value_weight_calc":true}).then(info=>{
        console.log(info);
    min.put("This is a test of",
        "了不起的修仙模拟器Jack  Tom love chicken...",
        {"value_weight_calc":true}).then(info=>{
        console.log(info);
        min.put("1",
            "卧槽 这他妈的什么玩意呀",
            {"value_weight_calc":true}).then(info=>{
            console.log(info);
            min.get_all();
            min.del("1").then(info=>{
                console.log(info);
                min.get("11").then(info=>{
                    console.log(info)
                })
            });
        });
    });
});