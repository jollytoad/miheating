"use strict"

import express from 'express'
import url from 'url'
import proxy from 'proxy-middleware'
import { setup } from './backend/main'
import { inquiry } from './backend/inquiry'
import { get } from 'fluxlet-immutable/lib/get'
import { topOfPeriod } from './util/history'
import { getCurrentHistory } from './backend/recorder'

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

app.use('/api', proxy(proxyOptions))

app.use(express.static('.'))

app.use(/^\/history\/(\d+)\.json$/, (req, res, next) => {
  if (+req.params[0] === topOfPeriod(Date.now())) {
    res.json(getCurrentHistory())
  } else {
    res.json([])
  }
})

app.listen(3030, () => {
  setup()
})
