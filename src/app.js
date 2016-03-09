"use strict"

import express from 'express'
import url from 'url'
import proxy from 'proxy-middleware'
import { setup } from './backend/main'

const proxyOptions = url.parse('https://mihome4u.co.uk/api')
proxyOptions.headers = {
    authorization: require('./auth')
}

const app = express()

app.use('/api', proxy(proxyOptions))

app.use(express.static('.'))

app.listen(3030, () => {
    setup()
})
