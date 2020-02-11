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
        if(!("key_weight" in options) || !utils.isNumber(options["key_weight"])){
            options["key_weight"]=1;
        }
        if(!("value_weight_calc" in options)){
            options["value_weight_calc"]=false;
        }
        if(!("default_value_weight" in options) || !utils.isNumber(options["default_value_weight"])){
            options["default_value_weight"]=1;
        }
        if(!("value_weights" in options) || !utils.isObject(options["value_weights"])){
            options["value_weights"]={};
        }
        return options;
    }



    get_tokens(key, value, options){
        let tokens={};
        let temp_tokens={};
        if (options["key_weight"]){
            let temp_tokens=tokenizer(key);
            utils.mergeTokens(tokens,temp_tokens);
        }
        if(options["value_weight_calc"]){
            let default_value_weight=options["default_value_weight"];
            let value_weights=options["value_weights"];
            if(utils.isString(value)){
                temp_tokens=tokenizer(value);
                utils.mergeTokens(tokens,temp_tokens,default_value_weight);
            }else if(utils.isObject(value)){
                for(let key of Object.keys(value)){
                    if(key in value_weights || default_value_weight>0){
                        temp_tokens=tokenizer(value[key]);
                        let weight = key in value_weights? value_weights[key] : default_value_weight;
                        utils.mergeTokens(tokens,temp_tokens,weight);
                    }
                }
            }else if(utils.isArray(value)){
                for(let i=0;i<value.length;i++){
                    if(i in value_weights || default_value_weight>0){
                        temp_tokens=tokenizer(value[i]);
                        let weight = i in value_weights? value_weights[i] : default_value_weight;
                        utils.mergeTokens(tokens,temp_tokens,weight);
                    }
                }
            }
        }

        return tokens;
    }

    create(key, value, options){
        let tokens=this.get_tokens(key, value, options);
        console.log(tokens);
    }

    async put(key, value, options) {
        let k = md5(key);
        options=this.init_options(options);
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