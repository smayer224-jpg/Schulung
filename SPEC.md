# SPEC: Pferde-Kalender

## 1. Zweck
Die App ist ein Kalender für ein Pferd.
Darin hält man alles Wichtige fest: Training, Gesundheit, Medikamente, Hufschmied, Tierarzt und Sonstiges.
Man sieht auf einen Blick, was an welchem Tag passiert ist oder geplant ist.

## 2. Nutzer
- Eine Person: die Besitzerin oder der Besitzer des Pferdes.
- Es geht um **ein** Pferd.
- Die App wird vor allem **am Handy** benutzt, zum Beispiel direkt im Stall.
- Man braucht kein Fachwissen, um die App zu bedienen.

## 3. Funktionen

### Muss (wird in einer Runde gebaut)
1. **Monatsansicht**: Der aktuelle Monat wird als Raster mit 7 Spalten angezeigt (Montag bis Sonntag).
2. **Monat wechseln**: Mit den Knöpfen „◀“ und „▶“ geht man einen Monat zurück oder vor. Ein Knopf „Heute“ springt zum aktuellen Monat.
3. **Heute markieren**: Der heutige Tag ist deutlich hervorgehoben.
4. **Farbige Punkte**: Jeder Tag zeigt für jede ausgefüllte Kategorie einen farbigen Punkt.
5. **Tag öffnen**: Ein Tipp auf einen Tag öffnet eine Tagesansicht. Dort steht für jede der 6 Kategorien ein eigenes Textfeld.
6. **Optional ausfüllen**: Man füllt nur die Felder aus, die man braucht. Leere Felder werden nicht gespeichert und bekommen keinen Punkt.
7. **Speichern, Ändern, Löschen**: Texte kann man speichern, später ändern oder leeren. Wenn man ein Feld leert, wird der Eintrag gelöscht.
8. **Automatisch speichern im Browser**: Alle Daten bleiben im Browser des Geräts gespeichert, auch nach dem Schließen.
9. **Sicherung herunterladen**: Ein Knopf lädt alle Daten als Datei herunter (`pferd-sicherung.json`).
10. **Sicherung einlesen**: Ein Knopf liest so eine Datei wieder ein. Vorher fragt die App: „Vorhandene Daten ersetzen?“
11. **Farb-Legende**: Unter dem Kalender steht, welche Farbe zu welcher Kategorie gehört.
12. **Farben ändern**: Ein Knopf „Farben ändern“ unter der Legende öffnet ein Fenster. Dort wählt man für jede Kategorie eine eigene Farbe. Ein Knopf „Standardfarben“ setzt alle Farben zurück. Die Farben gelten überall: im Kalender, in der Legende, in der Tagesansicht und bei „Nächste Termine“.

### Soll (zwei sichtbare Highlights)
1. **Pferde-Steckbrief** (oben auf der Seite)
   - Zeigt den Namen, die Rasse und das Alter des Pferdes.
   - Ein runder Kreis zeigt ein Bild des Pferdes. Ohne Bild steht dort der Anfangsbuchstabe des Namens.
   - Über „Bearbeiten“ kann man Bild, Name, Rasse und Geburtsjahr eintragen. Das Alter rechnet die App selbst aus.
   - Das Bild wird automatisch quadratisch zugeschnitten und auf 240 × 240 Pixel verkleinert, damit es in den Browser-Speicher passt. Man kann es auch wieder entfernen.
2. **Nächste Termine** (unter dem Steckbrief)
   - Ein Kasten zeigt den nächsten Termin beim **Hufschmied** und beim **Tierarzt**.
   - Beispiel: „Hufschmied: in 5 Tagen (18.11.)“ oder „Tierarzt: heute“.
   - Gibt es keinen Termin in der Zukunft, steht dort „Kein Termin geplant“.
   - Als Termin zählt jeder Tag ab heute, an dem die Kategorie Hufschmied oder Tierarzt ausgefüllt ist.

