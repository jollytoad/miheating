"use strict"
import fluxlet from "fluxlet/development"
import { update, chain, get, path as bakePath } from "fluxlet-immutable"
import $ from "jquery"
import diff from 'virtual-dom/diff'
import patch from 'virtual-dom/patch'
import { root, initRoot } from './templates'
import { render, whenNotRendering } from './render-utils'
import { map, mapIf, mapFrom } from '../util/map2'
import { bindReady, bindActions, bindTimers } from './bindings'
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
      toggleGraphs,
      selectTimer,
      unselectTimer,
      newTimer,
      saveTimer,
      deleteTimer,
      setTimerData
    })
    .calculations({
      indexSubdevices,
      retryOnError,
      pollAfterLoading,
      lookupTimerData
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
      submitTargetTemperatures,
      submitTimer
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
      bindActions,
      bindTimers
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
    pendingTemperatures: {},
    selectedTimer: {
      subdeviceId: null,
      timerId: null,
      data: null
    },
    savedTimer: null
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

const setTargetTemperature = ({ id, value }) => update(["model", "pendingTemperatures", ""+id], +value)

const toggleGraphs = () => update("model.graphs", graphs => !graphs)

const suspend = () => update("req.suspend", true)
const resume = refresh.then

const selectTimer = (subdeviceId, timerId) => chain(
  update("model.selectedTimer.subdeviceId", +subdeviceId),
  update("model.selectedTimer.timerId", +timerId)
)

const unselectTimer = () => chain(
  update("model.selectedTimer.subdeviceId", null),
  update("model.selectedTimer.timerId", null),
  update("model.selectedTimer.data", null)
)

const newTimer = ({ subdeviceId, now, temperature, days }) => chain(
    update("model.selectedTimer.subdeviceId", +subdeviceId),
    update("model.selectedTimer.timerId", null),
    update("model.selectedTimer.data", {
      time: parseRunAtTime(new Date(now).toISOString()),
      temperature: +temperature,
      days: Math.pow(2, (new Date(now).getDay() + 6) % 7)
    })
)

const saveTimer = () => chain(
  update("model.savedTimer", (x, state) => state.model.selectedTimer),
  unselectTimer()
)

const deleteTimer = () => chain(
  update("model.savedTimer", (x, state) => state.model.selectedTimer),
  update("model.savedTimer.data", false),
  unselectTimer()
)

const setTimerData = ({ prop, value }) =>
    update(["model", "selectedTimer", "data", prop], parseTimerValue(value))

function parseTimerValue(value) {
  if (typeof value === 'string') {
    if (value.indexOf(':') >= 0) {
      return parseRunAtTime('T' + value)
    } else {
      return +value
    }
  }
  return value
}

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

const timerSelected = (state, prev) => state.model.selectedTimer.subdeviceId && state.model.selectedTimer.timerId && state.model.selectedTimer.timerId !== prev.model.selectedTimer.timerId
const timerSaved = (state, prev) => state.model.savedTimer && state.model.savedTimer !== prev.model.savedTimer

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

const lookupTimerData = {
  when: timerSelected,
  then: update("model.selectedTimer.data", (x, {raw:{timers},model:{selectedTimer}}) => createTimerData(timers[selectedTimer.subdeviceId].find(data => data.id === selectedTimer.timerId)))
}

const createTimerData = ({value, days_active, run_at}) => ({
  temperature: +value,
  time: parseRunAtTime(run_at),
  days: +days_active
})

const parseRunAtTime = time => {
  const [,hh,mm] = time.match(/T(\d\d):(\d\d)/)
  return +mm + hh*60
}

// ## Request Side Effects

const loadSubDevices = {
  when: refreshed,
  then: (s, p, dispatch) => {
    fetchData(dispatch, 'subdevices', 'subdevices/list')
  }
}

const loadTimers = {
  when: subDevicesChanged,
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

const submitTimer = {
  when: timerSaved,
  then: (state, prev, dispatch) => {
    const { subdeviceId, timerId, data } = state.model.savedTimer
    const api = timerId ? (data === false ? 'timers/delete' : 'timers/update') : 'timers/create'

    fetchData(dispatch, null, api, {
      subdevice_id: subdeviceId,
      id: timerId,
      action: data ? 'set_target_temperature' : undefined,
      value: data ? '' + data.temperature : undefined,
      run_at: data ? formatTime(data.time) : undefined,
      days_active: data ? data.days : undefined
    })
        .then(() => fetchData(dispatch, ['timers', ''+subdeviceId], 'timers/list', { subdevice_id: subdeviceId }))
  }
}

const formatTime = time => pad2(Math.floor(time/60)) + ':' + pad2(time % 60)

const pad2 = n => ('0' + n).slice(-2)

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

const createTimerSeries = (timerData, date) =>
    timerData
        .map(({action, run_at, days_active, value, subdevice_id, id}) =>
            action === "set_target_temperature" && run_at && value
              ? createTimerPoint(subdevice_id, id, value, run_at, days_active, date)
              : null)
        .filter(x => x !== null)

const createTimerPoint = (subdeviceId, timerId, value, run_at, days, date) => {
  const time = calcTimer(date, parseRunAtTime(run_at))
  const day = new Date(time).getDay()
  const dayBit = Math.pow(2, (day === 0 ? 6 : day-1))
  return {
    x: time,
    y: +value,
    group: 2,
    subdeviceId,
    timerId,
    today: !!(days & dayBit)
  }
}

const calcTimer = (timestamp, minutes) => new Date(timestamp).setHours(0, minutes, 0, 0)

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

  if (!container) {
    return
  }

  let temperatureSeries

  if (range.source === 'mihome') {
    temperatureSeries = temperatureData && temperatureData.map(([x,y]) => ({ x, y, group: 1 }))
  } else {
    temperatureSeries = history && mihomeTrvs[id] && createHistorySeries(mihomeTrvs[id], history, range)
  }
  const timerSeries = timerData && createTimerSeries(timerData, range.start).concat(createTimerSeries(timerData, range.end))
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
        drawPoints: item => ({
          style: 'circle',
          size: 10,
          className: `timer timer-${item.subdeviceId}-${item.timerId} ${item.today ? 'today' : ''}`
        })
      }
    })

    const options = {
      start: range.start,
      end: range.end,
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
        .then(content => target && dispatch.setRaw(target, content.data, Date.now()))
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
