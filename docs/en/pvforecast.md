
![Logo](docs/de/img/pvforecast.png)
# pvforecast - Adapter zu vorhersage eurer PV Erträge

**If you like it, please consider a donation:**

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=UYB92ZVNEFNF6&source=url)


This Adapter replaced the javascript from the iobroker forum https://forum.iobroker.net/topic/26068/forecast-solar-mit-dem-systeminfo-adapter

# The adapter take the roh data from https://api.forecast.solar and need this information:

settings:
1. longitude
2. latiude
3. link to hompage
4. Api key
5. graph y-axis step

For plants 1-5 you can make the following settings (only plant1 has to fill out):

1. tilt
2. Azimuth
3. plant power (kWh)
4. plat name
5. graph legend name
9. graph color
10. graph label color 

# With an api-key, you can recive optional the weather data with follwing points:
higher time resolution
datetime -  date and time
sky - A numerical value between 0 and 1 percentage of clear sky [1 = clear sky].
temperature [°C]
condition - text
icon - text + number
wind_speed -  [km/h]
wind_degrees - north at 0°[clockwise]. (windSpeed is zero, value will not be defined)
wind_direction - Short name 



all this information are needed, that the adapter runs perfect.

If longitde and latitude in the iobroker main settings, the adapter will fill out the fields automatic.

# vis exmaple
If you want to take the json graph and table you can use this ![exmaple](https://github.com/Patrick-Walther/ioBroker.pvforecast/blob/main/docs/example/visdocs/example/vis)


# test setting
![Here](https://github.com/Patrick-Walther/ioBroker.pvforecast/blob/main/docs/example/system.adapter.pvforecast.0.json) you can find a test configuration.

have fun with the adapter

