"use strict"

import browserSync from 'browser-sync'
import url from 'url'
import proxy from 'proxy-middleware'
import { setup } from './backend/main'

const bs = browserSync.create()

const proxyOptions = url.parse('https://mihome4u.co.uk/api')
proxyOptions.route = '/api'
proxyOptions.headers = {
    authorization: require('./auth')
}

bs.init({
    server: ".",
    port: "3030",
    files: "frontend/*,lib/*",
    middleware: [
        proxy(proxyOptions)
    ]
}, setup)
