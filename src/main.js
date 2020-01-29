import Level from "level"
import path from "path"
import md5 from "md5"
import * as utils from "./utils.js"
import tokenizer from "./tokenizer.js"

function construct_index(index) {
    return "0x002_" + index.toString();
}

function construct_key(key) {
    return "0x002_" + key.toString();
}





class Min {
    constructor() {
        if (arguments.length > 0) {
            this.set_db(arguments[0], arguments[1])
        }
    }

    set_db(db_address, options) {
        try {
            if (db_address.indexOf("/") < 0 && db_address.indexOf("\\") < 0) {
                db_address = path.join(process.cwd(), db_address);
            }
            options = options || {};
            this.db = Level(db_address, options);
            console.log("Leveldb selected: " + db_address);
        } catch (e) {
            console.error("Leveldb setup failed at: " + db_address + " \nPlease check your db_address and options.");
            console.error(e);
        }
    }

    init_options(options){
        if(!options){
            options={};
        }
        if(!(options["key_weight"] in options) || !utils.isNumber(options["key_weight"])){
            options["key_weight"]=1;
        }
        if(!(options["value_weight_diff"] in options)){
            options["value_weight_diff"]=false;
        }
        if(!(options["default_value_weight"] in options) || !utils.isNumber(options["default_value_weight"])){
            options["default_value_weight"]=1;
        }
        if(!(options["value_weights"] in options) || !utils.isObject(options["value_weights"])){
            options["value_weights"]={};
        }
    }

    create(key, value, options){
        let tokens={};
        if (options["key_weight"]){
            let temp_tokens=tokenizer(key);
        }

    }

    async put(key, value, options) {
        let k = md5(key);
        this.init_options(options);
        let obj = await this.db.get(construct_key(k)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        options=this.init_options(options);
        if (!obj){
            this.create(key,value,options)
        }else{

        }


    }

}

module.exports = Min;