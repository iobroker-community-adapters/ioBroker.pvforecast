![Logo](admin/pvforecast.png)

# ioBroker.pvforecast

[![NPM version](https://img.shields.io/npm/v/iobroker.pvforecast?style=flat-square)](https://www.npmjs.com/package/iobroker.pvforecast)
[![Downloads](https://img.shields.io/npm/dm/iobroker.pvforecast?label=npm%20downloads&style=flat-square)](https://www.npmjs.com/package/iobroker.pvforecast)
![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/iobroker.pvforecast?label=npm%20vulnerabilities&style=flat-square)
![node-lts](https://img.shields.io/node/v-lts/iobroker.pvforecast?style=flat-square)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/iobroker.pvforecast?label=npm%20dependencies&style=flat-square)

![GitHub](https://img.shields.io/github/license/iobroker-community-adapters/iobroker.pvforecast?style=flat-square)
![GitHub repo size](https://img.shields.io/github/repo-size/iobroker-community-adapters/iobroker.pvforecast?logo=github&style=flat-square)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/iobroker-community-adapters/iobroker.pvforecast?logo=github&style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/iobroker-community-adapters/iobroker.pvforecast?logo=github&style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/iobroker-community-adapters/iobroker.pvforecast?logo=github&style=flat-square)
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/iobroker-community-adapters/iobroker.pvforecast/Test%20and%20Release?label=Test%20and%20Release&logo=github&style=flat-square)
![Snyk Vulnerabilities for GitHub Repo](https://img.shields.io/snyk/vulnerabilities/github/iobroker-community-adapters/iobroker.pvforecast?label=repo%20vulnerabilities&logo=github&style=flat-square)

## Versions

![Beta](https://img.shields.io/npm/v/iobroker.pvforecast.svg?color=red&label=beta)
![Stable](http://iobroker.live/badges/pvforecast-stable.svg)
![Installed](http://iobroker.live/badges/pvforecast-installed.svg)

The adapter provides forecast data from [forecast.solar](https://forecast.solar) or [Solcast](https://solcast.com/)

This Adapter replaced the javascript from the [ioBroker forum](https://forum.iobroker.net/topic/26068/forecast-solar-mit-dem-systeminfo-adapter)

**If you like it, please consider a donation:**

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=UYB92ZVNEFNF6&source=url)

## Documentation

[🇺🇸 Documentation](./docs/en/pvforecast.md)

[🇩🇪 Dokumentation](./docs/de/pvforecast.md)

## Credits

- Logo (Sun): https://pixabay.com/de/vectors/sonne-wetter-wettervorhersage-157126/

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (klein0r) Added option for label text size (charting)

### 2.1.3 (2022-05-24)
* (klein0r) Reduced info log messages

### 2.1.2 (2022-05-23)
* (klein0r) Fixed refresh bug for solcast data
* (klein0r) Fixed null values for now (power and energy)

### 2.1.1 (2022-05-22)
* (klein0r) Improved error handling
* (klein0r) Format table values based on system.config

### 2.1.0 (2022-05-21)
* (klein0r) Force forecast update when url / config changed
* (klein0r) Added more options for JSON Graph generation
* (klein0r) Added image for azimuth configuraion
* (klein0r) Added missing translations

### 2.0.0 (2022-05-20)
* (klein0r) Added manual reset for forecast
* (klein0r) Added step size for hourly values
* (klein0r) Added hourly forecast for tomorrow
* (klein0r) Fixed weather information
* (klein0r) Restructured states (energy and power to seperate channels)
* (klein0r) Updated object names
* (klein0r) Fixed several async/await bugs
* (klein0r) Reduce service requests
* (klein0r) Added validation for configured devices
* (klein0r) Updated instance configuration fields (+ encryption of api key)

**BREAKING CHANGES FROM 1.X.X PLEASE DELETE AND REINSTALL**

### 1.0.1 (2022-04-29)
* (klein0r) Updated documentation
* (klein0r) Updated adapter category (energy)

### 1.0.0 (2022-04-03)
* (klein0r) Fallback to system location
* (klein0r) Updated admin config
* (klein0r) Fixed weather API requests
* (klein0r) Updated translations
* (klein0r) Updated roles and types
* (klein0r) Code cleanup
* (bluefox) Refactoring
* **BREAKING CHANGES FROM 0.2.X PLEASE DELETE AND REINSTALL**

### 0.2.7 (2022-03-15)
* (MeisterTR) fixes for repo

### 0.2.6 (2022-03-03)
* (MeisterTR) fix error with values before 5 oclock
* (MeisterTR) fix error when starting after 22 oclock

### 0.2.5 (2022-02-28)
 * (MeisterTR) fix request time
 * (MeisterTR) fix error with weather and solcast
 * (MeisterTR) solcast request only after midnight

### 0.2.4 (2022-02-26)
 * (MeisterTR) added support for Solcast

### 0.2.3 (2022-02-24)
* (MeisterTR) add Unit selection in Config (W/kW)
* (MeisterTR) fixed units in tables
* (MeisterTR) implement Solcast api (next version)

### 0.2.2 (2022-02-22)
* (MeisterTR) fixed timer warning
* (MeisterTR) fixed bootloop in some cases

### 0.2.1 (2022-02-21)
* (MeisterTR) fix typo
* (MeisterTR) fix no every hour folder in summary
* **BREAKING CHANGES FROM 0.1.X PLEASE DELETE AND REINSTALL**

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
MIT License

Copyright (c) 2022 Patrick-Walther

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
