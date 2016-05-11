"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
// ### Predicate combinators
// (?) -> (state, prev) -> boolean

const anyOf = exports.anyOf = (...predicates) => (...args) => predicates.some(when => when(...args));
const allOf = exports.allOf = (...predicates) => (...args) => predicates.every(when => when(...args));
const not = exports.not = predicate => (...args) => !predicate(...args);