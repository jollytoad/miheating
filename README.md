# Mi Heating

Experimental system to fire boiler when Mi|Home eTRVs demand heat,
and a visualisation of room temperatures over the past 24hrs.

    Copyright (C) 2016  Mark Gibson

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

## Run it locally

Add an auth.js file containing your basic authentication string for mihome4u API

eg:

    module.exports = "Basic xxxx"

### Production

This is suitable for a Raspberry PI etc:

    $ npm install --production
    $ npm start

Open http://localhost:3030

### Development

Then install and start:

    $ npm install
    $ jspm install
    $ npm run build
    $ npm start

Open http://localhost:3030/dev.html

### Bundling for Production

    $ npm run bundle
