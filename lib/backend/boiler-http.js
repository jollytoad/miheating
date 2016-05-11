"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function ({ boiler: { demand } }, x, { setFlame }) {
  console.log("CALL FOR HEAT: ", demand);

  return (0, _nodeFetch2.default)(_settings.boilerBaseUrl + (demand ? '/on' : '/off'), { timeout: 5000 }).then(response => {
    if (response.status >= 200 && response.status < 300) {
      return response;
    } else {
      const error = new Error(response.statusText);
      error.response = response;
      throw error;
    }
  }).then(response => response.json()).then(heat => setFlame(heat)).catch((...args) => console.error("Boiler demand failed", ...args));
};

var _nodeFetch = require("node-fetch");

var _nodeFetch2 = _interopRequireDefault(_nodeFetch);

var _settings = require("../../settings.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }