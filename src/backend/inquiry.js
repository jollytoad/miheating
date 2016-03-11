export const inquiry = {}

const saveState = ({ id }) => id ? state => { inquiry[id] = state } : null

export const inquirer = {
  registerState: saveState,
  dispatch: saveState
}
