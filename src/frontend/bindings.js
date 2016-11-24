"use strict"
import $ from "jquery"

// ## Bindings

export function bindReady({ suspend, resume }) {
  $(() => {
    function updateSuspend() {
      if (document.hidden || !navigator.onLine) {
        suspend()
      } else {
        resume({ now: Date.now() })
      }
    }

    $(document).on("visibilitychange", updateSuspend)
    $(window).on("online offline", updateSuspend)

    resume({
      source: getSource(window.location.search),
      now: Date.now()
    })
  })
}

export function bindActions(dispatch) {

  const dispatchAction = (target, extraDataSupplier) => {
    let data = Object.assign(Object.create(null), target.dataset)
    if (extraDataSupplier) {
      data = Object.assign(data, extraDataSupplier(target))
    }
    if (dispatch[data.action]) {
      dispatch[data.action](data)
    } else {
      console.error(`Action '${data.action}' is not defined`, target, data)
    }
  }

  $(document)
      .on("click", ":not(input)[data-action]", e => {
        e.preventDefault()
        dispatchAction(e.currentTarget)
      })
      .on("input", "input[data-action]", e => {
        dispatchAction(e.currentTarget, ({value}) => ({value}))
      })
}

export function bindButtons({ setTargetTemperature, toggleGraphs, refresh }) {
  $(document)
      .on("click", "[data-set-target-temperature]", e => {
        e.preventDefault()
        setTargetTemperature(e.currentTarget.dataset.id, +e.currentTarget.dataset.setTargetTemperature)
      })
      .on("click", ".toggle-graphs", e => {
        e.preventDefault()
        toggleGraphs()
      })
      .on("click", ".refresh", e => {
        e.preventDefault()
        refresh({ now: Date.now() })
      })
}

export function bindTimers({ selectTimer }) {
  $(document)
      .on("click", ".timer", e => {
        let timerId = getTimerId($(e.target).attr('class'))
        if (timerId.length) {
          selectTimer(...timerId);
        }
      })
}

function getTimerId(className) {
  return (/timer-(\d+)-(\d+)/.exec(className) || []).slice(1)
}

function getSource(url) {
  return (/source=(\w+)/.exec(url) || [])[1]
}
