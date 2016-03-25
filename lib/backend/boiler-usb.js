"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (_ref, x, _ref2) {
  let demand = _ref.boiler.demand;
  let setFlame = _ref2.setFlame;

  console.log("CALL FOR HEAT: ", demand);

  openPort(() => {
    serialPort.write(demand ? "1\n" : "0\n", (error, results) => {
      if (error) {
        console.error("Boiler demand failed:", error);
        serialPort.close();
        serialPort = null;
      } else {
        setFlame(demand);
      }
    });
  });
};

var _serialport = require("serialport");

let serialPort = null;

function openPort(callback) {
  if (serialPort == null || !serialPort.isOpen()) {
    serialPort = new _serialport.SerialPort("/dev/tty.wchusbserial1420", {
      baudrate: 9600,
      parser: _serialport.parsers.readline("\n")
    }, false);

    serialPort.open(error => {
      if (error) {
        console.error("Failed to open serial port:", error);
        serialPort = null;
      } else {
        console.log("Serial port open");

        serialPort.on('data', data => {
          console.log("USB:", data);
        });

        callback();
      }
    });
  } else {
    callback();
  }
}