<h1 id="top"></h1>
![Logo](admin/template.png)


# ioBroker.pvforecast
<p>
Hier findest du die Dokumentation auf <a href="#erstens">Deutsch</a><br>
Here you can find the documentation in <a href="#zweitens">Englisch</a><br>
<a href="#drittens">changelog</a><br>  
</p>


<h1 id="erstens">Dokumentation</h1>
Dieser Adapter ersetz das Javascript vom Iobroker Forum https://forum.iobroker.net/topic/26068/forecast-solar-mit-dem-systeminfo-adapter

Der Adapter holt die Grunddaten von https://api.forecast.solar mit folgenden Daten:

Einstellungen:
1. Längengrad 
2. Breitengrad
3. Link zu Seite
4. Api Schlüssel
5. Diagramm Y-Achse Stufe

Für die Anlage 1-5 stehen folgende Einstellungen zu Verfügung(Nur Anlage 1 muss Angegeben werden):

1. Neigung
2. Azimuth
3. Anlagenleistung (kWh)
4. Anlagenname
5. Diagramm Legenden Name
9. Diagramm Farbe
10. Diagramm Label Farbe 

Mit einem Api-Schlüssel kann zusätzlich das Wetter bezogen werden.
1. datetime - Datum und Uhrzeit
2. sky - Wert zwischen 0 und 1 prozentual für klaren Himmel [1 =  klarer Himmel].
3. Temperatur [°C]
4. Zustand - text 
5. icon - text + nummer
6. Wind geschwindigket -  [km/h]
7. Wind winkel - Norden 0°[Uhrzeigersinn]. (Wenn die Windgeschwindigkeit ist Null, wird der werd nicht definiert)
8. Wind richtung - Short name 



All diese Information werden benötigt um eine saubere Funtkion des Adapters gewährleisten zu können.

Falls der Längen und Breitengrad schon im System hinterlegt ist, trägt das System die Daten automatisch in die Felder ein.


Gehe zum <a href="#top">Anfang</a><br>


<h1 id="zweitens">Documentation</h1>
This Adapter replaced the javascript from the iobroker forum https://forum.iobroker.net/topic/26068/forecast-solar-mit-dem-systeminfo-adapter

The adapter take the roh data from https://api.forecast.solar and need this information:

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

With an api-key, you can recive optional the weather data with follwing points:
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


go to the<a href="#top">top</a><br>




<h1 id="drittens">Changelog</h1>
## Changelog
### 0.1.2
* (Patrick Walther) remove bugfixes, add weather forecast(api), add new logo from forecast.solar 
### 0.1.0
* (Patrick Walther) add  more plants, add summary, add json graph/table 
### 0.0.3
* (Patrick Walther) added datapoint power_day_tomorrow
* 
### 0.0.2
* (Patrick Walther) added data JSONgraph and JSONtable, fix failure with personal account(url)

### 0.0.1
* (Patrick Walther) initial release

## License
The MIT License (MIT)

Copyright (c) 2021 Patrick Walther walther-patrick@gmx.net

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
