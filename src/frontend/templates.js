/** @jsx hx */
"use strict"
import hx from './jsx-h'

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour12: true, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })

// ## Templates

export const initRoot = () =>
  <div id="root"/>

export const root = ({ raw, model, loaded, error, req: { suspend } }) =>
    <div id="root" class={model.selectedTimer.data ? 'modal-open' : ''}>
      <nav class="navbar navbar-inverse navbar-fixed-top">
        <div class="container">
          <div class="navbar-left">
            <a class="navbar-brand" href="#" data-action="refresh">{suspend ? "Offline" : (error ? error : timeFormat.format(loaded))}</a>
          </div>
          <button type="button" class={`btn btn-default navbar-btn navbar-right pull-right ${model.graphs ? 'active' : ''}`} data-action="toggleGraphs">
            <span class="glyphicon glyphicon-stats" aria-hidden="true"></span>
          </button>
        </div>
      </nav>

      {model.selectedTimer.data ? timer(model.selectedTimer) : ''}

      <div class="container-fluid main" role="main">
        {main(raw, model)}
      </div>
    </div>

const main = ({subdevices, temperatures}, model) =>
    <div class="row">
      <div class="col-md-12">
        <table class="table table-striped">
          {subdevices.filter(({device_type}) => device_type === 'etrv').map(subdevice(model, temperatures))}
        </table>
      </div>
    </div>

const subdevice = ({graphs, currentTemperatures, targetTemperatures, pendingTemperatures}, temperatures) => ({id, label}) =>
    <tbody>
      <tr class={`subdevice ${pendingTemperatures[id] ? 'warning' : (targetTemperatures[id] > currentTemperatures[id] ? 'danger' : 'success')}`} data-id={id}>
        <td class="name">{label}</td>
        <td class="current">{currentTemperatures[id]}</td>
        <td class="target">{targetTemperature(id, pendingTemperatures[id] || targetTemperatures[id])}</td>
        <td class="control">{temperatureControl(id, currentTemperatures[id], pendingTemperatures[id] || targetTemperatures[id])}</td>
      </tr>
      {graph(id, graphs)}
    </tbody>

const targetTemperature = (id, temperature) =>
    <span data-action="newTimer" data-subdevice-id={id} data-temperature={temperature}>
      {temperature}
    </span>

const temperatureControl = (id, currentTemperature, targetTemperature) =>
    <div class="btn-group">
      {targetTempBtn('minus', id, targetTemperature-1)}
      {targetTempBtn('plus', id, Math.max(currentTemperature,targetTemperature)+1)}
    </div>

const targetTempBtn = (icon, id, temperature) =>
    <button type="button" class="btn btn-default" data-action="setTargetTemperature" data-id={id} data-value={temperature}>
      <span class={`glyphicon glyphicon-${icon}`} aria-hidden="true"></span>
    </button>

const graph = (id, graphs) =>
    graphs ? <tr><td colSpan="4" class="chart fill" id={`chart-${id}`}/></tr> : null

const timer = ({timerId, data: {temperature, time, days}}) =>
    <div id="timer-modal" class="timer-dialog modal" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-sm" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" data-action="unselectTimer" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            <h4 class="modal-title">{timerId ? 'Change timer' : 'Add timer'}</h4>
          </div>
          <div class="modal-body">

            <div class="row">
              <div class="col-xs-4 col-xs-offset-4 text-center">
                {temperatureBtn('plus', 1, temperature)}
              </div>
            </div>

            <div class="row">
              <div class="col-xs-4 text-right">
                <div class="btn-group btn-group-sm" role="group">
                  {timeBtn('fast-backward', -60, time)}
                  {timeBtn('step-backward', -15, time)}
                </div>
              </div>
              <div class="col-xs-4 text-center">
                <span class="timer-temperature">{temperature}</span>
              </div>
              <div class="col-xs-4">
                <div class="btn-group btn-group-sm" role="group">
                  {timeBtn('step-forward', 15, time)}
                  {timeBtn('fast-forward', 60, time)}
                </div>
              </div>
            </div>

            <div class="row">
              <div class="col-xs-4 col-xs-offset-4 text-center">
                {temperatureBtn('minus', -1, temperature)}
              </div>
            </div>

            <div class="row">
              <div class="col-xs-10 col-xs-offset-1 text-center">
                <div class="form-group">
                  <input type="time" class="form-control timer-time" data-action="setTimerData" data-prop="time" value={formatTime(time)}/>
                </div>
                <div class="form-group btn-group btn-group-sm" role="group">
                  {dayBtn('M', 1, days)}
                  {dayBtn('T', 2, days)}
                  {dayBtn('W', 4, days)}
                  {dayBtn('T', 8, days)}
                  {dayBtn('F', 16, days)}
                  {dayBtn('S', 32, days)}
                  {dayBtn('S', 64, days)}
                </div>
                <div class="btn-group btn-group-xs" role="group">
                  {rangeBtn('Weekdays', 31)}
                  {rangeBtn('All week', 127)}
                  {rangeBtn('Weekend', 96)}
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <div class="row">
              <div class="col-xs-6 text-center">
                {timerId ?
                  <button type="button" class="btn btn-default btn-danger" data-action="deleteTimer">Delete</button>
                    :
                  <span/>
                }
              </div>
              <div class="col-xs-6 text-center">
                <button type="button" class="btn btn-primary" data-action="saveTimer">Save</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

const temperatureBtn = (icon, offset, temperature) =>
    <button type="button" class="btn btn-default" data-action="setTimerData" data-prop="temperature" data-value={temperature + offset}>
      <span class={`glyphicon glyphicon-${icon}`} aria-hidden="true"></span>
    </button>

const timeBtn = (icon, offset, time) =>
    <button type="button" class="btn btn-default" data-action="setTimerData" data-prop="time" data-value={calcTime(time, offset)}>
      <span class={`glyphicon glyphicon-${icon}`} aria-hidden="true"></span>
    </button>

const dayBtn = (char, bit, days) =>
    <button type="button" class={`btn btn-default ${bit & days ? 'btn-success active' : ''}`} data-day={bit}
            data-action="setTimerData" data-prop="days" data-value={days ^ bit}>{char}</button>

const rangeBtn = (label, value) =>
    <button type="button" class="btn btn-default" data-action="setTimerData" data-prop="days" data-value={value}>{label}</button>

const calcTime = (time, offset) => (2880 + (time + offset)) % 1440

const formatTime = time => pad2(Math.floor(time/60)) + ':' + pad2(time % 60)

const pad2 = n => ('0' + n).slice(-2)
