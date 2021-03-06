"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setup = setup;

var _development = require("fluxlet/lib/development");

var _development2 = _interopRequireDefault(_development);

var _fluxletImmutable = require("fluxlet-immutable");

var _nodeFetch = require("node-fetch");

var _nodeFetch2 = _interopRequireDefault(_nodeFetch);

var _inquiry = require("./inquiry");

var _things = require("../util/things");

var _settings = require("../../settings");

var _object = require("object.entries");

var _object2 = _interopRequireDefault(_object);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (!Object.entries) _object2.default.shim();

const baseUrl = "http://localhost:" + _settings.httpPort;

let relay;

// # Setup

function setup(dispatchers) {

  relay = dispatchers;

  (0, _development2.default)('mihome').hooks(_inquiry.inquirer).state(initialState).actions({
    loaded
  }).calculations({}).sideEffects({
    dispatchTrvReadings
  }).init(fetchTrvReadings(_settings.trvPolling));
}

// # Initial State

const initialState = {
  now: null,
  subdevices: []
};

// ## Bindings

const fetchTrvReadings = interval => dispatch => {
  const fetchSubdevices = () => {
    console.log("FETCH TRVs");
    fetchData(dispatch, 'subdevices', 'subdevices/list');
  };

  fetchSubdevices();
  setInterval(fetchSubdevices, interval);
};

// ## Actions

const loaded = (property, data, now) => (0, _fluxletImmutable.chain)((0, _fluxletImmutable.update)('now', now), (0, _fluxletImmutable.update)(property, data));

// ## Predicates
// For use in _when_ clauses of calculations and side-effects
// (state, prev) -> boolean

const subDevicesChanged = (state, prev) => state.subdevices !== prev.subdevices;

// ## Side Effects

const dispatchTrvReadings = {
  when: subDevicesChanged,
  then: ({ now, subdevices }) => {
    relay.trvReadings(subdevices.map(device => {
      const id = _things.mihomeTrvs[device.id];
      return id ? {
        id,
        target: device.target_temperature,
        current: device.last_temperature,
        lastReading: now
      } : null;
    }).filter(reading => reading !== null));
  }
};

// ## Utilities

const fetchData = (dispatch, target, api, params) => (0, _nodeFetch2.default)(`${ baseUrl }/api/v1/${ api }` + (params ? "?params=" + encodeURIComponent(JSON.stringify(params)) : '')).then(response => {
  if (response.status >= 200 && response.status < 300) {
    return response;
  } else {
    const error = new Error(response.statusText);
    error.response = response;
    throw error;
  }
}).then(response => response.json()).then(content => dispatch.loaded(target, content.data, Date.now())).catch((...args) => console.error("Fetching TRV data failed", ...args));