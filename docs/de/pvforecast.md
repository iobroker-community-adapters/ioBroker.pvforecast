![Logo](img/pvforecast.png)

# pvforecast - Adapter zu vorhersage eurer PV Erträge

**If you like it, please consider a donation:**

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=UYB92ZVNEFNF6&source=url)


Dieser Adapter ersetz das Javascript vom Iobroker Forum https://forum.iobroker.net/topic/26068/forecast-solar-mit-dem-systeminfo-adapter

# Der Adapter holt die Grunddaten von https://api.forecast.solar mit folgenden Daten:

Einstellungen:
1. Längengrad 
2. Breitengrad
3. Link zu Seite
4. Api Schlüssel
5. Diagramm Y-Achse Stufe
6. Zeitplan Datenabfrage(min) - Zeitplan aller x Minuten die Daten vom Server abgerufen werden sollen.
7. Zeitüberschreitung Daten(sec) - Zeit nach der die Daten in das Object geschrieben werden (Aufruf nach dem Start).

Für die Anlage 1-5 stehen folgende Einstellungen zu Verfügung(Nur Anlage 1 muss Angegeben werden):

1. Neigung
2. Azimuth
3. Anlagenleistung (kWh)
4. Anlagenname
5. Diagramm Legenden Name
9. Diagramm Farbe
10. Diagramm Label Farbe 

# Mit einem Api-Schlüssel kann zusätzlich das Wetter bezogen werden.

1. datetime - Datum und Uhrzeit
2. sky - Wert zwischen 0 und 1 prozentual für klaren Himmel [1 =  klarer Himmel].
3. Temperatur [°C]
4. Zustand - text 
5. icon - text + nummer
6. Wind geschwindigket -  [km/h]
7. Wind winkel - Norden 0°[Uhrzeigersinn]. (Wenn die Windgeschwindigkeit ist Null, wird der werd nicht definiert)
8. Wind richtung - Short name 
9. Höhere Zeitauflösung


All diese Information werden benötigt um eine saubere Funtkion des Adapters gewährleisten zu können.

Falls der Längen und Breitengrad schon im System hinterlegt ist, trägt das System die Daten automatisch in die Felder ein.


# Vis Beispiel

Bevor das Beispiel geladen werden kann, bitte Installiert: ![Material Design](https://github.com/Scrounger/ioBroker.vis-materialdesign)
Wenn ihr in der IoBroker Vis die Json Diagramme und Tabellen benutzen möchtet, findet ihr hier ein ![Beispiel](https://github.com/Patrick-Walther/ioBroker.pvforecast/blob/main/docs/example/vis/)


# Test Einstellung
Falls ihr eine Test Einstellungen braucht![Klickt hier](https://github.com/Patrick-Walther/ioBroker.pvforecast/blob/main/docs/example/system.adapter.pvforecast.0.json) 

Habt Spaß mit dem Adapter


