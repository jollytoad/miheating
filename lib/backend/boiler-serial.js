"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function ({ boiler: { demand, low, high } }, x, { setFlame }) {
  console.log("CALL FOR HEAT: ", demand, " low: ", low, " high: ", high);

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

    serialPort.write(`l${ low }\nh${ high }\n`);
  });
};

var _serialport = require("serialport");

var _settings = require("../../settings.js");

let serialPort = null;

function openPort(callback) {
  if (serialPort == null || !serialPort.isOpen()) {
    serialPort = new _serialport.SerialPort(_settings.boilerSerialDev, {
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
          console.log("Boiler:", data);
        });

        callback();
      }
    });
  } else {
    callback();
  }
}