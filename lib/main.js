"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _level = _interopRequireDefault(require("level"));

var _path = _interopRequireDefault(require("path"));

var _md = _interopRequireDefault(require("md5"));

function constrruvt_key(key) {
  return "0x002_" + key.toString();
}

var Min =
/*#__PURE__*/
function () {
  function Min() {
    (0, _classCallCheck2["default"])(this, Min);

    if (arguments.length > 0) {
      this.set_db(arguments[0], arguments[1]);
    }
  }

  (0, _createClass2["default"])(Min, [{
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
  }, {
    key: "put",
    value: function () {
      var _put = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee(key, value, options) {
        var k, v;
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                k = (0, _md["default"])(key);
                _context.next = 3;
                return this.db.get(constrruvt_key(k))["catch"](function (e) {
                  if (e.type === "NotFoundError") {
                    return false;
                  }
                });

              case 3:
                v = _context.sent;
                console.log(v);

              case 5:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function put(_x, _x2, _x3) {
        return _put.apply(this, arguments);
      }

      return put;
    }()
  }]);
  return Min;
}();

module.exports = Min;