### Bewusst nicht
- Keine Uhrzeit bei Einträgen.
- Kein Erledigt-Häkchen.
- Keine Wiederholungen (zum Beispiel „jeden Tag ein Medikament“).
- Keine Kosten oder Rechnungen.
- Nur ein Bild für das Pferd, keine Fotos zu einzelnen Tagen oder Einträgen.
- Nur ein Pferd, nicht mehrere.
- Keine Erinnerungen oder Benachrichtigungen.
- Kein Login, kein Server, keine Synchronisierung zwischen Geräten. Daten bringt man über die Sicherungsdatei auf ein anderes Gerät.
- Keine Wochen- oder Listenansicht.

## 4. Daten

### Kategorien
Die Farben sind die Standardfarben. Man kann sie in der App ändern.

| Schlüssel     | Anzeige       | Farbe  |
|---------------|---------------|--------|
| `training`    | Training      | Grün   |
| `gesundheit`  | Gesundheit    | Blau   |
| `medikamente` | Medikamente   | Lila   |
| `hufschmied`  | Hufschmied    | Orange |
| `tierarzt`    | Tierarzt      | Rot    |
| `sonstiges`   | Sonstiges     | Grau   |

### Speicherung
Alles liegt unter **einem** Schlüssel im Browser-Speicher (`localStorage`), Name: `pferdeKalender`.

Aufbau:
```json
{
  "version": 1,
  "pferd": {
    "name": "Luna",
    "rasse": "Haflinger",
    "geburtsjahr": 2015,
    "bild": "data:image/jpeg;base64,..."
  },
  "farben": {
    "training": "#00aa88"
  },
  "tage": {
    "2026-11-13": {
      "training": "30 Min. Longe, locker",
      "gesundheit": "Fit, frisst gut"
    },
    "2026-11-18": {
      "hufschmied": "Neu beschlagen vorne"
    }
  }
}
```
- Das Datum ist immer im Format `JJJJ-MM-TT`.
- Ein Tag ohne Einträge wird aus `tage` entfernt.
- `bild` ist das verkleinerte Bild als Text (Data-URL). Leer bedeutet: kein Bild.
- In `farben` stehen nur Farben, die vom Standard abweichen. Format: `#rrggbb`.
- Die Sicherungsdatei hat genau denselben Aufbau.

## 5. Oberfläche
Von oben nach unten, gebaut für das Handy (schmaler Bildschirm):

1. **Steckbrief**: Kreis mit Bild oder Anfangsbuchstabe, Name, Rasse, Alter, Knopf „Bearbeiten“.
2. **Nächste Termine**: Kasten mit Hufschmied und Tierarzt.
3. **Monatskopf**: „◀ November 2026 ▶“ und Knopf „Heute“.
4. **Kalender-Raster**: 7 Spalten (Mo–So), Tageszahl und farbige Punkte darunter.
5. **Legende**: 6 Farben mit Namen, darunter der Knopf „Farben ändern“.
6. **Sicherung**: Knöpfe „Sicherung herunterladen“ und „Sicherung einlesen“.

**Tagesansicht** (öffnet sich als Fenster über dem Kalender):
- Oben das Datum, zum Beispiel „Freitag, 13. November 2026“.
- Darunter 6 Textfelder, jedes mit farbigem Punkt und Namen der Kategorie.
- Knöpfe „Speichern“ und „Abbrechen“.

Weitere Regeln für die Gestaltung:
- Große Flächen zum Tippen (mindestens 44 × 44 Pixel).
- Gut lesbare Schrift, genug Kontrast.
- Funktioniert auch am PC, dann ist die Seite mittig und nicht zu breit.
- Alle Texte in der App sind auf Deutsch.

