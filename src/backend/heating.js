"use strict"
import fluxlet from "fluxlet/lib/development"
import { update, chain } from "fluxlet-immutable"
import { allOf } from '../util/predicates'
import callBoilerHTTP from './boiler-http'
import callBoilerSerial from './boiler-serial'
import record from './recorder'
import { inquirer } from './inquiry'

import { mihomeTrvs } from '../util/things'
import { boilerBackend } from '../../settings'

import values from 'object.values'
if (!Object.values) values.shim()

const trvIds = Object.values(mihomeTrvs)

const callBoiler = {
  http: callBoilerHTTP,
  serial: callBoilerSerial
}

const initTrv = () => ({
  target: null,
  setTarget: null,
  current: null,
  lastReading: null,
  demand: null
})

const mapOf = (keys, valFn, keyFn) => keys.reduce((obj, key) => {
    obj[keyFn ? keyFn(key) : key] = valFn(key)
    return obj
  }, {})

// # Setup

export function setup(...plugins) {

  fluxlet('heating')
    .hooks(inquirer)
    .state(initialState)
    .actions({
      trvReading,
      trvReadings,
      setTarget,
      setFlame
    })
    .calculations(
        mapOf(trvIds, trvDemand, id => `trvDemand_${id}`),
    {
      boilerDemand
    })
    .sideEffects(
      mapOf(trvIds, setTrvTarget, id => `setTrvTarget_${id}`),
    {
      callBoiler: callBoiler[boilerBackend],
      record
    })
    .init(dispatchers => {
      plugins.forEach(plugin => plugin.setup(dispatchers))
    })
}

// # Initial State

const initialState = {
  trvs: mapOf(trvIds, initTrv),
  boiler: {
    flame: null,
    demand: null
  }
}

// ## Actions

const trvReading = ({ id, target, current, lastReading }) => chain(
  update(['trvs', id, 'target'], target),
  update(['trvs', id, 'current'], current),
  update(['trvs', id, 'lastReading'], lastReading)
)

const trvReadings = (readings) => chain(
    ...readings.map(trvReading)
)

const setTarget = (id, target) => chain(
  update(['trvs', id, 'setTarget'], target)
)

const setFlame = (flame) => update('boiler.flame', flame)

// ## Predicates

const trvJustRead = (id) => (state, prev) =>
  state.trvs[id].lastReading !== prev.trvs[id].lastReading

const trvTargetUpdateDue = (id) => (state, prev) =>
  state.trvs[id].setTarget != null &&
  state.trvs[id].target !== state.trvs[id].setTarget

const trvsChanged = (state, prev) => state.trvs !== prev.trvs

// ## Calculations

const trvDemand = id => ({
  when: trvJustRead(id),
  then: update(['trvs', id, 'demand'],
      (x, { trvs }) => trvs[id].current < trvs[id].target)
})

const boilerDemand = {
  when: trvsChanged,
  then: update('boiler.demand',
      (x, { trvs }) => Object.values(trvs).some(trv => trv.demand))
}

// ## Side Effects

const setTrvTarget = (id) => ({
  when: allOf(trvJustRead(id), trvTargetUpdateDue(id)),
  then: ({ trvs }) => {
    console.log(`SET NEW TARGET ON TRV: ${id} -> ${trvs[id].setTarget} (was: ${trvs[id].target})`)
  }
})
