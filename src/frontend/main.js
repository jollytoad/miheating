"use strict"
import fluxlet from "fluxlet/development"
import { update, chain, get, path as bakePath } from "fluxlet-immutable"
import $ from "jquery"
import diff from 'virtual-dom/diff'
import patch from 'virtual-dom/patch'
import { root, initRoot } from './templates'
import { render, whenNotRendering } from './render-utils'
import { map, mapIf, mapFrom } from '../util/map2'
import { bindReady, bindButtons } from './bindings'
import { mihomeTrvs } from '../util/things'
import { periodDuration, topOfPeriod } from '../util/history'
import { anyOf, allOf, not } from '../util/predicates'
import { uiRefresh, uiRetry } from "../../settings.js"
import vis from "vis"
import "vis/dist/vis.css!"

// TODO: Store and fetch data from IndexedDB

const trvIds = Object.keys(mihomeTrvs)

// # Setup

export function setup() {

  fluxlet("mi")
    .state(initialState)
    .actions({
      refresh,
      suspend,
      resume,
      setRaw,
      fetchFailed,
      rangeChange,
      setTargetTemperature,
      toggleGraphs
    })
    .calculations({
      indexSubdevices,
      retryOnError,
      pollAfterLoading
    },{
      receivedCurrentTemperature,
      receivedTargetTemperature
    },
        mapOf(trvIds, clearPendingTemperature, id => 'clearPendingTemperature_' + id)
     ,{
      renderRoot
    },{
      generateViewDiff
    })
    .sideEffects({
      loadSubDevices,
      loadTimers,
      loadTemperatureReports,
      loadHistory
    },{
      submitTargetTemperatures
    },{
      polling
    },{
      patchDOM
    },{
      renderGraphs,
      adjustGraphs
    })
    .init(
      bindReady,
      bindButtons
    )
}

// # Initial State

const initialState = {
  refresh: null,
  loaded: null,
  error: null,
  req: {
    suspend: false,
    source: 'history',
    start: null,
    end: null,
    interval: uiRefresh
  },
  raw: {
    subdevices: [],
    timers: {},
    temperatures: {},
    history: {}
  },
  model: {
    graphs: false,
    currentTemperatures: {},
    targetTemperatures: {},
    pendingTemperatures: {}
  },
  trans: { // transient state
    subdeviceIndex: {}
   // graphData: {}
  },
  view: {
    range: {},
    vdom: initRoot(),
    diff: null
  }
}


// ## Actions

const refresh = {
  when: (state) => !state.req.suspend,
  then: ({source, now}) => chain(
      update("refresh", +now),
      update("req", req => ({
        source: source || req.source,
        start: now - 24 * 60 * 60 * 1000,
        end: +now,
        interval: req.interval,
        suspend: false
      }))
  )
}

const setRaw = (property, data, now) => chain(
    update(["raw"].concat(property), data),
    update("loaded", now),
    update("error", null)
)

const fetchFailed = (reason) => {
  console.error(reason)
  return update("error", reason.message)
}

const rangeChange = (id, start, end) => update("view.range", {id, start, end})

const setTargetTemperature = (id, temperature) => update(["model", "pendingTemperatures", ""+id], temperature)

const toggleGraphs = () => update("model.graphs", graphs => !graphs)

const suspend = () => update("req.suspend", true)
const resume = refresh.then

// ## Predicates
// For use in _when_ clauses of calculations and side-effects
// (state, prev) -> boolean

const refreshed = (state, prev) => state.refresh !== prev.refresh
const graphsEnabled = (state, prev) => state.model.graphs === true
const graphsJustEnabled = (state, prev) => state.model.graphs === true && prev.model.graphs === false
const subDevicesChanged = (state, prev) => state.raw.subdevices !== prev.raw.subdevices
const timersChanged = (state, prev) => state.raw.timers !== prev.raw.timers
const temperaturesChanged = (state, prev) => state.raw.temperatures !== prev.raw.temperatures
const historyChanged = (state, prev) => state.raw.history !== prev.raw.history
const rangeChanged = (state, prev) => state.view.range !== prev.view.range
//const graphDataChanged = (state, prev) => state.trans.graphData !== prev.trans.graphData
const modelChanged = (state, prev) => state.model !== prev.model
const targetTemperaturesChanged = (state, prev) => state.model.targetTemperatures !== prev.model.targetTemperatures
const pendingTemperaturesChanged = (state, prev) => state.model.pendingTemperatures !== prev.model.pendingTemperatures
//const transChanged = (state, prev) => state.trans !== prev.trans
const vdomChanged = (state, prev) => state.view.vdom !== prev.view.vdom
const diffReady = (state, prev) => state.view.diff !== null && state.view.diff !== prev.view.diff
const hasError = (state, prev) => state.error !== null && state.error !== prev.error
const hasLoaded = (state, prev) => state.error === null && state.loaded !== prev.loaded
const pollingChanged = (state, prev) => state.req.suspend !== prev.req.suspend || state.req.interval !== prev.req.interval

const sourceIs = source => state => state.req.source === source

const pendingTemperatureConfirmed = id => state => state.model.targetTemperatures[id] === state.model.pendingTemperatures[id]

// ## Calculations

//const prepareGraphData = {
//  when: temperaturesChanged,
//  then: update("trans.graphData", mapFrom("raw.temperatures", map(([x, y]) => ({x, y}))))
//}

const indexSubdevices = {
  when: subDevicesChanged,
  then: update("trans.subdeviceIndex", (x, state) => state.raw.subdevices.reduce((memo, subdevice, idx) => { memo[subdevice.id] = idx; return memo }, {}))
}

const extractRawData = (rawProp, modelProp) => ({
  when: subDevicesChanged,
  then: (state, prev) => update(["model", modelProp], (data, state) => state.raw.subdevices.reduce((memo, subdevice, idx) => {
        if (subdevice[rawProp] != null && (prev.raw.subdevices[idx] ? subdevice.updated_at > prev.raw.subdevices[idx].updated_at : true)) {
          memo[subdevice.id] = subdevice[rawProp]
        } else if (data[subdevice.id] != null) {
          memo[subdevice.id] = data[subdevice.id]
        }
        return memo
      }, {}))(state)
})

const receivedCurrentTemperature = extractRawData("last_temperature", "currentTemperatures")
const receivedTargetTemperature = extractRawData("target_temperature", "targetTemperatures")

const clearPendingTemperature = (id) => ({
  when: allOf(targetTemperaturesChanged, pendingTemperatureConfirmed(id)),
  then: update(["model", "pendingTemperatures", ""+id], null)
})

const renderRoot = {
  when: anyOf(modelChanged, subDevicesChanged, temperaturesChanged, hasError, pollingChanged),
  then: update("view.vdom", (x, state) => root(state))
}

const generateViewDiff = {
  when: vdomChanged,
  then: (state, prev) => update("view.diff", () => diff(prev.view.vdom, state.view.vdom))(state)
}

const retryOnError = {
  when: hasError,
  then: update("req.interval", uiRetry)
}

const pollAfterLoading = {
  when: hasLoaded,
  then: update("req.interval", uiRefresh)
}

// ## Request Side Effects

const loadSubDevices = {
  when: refreshed,
  then: (s, p, dispatch) => {
    fetchData(dispatch, 'subdevices', 'subdevices/list')
  }
}

const loadTimers = {
  when: anyOf(graphsJustEnabled, allOf(graphsEnabled, subDevicesChanged)),
  then: (state, p, dispatch) => {
    state.raw.subdevices.forEach(({id, device_type}) => {
      if (device_type === "etrv") {
        const params = {
          subdevice_id: +id
        }

        fetchData(dispatch, ['timers', id], 'timers/list', params)
      }
    })
  }
}


const loadTemperatureReports = {
  when: allOf(sourceIs('mihome'), anyOf(graphsJustEnabled, allOf(graphsEnabled, subDevicesChanged))),
  then: (state, p, dispatch) => {
    state.raw.subdevices.forEach(({id, device_type}) => {
      if (device_type === "etrv") {
        const params = {
          id: +id,
          data_type: "reported_temperature",
          resolution: "instant",
          start_time: new Date(state.req.start).toISOString(),
          end_time: new Date(state.req.end).toISOString()
        }

        fetchData(dispatch, ['temperatures', id], 'subdevices/get_data', params)
      }
    })
  }
}

const loadHistory = {
  when: anyOf(graphsJustEnabled, allOf(graphsEnabled, refreshed)),
  then: (state, p, dispatch) => {
    let t = topOfPeriod(state.req.start)
    while (t < state.req.end) {
      if (!state.raw.history[t]) {
        fetchHistory(dispatch, t)
      }
      t += periodDuration
    }
  }
}

const submitTargetTemperatures = {
  when: pendingTemperaturesChanged,
  then: (state, prev, dispatch) => {
    $.each(state.model.pendingTemperatures, (id, temperature) => {
      const prevTemperature = prev.model.pendingTemperatures[id];

      if (temperature != undefined && temperature !== prevTemperature) {
        fetchData(dispatch, ['subdevices', state.trans.subdeviceIndex[id]], 'subdevices/set_target_temperature', { id: +id, temperature })
      }
    })
  }
}

let pollingHandle = null

