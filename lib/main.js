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
  return "0x001_" + index.toString();
}

function construct_key(key) {
  return "0x002_" + key.toString();
}

function stringify(value) {
  if (utils.isString(value)) {
    return value;
  } else if (utils.isNumber(value)) {
    return value.toString();
  } else if (utils.isArray(value) || utils.isObject(value)) {
    return JSON.stringify(value);
  }
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
    key: "search_index",
    value: function search_index(token) {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this.db.get(construct_index(token)).then(function (result) {
          resolve(JSON.parse(result));
        })["catch"](function (e) {
          if (e.type === "NotFoundError") {
            // v: {docId:tf,...}
            resolve({
              t: token,
              l: 0,
              v: {}
            });
          } else {
            console.error(e);
            reject(e);
          }
        });
      });
    }
  }, {
    key: "create",
    value: function () {
      var _create = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee(key, value, options) {
        var _this2 = this;

        var doc_id, tokens, doc_count, promise_arr, _i2, _Object$keys2, token, ops;

        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                doc_id = (0, _md["default"])(key);
                tokens = this.get_tokens(key, value, options);
                _context.next = 4;
                return this.db.get("0x000_doc_count")["catch"](function (e) {
                  return e.type === "NotFoundError" ? 0 : false;
                });

              case 4:
                doc_count = _context.sent;
                promise_arr = [];

                for (_i2 = 0, _Object$keys2 = Object.keys(tokens); _i2 < _Object$keys2.length; _i2++) {
                  token = _Object$keys2[_i2];
                  promise_arr.push(this.search_index(token));
                }

                _context.next = 9;
                return Promise.all(promise_arr).then(function (results) {
                  var ops = [];
                  var _iteratorNormalCompletion = true;
                  var _didIteratorError = false;
                  var _iteratorError = undefined;

                  try {
                    for (var _iterator = results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                      var obj = _step.value;

                      if (!(doc_id in obj["v"])) {
                        obj["l"] += 1;
                      }

                      obj["v"][doc_id] = tokens[obj["t"]];
                      ops.push({
                        "type": "put",
                        "key": construct_index(obj["t"]),
                        "value": JSON.stringify(obj)
                      });
                    }
                  } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion && _iterator["return"] != null) {
                        _iterator["return"]();
                      }
                    } finally {
                      if (_didIteratorError) {
                        throw _iteratorError;
                      }
                    }
                  }

                  ops.push({
                    "type": "put",
                    "key": construct_key(doc_id),
                    "value": JSON.stringify({
                      "k": key,
                      "v": JSON.stringify(value),
                      "o": JSON.stringify(options)
                    })
                  });
                  return ops;
                })["catch"](function (e) {
                  console.error("Oops...The Create operation is interrupted by an internal error.");
                  return false;
                });

              case 9:
                ops = _context.sent;
                console.log(tokens);
                console.log(ops);
                return _context.abrupt("return", new Promise(function (resolve, reject) {
                  _this2.db.batch(ops).then(function (info) {
                    resolve(info);
                  })["catch"](function (e) {
                    console.error(e);
                    console.error("Oops...The Create operation is interrupted by an internal error.");
                    reject(e);
                  });
                }));

              case 13:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function create(_x, _x2, _x3) {
        return _create.apply(this, arguments);
      }

      return create;
    }()
  }, {
    key: "put",
    value: function () {
      var _put = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee2(key, value, options) {
        var doc_id, obj;
        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                doc_id = (0, _md["default"])(key);
                options = this.init_options(options);
                _context2.next = 4;
                return this.db.get(construct_key(doc_id))["catch"](function (e) {
                  if (e.type === "NotFoundError") {
                    return false;
                  }
                });

              case 4:
                obj = _context2.sent;
                options = this.init_options(options);

                if (!obj) {
                  this.create(key, value, options);
                } else {
                  console.log(obj);
                }

              case 7:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function put(_x4, _x5, _x6) {
        return _put.apply(this, arguments);
      }

      return put;
    }()
  }]);
  return Min;
}();

module.exports = Min;