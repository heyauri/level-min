import Level from "level"
import path from "path"

class Min {
    constructor() {
    }

    set_db(db_address,options){
        try{
            if(db_address.indexOf("/") < 0 && db_address.indexOf("\\") < 0){
                db_address=path.join(process.cwd(),db_address);
            }
            options= options || {};
            this.db = Level(db_address,options);
            console.log("Leveldb selected: "+db_address);
        }catch (e) {
            console.error("Leveldb setup failed at: "+db_address+" \nPlease check your db_address and options.");
            console.error(e);
        }
    }






}

const min = new Min();

export default min;

module.exports = min;