const polling = {
  when: pollingChanged,
  then: (state, prev, { refresh }) => {
    window.clearInterval(pollingHandle)
    pollingHandle = null

    if (!state.req.suspend) {
      console.log("Start polling", state.req.interval)
      pollingHandle = window.setInterval(() => { refresh({ now: Date.now() }) }, state.req.interval)
    } else {
      console.log("Stop polling")
    }
  }
}

// ## Rendering Side Effects

const patchDOM = {
  when: diffReady,
  then: render(({view:{diff}}) => {
    patch(document.getElementById("root"), diff)
  })
}

const createTimerSeries = (timerData, range) =>
    timerData
        .map(({action, last_run_at, value}) =>
            action === "set_target_temperature" && last_run_at && Date.parse(last_run_at) >= range.start && value
              ? { x: last_run_at, y: +value, group: 2 }
              : null)
        .filter(x => x !== null)

const createHistorySeries = (name, history, range) =>
  [].concat(...Object.values(history))
      .map(r => r[name] ? { x: r.t, y: r[name].current, group: 1 } : null)
      .filter(x => x !== null)

const createBoilerSeries = (history, range) =>
  [].concat(...Object.values(history))
      .map(r => r.boiler ? { x: r.t, y: r.boiler.flame ? 26 : 10, group: 0 } : null)
      .filter(x => x !== null)

const renderGraph = (id, temperatureData, timerData, history, range, dispatch) => {

  const container = document.getElementById(`chart-${id}`)

  console.log(id, container)

  if (!container) {
    return
  }

  // HACK: colspan doesn't seem to get rendered in the DOM
  container.colSpan = 4

  let temperatureSeries

  if (range.source === 'mihome') {
    temperatureSeries = temperatureData && temperatureData.map(([x,y]) => ({ x, y, group: 1 }))
  } else {
    temperatureSeries = history && mihomeTrvs[id] && createHistorySeries(mihomeTrvs[id], history, range)
  }
  const timerSeries = timerData && createTimerSeries(timerData, range)
  const boilerSeries = history && createBoilerSeries(history, range)

  const dataset = new vis.DataSet()
  temperatureSeries && dataset.add(temperatureSeries)
  timerSeries && dataset.add(timerSeries)
  boilerSeries && dataset.add(boilerSeries)

  let graph = $.data(container, "graph")

  if (graph) {
    graph.setItems(dataset)
  } else {
    const groups = new vis.DataSet()

    groups.add({
      id: 0,
      options: {
        drawPoints: false,
        shaded: true,
        interpolation: false
      }
    })

    groups.add({
      id: 1,
      options: {
        drawPoints: false,
        shaded: true
      }
    })

    groups.add({
      id: 2,
      options: {
        sort: false,
        sampling: false,
        style: 'points',
        drawPoints: {
          style: 'circle'
        }
      }
    })

    const options = {
      //start: "2016-02-10",
      //end: "2016-02-12",
      height: "200px",
      width: "100%",
      dataAxis: {
        left: {
          range: { min: 12, max: 24 }
        }
      }
    }

    graph = new vis.Graph2d(container, dataset, groups, options)
    graph.on("rangechanged", whenNotRendering(({start,end}) => dispatch.rangeChange(id,start,end)))

    $.data(container, "graph", graph)
  }
}

const renderGraphs = {
  when: allOf(graphsEnabled, anyOf(graphsJustEnabled, temperaturesChanged, timersChanged, historyChanged)),
  then: render((state, prev, dispatch) => {
    Object.keys(mihomeTrvs).forEach(id => {
      renderGraph(id, state.raw.temperatures[id], state.raw.timers[id], state.raw.history, state.req, dispatch)
    })
  })
}

const adjustGraphs = {
  when: rangeChanged,
  then: render((state) => {
    $(".chart").each((i, container) => {
      const graph = $.data(container, "graph")
      if (graph && container.id !== `chart-${state.view.range.id}`) {
        graph.setWindow(state.view.range.start, state.view.range.end)
      }
    })
  })
}

// ## Utilities

const arrEq = (path1, path2) => path1 != null && path2 != null &&
  path1.length === path2.length && path1.every((e, i) => e === path2[i])

const fetchData = (dispatch, target, api, params) =>
    fetch(`api/v1/${api}` + (params ? "?params=" + encodeURIComponent(JSON.stringify(params)) : ''))
        .then(response => response.json())
        .then(content => dispatch.setRaw(target, content.data, Date.now()))
        .catch(dispatch.fetchFailed)

const fetchHistory = (dispatch, start) =>
        fetch(`history/${start}.json`)
            .then(response => response.json())
            .then(data => dispatch.setRaw(['history',start], data, Date.now()))
            .catch(dispatch.fetchFailed)

const mapOf = (keys, valFn, keyFn) => keys.reduce((obj, key) => {
  obj[keyFn ? keyFn(key) : key] = valFn(key)
  return obj
}, {})