## 6. Technik und Grenzen
- Nur **HTML, CSS und JavaScript**. Keine externen Bibliotheken, keine Schriften oder Dateien aus dem Internet.
- Dateien: `index.html`, `style.css`, `app.js`. Die bisherige `index.html` mit „Hallo“ wird ersetzt.
- Die App läuft durch Öffnen von `index.html` im Browser. Man braucht keinen Server und keine Installation.
- **Handy-App (PWA)**: Die App kann man auf dem Handy installieren („Zum Startbildschirm hinzufügen“).
  - `manifest.json`: Name, Farben und Symbol der App.
  - `sw.js`: Offline-Helfer. Er legt die App-Dateien auf dem Handy ab. So startet die App auch ohne Internet.
  - `icons/`: App-Symbol (Hufeisen) in den Größen 512, 192 und 180 Pixel (für das iPhone).
  - Zum Installieren muss die App über eine **https-Adresse** erreichbar sein, zum Beispiel über GitHub Pages. Als Datei per Doppelklick läuft sie weiter, aber ohne Offline-Helfer.
  - Wichtig: Jede Adresse hat ihren eigenen Speicher. Daten aus der Datei-Version erscheinen nicht automatisch in der installierten App. Man überträgt sie mit der Sicherungsdatei.
- Speicherung nur über `localStorage` im Browser.
- **Grenzen**:
  - Daten gibt es nur auf dem Gerät und in dem Browser, in dem sie eingetragen wurden.
  - Wenn man den Browser-Speicher löscht, sind die Daten weg. Dann hilft nur eine Sicherungsdatei.
  - Im privaten Modus des Browsers werden Daten eventuell nicht dauerhaft gespeichert.
- Keine Passwörter, Schlüssel oder Zugangsdaten in den Dateien.

## 7. Abnahmekriterien
Die App ist fertig, wenn alle Punkte stimmen:

- [ ] Beim Öffnen sieht man den aktuellen Monat, und der heutige Tag ist hervorgehoben.
- [ ] Mit ◀ und ▶ wechselt man den Monat. „Heute“ springt zurück zum aktuellen Monat.
- [ ] Der Monat beginnt am Montag, und die Tage stehen in der richtigen Spalte.
- [ ] Tippt man auf einen Tag, öffnet sich die Tagesansicht mit 6 Textfeldern.
- [ ] Nach dem Speichern zeigt der Tag für jedes ausgefüllte Feld einen Punkt in der richtigen Farbe.
- [ ] Öffnet man den Tag erneut, stehen die gespeicherten Texte in den Feldern.
- [ ] Leert man ein Feld und speichert, verschwindet der Punkt.
- [ ] Nach dem Neuladen der Seite sind alle Daten noch da.
- [ ] Der Steckbrief zeigt Name, Rasse, Alter und den Anfangsbuchstaben. Änderungen bleiben gespeichert.
- [ ] Man kann ein Bild auswählen. Es erscheint rund im Steckbrief und ist nach dem Neuladen noch da. „Bild entfernen“ zeigt wieder den Anfangsbuchstaben.
- [ ] Unter „Farben ändern“ kann man jede Farbe ändern. Nach dem Speichern haben alle Punkte und die Legende die neue Farbe, auch nach dem Neuladen. „Standardfarben“ stellt die alten Farben wieder her.
- [ ] Bild und Farben sind in der Sicherungsdatei enthalten und werden beim Einlesen wiederhergestellt.
- [ ] „Nächste Termine“ zeigt den nächsten Hufschmied- und Tierarzt-Termin ab heute richtig an, oder „Kein Termin geplant“.
- [ ] „Sicherung herunterladen“ lädt eine JSON-Datei mit allen Daten herunter.
- [ ] „Sicherung einlesen“ stellt die Daten aus dieser Datei wieder her, nachdem man die Rückfrage bestätigt hat.
- [ ] Eine falsche oder kaputte Datei zeigt eine verständliche Fehlermeldung und ändert keine Daten.
- [ ] Auf einem Handy-Bildschirm (360 Pixel breit) muss man nicht seitlich scrollen. Alles ist gut bedienbar.
- [ ] Der Code nutzt keine externen Bibliotheken und keine Dateien aus dem Internet.
- [ ] Über die https-Adresse lässt sich die App auf dem Handy zum Startbildschirm hinzufügen. Sie zeigt das Hufeisen-Symbol und öffnet sich ohne Browser-Leiste.
- [ ] Nach dem ersten Öffnen startet die installierte App auch im Flugmodus.
