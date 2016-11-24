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
  $(document)
      .on("click", "[data-action]", e => {
        e.preventDefault()
        const data = Object.assign(Object.create(null), e.currentTarget.dataset)
        if (dispatch[data.action]) {
          dispatch[data.action](data)
        } else {
          console.error(`Action '${data.action}' is not defined`, e.currentTarget, data)
        }
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

export function bindTimers({ selectTimer, setTimerData }) {
  $(document)
      .on("click", ".timer", e => {
        console.log(e)
        let timerId = getTimerId($(e.target).attr('class'))
        if (timerId.length) {
          console.log("Clicked Timer", timerId)
          selectTimer(...timerId);
        }
      })
      .on("click", "[data-set-timer]", e => {
          e.preventDefault()
          setTimerData(e.currentTarget.dataset.setTimer, +e.currentTarget.dataset.value)
      })
}

function getTimerId(className) {
  return (/timer-(\d+)-(\d+)/.exec(className) || []).slice(1)
}

function getSource(url) {
  return (/source=(\w+)/.exec(url) || [])[1]
}
