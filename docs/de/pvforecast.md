
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


