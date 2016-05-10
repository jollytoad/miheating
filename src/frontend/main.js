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
import vis from "vis"
import "vis/dist/vis.css!"

// TODO: Store and fetch data from IndexedDB

// # Setup

export function setup() {

  fluxlet("mi")
    .state(initialState)
    .actions({
      begin,
      setRaw,
      rangeChange,
      setTargetTemperature,
      toggleGraphs
    })
    .calculations({
      indexSubdevices
    },{
      receivedCurrentTemperature,
      receivedTargetTemperature
    },{
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
  begin: false,
  req: {
    source: null,
    start: null,
    end: null
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
    targetTemperatures: {}
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

const begin = (params) => chain(
    update("begin", true),
    update("req", {
      source: params.source || 'history',
      start: Date.now()-24*60*60*1000,
      end: Date.now()
    })
)

const setRaw = (property, data) => update(["raw"].concat(property), data)

const rangeChange = (id, start, end) => update("view.range", {id, start, end})

const setTargetTemperature = (id, temperature) => update(["model", "targetTemperatures", ""+id], temperature)

const toggleGraphs = () => update("model.graphs", graphs => !graphs)

// ## Predicates
// For use in _when_ clauses of calculations and side-effects
// (state, prev) -> boolean

const graphsEnabled = (state, prev) => state.model.graphs === true
const graphsJustEnabled = (state, prev) => state.model.graphs === true && prev.model.graphs === false
const reqChanged = (state, prev) => state.req !== prev.req
const subDevicesChanged = (state, prev) => state.raw.subdevices !== prev.raw.subdevices
const timersChanged = (state, prev) => state.raw.timers !== prev.raw.timers
const temperaturesChanged = (state, prev) => state.raw.temperatures !== prev.raw.temperatures
const historyChanged = (state, prev) => state.raw.history !== prev.raw.history
const rangeChanged = (state, prev) => state.view.range !== prev.view.range
//const graphDataChanged = (state, prev) => state.trans.graphData !== prev.trans.graphData
const modelChanged = (state, prev) => state.model !== prev.model
const targetTemperaturesChanged = (state, prev) => state.model.targetTemperatures !== prev.model.targetTemperatures
//const transChanged = (state, prev) => state.trans !== prev.trans
const vdomChanged = (state, prev) => state.view.vdom !== prev.view.vdom
const diffReady = (state, prev) => state.view.diff !== null && state.view.diff !== prev.view.diff

const sourceIs = source => state => state.req.source === source

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
  then: state => chain(...state.raw.subdevices.map(subdevice =>
      subdevice[rawProp] != undefined ?
        update(["model", modelProp, subdevice.id], subdevice[rawProp]) :
        s => s
  ))(state)
})

const receivedCurrentTemperature = extractRawData("last_temperature", "currentTemperatures")
const receivedTargetTemperature = extractRawData("target_temperature", "targetTemperatures")

const renderRoot = {
  when: anyOf(modelChanged, subDevicesChanged, temperaturesChanged),
  then: update("view.vdom", (x, {raw, model}) => root(raw, model))
}

const generateViewDiff = {
  when: vdomChanged,
  then: (state, prev) => update("view.diff", () => diff(prev.view.vdom, state.view.vdom))(state)
}

// ## Request Side Effects

const loadSubDevices = {
  when: (state, prev) => state.begin && !prev.begin,
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
  when: anyOf(graphsJustEnabled, allOf(graphsEnabled, reqChanged)),
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
  when: targetTemperaturesChanged,
  then: (state, prev, dispatch) => {
    $.each(state.model.targetTemperatures, (id, temperature) => {
      const prevTemperature = prev.model.targetTemperatures[id];

      if (prevTemperature != undefined && temperature !== prevTemperature) {
        fetchData(dispatch, ['subdevices', state.trans.subdeviceIndex[id]], 'subdevices/set_target_temperature', { id: +id, temperature })
      }
    })
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
        .then(content => dispatch.setRaw(target, content.data))

const fetchHistory = (dispatch, start) =>
        fetch(`history/${start}.json`)
            .then(response => response.json())
            .then(data => dispatch.setRaw(['history',start], data))
