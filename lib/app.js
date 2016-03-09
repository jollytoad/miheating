"use strict";

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _proxyMiddleware = require('proxy-middleware');

var _proxyMiddleware2 = _interopRequireDefault(_proxyMiddleware);

var _main = require('./backend/main');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const proxyOptions = _url2.default.parse('https://mihome4u.co.uk/api');
proxyOptions.headers = {
    authorization: require('./auth')
};

const app = (0, _express2.default)();

app.use('/api', (0, _proxyMiddleware2.default)(proxyOptions));

app.use(_express2.default.static('.'));

app.listen(3030, () => {
    (0, _main.setup)();
});