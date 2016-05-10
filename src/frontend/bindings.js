"use strict"
import $ from "jquery"

// ## Bindings

export function bindReady({ begin }) {
  $(() => {
    begin({ source: getSource(window.location.search) })
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
