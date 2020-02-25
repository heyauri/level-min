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

var _deasync = _interopRequireDefault(require("deasync"));

var utils = _interopRequireWildcard(require("./utils.js"));

var tokenizer = _interopRequireWildcard(require("./tokenizer.js"));

function constructIndex(index) {
  return "0x001_" + index.toString();
}

function constructKey(key) {
  return "0x002_" + key.toString();
}

var Min =
/*#__PURE__*/
function () {
  function Min() {
    (0, _classCallCheck2["default"])(this, Min);

    if (arguments.length > 0) {
      this.setDB(arguments[0], arguments[1]);
    }

    var obj = this.optionsTable = {
      keyWeight: "kw",
      valueWeightCalc: "vwc",
      defaultValueWeight: "dvw",
      valueWeights: "vw"
    };
    this.compressOptionsTable = Object.keys(obj).reduce(function (prev, curr) {
      prev[obj[curr]] = curr;
      return prev;
    }, {});
    this.tokenizer = tokenizer;
  }

  (0, _createClass2["default"])(Min, [{
    key: "setDB",
    value: function setDB(dbAddress, options) {
      try {
        if (dbAddress.indexOf("/") < 0 && dbAddress.indexOf("\\") < 0) {
          dbAddress = _path["default"].join(process.cwd(), dbAddress);
        }

        options = options || {};
        this.db = (0, _level["default"])(dbAddress, options);

        var _this = this;

        var done = false;
        this.db.get("0x000_docCount", function (err, val) {
          if (!val && err) {
            if (err.type === "NotFoundError") {
              _this.docCount = 0;
            } else {
              throw err;
            }
          } else {
            _this.docCount = parseInt(val) ? parseInt(val) : 0;
          }

          done = true;
        });
        /*
          Covert the query of docCount from async to sync, to maintain its' consistency.
         */

        _deasync["default"].loopWhile(function () {
          return !done;
        });

        console.log("Leveldb selected: " + dbAddress);
      } catch (e) {
        console.error("Leveldb setup failed at: " + dbAddress + " \nPlease check your dbAddress and options.");
        console.error(e);
      }
    }
  }, {
    key: "setTokenizer",
    value: function setTokenizer(customTokenizer) {
      try {
        var res = customTokenizer.tokenize("Hello world this is a test");

        if (utils.isObject(res)) {
          this.tokenizer = customTokenizer;
          console.log("The internal tokenizer have already switched to the custom one.");
        } else {
          console.error("The output from custom-tokenizer is not the required format. Setting fail.");
        }
      } catch (e) {
        console.error(e);
        console.error("Oops... The operation of switching the tokenizer have encountered an error.");
      }
    } // Options -> a schema that contain the rules of token-frequency calculation.
    //        ["keyWeight"] -> the default weight of the tokens inside key
    //        ["valueWeightCalc"] -> if the token inside the value will be counted or not?
    //                                  True : False
    //        ["defaultValueWeight"] ->  the default weight of the tokens inside value
    //        ["valueWeights"] ->  The values for those spec key/index when the value is an Array/Object

  }, {
    key: "initOptions",
    value: function initOptions(options) {
      if (!options || !utils.isObject(options)) {
        options = {};
      }

      if ("keyWeight" in options && !utils.isNumber(options["keyWeight"])) {
        options["keyWeight"] = 1;
      }

      if ("defaultValueWeight" in options && !utils.isNumber(options["defaultValueWeight"])) {
        options["defaultValueWeight"] = 1;
      }

      if ("valueWeights" in options && !utils.isObject(options["valueWeights"])) {
        options["valueWeights"] = {};
      }

      return options;
    }
  }, {
    key: "compressOptions",
    value: function compressOptions(options) {
      var decompress = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var res = {};
      var table = decompress ? this.compressOptionsTable : this.optionsTable;

      for (var _i = 0, _Object$keys = Object.keys(options); _i < _Object$keys.length; _i++) {
        var key = _Object$keys[_i];
        if (key in table) res[table[key]] = options[key];
      }

      return res;
    }
  }, {
    key: "getTokens",
    value: function getTokens(key, value, options) {
      var tokens = {};
      var tempTokens = {};

      if (options["keyWeight"]) {
        var _tempTokens = this.tokenizer.tokenize(key);

        utils.mergeTokens(tokens, _tempTokens);
      }

      if (options["valueWeightCalc"]) {
        var defaultValueWeight = options["defaultValueWeight"];
        var valueWeights = options["valueWeights"];

        if (utils.isString(value)) {
          tempTokens = this.tokenizer.tokenize(value);
          utils.mergeTokens(tokens, tempTokens, defaultValueWeight);
        } else if (utils.isObject(value)) {
          for (var _i2 = 0, _Object$keys2 = Object.keys(value); _i2 < _Object$keys2.length; _i2++) {
            var _key = _Object$keys2[_i2];

            if (_key in valueWeights || defaultValueWeight > 0) {
              tempTokens = this.tokenizer.tokenize(value[_key]);
              var weight = _key in valueWeights ? valueWeights[_key] : defaultValueWeight;
              utils.mergeTokens(tokens, tempTokens, weight);
            }
          }
        } else if (utils.isArray(value)) {
          for (var i = 0; i < value.length; i++) {
            if (i in valueWeights || defaultValueWeight > 0) {
              tempTokens = this.tokenizer.tokenize(value[i]);

              var _weight = i in valueWeights ? valueWeights[i] : defaultValueWeight;

              utils.mergeTokens(tokens, tempTokens, _weight);
            }
          }
        } else if (utils.isNumber(value) || utils.isBoolean(value)) {
          try {
            tokens[value.toString()] = defaultValueWeight;
          } catch (e) {
            console.error(e);
          }
        }
      }

      return tokens;
    }
  }, {
    key: "searchIndex",
    value: function searchIndex(token) {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        _this2.db.get(constructIndex(token)).then(function (result) {
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
    key: "getDocCount",
    value: function () {
      var _getDocCount = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee() {
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.db.get("0x000_docCount")["catch"](function (e) {
                  return e.type === "NotFoundError" ? 0 : false;
                });

              case 2:
                return _context.abrupt("return", _context.sent);

              case 3:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function getDocCount() {
        return _getDocCount.apply(this, arguments);
      }

      return getDocCount;
    }()
  }, {
    key: "create",
    value: function () {
      var _create = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee2(key, value, options) {
        var _this3 = this;

        var docId, tokens, promiseArr, _i3, _Object$keys3, token, ops;

        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                docId = (0, _md["default"])(key);
                this.docCount += 1;
                tokens = this.getTokens(key, value, options);
                promiseArr = [];

                for (_i3 = 0, _Object$keys3 = Object.keys(tokens); _i3 < _Object$keys3.length; _i3++) {
                  token = _Object$keys3[_i3];
                  promiseArr.push(this.searchIndex(token));
                }

                _context2.next = 7;
                return Promise.all(promiseArr).then(function (results) {
                  var ops = [];
                  var _iteratorNormalCompletion = true;
                  var _didIteratorError = false;
                  var _iteratorError = undefined;

                  try {
                    for (var _iterator = results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                      var obj = _step.value;

                      if (!(docId in obj["v"])) {
                        obj["l"] += 1;
                      }

                      obj["v"][docId] = tokens[obj["t"]];
                      ops.push({
                        type: "put",
                        key: constructIndex(obj["t"]),
                        value: JSON.stringify(obj)
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
                    type: "put",
                    key: constructKey(docId),
                    value: JSON.stringify({
                      k: key,
                      v: JSON.stringify(value),
                      o: JSON.stringify(_this3.compressOptions(options))
                    })
                  });
                  ops.push({
                    type: "put",
                    key: "0x000_docCount",
                    value: _this3.docCount.toString()
                  });
                  return ops;
                })["catch"](function (e) {
                  console.error("Oops...The Create operation is interrupted by an internal error.");
                  return e;
                });

              case 7:
                ops = _context2.sent;
                return _context2.abrupt("return", new Promise(function (resolve, reject) {
                  if (ops instanceof EvalError) {
                    _this3.docCount -= 1;
                    reject(ops);
                  }

                  _this3.db.batch(ops).then(function (info) {
                    resolve("Put: " + key + " successfully.");
                  })["catch"](function (e) {
                    _this3.docCount -= 1;
                    console.error(e);
                    console.error("Oops...The Create operation is interrupted by an internal error.");
                    reject(e);
                  });
                }));

              case 9:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function create(_x, _x2, _x3) {
        return _create.apply(this, arguments);
      }

      return create;
    }()
  }, {
    key: "update",
    value: function () {
      var _update = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee3(key, value, options, prev_obj) {
        var _this4 = this;

        var docId, tokens, prevTokens, diffTokens, promiseArr, _i4, _Object$keys4, token, ops;

        return _regenerator["default"].wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                docId = (0, _md["default"])(key);
                tokens = this.getTokens(key, value, options);
                prevTokens = this.getTokens(prev_obj["k"], prev_obj["v"], prev_obj["o"]);
                diffTokens = utils.diffTokens(prevTokens, tokens);
                promiseArr = [];

                for (_i4 = 0, _Object$keys4 = Object.keys(diffTokens); _i4 < _Object$keys4.length; _i4++) {
                  token = _Object$keys4[_i4];
                  promiseArr.push(this.searchIndex(token));
                }

                tokens = diffTokens;
                _context3.next = 9;
                return Promise.all(promiseArr).then(function (results) {
                  var ops = [];
                  var _iteratorNormalCompletion2 = true;
                  var _didIteratorError2 = false;
                  var _iteratorError2 = undefined;

                  try {
                    for (var _iterator2 = results[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                      var obj = _step2.value;

                      //DEL:
                      if (tokens[obj["t"]] <= 0) {
                        delete obj["v"][docId];
                        obj["l"] = Object.keys(obj["v"]).length; //there is no other doc related to this index, delete it

                        if (obj["l"] === 0) {
                          ops.push({
                            type: "del",
                            key: constructIndex(obj["t"])
                          });
                          continue;
                        }
                      } else {
                        //UPDATE
                        if (!(docId in obj["v"])) {
                          obj["l"] += 1;
                        }

                        obj["v"][docId] = tokens[obj["t"]];
                      }

                      ops.push({
                        type: "put",
                        key: constructIndex(obj["t"]),
                        value: JSON.stringify(obj)
                      });
                    }
                  } catch (err) {
                    _didIteratorError2 = true;
                    _iteratorError2 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
                        _iterator2["return"]();
                      }
                    } finally {
                      if (_didIteratorError2) {
                        throw _iteratorError2;
                      }
                    }
                  }

                  ops.push({
                    type: "put",
                    key: constructKey(docId),
                    value: JSON.stringify({
                      k: key,
                      v: JSON.stringify(value),
                      o: JSON.stringify(_this4.compressOptions(options))
                    })
                  });
                  return ops;
                })["catch"](function (e) {
                  console.error("Oops...The Create operation is interrupted by an internal error.");
                  return e;
                });

              case 9:
                ops = _context3.sent;
                return _context3.abrupt("return", new Promise(function (resolve, reject) {
                  if (ops instanceof EvalError) {
                    reject(ops);
                  }

                  _this4.db.batch(ops).then(function (info) {
                    resolve("Put: " + key + " successfully.");
                  })["catch"](function (e) {
                    console.error(e);
                    console.error("Oops...The Create operation is interrupted by an internal error.");
                    reject(e);
                  });
                }));

              case 11:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function update(_x4, _x5, _x6, _x7) {
        return _update.apply(this, arguments);
      }

      return update;
    }()
  }, {
    key: "put",
    value: function () {
      var _put = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee4(key, value, options) {
        var docId, docCount, obj;
        return _regenerator["default"].wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                docId = (0, _md["default"])(key);
                docCount = this.docCount;

                if (!(!docCount && docCount !== 0)) {
                  _context4.next = 6;
                  break;
                }

                console.error("There are some internal errors inside the db about the docs' count, the PUT operation failed.");
                console.error("Try this.fixDocCount()");
                return _context4.abrupt("return", Promise.reject(false));

              case 6:
                _context4.next = 8;
                return this.db.get(constructKey(docId))["catch"](function (e) {
                  if (e.type === "NotFoundError") {
                    return false;
                  }
                });

              case 8:
                obj = _context4.sent;
                options = this.initOptions(options);
                _context4.prev = 10;

                if (obj) {
                  _context4.next = 17;
                  break;
                }

                _context4.next = 14;
                return this.create(key, value, options);

              case 14:
                return _context4.abrupt("return", _context4.sent);

              case 17:
                obj = JSON.parse(obj);
                obj["v"] = JSON.parse(obj["v"]);
                obj["o"] = JSON.parse(obj["o"]);

                if (!(key === obj["k"] && value === obj["v"] && options === obj["o"])) {
                  _context4.next = 24;
                  break;
                }

                return _context4.abrupt("return", true);

              case 24:
                _context4.next = 26;
                return this.update(key, value, options, obj);

              case 26:
                return _context4.abrupt("return", _context4.sent);

              case 27:
                _context4.next = 32;
                break;

              case 29:
                _context4.prev = 29;
                _context4.t0 = _context4["catch"](10);
                return _context4.abrupt("return", _context4.t0);

              case 32:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this, [[10, 29]]);
      }));

      function put(_x8, _x9, _x10) {
        return _put.apply(this, arguments);
      }

      return put;
    }()
  }, {
    key: "cleanUpdate",
    // just update the value inside without reindexing
    value: function () {
      var _cleanUpdate = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee5(key, value) {
        var docId, obj;
        return _regenerator["default"].wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                docId = (0, _md["default"])(key);
                _context5.next = 3;
                return this.db.get(constructKey(docId))["catch"](function (e) {
                  if (e.type === "NotFoundError") {
                    return false;
                  }
                });

              case 3:
                obj = _context5.sent;

                if (obj) {
                  _context5.next = 6;
                  break;
                }

                return _context5.abrupt("return", Promise.reject(key.toString() + " is not exist inside the db."));

              case 6:
                _context5.prev = 6;
                obj = JSON.parse(obj);
                obj["v"] = JSON.stringify(value);
                _context5.next = 11;
                return this.db.put(constructKey(docId), JSON.stringify(obj));

              case 11:
                return _context5.abrupt("return", _context5.sent);

              case 14:
                _context5.prev = 14;
                _context5.t0 = _context5["catch"](6);
                return _context5.abrupt("return", _context5.t0);

              case 17:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this, [[6, 14]]);
      }));

      function cleanUpdate(_x11, _x12) {
        return _cleanUpdate.apply(this, arguments);
      }

      return cleanUpdate;
    }()
  }, {
    key: "del",
    value: function () {
      var _del = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee6(key) {
        var _this5 = this;

        var docId, docCount, obj, value, options, tokens, promiseArr, _i5, _Object$keys5, token, ops;

        return _regenerator["default"].wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                docId = (0, _md["default"])(key);
                docCount = this.docCount;

                if (!(!docCount && docCount !== 0)) {
                  _context6.next = 6;
                  break;
                }

                console.error("There are some internal errors inside the db about the docs' count, the DEL operation failed.");
                console.error("Try this.fixDocCount()");
                return _context6.abrupt("return", Promise.reject(false));

              case 6:
                _context6.next = 8;
                return this.db.get(constructKey(docId))["catch"](function (e) {
                  if (e.type === "NotFoundError") {
                    return false;
                  }
                });

              case 8:
                obj = _context6.sent;
                _context6.prev = 9;

                if (obj) {
                  _context6.next = 14;
                  break;
                }

                return _context6.abrupt("return", Promise.resolve("The input key is not exist."));

              case 14:
                obj = JSON.parse(obj);
                this.docCount -= 1;
                value = JSON.parse(obj["v"]);
                options = JSON.parse(obj["o"]);
                tokens = this.getTokens(key, value, options);
                promiseArr = [];

                for (_i5 = 0, _Object$keys5 = Object.keys(tokens); _i5 < _Object$keys5.length; _i5++) {
                  token = _Object$keys5[_i5];
                  promiseArr.push(this.searchIndex(token));
                }

                _context6.next = 23;
                return Promise.all(promiseArr).then(function (results) {
                  var ops = [];
                  var _iteratorNormalCompletion3 = true;
                  var _didIteratorError3 = false;
                  var _iteratorError3 = undefined;

                  try {
                    for (var _iterator3 = results[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                      var _obj = _step3.value;
                      //DEL:
                      delete _obj["v"][docId];
                      _obj["l"] = Object.keys(_obj["v"]).length; //there is no other doc related to this index, delete it

                      if (_obj["l"] === 0) {
                        ops.push({
                          type: "del",
                          key: constructIndex(_obj["t"])
                        });
                      } else {
                        ops.push({
                          type: "put",
                          key: constructIndex(_obj["t"]),
                          value: JSON.stringify(_obj)
                        });
                      }
                    }
                  } catch (err) {
                    _didIteratorError3 = true;
                    _iteratorError3 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion3 && _iterator3["return"] != null) {
                        _iterator3["return"]();
                      }
                    } finally {
                      if (_didIteratorError3) {
                        throw _iteratorError3;
                      }
                    }
                  }

                  ops.push({
                    type: "del",
                    key: constructKey(docId)
                  });
                  ops.push({
                    type: "put",
                    key: "0x000_docCount",
                    value: _this5.docCount.toString()
                  });
                  return ops;
                })["catch"](function (e) {
                  console.error("Oops...The Delete operation is interrupted by an internal error.");
                  return e;
                });

              case 23:
                ops = _context6.sent;
                return _context6.abrupt("return", new Promise(function (resolve, reject) {
                  if (ops instanceof EvalError) {
                    _this5.docCount += 1;
                    reject(ops);
                  }

                  _this5.db.batch(ops).then(function (info) {
                    resolve("Del: " + key + " successfully.");
                  })["catch"](function (e) {
                    _this5.docCount += 1;
                    console.error(e);
                    console.error("Oops...The Delete operation is interrupted by an internal error.");
                    reject(e);
                  });
                }));

              case 25:
                _context6.next = 30;
                break;

              case 27:
                _context6.prev = 27;
                _context6.t0 = _context6["catch"](9);
                return _context6.abrupt("return", _context6.t0);

              case 30:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this, [[9, 27]]);
      }));

      function del(_x13) {
        return _del.apply(this, arguments);
      }

      return del;
    }() // Hash : True -> The input key is the md5 docId of the key.
    // Hash : False -> The origin key was input.

  }, {
    key: "get",
    value: function () {
      var _get = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee7(key) {
        var hash,
            docId,
            obj,
            _args7 = arguments;
        return _regenerator["default"].wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                hash = _args7.length > 1 && _args7[1] !== undefined ? _args7[1] : false;
                docId = hash ? key : (0, _md["default"])(key);
                _context7.next = 4;
                return this.db.get(constructKey(docId))["catch"](function (e) {
                  return e;
                });

              case 4:
                obj = _context7.sent;

                if (!(obj instanceof EvalError)) {
                  _context7.next = 7;
                  break;
                }

                return _context7.abrupt("return", Promise.reject(obj));

              case 7:
                _context7.prev = 7;
                obj = JSON.parse(obj);
                return _context7.abrupt("return", {
                  key: obj["k"],
                  docId: docId,
                  value: JSON.parse(obj["v"]),
                  options: this.compressOptions(JSON.parse(obj["o"]), true)
                });

              case 12:
                _context7.prev = 12;
                _context7.t0 = _context7["catch"](7);
                console.error("Oops...The Get operation is interrupted by an internal error.");
                return _context7.abrupt("return", _context7.t0);

              case 16:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this, [[7, 12]]);
      }));

      function get(_x14) {
        return _get.apply(this, arguments);
      }

      return get;
    }() // only focus on the value related to the key

  }, {
    key: "cleanGet",
    value: function () {
      var _cleanGet = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee8(key) {
        var hash,
            docId,
            obj,
            _args8 = arguments;
        return _regenerator["default"].wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                hash = _args8.length > 1 && _args8[1] !== undefined ? _args8[1] : false;
                docId = hash ? key : (0, _md["default"])(key);
                _context8.next = 4;
                return this.db.get(constructKey(docId))["catch"](function (e) {
                  return e;
                });

              case 4:
                obj = _context8.sent;

                if (!(obj instanceof EvalError)) {
                  _context8.next = 7;
                  break;
                }

                return _context8.abrupt("return", Promise.reject(obj));

              case 7:
                _context8.prev = 7;
                obj = JSON.parse(obj);
                return _context8.abrupt("return", JSON.parse(obj["v"]));

              case 12:
                _context8.prev = 12;
                _context8.t0 = _context8["catch"](7);
                console.error("Oops...The Get operation is interrupted by an internal error.");
                return _context8.abrupt("return", _context8.t0);

              case 16:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this, [[7, 12]]);
      }));

      function cleanGet(_x15) {
        return _cleanGet.apply(this, arguments);
      }

      return cleanGet;
    }() //Search the content by tf-idf.

  }, {
    key: "search",
    value: function () {
      var _search = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee10(content, topK) {
        var _this6 = this;

        var tokens, promiseArr, _i6, _Object$keys6, token, docCount, results;

        return _regenerator["default"].wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                tokens = this.tokenizer.tokenize(content);
                promiseArr = [];

                for (_i6 = 0, _Object$keys6 = Object.keys(tokens); _i6 < _Object$keys6.length; _i6++) {
                  token = _Object$keys6[_i6];
                  promiseArr.push(this.searchIndex(token));
                }

                _context10.next = 5;
                return this.getDocCount();

              case 5:
                docCount = _context10.sent;
                _context10.next = 8;
                return Promise.all(promiseArr).then(
                /*#__PURE__*/
                function () {
                  var _ref = (0, _asyncToGenerator2["default"])(
                  /*#__PURE__*/
                  _regenerator["default"].mark(function _callee9(results) {
                    var docs, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, result, len, idf, tfs, _i7, _Object$keys7, docId, tf_norm, docIds, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, _docId;

                    return _regenerator["default"].wrap(function _callee9$(_context9) {
                      while (1) {
                        switch (_context9.prev = _context9.next) {
                          case 0:
                            docs = {};
                            _iteratorNormalCompletion4 = true;
                            _didIteratorError4 = false;
                            _iteratorError4 = undefined;
                            _context9.prev = 4;
                            _iterator4 = results[Symbol.iterator]();

                          case 6:
                            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
                              _context9.next = 17;
                              break;
                            }

                            result = _step4.value;
                            len = result["l"];

                            if (!(len === 0)) {
                              _context9.next = 11;
                              break;
                            }

                            return _context9.abrupt("continue", 14);

                          case 11:
                            idf = 1 + Math.log(docCount / (1 + len));
                            tfs = result["v"];

                            for (_i7 = 0, _Object$keys7 = Object.keys(tfs); _i7 < _Object$keys7.length; _i7++) {
                              docId = _Object$keys7[_i7];
                              tf_norm = 1 + Math.log(1 + Math.log(tfs[docId]));
                              docId in docs ? docs[docId] += idf * tf_norm : docs[docId] = idf * tf_norm;
                            }

                          case 14:
                            _iteratorNormalCompletion4 = true;
                            _context9.next = 6;
                            break;

                          case 17:
                            _context9.next = 23;
                            break;

                          case 19:
                            _context9.prev = 19;
                            _context9.t0 = _context9["catch"](4);
                            _didIteratorError4 = true;
                            _iteratorError4 = _context9.t0;

                          case 23:
                            _context9.prev = 23;
                            _context9.prev = 24;

                            if (!_iteratorNormalCompletion4 && _iterator4["return"] != null) {
                              _iterator4["return"]();
                            }

                          case 26:
                            _context9.prev = 26;

                            if (!_didIteratorError4) {
                              _context9.next = 29;
                              break;
                            }

                            throw _iteratorError4;

                          case 29:
                            return _context9.finish(26);

                          case 30:
                            return _context9.finish(23);

                          case 31:
                            docs = utils.sortByValue(docs);
                            docIds = Object.keys(docs);
                            if (topK && topK < docIds.length) docIds = docIds.slice(0, topK - 1);
                            promiseArr = [];
                            _iteratorNormalCompletion5 = true;
                            _didIteratorError5 = false;
                            _iteratorError5 = undefined;
                            _context9.prev = 38;

                            for (_iterator5 = docIds[Symbol.iterator](); !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                              _docId = _step5.value;
                              promiseArr.push(_this6.get(_docId, true));
                            }

                            _context9.next = 46;
                            break;

                          case 42:
                            _context9.prev = 42;
                            _context9.t1 = _context9["catch"](38);
                            _didIteratorError5 = true;
                            _iteratorError5 = _context9.t1;

                          case 46:
                            _context9.prev = 46;
                            _context9.prev = 47;

                            if (!_iteratorNormalCompletion5 && _iterator5["return"] != null) {
                              _iterator5["return"]();
                            }

                          case 49:
                            _context9.prev = 49;

                            if (!_didIteratorError5) {
                              _context9.next = 52;
                              break;
                            }

                            throw _iteratorError5;

                          case 52:
                            return _context9.finish(49);

                          case 53:
                            return _context9.finish(46);

                          case 54:
                            _context9.next = 56;
                            return Promise.all(promiseArr).then(function (res) {
                              var _iteratorNormalCompletion6 = true;
                              var _didIteratorError6 = false;
                              var _iteratorError6 = undefined;

                              try {
                                for (var _iterator6 = res[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
                                  var obj = _step6.value;
                                  obj["score"] = docs[obj["docId"]];
                                }
                              } catch (err) {
                                _didIteratorError6 = true;
                                _iteratorError6 = err;
                              } finally {
                                try {
                                  if (!_iteratorNormalCompletion6 && _iterator6["return"] != null) {
                                    _iterator6["return"]();
                                  }
                                } finally {
                                  if (_didIteratorError6) {
                                    throw _iteratorError6;
                                  }
                                }
                              }

                              return res.sort(function (a, b) {
                                return b["score"] - a["score"];
                              });
                            });

                          case 56:
                            return _context9.abrupt("return", _context9.sent);

                          case 57:
                          case "end":
                            return _context9.stop();
                        }
                      }
                    }, _callee9, null, [[4, 19, 23, 31], [24,, 26, 30], [38, 42, 46, 54], [47,, 49, 53]]);
                  }));

                  return function (_x18) {
                    return _ref.apply(this, arguments);
                  };
                }())["catch"](function (e) {
                  return e;
                });

              case 8:
                results = _context10.sent;

                if (!(results instanceof EvalError)) {
                  _context10.next = 13;
                  break;
                }

                return _context10.abrupt("return", Promise.reject(results));

              case 13:
                return _context10.abrupt("return", Promise.resolve(results));

              case 14:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function search(_x16, _x17) {
        return _search.apply(this, arguments);
      }

      return search;
    }()
  }, {
    key: "printAll",
    value: function printAll() {
      this.db.createReadStream().on('data', function (data) {
        console.log(data.key, '=', data.value);
      }).on('error', function (err) {
        console.log('Oh my!', err);
      }).on('close', function () {
        console.log('Stream closed');
      }).on('end', function () {
        console.log('Stream ended');
      });
    }
  }, {
    key: "fixDocCount",
    value: function fixDocCount() {
      var docCount = 0;
      var pattern = /^0x002_/;
      var db = this.db;
      this.db.createReadStream().on('data', function (data) {
        if (pattern.test(data.key)) docCount++;
      }).on('error', function (err) {
        console.log('Oh my!', err);
      }).on('end', function () {
        db.put("0x000_docCount", docCount).then(function (info) {
          console.log("Rescan complete. The docCount is " + docCount.toString());
        });
      });
    }
  }], [{
    key: "getDocId",
    value: function getDocId(key) {
      return (0, _md["default"])(key);
    }
  }]);
  return Min;
}();

module.exports = Min;