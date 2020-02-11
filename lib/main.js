"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _level = _interopRequireDefault(require("level"));

var _path = _interopRequireDefault(require("path"));

var _md = _interopRequireDefault(require("md5"));

var utils = _interopRequireWildcard(require("./utils.js"));

var _tokenizer = _interopRequireDefault(require("./tokenizer.js"));

function construct_index(index) {
  return "0x002_" + index.toString();
}

function construct_key(key) {
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
    key: "init_options",
    value: function init_options(options) {
      if (!options) {
        options = {};
      }

      if (!("key_weight" in options) || !utils.isNumber(options["key_weight"])) {
        options["key_weight"] = 1;
      }

      if (!("value_weight_calc" in options)) {
        options["value_weight_calc"] = false;
      }

      if (!("default_value_weight" in options) || !utils.isNumber(options["default_value_weight"])) {
        options["default_value_weight"] = 1;
      }

      if (!("value_weights" in options) || !utils.isObject(options["value_weights"])) {
        options["value_weights"] = {};
      }

      return options;
    }
  }, {
    key: "get_tokens",
    value: function get_tokens(key, value, options) {
      var tokens = {};
      var temp_tokens = {};

      if (options["key_weight"]) {
        var _temp_tokens = (0, _tokenizer["default"])(key);

        utils.mergeTokens(tokens, _temp_tokens);
      }

      if (options["value_weight_calc"]) {
        var default_value_weight = options["default_value_weight"];
        var value_weights = options["value_weights"];

        if (utils.isString(value)) {
          temp_tokens = (0, _tokenizer["default"])(value);
          utils.mergeTokens(tokens, temp_tokens, default_value_weight);
        } else if (utils.isObject(value)) {
          for (var _i = 0, _Object$keys = Object.keys(value); _i < _Object$keys.length; _i++) {
            var _key = _Object$keys[_i];

            if (_key in value_weights || default_value_weight > 0) {
              temp_tokens = (0, _tokenizer["default"])(value[_key]);
              var weight = _key in value_weights ? value_weights[_key] : default_value_weight;
              utils.mergeTokens(tokens, temp_tokens, weight);
            }
          }
        } else if (utils.isArray(value)) {
          for (var i = 0; i < value.length; i++) {
            if (i in value_weights || default_value_weight > 0) {
              temp_tokens = (0, _tokenizer["default"])(value[i]);

              var _weight = i in value_weights ? value_weights[i] : default_value_weight;

              utils.mergeTokens(tokens, temp_tokens, _weight);
            }
          }
        }
      }

      return tokens;
    }
  }, {
    key: "create",
    value: function create(key, value, options) {
      var tokens = this.get_tokens(key, value, options);
      console.log(tokens);
    }
  }, {
    key: "put",
    value: function () {
      var _put = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee(key, value, options) {
        var k, obj;
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                k = (0, _md["default"])(key);
                options = this.init_options(options);
                _context.next = 4;
                return this.db.get(construct_key(k))["catch"](function (e) {
                  if (e.type === "NotFoundError") {
                    return false;
                  }
                });

              case 4:
                obj = _context.sent;
                options = this.init_options(options);

                if (!obj) {
                  this.create(key, value, options);
                } else {}

              case 7:
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