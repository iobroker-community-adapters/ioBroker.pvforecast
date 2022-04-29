![Logo](img/pvforecast.png)
# pvforecast - Adapter zu vorhersage eurer PV Erträge

**Wenn Dir der Adapter gefällt, freue ich mich über eine Spende:**

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=UYB92ZVNEFNF6&source=url)

Dieser Adapter ersetzt das Javascript vom Iobroker Forum https://forum.iobroker.net/topic/26068/forecast-solar-mit-dem-systeminfo-adapter

Der Adapter holt die Grunddaten von https://api.forecast.solar mit folgenden Daten:

## Einstellungen

1. Längengrad (-180 (West) … 180 (Ost))
2. Breitengrad -90 (Süd) … 90 (Nord)
3. Link zu Seite
4. Api Schlüssel
5. Diagramm Y-Achse Stufe
6. Zeitplan Datenabfrage(min) - Zeitplan aller x Minuten die Daten vom Server abgerufen werden sollen.

![pvforecast options](https://user-images.githubusercontent.com/76852173/155196476-8c8210d9-bdb2-456b-a0aa-1dd411efea5e.JPG)

Mit einem Api-Schlüssel kann zusätzlich das Wetter bezogen werden.

1. datetime - Datum und Uhrzeit
2. sky - Wert zwischen 0 und 1 prozentual für klaren Himmel [1 =  klarer Himmel].
3. Temperatur [°C]
4. Zustand - text 
5. icon - text + nummer
6. Wind Geschwindigkeit -  [km/h]
7. Wind winkel - Norden 0°[Uhrzeigersinn]. (Wenn die Windgeschwindigkeit ist Null, wird der Wert nicht definiert)
8. Wind richtung - Short name 
9. Höhere Zeitauflösung

## Für die Anlage stehen folgende Einstellungen zu Verfügung

1. Neigung (0°-90°)
2. Azimuth (-180 = north, -90 = east, 0 = south, 90 = west, 180 = north)
3. Anlagenleistung (kWh)
4. Anlagenname
5. Diagramm Legenden Name
9. Diagramm Farbe
10. Diagramm Label Farbe 

![pvforecast pvsystem](https://user-images.githubusercontent.com/76852173/155196535-6828775a-8234-4a6a-b2a3-03d7fd88c80d.JPG)

All diese Information werden benötigt um eine saubere Funktion des Adapters gewährleisten zu können.

Falls der Längen und Breitengrad schon im System hinterlegt ist, trägt das System die Daten automatisch in die Felder ein.

## VIS Beispiel

Bevor das Beispiel geladen werden kann, bitte installiert: [Material Design](https://github.com/Scrounger/ioBroker.vis-materialdesign).
Wenn ihr in der IoBroker Vis die Json Diagramme und Tabellen benutzen möchtet, findet ihr hier ein [Beispiel](https://github.com/Patrick-Walther/ioBroker.pvforecast/blob/main/docs/example/vis/)
