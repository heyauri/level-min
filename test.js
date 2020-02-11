const Min = require("./lib/main.js");

const min = new Min("data");

min.put("This is a test of the language detect, where is your daddy sons?",
    "this is a test of the language detect",
    {"value_weight_calc":true});
