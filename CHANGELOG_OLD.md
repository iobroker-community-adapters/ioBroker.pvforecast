# Older changes
## 2.9.1 (2023-12-18)

* (klein0r) Avoid logging of api key

## 2.9.0 (2023-10-28)
* (klein0r) Updated conversion for Solcast
* (klein0r) Store JSON state values in prettified format

## 2.8.2 (2023-10-28)
* (klein0r) Added icons in admin tabs

## 2.8.1 (2023-09-16)
* (klein0r) Fixed graph limits in summary
* (klein0r) Added options for summary graph and label color

## 2.8.0 (2023-09-16)
* (klein0r) Graphs are limited to maximum power (max)
* (klein0r) Installed power is Wp or kWp (as configured)

## 2.7.1 (2023-05-10)
* (klein0r) Summary channel should not be deleted

## 2.7.0 (2023-05-09)
* (klein0r) Request forecast data in correct timezone
* (bluefox) Type of the `summary` object was changed to `device`

## 2.6.0 (2023-03-09)
* (arteck) chart summary for more strings
* (klein0r) Fixed charting summary
* (klein0r) Rounded values in JSON summary

## 2.5.2 (2023-03-08)
* (klein0r) Fixed error when weather data could not be fetched

## 2.5.1 (2023-01-13)
* (klein0r) Fixed JSON table when using solcast

## 2.5.0 (2023-01-11)
* (klein0r) Added hourly values for energy
* (Apollon77) Added Sentry for crash reporting
* (klein0r) Dropped Admin 5 support
* (klein0r) Added Ukrainian language

## 2.4.0 (2022-12-09)
* (stromdao) Added SolarPredictionAPI

## 2.3.0 (2022-06-26)
* (klein0r) Add summary values to InfluxDB
* (klein0r) Use cron to ensure update on day change
* (klein0r) Removed visibility from weather data (doesn't exist in response)

## 2.2.1 (2022-06-23)
* (klein0r) Fixed tilt validation - allow zero tilt (0)

## 2.2.0 (2022-06-09)
* (klein0r) Added raw JSON data states for own graphs
* (klein0r) Improved debug log
* (klein0r) Updated azimuth image for dark theme

## 2.1.5 (2022-06-03)
* (klein0r) Added installed peak power as state
* (klein0r) Fixed time shift when using solcast

## 2.1.4 (2022-05-27)
* (klein0r) Added option for label text size (charting)

## 2.1.3 (2022-05-24)
* (klein0r) Reduced info log messages

## 2.1.2 (2022-05-23)
* (klein0r) Fixed refresh bug for solcast data
* (klein0r) Fixed null values for now (power and energy)

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