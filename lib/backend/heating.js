"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setup = setup;

var _development = require("fluxlet/lib/development");

var _development2 = _interopRequireDefault(_development);

var _fluxletImmutable = require("fluxlet-immutable");

var _predicates = require("../util/predicates");

var _boilerHttp = require("./boiler-http");

var _boilerHttp2 = _interopRequireDefault(_boilerHttp);

var _boilerSerial = require("./boiler-serial");

var _boilerSerial2 = _interopRequireDefault(_boilerSerial);

var _recorder = require("./recorder");

var _recorder2 = _interopRequireDefault(_recorder);

var _inquiry = require("./inquiry");

var _things = require("../util/things");

var _settings = require("../../settings");

var _object = require("object.values");

var _object2 = _interopRequireDefault(_object);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (!Object.values) _object2.default.shim();

const trvIds = Object.values(_things.mihomeTrvs);

const callBoiler = {
  http: _boilerHttp2.default,
  serial: _boilerSerial2.default,
  none: () => {}
};

const initTrv = () => ({
  target: null,
  setTarget: null,
  current: null,
  lastReading: null,
  demand: null
});

const mapOf = (keys, valFn, keyFn) => keys.reduce((obj, key) => {
  obj[keyFn ? keyFn(key) : key] = valFn(key);
  return obj;
}, {});

// # Setup

function setup(...plugins) {

  (0, _development2.default)('heating').hooks(_inquiry.inquirer).state(initialState).actions({
    trvReading,
    trvReadings,
    setTarget,
    setFlame
  }).calculations(mapOf(trvIds, trvDemand, id => `trvDemand_${ id }`), {
    boilerDemand,
    lowHigh
  }).sideEffects(mapOf(trvIds, setTrvTarget, id => `setTrvTarget_${ id }`), {
    callBoiler: callBoiler[_settings.boilerBackend],
    record: _recorder2.default
  }).init(dispatchers => {
    plugins.forEach(plugin => plugin.setup(dispatchers));
  });
}

// # Initial State

const initialState = {
  trvs: mapOf(trvIds, initTrv),
  boiler: {
    flame: null,
    demand: null,
    low: 0,
    high: 0
  }
};

// ## Actions

const trvReading = ({ id, target, current, lastReading }) => (0, _fluxletImmutable.chain)((0, _fluxletImmutable.update)(['trvs', id, 'target'], target), (0, _fluxletImmutable.update)(['trvs', id, 'current'], current), (0, _fluxletImmutable.update)(['trvs', id, 'lastReading'], lastReading));

const trvReadings = readings => (0, _fluxletImmutable.chain)(...readings.map(trvReading));

const setTarget = (id, target) => (0, _fluxletImmutable.chain)((0, _fluxletImmutable.update)(['trvs', id, 'setTarget'], target));

const setFlame = flame => (0, _fluxletImmutable.update)('boiler.flame', flame);

// ## Predicates

const trvJustRead = id => (state, prev) => state.trvs[id].lastReading !== prev.trvs[id].lastReading;

const trvTargetUpdateDue = id => (state, prev) => state.trvs[id].setTarget != null && state.trvs[id].target !== state.trvs[id].setTarget;

const trvsChanged = (state, prev) => state.trvs !== prev.trvs;

// ## Calculations

const trvDemand = id => ({
  when: trvJustRead(id),
  then: (0, _fluxletImmutable.update)(['trvs', id, 'demand'], (x, { trvs }) => trvs[id].current < trvs[id].target)
});

const boilerDemand = {
  when: trvsChanged,
  then: (0, _fluxletImmutable.update)('boiler.demand', (x, { trvs }) => Object.values(trvs).some(trv => trv.demand))
};

const lowHigh = {
  when: trvsChanged,
  then: (0, _fluxletImmutable.chain)((0, _fluxletImmutable.update)('boiler.low', (x, { trvs }) => Math.min(...Object.values(trvs).map(trv => trv.current))), (0, _fluxletImmutable.update)('boiler.high', (x, { trvs }) => Math.max(...Object.values(trvs).map(trv => trv.current))))
};

// ## Side Effects

const setTrvTarget = id => ({
  when: (0, _predicates.allOf)(trvJustRead(id), trvTargetUpdateDue(id)),
  then: ({ trvs }) => {
    console.log(`SET NEW TARGET ON TRV: ${ id } -> ${ trvs[id].setTarget } (was: ${ trvs[id].target })`);
  }
});