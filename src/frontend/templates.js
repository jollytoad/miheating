/** @jsx hx */
"use strict"
import hx from './jsx-h'

// ## Templates

export const initRoot = () =>
  <div id="root"/>

export const root = ({ raw, model, refresh }) =>
    <div id="root">
      <nav class="navbar navbar-inverse navbar-fixed-top">
        <div class="container">
          <div class="navbar-left">
            <a class="navbar-brand" href="#">{new Date(refresh).toISOString().replace('T',' ').replace(/\..+/,'')}</a>
          </div>
          <button type="button" class="toggle-graphs btn btn-default navbar-btn navbar-right pull-right">
            <span class="glyphicon glyphicon-stats" aria-hidden="true"></span>
          </button>
        </div>
      </nav>
  
      <div class="container-fluid" role="main">
        {main(raw, model)}
      </div>
    </div>

const main = ({subdevices, temperatures}, model) =>
    <div id="root" class="row">
      <div class="col-md-12">
        <table class="table table-striped">
          {subdevices.filter(({device_type}) => device_type === 'etrv').map(subdevice(model, temperatures))}
        </table>
      </div>
    </div>

const subdevice = ({graphs, currentTemperatures, targetTemperatures}, temperatures) => ({id, label}) =>
    <tbody>
      <tr class={`subdevice ${targetTemperatures[id] > currentTemperatures[id] ? 'danger' : 'success'}`} data-id={id}>
        <td class="name">{label}</td>
        <td class="current">{currentTemperatures[id]}</td>
        <td class="target">{targetTemperatures[id]}</td>
        <td class="control">{temperatureControl(id, targetTemperatures[id])}</td>
      </tr>
      {graph(id, graphs)}
    </tbody>

const temperatureControl = (id, targetTemperature) =>
    <div class="btn-group">
      <button type="button" class="btn btn-default" aria-label="Decrease target temperature" data-id={id}
              data-set-target-temperature={targetTemperature-1}>
        <span class="glyphicon glyphicon-minus" aria-hidden="true"></span>
      </button>
      <button type="button" class="btn btn-default" aria-label="Increase target temperature" data-id={id}
              data-set-target-temperature={targetTemperature+1}>
        <span class="glyphicon glyphicon-plus" aria-hidden="true"></span>
      </button>
    </div>

const graph = (id, graphs) =>
    graphs ? <tr><td colspan="4" class="chart fill" id={`chart-${id}`}/></tr> : null
