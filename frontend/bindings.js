"use strict"
import $ from "jquery"

// ## Bindings

export function bindReady({ begin }) {
  $(() => {
    begin()
  })
}
