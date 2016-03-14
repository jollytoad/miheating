'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.topOfPeriod = topOfPeriod;
const periodDuration = exports.periodDuration = 1000 * 60 * 60;

const folder = exports.folder = 'history';

function topOfPeriod(now) {
  return Math.floor(now / periodDuration) * periodDuration;
}