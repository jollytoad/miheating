import fs from 'fs'
import { mihomeTrvs } from '../util/things'
import { anyOf } from './predicates'
import { periodDuration, folder, topOfPeriod } from '../util/history'

import values from 'object.values'
if (!Object.values) values.shim()

// ## Configuration

const trvIds = Object.values(mihomeTrvs)

// ## Internal state

let period = topOfPeriod(Date.now())
let history = []

export function getCurrentHistory() {
  return history
}

// ## Predicates

const trvsChanged = (state, prev) => state.trvs !== prev.trvs
const boilerChanged = (state, prev) => state.boiler !== prev.boiler

// ## Side Effects

export default {
  when: anyOf(boilerChanged, trvsChanged),
  then: (state, prev) => {
    const now = Date.now()
    const top = topOfPeriod(now)

    if (top !== period) {
      console.log("Saving history: ", period)

      fs.writeFile(`${folder}/${period}.json`, JSON.stringify(history), err => {
        console.log(err ? err : 'saved')
      })

      period = top
      history = []
    }

    const record = { t: now }

    trvIds.forEach(id => {
      if (!history.length ||
          state.trvs[id].target !== prev.trvs[id].target ||
          state.trvs[id].current !== prev.trvs[id].current) {
        record[id] = {
          target: state.trvs[id].target,
          current: state.trvs[id].current
        }
      }
    })

    if (!history.length || state.boiler !== prev.boiler) {
      record.boiler = state.boiler
    }

    history.push(record)
  }
}
