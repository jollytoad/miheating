import * as heating from './heating'
import * as mihome from './mihome'
import * as logging from "fluxlet/lib/logging"

// # Setup

export function setup() {

  logging.enableState(false)
  logging.enableActionArgs(false)

  heating.setup(mihome)

}
