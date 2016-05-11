"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
const inquiry = exports.inquiry = {};

const saveState = ({ id }) => id ? state => {
  inquiry[id] = state;
} : null;

const inquirer = exports.inquirer = {
  registerState: saveState,
  dispatch: saveState
};