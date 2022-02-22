![Logo](docs/de/img/pvforecast.png)
# pvforecast - Adapter zu vorhersage eurer PV Erträge
[![NPM version](https://img.shields.io/npm/v/iobroker.pvforecast.svg)](https://www.npmjs.com/package/iobroker.pvforecast)
[![Downloads](https://img.shields.io/npm/dm/iobroker.pvforecast.svg)](https://www.npmjs.com/package/iobroker.pvforecast)
![Number of Installations](https://iobroker.live/badges/pvforecast-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/pvforecast-stable.svg)
[![Dependency Status](https://img.shields.io/david/Patrick-Walther/iobroker.pvforecast.svg)](https://david-dm.org/Patrick-Walther/iobroker.pvforecast)

[![NPM](https://nodei.co/npm/iobroker.pvforecast.png?downloads=true)](https://nodei.co/npm/iobroker.pvforecast/)

**Tests:** ![Test and Release](https://github.com/Patrick-Walther/ioBroker.pvforecast/workflows/Test%20and%20Release/badge.svg)


**If you like it, please consider a donation:**

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=UYB92ZVNEFNF6&source=url)

vorhersage eurer PV Erträge
[Deutsche Beschreibung hier](docs/de/pvforecast.md)

forecast your pv earnings
[English Description here](docs/en/pvforecast.md)

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (MeisterTR) fixed timer warning
* (MeisterTR) fixed bootloop in some cases

### 0.2.1 (2022-02-21)

* (MeisterTR) fix typo
* (MeisterTR) fix no every hour folder in summary
* BREAKING CHANGES FROM 0.1.X PLEASE DELETE AND REINSTALL

### 0.2.0
* (MeisterTR) add jsonConfig (No admin4 support)
* (MeisterTR) fixed bugs and errors
* (MeisterTR) total code refactoring

### 0.1.8
* (Patrick Walther) fixed writing to database, log failure

### 0.1.7
* (Patrick Walther)add write to Database function

### 0.1.6
* (Patrick Walther)add timeout, fix bugs and add schedule in settings

### 0.1.5
* (Patrick Walther)repair failure everyhour 

### 0.1.4
* (Patrick Walther)add hourly forecast

### 0.1.2
* (Patrick Walther) remove bugfixes, add weather forecast(api), add new logo from forecast.solar 

### 0.1.0
* (Patrick Walther) add  more plants, add summary, add json graph/table 

### 0.0.3
* (Patrick Walther) added datapoint power_day_tomorrow

### 0.0.2
* (Patrick Walther) added data JSONgraph and JSONtable, fix failure with personal account(url)

### 0.0.1
* (Patrick Walther) initial release

## License
The MIT License (MIT)

Copyright (c) 2022 Patrick Walther walther-patrick@gmx.net

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
