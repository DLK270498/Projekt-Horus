# Profil-Mock (privat)

Eine einzelne, eigenständige HTML-Datei (`index.html`), die ein LinkedIn-Profil möglichst detailgetreu nachbildet – zum privaten Ausprobieren und Zusammenstellen des eigenen Profils, ohne dass etwas öffentlich wird.

## Benutzung

1. `index.html` lokal im Browser öffnen (Doppelklick genügt, kein Server, kein Build).
2. Unten rechts auf **Bearbeiten** klicken – dann sind alle Texte direkt anklickbar und editierbar.
   - Profil- und Hintergrundbild: im Bearbeitungsmodus auf das Bild klicken.
   - Einträge (Berufserfahrung, Ausbildung, Kenntnisse …) per **+** hinzufügen, per ↑/↓ sortieren, per 🗑 löschen.
   - Sektionen lassen sich über „anzeigen“ ausblenden; #OpenToWork und Verifiziert-Symbol sind umschaltbar.
3. **Fertig** klicken, um die Ansicht wie ein echtes Profil zu sehen.

## Wo liegen die Daten?

Nur im `localStorage` des eigenen Browsers – nichts wird hochgeladen oder ins Repo geschrieben. Über das **···**-Menü:

- **Als JSON exportieren** – Sicherung / Übertragung auf ein anderes Gerät
- **JSON importieren** – Sicherung wiederherstellen
- **Drucken / als PDF**
- **Hell / Dunkel wechseln**
- **Auf Beispieldaten zurücksetzen**

Hinweis: Exportierte `profil.json`-Dateien nicht ins Repository committen, wenn das Repo öffentlich ist.
