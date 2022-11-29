![Logo](../../admin/pvforecast.png)

# ioBroker.pvforecast - Adapter for the forecast of PV incomes

**If you like it, please consider a donation:**

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=UYB92ZVNEFNF6&source=url)

This Adapter replaced the javascript from the [ioBroker forum](https://forum.iobroker.net/topic/26068/forecast-solar-mit-dem-systeminfo-adapter)

The adapter take the roh data from https://api.forecast.solar and need this information

## Settings

1. longitude (-180 (west) … 180 (east))
2. latitude (-90 (south) … 90 (nord))
4. link to homepage
5. Api key
6. graph y-axis step

![pvforecast options](https://user-images.githubusercontent.com/76852173/155196821-61d26563-48cc-4ddd-a37f-417088c60951.JPG)

## With an api-key, you can receive optional the weather data with following points

higher time resolution
datetime -  date and time
sky - A numerical value between 0 and 1 percentage of clear sky [1 = clear sky].
temperature [°C]
condition - text
icon - text + number
wind_speed -  [km/h]
wind_degrees - north at 0°[clockwise]. (windSpeed is zero, value will not be defined)
wind_direction - Short name 

## For the equipment you can make the following settings

1. tilt (0°-90°)
2. azimuth (-180 = north, -90 = east, 0 = south, 90 = west, 180 = north)
3. plant power (kWh)
4. plant name
5. graph legend name
9. graph color
10. graph label color 

![pvforecast pvsystem](https://user-images.githubusercontent.com/76852173/155196852-62b928ca-4c8b-407e-8947-a45c7b31972a.JPG)

All this information is needed, that the adapter runs perfect.

If longitude and latitude in the iobroker main settings, the adapter will fill out the fields automatic.

# VIS example

Please install: [Material Design](https://github.com/Scrounger/ioBroker.vis-materialdesign) before you use the example.
If you want to take the json graph and table you can use this [example](./vis.md)
