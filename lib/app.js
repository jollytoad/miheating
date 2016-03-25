"use strict";

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _proxyMiddleware = require('proxy-middleware');

var _proxyMiddleware2 = _interopRequireDefault(_proxyMiddleware);

var _main = require('./backend/main');

var _inquiry = require('./backend/inquiry');

var _get = require('fluxlet-immutable/lib/get');

var _history = require('./util/history');

var _recorder = require('./backend/recorder');

var _settings = require('../settings');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const proxyOptions = _url2.default.parse('https://mihome4u.co.uk/api');
proxyOptions.headers = {
  authorization: require('../auth')
};

const app = (0, _express2.default)();

app.get(/^\/state\/(.*)$/, (req, res) => {
  const path = req.params[0].split('/').filter(v => !!v);
  const data = (0, _get.get)(path)(_inquiry.inquiry);
  res.json(data);
});

app.use('/api', (0, _proxyMiddleware2.default)(proxyOptions));

app.use(/^\/history\/(\d+)\.json$/, (req, res, next) => {
  if (+req.params[0] === (0, _history.topOfPeriod)(Date.now())) {
    (0, _recorder.save)(next);
  } else {
    next();
  }
});

app.use(_express2.default.static('.'));

app.use(/^\/history\/(\d+)\.json$/, (req, res, next) => {
  res.json([]);
});

app.listen(_settings.httpPort, () => {
  (0, _main.setup)();
});

function shutdown() {
  (0, _recorder.save)(() => {
    console.log("Bye");
    process.exit();
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);