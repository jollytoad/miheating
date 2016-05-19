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

        refresh({source: getSource(window.location.search), now: Date.now()})
      }
    }

    document.addEventListener("visibilitychange", tryRefresh, false)

    tryRefresh()
  })
}

function getSource(url) {
  return (/source=(\w+)/.exec(url) || [])[1]
}

export function bindButtons({ setTargetTemperature, toggleGraphs }) {
  $(document).on("click", "[data-set-target-temperature]", e => {
    setTargetTemperature(e.currentTarget.dataset.id, +e.currentTarget.dataset.setTargetTemperature)
  })
  
  $(document).on("click", ".toggle-graphs", e => {
    toggleGraphs()
  })
}
