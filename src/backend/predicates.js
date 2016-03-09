// ### Predicate combinators
// (?) -> (state, prev) -> boolean

export const anyOf = (...predicates) => (...args) => predicates.some(when => when(...args))
export const allOf = (...predicates) => (...args) => predicates.every(when => when(...args))
export const not = (predicate) => (...args) => !predicate(...args)
