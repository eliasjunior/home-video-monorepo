// sharedState.js
let moviesMap = {};

export function getMoviesMap() {
  return moviesMap;
}

export function setMoviesMap(newValue) {
  moviesMap = newValue;
}
