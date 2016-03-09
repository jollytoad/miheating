/** @jsx hx */
"use strict"
import hx from './jsx-h'

// ## Templates

export const initRoot = () =>
  <div id="root" class="row"/>

export const root = ({ subdevices, temperatures }) =>
  <div id="root" class="row">
    <div class="col-md-12">
      <table class="table table-striped">
        <tbody>
          {subdevices.filter(({device_type}) => device_type === 'etrv').map(subdevice(temperatures))}
        </tbody>
      </table>
    </div>
  </div>

const subdevice = (temperatures) => ({ id, label, device_type, last_temperature, target_temperature }) =>
  <tr class={`subdevice ${target_temperature > last_temperature ? 'danger' : 'success'}`}>
    <td>
      <ul>
        <li>{id} ({device_type})</li>
        <li>{label}</li>
      </ul>
      {currentTemperature(temperatures[id], last_temperature, target_temperature)}
    </td>
    <td class="chart fill" id={`chart-${id}`}></td>
  </tr>

const currentTemperature = (data, last_temperature, target_temperature) => {
  if (data && data.length) {
    const [datetime, temperature] = data[0]
    const time = new Date(datetime).toLocaleTimeString()
    const next = new Date(Date.parse(datetime) + 5*60*1000).toLocaleTimeString()

    return <ul>
      <li>Target: {target_temperature}&deg;C</li>
      <li>Current: {temperature}&deg;C</li>
      <li title={datetime}>@ {time}</li>
    </ul>
  } else {
    return <ul>
      <li>Target: {target_temperature}&deg;C</li>
      <li>Current: {last_temperature}&deg;C</li>
    </ul>
  }
}
