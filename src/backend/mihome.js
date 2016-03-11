"use strict"
import fluxlet from "fluxlet/lib/development"
import { update, chain } from "fluxlet-immutable"
import fetch from "node-fetch"
import { inquirer } from './inquiry'

import { mihomeTrvs } from './things'

import entries from 'object.entries'
if (!Object.entries) entries.shim()

const baseUrl = "http://localhost:3030"

let relay

// # Setup

export function setup(dispatchers) {

  relay = dispatchers

  fluxlet('mihome')
    .hooks(inquirer)
    .state(initialState)
    .actions({
      loaded
    })
    .calculations({
    })
    .sideEffects({
      dispatchTrvReadings
    })
    .init(fetchTrvReadings(60000))
}

// # Initial State

const initialState = {
  now: null,
  subdevices: []
}

// ## Bindings

const fetchTrvReadings = interval => dispatch => {
  const fetchSubdevices = () => {
    console.log("FETCH TRVs")
    fetchData(dispatch, 'subdevices', 'subdevices/list');
  }

  fetchSubdevices()
  setInterval(fetchSubdevices, interval)
}


// ## Actions

const loaded = (property, data, now) => chain(
    update('now', now),
    update(property, data)
)

// ## Predicates
// For use in _when_ clauses of calculations and side-effects
// (state, prev) -> boolean

const subDevicesChanged = (state, prev) => state.subdevices !== prev.subdevices

// ## Side Effects

const dispatchTrvReadings = {
  when: subDevicesChanged,
  then: ({ now, subdevices }) => {
    relay.trvReadings(subdevices
        .map(device => {
          const id = mihomeTrvs[device.id];
          return id ? {
            id,
            target: device.target_temperature,
            current: device.last_temperature,
            lastReading: now
          } : null
        })
        .filter(reading => reading !== null))
  }
}

// ## Utilities

const fetchData = (dispatch, target, api, params) =>
    fetch(`${baseUrl}/api/v1/${api}` + (params ? "?params=" + encodeURIComponent(JSON.stringify(params)) : ''))
        .then(response => {
          if (response.status >= 200 && response.status < 300) {
            return response
          } else {
            const error = new Error(response.statusText)
            error.response = response
            throw error
          }
        })
        .then(response => response.json())
        .then(content => dispatch.loaded(target, content.data, Date.now()))
        .catch((...args) => console.error("Fetching TRV data failed", ...args))
