"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _level = _interopRequireDefault(require("level"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var Min =
/*#__PURE__*/
function () {
  function Min() {
    _classCallCheck(this, Min);
  }

  _createClass(Min, [{
    key: "set_db",
    value: function set_db(db_address, options) {
      try {
        if (db_address.indexOf("/") < 0 && db_address.indexOf("\\") < 0) {
          db_address = _path["default"].join(process.cwd(), db_address);
        }

        options = options || {};
        this.db = (0, _level["default"])(db_address, options);
        console.log("Leveldb selected: " + db_address);
      } catch (e) {
        console.error("Leveldb setup failed at: " + db_address + " \nPlease check your db_address and options.");
        console.error(e);
      }
    }
  }]);

  return Min;
}();

var min = new Min();
var _default = min;
exports["default"] = _default;
module.exports = min;