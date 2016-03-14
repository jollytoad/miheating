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
