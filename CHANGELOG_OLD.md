# Older changes
## 2.1.1 (2022-05-22)
* (klein0r) Improved error handling
* (klein0r) Format table values based on system.config

## 2.1.0 (2022-05-21)
* (klein0r) Force forecast update when url / config changed
* (klein0r) Added more options for JSON Graph generation
* (klein0r) Added image for azimuth configuraion
* (klein0r) Added missing translations

## 2.0.0 (2022-05-20)
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

## 1.0.1 (2022-04-29)
* (klein0r) Updated documentation
* (klein0r) Updated adapter category (energy)

## 1.0.0 (2022-04-03)
* (klein0r) Fallback to system location
* (klein0r) Updated admin config
* (klein0r) Fixed weather API requests
* (klein0r) Updated translations
* (klein0r) Updated roles and types
* (klein0r) Code cleanup
* (bluefox) Refactoring
* **BREAKING CHANGES FROM 0.2.X PLEASE DELETE AND REINSTALL**

## 0.2.7 (2022-03-15)
* (MeisterTR) fixes for repo

## 0.2.6 (2022-03-03)
* (MeisterTR) fix error with values before 5 oclock
* (MeisterTR) fix error when starting after 22 oclock

## 0.2.5 (2022-02-28)
 * (MeisterTR) fix request time
 * (MeisterTR) fix error with weather and solcast
 * (MeisterTR) solcast request only after midnight

## 0.2.4 (2022-02-26)
 * (MeisterTR) added support for Solcast

## 0.2.3 (2022-02-24)
* (MeisterTR) add Unit selection in Config (W/kW)
* (MeisterTR) fixed units in tables
* (MeisterTR) implement Solcast api (next version)

## 0.2.2 (2022-02-22)
* (MeisterTR) fixed timer warning
* (MeisterTR) fixed bootloop in some cases

## 0.2.1 (2022-02-21)
* (MeisterTR) fix typo
* (MeisterTR) fix no every hour folder in summary
* **BREAKING CHANGES FROM 0.1.X PLEASE DELETE AND REINSTALL**

## 0.2.0
* (MeisterTR) add jsonConfig (No admin4 support)
* (MeisterTR) fixed bugs and errors
* (MeisterTR) total code refactoring

## 0.1.8
* (Patrick Walther) fixed writing to database, log failure

## 0.1.7
* (Patrick Walther)add write to Database function

## 0.1.6
* (Patrick Walther)add timeout, fix bugs and add schedule in settings

## 0.1.5
* (Patrick Walther)repair failure everyhour

## 0.1.4
* (Patrick Walther)add hourly forecast

## 0.1.2
* (Patrick Walther) remove bugfixes, add weather forecast(api), add new logo from forecast.solar

## 0.1.0
* (Patrick Walther) add  more plants, add summary, add json graph/table

## 0.0.3
* (Patrick Walther) added datapoint power_day_tomorrow

## 0.0.2
* (Patrick Walther) added data JSONgraph and JSONtable, fix failure with personal account(url)

## 0.0.1
* (Patrick Walther) initial release