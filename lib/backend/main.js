'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setup = setup;

var _heating = require('./heating');

var heating = _interopRequireWildcard(_heating);

var _mihome = require('./mihome');

var mihome = _interopRequireWildcard(_mihome);

var _logging = require('fluxlet/lib/logging');

var logging = _interopRequireWildcard(_logging);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

// # Setup

function setup() {

  logging.enableState(false);
  logging.enableActionArgs(false);

  heating.setup(mihome);
}