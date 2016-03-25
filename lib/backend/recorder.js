'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCurrentHistory = getCurrentHistory;
exports.save = save;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _things = require('../util/things');

var _predicates = require('../util/predicates');

var _history = require('../util/history');

var _object = require('object.values');

var _object2 = _interopRequireDefault(_object);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (!Object.values) _object2.default.shim();

// ## Configuration

const trvIds = Object.values(_things.mihomeTrvs);

// ## Internal state

let period = null;
let history = [];

function getCurrentHistory() {
  return history;
}

// ## Predicates

const trvsChanged = (state, prev) => state.trvs !== prev.trvs;
const boilerChanged = (state, prev) => state.boiler !== prev.boiler;

// ## Side Effects

exports.default = {
  when: (0, _predicates.anyOf)(boilerChanged, trvsChanged),
  then: (state, prev) => {
    const now = Date.now();
    const top = (0, _history.topOfPeriod)(now);

    if (period === null) {
      period = top;
      history = load();
    } else if (top !== period) {
      save();
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
function save(callback) {
  console.log("Saving history: ", period);

  _fs2.default.writeFile(`${ _history.folder }/${ period }.json`, JSON.stringify(history), err => {
    console.log(err ? err : 'saved');
    callback && callback();
  });
}

function load() {
  try {
    console.log("Attempting to load current history");
    return JSON.parse(_fs2.default.readFileSync(`${ _history.folder }/${ period }.json`, 'utf-8'));
  } catch (e) {
    console.log(e);
    return [];
  }
}