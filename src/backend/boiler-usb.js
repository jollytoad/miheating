import { SerialPort, parsers } from "serialport"

let serialPort = null

function openPort(callback) {
  if (serialPort == null || !serialPort.isOpen()) {
    serialPort = new SerialPort("/dev/tty.wchusbserial1420", {
      baudrate: 9600,
      parser: parsers.readline("\n")
    }, false)

    serialPort.open(error => {
      if (error) {
        console.error("Failed to open serial port:", error)
        serialPort = null
      } else {
        console.log("Serial port open")

        serialPort.on('data', data => {
          console.log("USB:", data)
        })

        callback()
      }
    })
  } else {
      callback()
  }
}

export default function({ boiler: { demand }}, x, { setFlame }) {
  console.log("CALL FOR HEAT: ", demand)

  openPort(() => {
    serialPort.write(demand ? "1\n" : "0\n", (error, results) => {
      if (error) {
        console.error("Boiler demand failed:", error)
        serialPort.close()
        serialPort = null
      } else {
        setFlame(demand)
      }
    })
  })
}
