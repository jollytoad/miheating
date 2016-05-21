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
