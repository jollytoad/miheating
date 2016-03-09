import fetch from "node-fetch"

const baseUrl = "http://192.168.1.123"

export default function({ boiler: { demand }}, x, { setFlame }) {
  console.log("CALL FOR HEAT: ", demand)

  return fetch(baseUrl + (demand ? '/on' : '/off'), { timeout: 5000 })
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          return response
        } else {
          const error = new Error(response.statusText)
          error.response = response
          throw error
        }
      })
      .then(response => response.json())
      .then(heat => setFlame(heat))
      .catch((...args) => console.error("Boiler demand failed", ...args))
}
