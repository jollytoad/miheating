"use strict"
import $ from "jquery"

// ## Bindings

export function bindReady({ refresh, suspend }) {
  $(() => {
    function updateSuspend() {
      suspend(document.hidden || !navigator.onLine)
    }

    $(document).on("visibilitychange", updateSuspend)
    $(window).on("online offline", updateSuspend)

    refresh({
      source: getSource(window.location.search),
      now: Date.now()
    })
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

function getSource(url) {
  return (/source=(\w+)/.exec(url) || [])[1]
}
