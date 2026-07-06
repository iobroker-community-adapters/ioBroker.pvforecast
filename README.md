![Logo](admin/pvforecast.png)

# ioBroker.pvforecast

[![NPM version](https://img.shields.io/npm/v/iobroker.pvforecast?style=flat-square)](https://www.npmjs.com/package/iobroker.pvforecast)
[![Downloads](https://img.shields.io/npm/dm/iobroker.pvforecast?label=npm%20downloads&style=flat-square)](https://www.npmjs.com/package/iobroker.pvforecast)
![node-lts](https://img.shields.io/node/v-lts/iobroker.pvforecast?style=flat-square)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/iobroker.pvforecast?label=npm%20dependencies&style=flat-square)

![GitHub](https://img.shields.io/github/license/iobroker-community-adapters/iobroker.pvforecast?style=flat-square)
![GitHub repo size](https://img.shields.io/github/repo-size/iobroker-community-adapters/iobroker.pvforecast?logo=github&style=flat-square)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/iobroker-community-adapters/iobroker.pvforecast?logo=github&style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/iobroker-community-adapters/iobroker.pvforecast?logo=github&style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/iobroker-community-adapters/iobroker.pvforecast?logo=github&style=flat-square)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/iobroker-community-adapters/iobroker.pvforecast/test-and-release.yml?branch=main&logo=github&style=flat-square)

## Versions

![Beta](https://img.shields.io/npm/v/iobroker.pvforecast.svg?color=red&label=beta)
![Stable](http://iobroker.live/badges/pvforecast-stable.svg)
![Installed](http://iobroker.live/badges/pvforecast-installed.svg)

Provides forecast data from [forecast.solar](https://forecast.solar), [Solcast](https://solcast.com/), [SolarPredictionAPI](https://rapidapi.com/stromdao-stromdao-default/api/solarenergyprediction/) or [pvnode](https://pvnode.com)

## Documentation

[🇺🇸 Documentation](./docs/en/README.md)

[🇩🇪 Dokumentation](./docs/de/README.md)

## Credits

- Logo (Sun): https://pixabay.com/de/vectors/sonne-wetter-wettervorhersage-157126/

## Sentry

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
- (@patricknitsch) Change Free Tier Forecast from only today to today and tomorrow

### 6.2.0 (2026-07-06)
- (@patricknitsch) pvnode API v2 support: plant configuration via Site ID in the pvnode portal — create a site at https://pvnode.com/sites/new
- (@patricknitsch) pvnode v2: per-string forecasts — each configured plant receives its own forecast matched by index (plant 1 → string 0, etc.)
- (@patricknitsch) pvnode subscription tiers (Free / Light / Plus) replace the old paid-account checkbox; poll interval is set automatically per tier
- (@patricknitsch) pvnode v1: rotating round-robin fetch — one plant per poll cycle instead of one combined request; each plant receives an individual API call
- (@patricknitsch) Poll interval field hidden for pvnode (auto-managed)
- (@patricknitsch) Update Documentation of pvnode
- (@patricknitsch) Include warning for v1 and error after 31.12.26. The adapter cannot use v1 after this date anymore
- (@patricknitsch) pvnode Free tier forecast days is now configurable (1-2, today/today+tomorrow) instead of being hardcoded to 1, matching the actual pvnode Free tier scope

### 6.1.0 (2026-04-26)
- (@mcm1957) Adapter requires node.js >= 22, js-controller >= 6.0.11 and admin >= 7.7.22 now
- (@mcm1957) Dependencies have been updated

### 6.0.0 (2026-04-10)

- (@patricknitsch) Added pvnode als alternative Provider
- (copilot) Adapter requires admin >= 7.7.22 now

### 5.1.0 (2026-02-03)

* (@klein0r) admin 7.6.17 and js-controller 6.0.11 (or later) are required
* (@Scrounger) solcast user agent bug fix
* (@klein0r) Updated dependencies

### 5.0.0 (2025-04-23)

NodeJS >= 20.x and js-controller >= 6 is required

* (@klein0r) Minimum peak power is 0.1 kWp

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License

MIT License


Copyright (c) 2026 iobroker-community-adapters <iobroker-community-adapters@gmx.de>  
Copyright (c) 2021-2025 Patrick-Walther
                        Matthias Kleine <info@haus-automatisierung.com>

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
