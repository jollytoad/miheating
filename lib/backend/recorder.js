'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _things = require('./things');

var _predicates = require('./predicates');

var _object = require('object.values');

var _object2 = _interopRequireDefault(_object);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (!Object.values) _object2.default.shim();

// ## Configuration

const periodDuration = 1000 * 60 * 60;
const folder = 'history';

const trvIds = Object.values(_things.mihomeTrvs);

// ## Internal state

let period = topOfPeriod(Date.now());
let history = [];

// ## Predicates

const trvsChanged = (state, prev) => state.trvs !== prev.trvs;
const boilerChanged = (state, prev) => state.boiler !== prev.boiler;

// ## Side Effects

exports.default = {
  when: (0, _predicates.anyOf)(boilerChanged, trvsChanged),
  then: (state, prev) => {
    const now = Date.now();
    const top = topOfPeriod(now);

    if (top !== period) {
      console.log("Saving history: ", period);

      _fs2.default.writeFile(`${ folder }/${ period }.json`, JSON.stringify(history), err => {
        console.log(err ? err : 'saved');
      });

      period = top;
      history = [];
    }

    const record = { t: now };

    trvIds.forEach(id => {
      if (!history.length || state.trvs[id].target !== prev.trvs[id].target || state.trvs[id].current !== prev.trvs[id].current) {
        record[id] = {
          target: state.trvs[id].target,
          current: state.trvs[id].current
        };
      }
    });

    if (!history.length || state.boiler !== prev.boiler) {
      record.boiler = state.boiler;
    }

    history.push(record);
  }
};

// ## Utils

function topOfPeriod(now) {
  return Math.floor(now / periodDuration) * periodDuration;
}