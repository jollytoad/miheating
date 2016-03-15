"use strict"

import express from 'express'
import url from 'url'
import proxy from 'proxy-middleware'
import { setup } from './backend/main'
import { inquiry } from './backend/inquiry'
import { get } from 'fluxlet-immutable/lib/get'
import { topOfPeriod } from './util/history'
import { getCurrentHistory, save } from './backend/recorder'

const proxyOptions = url.parse('https://mihome4u.co.uk/api')
proxyOptions.headers = {
    authorization: require('../auth')
}

const app = express()

app.get(/^\/state\/(.*)$/, (req, res) => {
  const path = req.params[0].split('/').filter(v => !!v)
  const data = get(path)(inquiry)
  res.json(data)
})

app.get('/history/save', (req, res) => {
  save()
  res.json(true)
})

app.use('/api', proxy(proxyOptions))

app.use(/^\/history\/(\d+)\.json$/, (req, res, next) => {
  if (+req.params[0] === topOfPeriod(Date.now())) {
    res.json(getCurrentHistory())
  } else {
    res.json([])
  }
})

app.use(express.static('.'))

app.listen(3030, () => {
  setup()
})

function shutdown() {
  save()
  console.log("Bye")
  process.exit()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
