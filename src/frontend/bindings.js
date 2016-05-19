"use strict"
import $ from "jquery"

// ## Bindings

export function bindReady({ refresh }) {
  $(() => {
    let refreshHandle = null

    function tryRefresh() {
      if (document.hidden) {
        console.log("Stop polling")
        window.clearInterval(refreshHandle)
        refreshHandle = null
      } else {
        if (!refreshHandle) {
          console.log("Start polling")
          refreshHandle = window.setInterval(tryRefresh, 60000)
        }

        refresh(refreshOpts())
      }
    }

    document.addEventListener("visibilitychange", tryRefresh, false)

    tryRefresh()
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
        refresh(refreshOpts())
      })
}

function refreshOpts() {
  return {
    source: getSource(window.location.search),
    now: Date.now()
  }
}

function getSource(url) {
  return (/source=(\w+)/.exec(url) || [])[1]
}
