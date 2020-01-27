import Level from "level"
import path from "path"
import md5 from "md5"

function construct_index(index) {
    return "0x002_" + index.toString();
}

function construct_key(key) {
    return "0x002_" + key.toString();
}

function diff_of_strings(a,b){

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

    create(key, value, options){

    }

    async put(key, value, options) {
        let k = md5(key);
        let obj = await this.db.get(construct_key(k)).catch(e => {
            if (e.type === "NotFoundError") {
                return false;
            }
        });
        if (!obj){
            this.create(key,value,options)
        }else{

        }


    }

}

module.exports = Min;