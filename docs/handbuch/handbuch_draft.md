# Benutzerhandbuch: Stellenistberechnung

**CREDO Verwaltung | HR-Software für NRW-Ersatzschulen**
**Version 1.0 | Stand: April 2026**

---

*Dieses Handbuch richtet sich an HR-Sachbearbeiter der CREDO-Schulgruppe.*
*Es setzt keine IT-Kenntnisse voraus.*

---

## Inhaltsverzeichnis

1. Einleitung
2. Schnellstart: In 5 Minuten zur ersten Auswertung
3. Kernfunktionen im Detail
   - 3.1 Dashboard
   - 3.2 Schülerzahlen
   - 3.3 SLR-Konfiguration
   - 3.4 Regeldeputate
   - 3.5 Deputate
   - 3.6 Deputat-Detail
   - 3.7 Mehrarbeit
   - 3.8 Mitarbeiter
   - 3.9 Nachträge
   - 3.10 Stellensoll
   - 3.11 Stellenist
   - 3.12 Soll-Ist-Vergleich
   - 3.13 Stellenanteile
   - 3.14 Export
   - 3.15 Einstellungen
   - 3.16 Benutzerverwaltung (Admin)
4. Häufige Fragen und Lösungen (FAQ)
5. Glossar

---

## 1. Einleitung

### Warum diese Software?

Die Berechnung von Lehrerstellen in freien Ersatzschulen ist gesetzlich geregelt. Grundlage ist § 3 der Verordnung über die Finanzierung von freien Ersatzschulen (FESchVO NRW). Jede Abweichung vom korrekten Verfahren kann Auswirkungen auf die Landesförderung haben. Bisher haben viele HR-Sachbearbeiter diese Berechnungen mühsam in Excel-Tabellen gepflegt. Das kostet Zeit, birgt Fehlerrisiken und ist bei Prüfungen durch die Bezirksregierung schwer nachvollziehbar zu dokumentieren.

**Die Software "Stellenistberechnung"** löst genau dieses Problem. Sie berechnet automatisch, wie viele Lehrerstellen Ihrer Schule laut Förderrecht zustehen (Stellensoll), wie viele tatsächlich besetzt sind (Stellenist) und ob Ihre Schule im grünen Bereich liegt. Das gesamte Verfahren ist revisionssicher dokumentiert und jederzeit exportierbar.

**Was Sie konkret sparen:** Statt mehrerer Stunden Excel-Arbeit pro Monat reichen wenige Minuten für die Kontrolle. Statt fehleranfälliger manueller Formeln rechnet die Software nach denselben gesetzlichen Vorgaben, die auch die Bezirksregierung anlegt. Statt lose abgelegter Tabellenblätter haben Sie eine zentrale, versionierte Datenbasis.

**Was die Software ersetzt:**
Die monatliche Excel-Pflege der Deputatslisten entfällt weitgehend, weil Stundenpläne automatisch aus Untis (dem schulischen Stundenplanprogramm) übertragen werden. Manuelle Stellenberechnungen auf Basis von Schülerzahlen und Schüler-Lehrer-Relationen erledigt die Software vollständig selbst. Auch die Erstellung von Nachweisdokumenten für die Bezirksregierung ist auf Knopfdruck möglich.

**Was Sie brauchen:**
- Einen aktuellen Webbrowser (Chrome, Firefox, Edge oder Safari)
- Ihre persönlichen Zugangsdaten (Benutzername und Passwort)
- Die Webadresse: **deputat.fes-credo.de**
- Eine Internetverbindung

Weitere Installation ist nicht notwendig. Die Software läuft vollständig im Browser.

---

## 2. Schnellstart: In 5 Minuten zur ersten Auswertung

Dieser Abschnitt zeigt Ihnen den schnellsten Weg zu einer nützlichen Auswertung. Folgen Sie den Schritten in dieser Reihenfolge. Nach etwa 5 Minuten haben Sie einen Überblick über die aktuelle Stellensituation Ihrer Schule.

---

### Schritt 1: Anmelden

Öffnen Sie Ihren Browser. Geben Sie in die Adresszeile **deputat.fes-credo.de** ein. Drücken Sie die Eingabetaste. Die Anmeldemaske erscheint.

Geben Sie Ihren Benutzernamen ein. Geben Sie Ihr Passwort ein. Klicken Sie auf "Anmelden". Sie befinden sich nun auf dem Dashboard.

**Hinweis:** Falls Sie Ihr Passwort vergessen haben, wenden Sie sich an Ihre Administratorin oder Ihren Administrator. Eine Passwort-Zurücksetzen-Funktion ist in der Benutzerverwaltung verfügbar.

[SCREENSHOT_1: Anmeldemaske mit Feldern für Benutzername und Passwort sowie dem Anmelden-Button]

---

### Schritt 2: Das richtige Haushaltsjahr wählen

Nach dem Anmelden sehen Sie oben rechts einen Auswahlbereich für das Haushaltsjahr. Standardmäßig ist das aktuelle Jahr voreingestellt (z.B. "2025"). Prüfen Sie, ob das richtige Jahr angezeigt wird. Klicken Sie auf den Auswahlpfeil, um ein anderes Jahr zu wählen.

**Goldene Regel Nr. 1 – Haushaltsjahr immer prüfen:** Bevor Sie irgendetwas exportieren oder melden, schauen Sie oben rechts auf den Haushaltsjahr-Selektor. Steht dort das richtige Jahr? Besonders zum Jahreswechsel (Januar) ist es leicht, noch im alten Jahr zu arbeiten ohne es zu bemerken. Ein Export im falschen Jahr ist offiziell wertlos.

**Wichtig:** Dieser Haushaltsjahr-Filter wirkt sich auf alle Seiten der Software aus. Alle Daten, Berechnungen und Exporte beziehen sich immer auf das gewählte Haushaltsjahr. Wenn Sie also die Situation von 2024 prüfen möchten, wählen Sie 2024. Wenn Sie aktuelle Daten sehen möchten, wählen Sie das laufende Jahr.

[SCREENSHOT_2: Haushaltsjahr-Selektor oben rechts im Header der Anwendung mit Dropdown-Pfeil]

---

### Schritt 3: Das Dashboard lesen

Nach dem Anmelden landen Sie automatisch auf dem Dashboard. Hier sehen Sie auf einen Blick:

- **Soll-Stellen:** Wie viele Lehrerstellen stehen Ihrer Schule laut Förderrecht zu?
- **Ist-Stellen:** Wie viele Stellen sind tatsächlich besetzt?
- **Ampelstatus:** Liegt Ihre Schule im grünen, gelben oder roten Bereich?
- **Deputate:** Aktuelle Gesamtdeputatsstunden aller Lehrkräfte
- **Anzahl Lehrkräfte:** Wie viele aktive Lehrkräfte sind erfasst?

Das Dashboard zeigt diese Kennzahlen für jede Schule der CREDO-Gruppe. Sie sehen sofort, wo Handlungsbedarf besteht.

**Ampelbedeutung im Schnellüberblick:**
- Grün: Stellendifferenz ist ausgeglichen oder leicht positiv. Alles in Ordnung.
- Gelb: Die Differenz beträgt bis zu 0,5 Stellen. Bitte beobachten.
- Rot: Die Differenz übersteigt 0,5 Stellen. Bitte prüfen und handeln.

[SCREENSHOT_3: Dashboard-Übersicht mit Karten für jede Schule, Ampelfarben und KPI-Zahlen]

---

### Schritt 4: Ersten Export erstellen

Klicken Sie in der linken Navigation auf "Export". Die Export-Seite öffnet sich. Wählen Sie "Berechnungsnachweis (PDF)" aus der Liste der verfügbaren Exporte. Wählen Sie die gewünschte Schule aus. Klicken Sie auf "Export erstellen". Nach wenigen Sekunden öffnet sich ein PDF-Dokument.

Dieses Dokument enthält alle relevanten Berechnungen für die Bezirksregierung. Es ist sofort einsatzbereit und muss nicht weiter bearbeitet werden.

[SCREENSHOT_4: Export-Seite mit Liste der Exportoptionen und Schul-Auswahlfeld]

**Herzlichen Glückwunsch!** Sie haben in wenigen Minuten einen offiziellen Berechnungsnachweis erstellt. Was früher Stunden dauerte, erledigt die Software in Sekunden.

---

## 3. Kernfunktionen im Detail

Dieser Abschnitt beschreibt alle 16 Seiten der Software ausführlich. Für jede Funktion erfahren Sie: Was sie tut, warum sie wichtig ist und wie Sie Schritt für Schritt vorgehen.

---

#### 3.1 Dashboard

**Was es tut:** Das Dashboard ist die Startseite der Software. Es zeigt alle wichtigen Kennzahlen aller Schulen auf einen Blick.

**Warum es hilft:** Als HR-Sachbearbeiter müssen Sie regelmäßig prüfen, ob Ihre Schulen stellenmäßig korrekt aufgestellt sind. Das Dashboard gibt Ihnen diese Übersicht ohne langen Klickweg. Abweichungen erkennen Sie sofort am Ampelsystem. Damit reagieren Sie schneller auf drohende Unterbesetzungen und haben bei Rückfragen der Bezirksregierung immer den aktuellen Stand griffbereit.

**Schritt für Schritt:**

1. Melden Sie sich bei deputat.fes-credo.de an. Das Dashboard erscheint automatisch.
2. Prüfen Sie das gewählte Haushaltsjahr oben rechts. Ändern Sie es bei Bedarf.
3. Schauen Sie auf die Schul-Karten. Jede Karte steht für eine Schule der CREDO-Gruppe.
4. Prüfen Sie die Ampelfarbe jeder Schule. Rot bedeutet: sofort handeln.
5. Klicken Sie auf eine Schul-Karte, um zur Detailansicht dieser Schule zu gelangen.
6. Nutzen Sie die Kennzahlen für Ihre tägliche Arbeit und interne Berichte.

[SCREENSHOT_5: Dashboard mit allen Schul-Karten nebeneinander, Ampelfarben und aufgeschlüsselten KPI-Werten wie Soll-Stellen, Ist-Stellen, Deputate und Lehrkräfte-Anzahl]

**Praxisbeispiel:** Es ist Oktober. Sie fragen sich, ob das Gymnasium (GYM) nach Beginn des neuen Schuljahres noch korrekt aufgestellt ist. Sie öffnen das Dashboard. Sie sehen sofort: Das GYM zeigt gelb. Klicken Sie auf die GYM-Karte und sehen Sie die genaue Differenz. So sparen Sie sich das Durchsuchen mehrerer Tabellen.

---

#### 3.2 Schülerzahlen

**Was es tut:** Diese Seite dient der Erfassung der offiziellen Schülerzahlen pro Schule und Jahrgangsstufe mit Stichtag 15. Oktober.

**Warum es hilft:** Die Schülerzahlen sind die Grundlage jeder Stellenberechnung nach § 3 FESchVO. Das Land NRW berechnet, wie viele Lehrerstellen eine Schule beanspruchen darf, direkt aus der Schülerzahl geteilt durch die Schüler-Lehrer-Relation (SLR). Falsche Schülerzahlen bedeuten falsche Stellenzahlen. Diese Seite stellt sicher, dass die richtigen Zahlen im richtigen Zeitraum verwendet werden.

**Wichtiger gesetzlicher Hintergrund:** Es gibt zwei relevante Stichtage im Jahr. Für den Zeitraum Januar bis Juli eines Jahres werden die Schülerzahlen vom 15. Oktober des **Vorjahres** verwendet. Für den Zeitraum August bis Dezember werden die Schülerzahlen vom 15. Oktober des **laufenden Jahres** verwendet. Die Software berücksichtigt diese Unterscheidung automatisch, sobald Sie die Zahlen korrekt erfasst haben.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Schülerzahlen".
2. Wählen Sie oben das Haushaltsjahr aus, für das Sie Zahlen erfassen möchten.
3. Wählen Sie die gewünschte Schule aus der Schul-Auswahlliste.
4. Sie sehen eine Tabelle mit allen Jahrgangsstufen dieser Schule.
5. Tragen Sie für jede Jahrgangsstufe die Schülerzahl ein. Orientieren Sie sich an der amtlichen Schulstatistik.
6. Prüfen Sie den Stichtag: Die Zahlen müssen dem Stand vom 15. Oktober entsprechen.
7. Klicken Sie auf "Speichern". Die Zahlen sind nun hinterlegt.
8. Wiederholen Sie den Vorgang für jede Schule der Gruppe.

[SCREENSHOT_6: Schülerzahlen-Seite mit Tabelle, Jahrgangsstufen in Zeilen, Eingabefeldern und Stichtag-Hinweis]

**Praxisbeispiel:** Der 15. Oktober naht. Sie haben die aktuellen Schülerzahlen aus der amtlichen Statistik erhalten. Für das Berufskolleg (BK) tragen Sie für jede Bildungsganggruppe die entsprechende Zahl ein. Die Software berechnet daraufhin automatisch das neue Stellensoll für das zweite Halbjahr des laufenden Jahres.

**Wichtig – Goldene Regel:** Tragen Sie IMMER die Zahlen vom 15. Oktober ein – nicht die Zahlen von heute oder von Anfang des Schuljahres. Der Stichtag 15. Oktober ist gesetzlich unveränderlich (§ 3 FESchVO). Zahlen von einem anderen Datum sind für die Förderberechnung nicht anerkannt.

**Was tun, wenn Ihre Zahlen von den Zahlen der Bezirksregierung abweichen?** Das kann passieren, wenn die amtliche Schulstatistik (Landeserhebung) andere Werte enthält als Ihre interne Zählung. In diesem Fall gilt die amtliche Schulstatistik. Passen Sie die Zahlen in der Software entsprechend an. Dokumentieren Sie die Abweichung intern. Bei größeren Differenzen wenden Sie sich an Ihre Schulbehörde.

**Hinweis:** Bitte erfassen Sie die Zahlen möglichst zeitnah nach dem 15. Oktober. Verspätete Erfassung kann zu Abweichungen in der Monatsberechnung führen.

---

#### 3.3 SLR-Konfiguration

**Was es tut:** Diese Seite zeigt und verwaltet die Schüler-Lehrer-Relationen (SLR) pro Schulform. Die SLR gibt an, wie viele Schüler rechnerisch auf eine Lehrerstelle entfallen.

**Warum es hilft:** Die SLR ist ein zentrales Element der Förderformel. Das Land NRW legt pro Schulform fest, wie hoch diese Relation ist. Die Gesamtschule hat eine andere SLR als das Gymnasium oder das Berufskolleg. Wenn sich die landesweit gültigen SLR-Werte ändern (was gelegentlich vorkommt), müssen diese Werte in der Software aktualisiert werden. Diese Seite macht das möglich.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "SLR-Konfiguration".
2. Wählen Sie das betreffende Schuljahr aus.
3. Sie sehen eine Tabelle mit einer Zeile pro Schulform: GES, GYM, BK, GSH, GSM, GSS.
4. In jeder Zeile steht der aktuelle SLR-Wert dieser Schulform.
5. Klicken Sie in das Eingabefeld einer Zeile, um den Wert zu ändern.
6. Tragen Sie den neuen Wert ein. Achten Sie auf Dezimalschreibweise (z.B. 17,5).
7. Klicken Sie auf "Speichern".
8. Prüfen Sie nach dem Speichern auf dem Dashboard, ob sich die Stellensoll-Werte entsprechend verändert haben.

[SCREENSHOT_7: SLR-Konfiguration mit Tabelle der Schulformen, zugehörigen SLR-Werten und Edit-Funktion]

**Praxisbeispiel:** Das Ministerium hat für das Gymnasium die SLR von 17,0 auf 16,5 gesenkt. Das bedeutet: Pro Schülerin oder Schüler weniger bekommt das Gymnasium jetzt etwas mehr Lehrerstellen. Sie rufen die SLR-Konfiguration auf, ändern den GYM-Wert auf 16,5 und speichern. Alle betroffenen Berechnungen werden sofort aktualisiert.

**Warnung:** Die SLR ist der wichtigste Eingabewert der gesamten Software. Eine falsche SLR verfälscht alle nachgelagerten Berechnungen: Stellensoll, Stellenist-Vergleich und sämtliche Exporte für die Bezirksregierung. Ändern Sie SLR-Werte nur, wenn Sie einen offiziellen Bescheid oder Erlass des Landes NRW vorliegen haben, der den neuen Wert dokumentiert. Im Zweifel: Finger weg und Schulrechtsabteilung fragen.

**Woher kommen die SLR-Werte?** Die SLR-Werte werden jährlich durch das Ministerium für Schule und Bildung NRW festgelegt und in der Verordnung zu § 93 Abs. 2 SchulG veröffentlicht. Sie gelten schulformspezifisch und können sich von Jahr zu Jahr leicht verändern.

**Wer darf das ändern?** Diese Seite sollte nur von Personen mit fundiertem Kenntnisstand zu den aktuellen Förderbescheiden geändert werden. Im Zweifel fragen Sie die Schulleitung oder die übergeordnete Verwaltung.

---

#### 3.4 Regeldeputate

**Was es tut:** Diese Seite zeigt die gesetzlichen Pflichtstundensätze pro Schulform. Das Regeldeputat ist die wöchentliche Pflichtstundenzahl einer Vollzeit-Lehrkraft an der jeweiligen Schulform.

**Warum es hilft:** Das Regeldeputat ist notwendig, um aus den geleisteten Wochenstunden einer Lehrkraft ihren Stellenanteil zu berechnen. Wenn eine Lehrkraft am Gymnasium 22 Wochenstunden leistet und das Regeldeputat dort 25,5 Stunden beträgt, entspricht das einem Stellenanteil von 22 ÷ 25,5 = 0,863. Die Software nutzt diese Werte in allen Stellenist-Berechnungen.

**Aktuelle Regeldeputate im Überblick:**
- Gesamtschule (GES): 27 Wochenstunden
- Gymnasium (GYM): 25,5 Wochenstunden (oder schulformspezifisch lt. aktuellem Erlass)
- Berufskolleg (BK): 25,5 Wochenstunden (oder schulformspezifisch)
- Grundschulen (GSH, GSM, GSS): 28 Wochenstunden

**Hinweis:** Die genauen Werte können sich durch Erlassänderungen verschieben. Die hier hinterlegten Werte gelten für das aktuell gewählte Schuljahr.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Regeldeputate".
2. Wählen Sie das gewünschte Schuljahr.
3. Prüfen Sie die hinterlegten Stundenwerte für jede Schulform.
4. Falls eine Änderung notwendig ist, klicken Sie auf den Bearbeiten-Button der betreffenden Zeile.
5. Tragen Sie den neuen Wert ein.
6. Klicken Sie auf "Speichern".
7. Prüfen Sie anschließend die Auswirkungen im Bereich Stellenist.

[SCREENSHOT_8: Regeldeputate-Seite mit Tabelle der Schulformen und zugehörigen Stundenwerten, Bearbeiten-Buttons]

**Praxisbeispiel:** Ein neuer Erlass senkt das Regeldeputat an Gesamtschulen von 27,5 auf 27 Stunden. Sie ändern den Wert in der Tabelle. Alle Lehrkräfte an der GES haben dadurch rechnerisch einen etwas höheren Stellenanteil. Die Stellenist-Summe der GES steigt entsprechend.

---

#### 3.5 Deputate

**Was es tut:** Diese Seite zeigt die monatlichen Wochenstunden aller Lehrkräfte. Sie ist die zentrale Datenbasis für die Stellenist-Berechnung.

**Warum es hilft:** Für die Berechnung, ob eine Schule ihre Planstellen tatsächlich besetzt hat, braucht man die genauen Stundenzahlen aller Lehrkräfte für jeden Monat. Die Software erhält diese Daten automatisch aus dem Stundenplanprogramm Untis (via n8n-Workflow). Das bedeutet: HR muss Deputate in der Regel **nicht manuell einpflegen**. Änderungen und Ausnahmen (z.B. Stundenplanwechsel mitten im Monat) werden über den Bereich Nachträge erfasst.

**Automatischer Untis-Sync – was das bedeutet:** Untis ist das Programm, das an Ihren Schulen den Stundenplan verwaltet. Jeden Monat überträgt ein automatischer Prozess die aktuellen Deputatsdaten aus Untis in die Stellenistberechnung. Sie sehen auf dieser Seite das Ergebnis dieses Imports. Wenn Untis korrekt gepflegt ist, sind auch die Deputate hier korrekt.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Deputate".
2. Wählen Sie das Haushaltsjahr und den Monat aus.
3. Wählen Sie die Schule.
4. Sie sehen eine Liste aller Lehrkräfte dieser Schule mit ihren Wochenstunden für den ausgewählten Monat.
5. Prüfen Sie auffällige Werte, z.B. sehr niedrige oder sehr hohe Stundenzahlen.
6. Bei offensichtlichen Fehlern erstellen Sie einen Nachtrag (siehe Abschnitt 3.9).
7. Mit Klick auf eine Lehrkraft gelangen Sie in die Deputat-Detailansicht (Abschnitt 3.6).

[SCREENSHOT_9: Deputate-Seite mit monatsgefilterter Tabelle aller Lehrkräfte, Stundenspalte, Schul-Filter und Monatsauswahl]

**Praxisbeispiel:** Im Oktober überprüfen Sie die Deputate der Gesamtschule. Frau Muster ist seit September in Teilzeit. In Untis wurde aber noch die alte Vollzeit-Stundenzahl gepflegt. Sie erkennen das an der ungewöhnlich hohen Stundenzahl. Sie erstellen einen Nachtrag für Oktober, um den richtigen Wert einzutragen.

**Wichtig für Grundschulen:** An den drei CREDO-Grundschulen (GSH, GSM, GSS) werden Deputate nicht automatisch aus Untis übertragen, da Grundschulen häufig kein Untis nutzen. Dort ist eine manuelle Pflege über die Mitarbeiter-Seite und Nachträge notwendig.

---

#### 3.6 Deputat-Detail

**Was es tut:** Diese Seite zeigt die Deputatshistorie einer einzelnen Lehrkraft. Sie sehen alle Monate, alle Stundenwerte und alle vorgenommenen Änderungen.

**Warum es hilft:** Manchmal müssen Sie nachvollziehen, warum eine Lehrkraft in einem bestimmten Monat einen bestimmten Stellenanteil hatte. Vielleicht gab es eine Änderung des Stundenkontingents, eine Beurlaubung oder eine Mehrarbeitspause. Die Deputat-Detail-Seite liefert diese Informationstiefe. Sie sehen außerdem die tagesgenau gewichteten Monats-Deputate, was bei Stundenplanwechseln innerhalb eines Monats relevant ist.

**Tagesgenaue Berechnung – was das bedeutet:** Wenn eine Lehrkraft in einem Monat die Stundenzahl ändert (z.B. weil sie ab dem 15. des Monats in Teilzeit geht), berechnet die Software den Monats-Deputatswert anteilig. Sie nimmt die Anzahl der Tage mit Vollzeit, dividiert durch die Gesamttage des Monats, und addiert den Teilzeit-Anteil. Dieser Mechanismus sorgt dafür, dass kein einziger Tag verloren geht und keine Stunde doppelt gewertet wird.

**Schritt für Schritt:**

1. Öffnen Sie die Deputate-Seite (Abschnitt 3.5).
2. Klicken Sie auf den Namen einer Lehrkraft in der Tabelle. Die Deputat-Detail-Seite öffnet sich.
3. Sie sehen oben die Stammdaten der Lehrkraft (Name, Schule, Rolle).
4. Darunter finden Sie eine monatliche Übersicht für das gewählte Haushaltsjahr.
5. Jede Monatszeile zeigt: Wochenstunden, berechneter Stellenanteil, Quelle (Untis oder manuell), Änderungshistorie.
6. Klicken Sie auf ein "i"-Symbol, um Details einer Änderung zu sehen.
7. Mit dem "Nachtrag erstellen"-Button können Sie direkt aus dieser Ansicht eine Korrektur anlegen.

[SCREENSHOT_10: Deputat-Detail-Seite für eine Beispiel-Lehrkraft mit Monatsübersicht, Stundenwerten und Änderungsprotokoll]

**Praxisbeispiel:** Die Bezirksregierung fragt nach, warum Herr Schmidt im März 2025 nur 0,7 Stellen ausgewiesen hat, obwohl er Vollzeit beschäftigt ist. Sie öffnen die Deputat-Detail-Ansicht von Herrn Schmidt. Sie sehen: Im März gab es einen Nachtrag, der seine Stunden für 12 Tage auf 15 Wochenstunden reduziert hat (Beurlaubung). Das erklärt den Wert. Sie exportieren die Detailansicht und reichen sie als Beleg ein.

---

#### 3.7 Mehrarbeit

**Was es tut:** Diese Seite erfasst Zusatzstunden über das reguläre Deputat hinaus. Mehrarbeit erhöht den rechnerischen Stellenanteil einer Lehrkraft oder den Gesamtstellenanteil einer Schule.

**Warum es hilft:** In manchen Monaten leisten Lehrkräfte mehr Stunden als ihr reguläres Deputat. Vielleicht überbrücken sie eine Vakanz. Vielleicht hat die Schulleitung eine besondere Aufgabe übernommen. Diese zusätzlichen Stunden wirken sich auf die Stellenist-Berechnung aus und müssen daher korrekt erfasst sein. Die Software unterscheidet zwei Ebenen: lehrkraftbezogene Mehrarbeit und schulweite Mehrarbeit (z.B. für befristet besetzte Zusatzstunden).

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Mehrarbeit".
2. Wählen Sie Haushaltsjahr und Schule.
3. Sie sehen eine Liste bestehender Mehrarbeitseinträge.
4. Klicken Sie auf "Neue Mehrarbeit erfassen".
5. Wählen Sie: lehrkraftbezogen oder schulweit.
6. Bei lehrkraftbezogen: Wählen Sie die Lehrkraft aus der Auswahlliste.
7. Tragen Sie die Zusatzstunden und den Zeitraum ein.
8. Geben Sie einen Grund an (z.B. "Vertretung für Elternzeitvertretung").
9. Klicken Sie auf "Speichern". Der Eintrag erscheint in der Liste.
10. Prüfen Sie auf der Stellenist-Seite, ob sich der Gesamtwert entsprechend verändert hat.

[SCREENSHOT_11: Mehrarbeit-Seite mit Tabelle bestehender Einträge und Button für neue Mehrarbeit-Erfassung]

**Praxisbeispiel:** Herr Müller unterrichtet im März wegen einer Erkrankungswelle 28 statt 25,5 Stunden. Das sind 2,5 Stunden Mehrarbeit. Sie erfassen diese im System. Damit steigt der Stellenist der GYM um den entsprechenden Anteil. Der Berechnungsnachweis für März weist diese Position korrekt aus.

---

#### 3.8 Mitarbeiter

**Was es tut:** Diese Seite verwaltet die Stammdaten aller Lehrkräfte. Sie sehen alle aktiven und früheren Lehrkräfte einer Schule mit Namen, Beschäftigungsart und Unterrichtsfächern.

**Warum es hilft:** Ohne korrekte Mitarbeiterdaten kann die Software Deputatsdaten aus Untis nicht korrekt zuordnen. Jede Lehrkraft braucht einen Datensatz in der Software. Bei Neueinstellungen, Abgängen oder Namensänderungen muss dieser Bereich gepflegt werden. Besonders wichtig ist das für Grundschulen, da deren Daten nicht automatisch aus Untis kommen.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Mitarbeiter".
2. Wählen Sie die Schule aus.
3. Sie sehen eine Liste aller Lehrkräfte mit Name, Status (aktiv/inaktiv), Schulform.
4. Klicken Sie auf eine Lehrkraft, um die Detailansicht zu öffnen.
5. Über "Bearbeiten" können Sie Daten ändern.
6. Für neue Lehrkräfte: Klicken Sie auf "Neue Lehrkraft anlegen".
7. Füllen Sie Pflichtfelder aus: Vorname, Nachname, Schulform, Eintrittsdatum.
8. Bei Lehrkräften aus Untis: Das Untis-Kürzel ist wichtig für die automatische Datenzuordnung.
9. Klicken Sie auf "Speichern".

[SCREENSHOT_12: Mitarbeiter-Seite mit Liste aller Lehrkräfte einer Schule, Statusanzeige und Buttons für Bearbeiten und Neu anlegen]

**Praxisbeispiel:** Im August beginnt Frau Lehrerin Neumann an der Grundschule Hüffer (GSH). Da die GSH kein Untis nutzt, legen Sie sie manuell an. Sie erfassen Name, Eintrittsdatum und Wochenstunden. Ab September erscheint sie in der Deputats-Liste der GSH.

---

#### 3.9 Nachträge

**Was es tut:** Diese Seite dient der korrekten Nachbearbeitung von Deputatsdaten. Wenn ein automatisch aus Untis importierter Wert falsch ist, erstellen Sie hier einen Nachtrag.

**Warum es hilft:** Die Realität des Schulalltags kennt viele Ausnahmen. Stundenplanänderungen mitten im Monat, nachträglich entdeckte Fehler in Untis, rückwirkende Beurlaubungen – all das führt dazu, dass der automatisch importierte Wert nicht mehr dem tatsächlichen Stand entspricht. Nachträge sind das offizielle Korrekturwerkzeug. Sie werden versioniert gespeichert, d.h. es bleibt immer nachvollziehbar, wer wann welche Änderung warum vorgenommen hat.

**Wichtig:** Nachträge sind nicht als Dauerlösung gedacht. Wenn Deputate dauerhaft falsch importiert werden, liegt das Problem in Untis. Sprechen Sie dann mit der zuständigen Stundenplanverantwortlichen.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Nachträge".
2. Oder: Klicken Sie direkt aus der Deputat-Detail-Seite auf "Nachtrag erstellen".
3. Wählen Sie die betroffene Lehrkraft.
4. Wählen Sie den betroffenen Monat und das Haushaltsjahr.
5. Tragen Sie den korrigierten Stundenwert ein.
6. Geben Sie im Pflichtfeld "Begründung" eine klare Erklärung ein. (Beispiel: "Stundenplan ab 12.10. geändert, Untis-Import war veraltet")
7. Klicken Sie auf "Nachtrag speichern".
8. Der Nachtrag erhält eine Versionsnummer. Die ursprünglichen Werte bleiben im System erhalten.

[SCREENSHOT_13: Nachträge-Seite mit Formular für Korrekturen, Pflichtfeld Begründung und Versionierungsanzeige]

**Praxisbeispiel:** Herr Weber hatte im November 2025 laut Untis 24 Stunden. Tatsächlich hat er nur 22 Stunden unterrichtet, weil er die ersten 5 Schultage krank war. Sie legen einen Nachtrag für Herrn Weber, November 2025, mit 22 Stunden an und begründen dies mit "krankheitsbedingte Stundenreduktion, Abgleich mit Fehlzeitenliste". Der Nachtrag fließt automatisch in die Stellenist-Berechnung ein.

---

#### 3.10 Stellensoll

**Was es tut:** Diese Seite zeigt die berechnete Sollzahl der Lehrerstellen für jede Schule. Die Berechnung folgt exakt § 3 FESchVO.

**Warum es hilft:** Das Stellensoll ist die Grundlage der staatlichen Förderung. Es gibt an, wie viele Lehrerstellen die Schule laut Schülerzahl und SLR beantragen darf. Die Bezirksregierung prüft genau diesen Wert. Fehler in der Berechnung können zu Unterförderung (Sie erhalten weniger Geld als Ihnen zusteht) oder Rückforderungen (Sie erhalten zu viel und müssen zurückzahlen) führen. Die Software berechnet diesen Wert automatisch und nachvollziehbar.

**Die Rechenformel im Klartext:**

Das Gesetz schreibt vor: Schülerzahl ÷ SLR ergibt den Grundstellenanteil für eine Jahrgangs- oder Schulgruppe. Dieser Wert wird auf 2 Dezimalstellen **abgeschnitten** (nicht gerundet!). Dann werden alle Jahrgangsgruppen einer Schule addiert. Das Ergebnis wird auf eine Stelle kaufmännisch gerundet. Dazu kommen noch Zuschläge aus den Stellenanteilen (Typ A und Typ A_106). Die Summe ist das Stellensoll.

**Beispiel:** Gesamtschule mit 450 Schülern, SLR 17,5:
450 ÷ 17,5 = 25,714... → abgeschnitten auf 25,71 → nach Addition weiterer Stufen und Rundung = Ergebnis.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Stellensoll".
2. Wählen Sie Haushaltsjahr und Schule.
3. Sie sehen eine Tabelle mit Schülerzahlen, SLR-Werten und berechneten Grundstellen pro Gruppe.
4. Darunter finden Sie die Zwischensummen und den Endrundungswert.
5. Weiter unten sehen Sie die Stellenanteile, die zum Grundwert addiert werden.
6. Das Endergebnis ist das **Stellensoll** dieser Schule für das gewählte Haushaltsjahr.
7. Prüfen Sie: Stimmen Schülerzahlen und SLR? Stimmen die Stellenanteile?
8. Über "Details anzeigen" sehen Sie die vollständige Rechenformel Schritt für Schritt.

[SCREENSHOT_14: Stellensoll-Seite mit Berechnungsaufschlüsselung: Schülerzahl, SLR, Grundstellen pro Gruppe, Zuschläge, Gesamtsumme]

**Praxisbeispiel:** Sie bereiten den Jahresabschluss vor und wollen das Stellensoll der Gesamtschule für 2025 nachvollziehen. Sie öffnen die Stellensoll-Seite, wählen GES und 2025. Sie sehen: Das Vorjahres-Stellensoll (Jan–Jul) basiert auf 430 Schülern, das aktuelle (Aug–Dez) auf 445 Schülern. Die Zuschläge für Ganztag, Integration und KAoA sind ebenfalls aufgeführt. Das Gesamt-Stellensoll für 2025 beträgt z.B. 52,3 Stellen.

---

#### 3.11 Stellenist

**Was es tut:** Diese Seite berechnet, wie viele Stellen die Schule im gewählten Haushaltsjahr tatsächlich besetzt hatte.

**Warum es hilft:** Das Stellenist ist der Vergleichswert zum Stellensoll. Nur wenn beide Werte zusammen passen, hat die Schule die Fördergelder korrekt eingesetzt. Zu wenig Ist-Stellen bedeuten: Die Schule hat weniger Unterricht gegeben als gefördert. Das kann zu Rückforderungen führen. Zu viel Ist-Stellen sind ebenfalls problematisch: Die Schule hat mehr Personalkosten als gefördert und trägt die Differenz selbst.

**Die Rechenformel im Klartext:**

Die Software nimmt für jeden Monat alle Deputatsstunden aller Lehrkräfte. Sie dividiert durch das Regeldeputat der Schulform. Das Ergebnis ist der monatliche Stellenanteil dieser Schule. Dann werden alle Monate des Haushaltsjahres summiert und durch die Anzahl der Monate geteilt. Dazu kommt der Mehrarbeitsanteil. Das ist das Stellenist.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Stellenist".
2. Wählen Sie Haushaltsjahr und Schule.
3. Sie sehen eine monatliche Übersicht aller Stellenanteile.
4. Jede Monatszeile zeigt: Summe Wochenstunden, Regeldeputat, rechnerischer Stellenanteil.
5. Darunter finden Sie den Jahres-Stellenist inklusive Mehrarbeit.
6. Prüfen Sie auffällige Monate (sehr niedrige oder sehr hohe Werte).
7. Klicken Sie auf einen Monat, um die einzelnen Lehrkraft-Beiträge zu sehen.

[SCREENSHOT_15: Stellenist-Seite mit monatlicher Aufschlüsselung, Wochenstunden-Summe, Regeldeputat, Stellenanteil je Monat und Jahresergebnis]

**Praxisbeispiel:** Sie prüfen das Stellenist des BK für Januar 2025. Das BK hat 18 Lehrkräfte mit unterschiedlichen Stunden. Die Summe aller Wochenstunden beträgt 415. Das Regeldeputat am BK ist 25,5. 415 ÷ 25,5 = 16,27 Stellen. Dazu kommen 0,5 Stellen Mehrarbeit. Das Januar-Stellenist des BK: 16,77.

---

#### 3.12 Soll-Ist-Vergleich

**Was es tut:** Diese Seite stellt Stellensoll und Stellenist gegenüber und zeigt die Differenz mit Ampelfarbe.

**Warum es hilft:** Das ist die eigentliche Kernauswertung der Software. Sie zeigt auf einen Blick, ob Ihre Schule förderrechtlich korrekt aufgestellt ist. Eine negative Differenz (Ist > Soll) bedeutet: Die Schule unterrichtet mehr als gefördert wird. Eine positive Differenz (Soll > Ist) bedeutet: Die Schule nutzt ihre Förderkapazität nicht vollständig. Beide Extremfälle sind problematisch. Die Ampellogik gibt sofort Orientierung.

**Ampellogik im Detail:**

- **Grün:** Differenz ≤ 0. Stellensoll wird erfüllt oder leicht übertroffen. Kein Handlungsbedarf.
- **Gelb:** Differenz 0 bis 0,5. Die Schule ist leicht unterbesetzt. Bitte beobachten und ggf. Einstellungen planen.
- **Rot:** Differenz > 0,5. Die Schule ist spürbar unterbesetzt. Sofort handeln: Stellen ausschreiben, Mehrarbeit erfassen oder Nachweise für die Bezirksregierung vorbereiten.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Soll-Ist-Vergleich".
2. Wählen Sie Haushaltsjahr.
3. Sie sehen alle Schulen der CREDO-Gruppe in einer Tabelle nebeneinander.
4. Für jede Schule: Stellensoll, Stellenist, Differenz und Ampelfarbe.
5. Klicken Sie auf eine Schule für die Detailansicht.
6. Dort sehen Sie monatliche Soll-Ist-Verläufe.
7. Über "Bericht erstellen" erzeugen Sie einen Export für die Bezirksregierung.

[SCREENSHOT_16: Soll-Ist-Vergleich-Seite mit tabellarischer Gegenüberstellung aller Schulen, Differenzspalte und farbigen Ampelmarkierungen]

**Praxisbeispiel:** Es ist Ende Dezember. Sie wollen den Jahresabschluss vorbereiten. Sie öffnen den Soll-Ist-Vergleich für 2025. Sie sehen: GES grün (Differenz –0,2), GYM gelb (Differenz +0,3), BK rot (Differenz +0,7). Für das BK eskalieren Sie sofort und prüfen, ob eine Stelle ausgeschrieben werden sollte oder ob es eine erklärbare Ausnahme gibt.

---

#### 3.13 Stellenanteile

**Was es tut:** Diese Seite erfasst alle Zusatzstellen, die über die Grundförderung hinaus bei der Bezirksregierung beantragt werden können.

**Warum es hilft:** Neben den Grundstellen aus Schülerzahl und SLR gibt es zahlreiche weitere Fördertatbestände. Schulen mit Ganztagsbetrieb, Inklusions-Konzepten, Berufsorientierungsangeboten oder besonderen Digitalisierungsprojekten können zusätzliche Stellenanteile beantragen. Diese sind gesetzlich geregelt (verschiedene Erlasse und das SchFG NRW) und erhöhen das Stellensoll. Jeder beantragte Anteil muss korrekt dokumentiert sein.

**Die vier Typen im Überblick:**

**Typ A – Erhöhung des Stellensolls:** Diese Anteile erhöhen direkt die Sollzahl, gegen die das Ist gemessen wird. Beispiele: Ganztag, Leitungszeit, Integration, Deutsch als Zweitsprache (DAZ), KAoA (Kein Abschluss ohne Anschluss). Es gibt 17 verschiedene Arten.

**Typ A_106 – Sonderbedarfe nach § 106 SchFG:** Besondere Projekte wie Digitalisierung, Schulqualitätsentwicklung oder Inklusion. Es gibt 8 Arten. Diese Anteile werden ebenfalls dem Stellensoll zugerechnet.

**Typ B – Wahlleistung:** Die Schule kann wählen: entweder eine Planstelle oder eine Geldleistung. Diese Entscheidung wird hier dokumentiert. Es gibt 2 Arten.

**Typ C – Nur Geldleistung:** Diese Fördertatbestände wirken sich nicht auf Stellenzahlen aus. Sie erhalten nur eine Geldzahlung. Es gibt 4 Arten.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Stellenanteile".
2. Wählen Sie Haushaltsjahr und Schule.
3. Sie sehen eine Liste aller bestehenden Stellenanteil-Einträge dieser Schule.
4. Klicken Sie auf "Neuen Anteil anlegen".
5. Wählen Sie den Typ (A, A_106, B oder C).
6. Wählen Sie die konkrete Art aus der Auswahlliste (z.B. "Ganztag" unter Typ A).
7. Tragen Sie den Umfang ein (z.B. 1,5 Stellen oder 2,0 Stunden je Woche).
8. Geben Sie den Förderzeitraum an.
9. Fügen Sie nach Bedarf eine Notiz oder Aktenzeichen hinzu.
10. Klicken Sie auf "Speichern". Der Anteil wird sofort im Stellensoll berücksichtigt.
11. Über den "Antrag"-Button erzeugen Sie das offizielle Word-Dokument für die Bezirksregierung.

[SCREENSHOT_17: Stellenanteile-Seite mit Liste bestehender Anteile, Typ-Filterung und Formular für neuen Eintrag mit Typ-Auswahl]

**Praxisbeispiel:** Die Gesamtschule erhält ab diesem Schuljahr das Gütesiegel für ihr Inklusionskonzept. Dafür stehen ihr 0,5 zusätzliche Stellen über Typ A_106 zu. Sie legen den Anteil an: Typ A_106, Art "Inklusion", Umfang 0,5, Förderjahr 2025. Das Stellensoll der GES steigt um 0,5. Sie exportieren den Antrag als Word-Dokument und reichen ihn bei der Bezirksregierung ein.

---

#### 3.14 Export

**Was es tut:** Diese Seite ermöglicht das Erstellen aller offiziellen Dokumente für die Bezirksregierung und für interne Zwecke.

**Warum es hilft:** Die Bezirksregierung fordert regelmäßig Nachweise über Stellenplanung und -besetzung. Diese Dokumente müssen bestimmten Formaten entsprechen. Früher wurden diese Berichte manuell aus Excel-Tabellen zusammengestellt – ein fehleranfälliger und zeitraubender Prozess. Die Software generiert alle benötigten Dokumente automatisch in druckfertiger Form. Ein Klick genügt.

**Verfügbare Export-Formate:**

1. **Deputate-Liste (Excel):** Tabellarische Übersicht aller Deputate pro Monat und Lehrkraft. Ideal für interne Prüfzwecke.

2. **Stellenplan (PDF):** Formeller Stellenplan der Schule mit Soll- und Ist-Stellen. Für offizielle Einreichungen bei der Bezirksregierung.

3. **Berechnungsnachweis (PDF):** Detaillierter Nachweis der gesamten Stellenberechnung nach § 3 FESchVO. Zeigt alle Rechenschritte. Wird bei Prüfungen durch die Bezirksregierung benötigt.

4. **Schülerzahlen (Excel):** Export der erfassten Schülerzahlen pro Schule, Stufe und Stichtag.

5. **Nachtrag-Dokument (Word):** Offizielles Dokument für einen Nachtrag zu einem Stellenplan. Enthält Unterschriftszeile für Schulleiterin oder Schulleiter und Trägerin oder Träger.

6. **Stellenanteil-Antrag (Word):** Antragsdokument für das Beantragen von Stellenanteilen bei der Bezirksregierung. Enthält alle relevanten Angaben.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Export".
2. Wählen Sie das Haushaltsjahr.
3. Wählen Sie die Schule, für die Sie exportieren möchten.
4. Klicken Sie auf das gewünschte Export-Format in der Liste.
5. Wählen Sie ggf. zusätzliche Filter (z.B. Monat, Lehrkraft).
6. Klicken Sie auf "Export erstellen".
7. Die Datei wird sofort generiert und öffnet sich oder lädt herunter.
8. Prüfen Sie das Dokument vor dem Versand auf Vollständigkeit.

[SCREENSHOT_18: Export-Seite mit Karten für verschiedene Exportformate (Deputate-Excel, Stellenplan-PDF, Berechnungsnachweis-PDF, Nachtrag-Word, Stellenanteil-Antrag-Word), Schul- und Jahresfilter]

**Welches Format geht wohin? (Orientierungstabelle)**

| Export-Format | Empfänger | Zweck |
|---|---|---|
| Berechnungsnachweis (PDF) | Bezirksregierung | Pflichtnachweis Stellenberechnung nach § 3 FESchVO |
| Stellenplan (PDF) | Bezirksregierung / Schulleitung | Formeller Stellenplan Soll & Ist |
| Nachtrag-Dokument (Word) | Bezirksregierung | Korrektur eines bereits eingereichten Nachweises |
| Stellenanteil-Antrag (Word) | Bezirksregierung | Antrag auf Genehmigung zusätzlicher Stellenanteile |
| Deputate-Liste (Excel) | Interne Buchhaltung / Prüfung | Übersicht aller Deputate für interne Kontrolle |
| Schülerzahlen (Excel) | Interne Ablage | Dokumentation der Stichtagszahlen |

**Wichtig:** Prüfen Sie VOR jedem Export das gewählte Haushaltsjahr oben rechts. Ein Export im falschen Jahr ist offiziell wertlos.

**Was tun, wenn nach dem Export ein Fehler auffällt?** Wenn Sie ein Dokument bereits an die Bezirksregierung gesendet haben und danach einen Fehler entdecken: Erstellen Sie einen Nachtrag (Abschnitt 3.9), korrigieren Sie den betroffenen Wert und erstellen Sie das Exportdokument erneut. Senden Sie das neue Dokument mit dem Betreff "Korrektur zu [Datum des ersten Dokuments]". Ein früherer Export wird durch einen neuen nicht automatisch ungültig – die neueste Version gilt. Notieren Sie intern das Datum beider Versionen.

**Praxisbeispiel:** Es ist Anfang Februar. Die Bezirksregierung fordert den Berechnungsnachweis für das Haushaltsjahr 2024 an. Sie öffnen die Export-Seite, wählen "Berechnungsnachweis (PDF)", wählen alle Schulen und das Jahr 2024. Innerhalb von Sekunden liegt ein professionell aufbereitetes, druckfertiges PDF vor. Sie senden es direkt weiter. Was früher einen halben Arbeitstag kostete, dauert jetzt 5 Minuten.

---

#### 3.15 Einstellungen

**Was es tut:** Diese Seite verwaltet die Stammdaten aller Schulen sowie die Haushaltsjahre und Schuljahre.

**Warum es hilft:** Bevor die Software korrekt rechnen kann, müssen die Grunddaten stimmen. Welche Schulen gehören zur Gruppe? In welchem Zeitraum läuft das aktuelle Haushaltsjahr? Wann beginnt und endet das Schuljahr? Diese strukturellen Daten sind die Basis aller anderen Berechnungen. Typischerweise werden diese Daten einmal eingerichtet und dann nur bei organisatorischen Änderungen angepasst.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Einstellungen".
2. Sie sehen drei Bereiche: Schulstammdaten, Schuljahre und Haushaltsjahre.
3. **Schulstammdaten:** Klicken Sie auf eine Schule, um ihre Daten zu bearbeiten. Hinterlegt sind: Name, Schulform, Standort, Schulnummer, offizieller Schulformschlüssel für die Bezirksregierung.
4. **Schuljahre:** Hier werden Schuljahre mit Start- und Enddatum angelegt. Das ist relevant für die Periodenzuordnung von Schülerzahlen und Deputaten.
5. **Haushaltsjahre:** Hier werden Haushaltsjahre definiert. Das Haushaltsjahr wird für den übergeordneten Selektor in allen Seitenansichten verwendet.
6. Nehmen Sie Änderungen vor und klicken Sie auf "Speichern".

[SCREENSHOT_19: Einstellungen-Seite mit drei Bereichen: Schulstammdaten als Liste, Schuljahre-Tabelle mit Datumsfeldern und Haushaltsjahre-Tabelle]

**Praxisbeispiel:** Zum 1. August beginnt das neue Schuljahr 2025/2026. Sie legen in den Einstellungen ein neues Schuljahr an: Startdatum 01.08.2025, Enddatum 31.07.2026. Außerdem legen Sie das Haushaltsjahr 2026 an. Ab sofort kann die Software Daten für 2026 erfassen.

---

#### 3.16 Benutzerverwaltung (Admin)

**Was es tut:** Diese Seite ist ausschließlich für Administratoren zugänglich. Sie verwaltet Benutzerkonten, Passwörter und Benutzerrollen.

**Warum es hilft:** Nicht jede Person, die die Software nutzt, soll alle Funktionen haben. Die Benutzerverwaltung ermöglicht es, Personen genau die Rechte zuzuweisen, die sie für ihre Arbeit brauchen. So kann z.B. eine Schulleiterin die Berichte einsehen und exportieren, ohne versehentlich Grunddaten ändern zu können. Eine Sachbearbeiterin kann alle HR-Funktionen nutzen, hat aber keinen Zugang zur Benutzerverwaltung.

**Rollen im Überblick:**

- **Admin:** Vollzugriff auf alle Funktionen, inkl. Benutzerverwaltung und Webhook-Verwaltung für den Untis-Sync.
- **Sachbearbeiter:** Vollzugriff auf alle HR-Seiten (Deputate, Stellenberechnungen, Nachträge, Exporte). Kein Zugang zu Benutzerverwaltung und technischer Administration.
- **Viewer:** Nur Lesezugriff und Exportfunktionen. Keine Bearbeitungsmöglichkeiten.

**Schritt für Schritt:**

1. Klicken Sie in der Navigation auf "Benutzerverwaltung". (Nur als Admin sichtbar.)
2. Sie sehen eine Liste aller angelegten Benutzer mit Rolle und letztem Login.
3. **Neuen Benutzer anlegen:** Klicken Sie auf "Neuen Benutzer anlegen". Tragen Sie Vor- und Nachname, E-Mail-Adresse und Rolle ein. Klicken Sie auf "Anlegen". Die Person erhält eine E-Mail mit Zugangsdaten.
4. **Benutzer bearbeiten:** Klicken Sie auf den Namen eines Benutzers. Ändern Sie Rolle oder E-Mail. Klicken Sie auf "Speichern".
5. **Passwort zurücksetzen:** Klicken Sie auf "Passwort zurücksetzen" neben dem Benutzernamen. Die Person erhält eine E-Mail mit einem Link zum Neuvergabe.
6. **Benutzer deaktivieren:** Klicken Sie auf "Deaktivieren". Der Zugang wird gesperrt. Die Daten bleiben erhalten.

[SCREENSHOT_20: Benutzerverwaltung-Seite mit Tabelle aller Benutzer, Rollenspalte, Status und Aktionsbuttons für Bearbeiten, Passwort-Reset und Deaktivieren]

**Praxisbeispiel:** Eine neue Sachbearbeiterin beginnt in der HR-Abteilung. Sie legen ihr Konto mit der Rolle "Sachbearbeiter" an. Sie erhält per E-Mail ihren Zugang und kann sofort alle HR-Funktionen nutzen. Der Zugang zur Benutzerverwaltung ist für sie nicht sichtbar – das schützt vor versehentlichen Änderungen.

---

## 4. Häufige Fragen und Lösungen (FAQ)

---

### Frage 1: Die Deputate einer Lehrkraft sehen falsch aus. Was tun?

**Antwort:** Prüfen Sie zuerst, ob der Fehler aus Untis stammt. Gehen Sie auf die Deputat-Detail-Seite der betroffenen Lehrkraft. Schauen Sie in die Spalte "Quelle". Steht dort "Untis-Import", liegt der Ursprungsfehler im Stundenplanprogramm. Sprechen Sie in diesem Fall mit der Person, die Untis an Ihrer Schule pflegt.

Falls der Fehler nur für einen einzelnen Monat gilt (z.B. wegen einer Beurlaubung oder Änderung), erstellen Sie einen Nachtrag (Abschnitt 3.9). Tragen Sie den korrekten Stundenwert ein und begründen Sie die Änderung. Der Nachtrag überschreibt den Untis-Wert für den betreffenden Monat.

Falls der Fehler dauerhaft besteht, informieren Sie die Person, die Untis-Daten pflegt, und geben den korrekten Wert als Nachtrag ein, bis Untis aktualisiert ist.

---

### Frage 2: Was bedeutet das rote Ampelsignal?

**Antwort:** Ein rotes Signal bedeutet, dass die Differenz zwischen Stellensoll und Stellenist größer als 0,5 Stellen ist. Das heißt: Ihre Schule ist spürbar unterbesetzt. Sie unterrichtet deutlich weniger als das, wofür die Förderung berechnet wird.

Das rote Signal ist ein Handlungsaufruf, kein Sanktionsmechanismus. Es gibt verschiedene mögliche Gründe: Eine Stelle ist vakant, eine Lehrkraft ist langfristig krank und wird nicht vertreten, oder die Daten sind schlicht noch nicht vollständig eingetragen.

**Was tun:** Prüfen Sie zunächst, ob alle Deputate korrekt erfasst sind. Prüfen Sie, ob Mehrarbeit (z.B. für Vertretungen) erfasst wurde. Gibt es eine vakante Stelle? Dann prüfen Sie mit der Schulleitung, ob eine Ausschreibung stattfinden muss. Dokumentieren Sie die Situation. Bei anhaltend rotem Signal sollten Sie die Bezirksregierung proaktiv informieren, bevor diese von sich aus nachfragt.

---

### Frage 3: Was bedeutet das gelbe Ampelsignal?

**Antwort:** Gelb bedeutet: Die Differenz zwischen Soll und Ist liegt bei 0 bis 0,5 Stellen. Das ist eine Beobachtungszone. Die Schule ist leicht unterbesetzt, aber noch innerhalb eines vertretbaren Bereichs.

Gelb erfordert kein sofortiges Handeln, aber Aufmerksamkeit. Prüfen Sie, ob die Situation temporär ist (z.B. eine kurze Vakanz wird bald besetzt) oder ob sich ein Trend abzeichnet. Beobachten Sie die Entwicklung monatlich.

---

### Frage 4: Wann muss ich die Schülerzahlen erfassen?

**Antwort:** Die Schülerzahlen müssen zum Stichtag **15. Oktober** erfasst werden. An diesem Tag findet die amtliche Schulstatistik statt. Sie erhalten die offiziellen Zahlen von der Schulverwaltung oder aus dem Schulverwaltungssystem.

Bitte erfassen Sie die Zahlen so bald wie möglich nach dem 15. Oktober, spätestens jedoch bis Ende Oktober. Für den Zeitraum Januar bis Juli verwendet die Software die Zahlen vom 15. Oktober des **Vorjahres**. Für August bis Dezember die Zahlen vom 15. Oktober des **laufenden Jahres**.

Wenn Sie die Zahlen zu spät erfassen, kann das dazu führen, dass Berechnungen für einzelne Monate auf veralteten Daten basieren. Ein rückwirkender Nachtrag ist möglich, aber aufwendig.

---

### Frage 5: Wie korrigiere ich ein falsch erfasstes Deputat aus einem vergangenen Monat?

**Antwort:** Vergangene Monate können nicht direkt überschrieben werden. Das ist so gewollt: Die Versionierung sichert die Nachvollziehbarkeit für Prüfzwecke.

Erstellen Sie stattdessen einen **Nachtrag** (Abschnitt 3.9). Wählen Sie die Lehrkraft, den vergangenen Monat und das korrekte Haushaltsjahr. Tragen Sie den richtigen Stundenwert ein. Geben Sie eine klare Begründung an (z.B. "rückwirkende Korrektur nach Rückmeldung Stundenplanung"). Der Nachtrag fließt sofort in die Stellenist-Berechnung ein.

**Tipp:** Wenn Sie merken, dass regelmäßig Nachträge für dieselbe Lehrkraft oder Schule nötig sind, liegt möglicherweise ein systematisches Problem bei der Untis-Datenpflege vor. Sprechen Sie das an.

---

### Frage 6: Was ist der Unterschied zwischen Stellensoll und Stellenist?

**Antwort:** Das **Stellensoll** ist die Anzahl der Lehrerstellen, die Ihrer Schule laut Förderrecht zustehen. Es ergibt sich aus der Schülerzahl geteilt durch die Schüler-Lehrer-Relation, plus eventuelle Zuschläge (Stellenanteile).

Das **Stellenist** ist die Anzahl der Stellen, die tatsächlich besetzt waren. Es ergibt sich aus der Summe aller tatsächlich geleisteten Deputatsstunden aller Lehrkräfte, umgerechnet in Vollzeit-Stellenäquivalente.

Der Vergleich dieser beiden Werte ist das Herzstück der Software. Nur wenn Ist nahe an Soll liegt, läuft die Schule förderrechtlich korrekt.

---

### Frage 7: Muss ich Deputate manuell eingeben?

**Antwort:** In der Regel nein. Für die Schulen, die Untis verwenden (GES, GYM, BK), werden Deputatsdaten automatisch übertragen. Der Sync läuft monatlich. Sie müssen also keine Stunden händisch eintragen.

Es gibt Ausnahmen: Nachträge für Sonderfälle (Beurlaubungen, Korrekturen), Mehrarbeit und Daten für Grundschulen (GSH, GSM, GSS), die kein Untis verwenden. Für die Grundschulen pflegen Sie die Deputate über die Mitarbeiter-Seite und Nachträge manuell.

---

### Frage 8: Ich kann mich nicht anmelden. Was tun?

**Antwort:** Prüfen Sie zuerst: Stimmt die Webadresse? Die korrekte Adresse ist **deputat.fes-credo.de**. Prüfen Sie die Großschreibung Ihres Passworts (die Eingabe unterscheidet zwischen Groß- und Kleinbuchstaben). Versuchen Sie, den Browser-Cache zu leeren und die Seite neu zu laden.

Falls das Problem bleibt, wenden Sie sich an Ihre Administratorin oder Ihren Administrator. Diese können in der Benutzerverwaltung Ihr Passwort zurücksetzen. Sie erhalten dann eine E-Mail mit einem Link zur Passwort-Neuvergabe.

---

### Frage 9: Warum ändert sich das Stellensoll im August?

**Antwort:** Das ist kein Fehler, sondern gewollt. Das Stellensoll basiert auf Schülerzahlen. Es gibt zwei relevante Stichtage: den 15. Oktober des Vorjahres (gilt für Jan–Jul) und den 15. Oktober des laufenden Jahres (gilt für Aug–Dez).

Ab August "schaltet" die Software auf die neuen Schülerzahlen des laufenden Jahres um. Da diese von den Vorjahreszahlen abweichen können, ändert sich auch das Stellensoll. Das ist gesetzlich so vorgeschrieben (FESchVO). Wenn Sie die neuen Zahlen noch nicht erfasst haben, kann es bis zur Eingabe zu einer vorübergehend falschen Anzeige kommen. Bitte tragen Sie die Oktober-Zahlen daher pünktlich ein.

---

### Frage 10: Wie beantrage ich einen neuen Stellenanteil bei der Bezirksregierung?

**Antwort:** Gehen Sie auf die Stellenanteile-Seite (Abschnitt 3.13). Legen Sie den neuen Anteil mit dem richtigen Typ und der richtigen Art an. Speichern Sie den Eintrag. Klicken Sie dann auf den "Antrag"-Button neben dem gespeicherten Eintrag. Die Software generiert ein vorausgefülltes Word-Dokument mit allen relevanten Angaben. Dieses Dokument enthält eine Unterschriftszeile. Lassen Sie es von der Schulleitung unterschreiben und reichen Sie es bei der Bezirksregierung ein.

---

### Frage 11: Was passiert, wenn ich das Haushaltsjahr wechsle?

**Antwort:** Der Haushaltsjahr-Selektor oben rechts filtert alle Seiten der Software gleichzeitig. Wenn Sie von 2025 auf 2024 wechseln, zeigen alle Seiten sofort die Daten des Jahres 2024. Berechnungen, Exporte und Deputate beziehen sich dann auf 2024. Ihre Eingaben gehen dabei nicht verloren – die Software speichert alle Haushaltsjahre dauerhaft.

Wenn Sie zurück zum aktuellen Jahr wechseln möchten, wählen Sie einfach das aktuelle Jahr im Selektor.

---

### Frage 12: Kann ich Daten eines abgeschlossenen Jahres noch ändern?

**Antwort:** Technisch ist das möglich. Sie können für vergangene Jahre Nachträge erstellen, Schülerzahlen bearbeiten und Stellenanteile anpassen. In der Praxis sollten Sie das nur tun, wenn es einen konkreten Anlass gibt (z.B. eine rückwirkende Korrektur nach einer Prüfung durch die Bezirksregierung).

Jede Änderung wird mit Zeitstempel und Benutzername protokolliert. Die Versionierung stellt sicher, dass frühere Zustände rekonstruierbar bleiben. Vor größeren rückwirkenden Änderungen empfehlen wir einen Export des aktuellen Berechnungsnachweises als Sicherungsdokument.

---

### Frage 13: Die Grundschule fehlt im Deputate-Sync. Was tun?

**Antwort:** Das ist kein Fehler. Die drei CREDO-Grundschulen (GSH, GSM, GSS) verwenden kein Untis. Ihre Deputatsdaten werden daher nicht automatisch importiert. Für Grundschulen müssen Sie Deputate manuell pflegen. Nutzen Sie dafür die Mitarbeiter-Seite für die Stammdaten und Nachträge für monatliche Deputatswerte.

---

### Frage 14: Wozu brauche ich das Nachtrag-Dokument als Word-Datei?

**Antwort:** Das Nachtrag-Dokument ist ein offizielles Schreiben an die Bezirksregierung. Es dokumentiert eine nachträgliche Änderung am Stellenplan. Solche Änderungen kommen vor, wenn sich die Schülerzahlen unerwartet stark ändern oder wenn Stellen aus nicht vorhersehbaren Gründen nicht besetzt werden konnten.

Das Dokument enthält alle relevanten Angaben in dem Format, das die Bezirksregierung erwartet. Es enthält eine Unterschriftszeile für Schulleiterin oder Schulleiter und Trägerin oder Träger. Lassen Sie es unterschreiben und reichen Sie es fristgerecht ein.

---

### Frage 15: Wie oft wird der Untis-Sync durchgeführt?

**Antwort:** Der automatische Untis-Sync läuft im Hintergrund und überträgt aktuelle Deputatsdaten regelmäßig. Der genaue Rhythmus wird von Ihrer Administratorin oder Ihrem Administrator konfiguriert (typischerweise monatlich oder wöchentlich). Sie müssen nichts manuell anstoßen. Wenn Sie nach einem Stundenplanwechsel aktuelle Daten erwarten, aber noch veraltete sehen, fragen Sie Ihre Administratorin oder Ihren Administrator nach dem letzten Sync-Zeitpunkt.

---

## 5. Glossar

Dieser Abschnitt erklärt die wichtigsten Fachbegriffe, die in der Software und in der Kommunikation mit der Bezirksregierung verwendet werden.

---

**Bezirksregierung**
Die Bezirksregierung ist die staatliche Behörde, die freie Ersatzschulen in NRW beaufsichtigt und deren staatliche Fördergelder bewilligt. Sie prüft die Korrektheit der Stellenberechnungen. Die CREDO-Schulen fallen in den Zuständigkeitsbereich der Bezirksregierung Detmold (oder je nach Schulstandort der entsprechend zuständigen Bezirksregierung). Alle Exporte der Software sind auf die Anforderungen der Bezirksregierung abgestimmt.

---

**DAZ (Deutsch als Zweitsprache)**
Ein Förderangebot für Schülerinnen und Schüler, deren Erstsprache nicht Deutsch ist. Schulen, die DAZ-Kurse anbieten, können unter bestimmten Bedingungen zusätzliche Stellenanteile beantragen (Typ A). Diese Anteile werden in der Stellenanteile-Seite erfasst.

---

**Deputat**
Das Deputat (auch: Unterrichtsverpflichtung oder Lehrdeputat) ist die Anzahl der Wochenstunden, die eine Lehrkraft laut Arbeitsvertrag und Stundenplan zu unterrichten hat. Das Regeldeputat ist die Vollzeit-Stundenzahl. Wer weniger unterrichtet, hat ein Teilzeit-Deputat. In der Software wird das Deputat monatlich erfasst und für die Stellenist-Berechnung verwendet.

---

**FESchVO (Verordnung über die Finanzierung von freien Ersatzschulen)**
Die rechtliche Grundlage der staatlichen Förderung von Ersatzschulen in NRW. § 3 FESchVO regelt die Berechnung der Personalstellen. Die gesamte Berechnungslogik der Software basiert auf dieser Verordnung. Bei Änderungen der FESchVO müssen entsprechend die Berechnungsparameter angepasst werden.

---

**Haushaltsjahr**
Das Haushaltsjahr ist der Abrechnungszeitraum für die Schulfinanzierung. Es entspricht dem Kalenderjahr (1. Januar bis 31. Dezember). Nicht zu verwechseln mit dem Schuljahr (August bis Juli). In der Software filtert der Haushaltsjahr-Selektor alle Ansichten auf den gewählten Zeitraum.

---

**Ist-Stelle (auch: Stellenist)**
Die tatsächlich besetzte Lehrerstelle, gemessen in Vollzeitäquivalenten. Ein Vollzeit-Deputat entspricht einer Ist-Stelle. Eine Teilzeitkraft mit 50% Stunden entspricht 0,5 Ist-Stellen. Die Summer aller Ist-Stellen einer Schule ist das Stellenist.

---

**KAoA (Kein Abschluss ohne Anschluss)**
Ein landesweites Programm zur Berufsorientierung an weiterführenden Schulen in NRW. Schulen, die KAoA anbieten, können zusätzliche Stellenanteile erhalten. Diese werden in der Software als Typ-A-Stellenanteil erfasst.

---

**Meldezeitraum**
Der Zeitraum, für den eine Stellenmeldung bei der Bezirksregierung eingereicht wird. Typischerweise entspricht der Meldezeitraum dem Haushaltsjahr. Innerhalb des Meldezeitraums kann es unterjährige Anpassungen (Nachträge) geben.

---

**Mehrarbeit**
Unterrichtsstunden, die über das reguläre Deputat einer Lehrkraft hinausgehen. Mehrarbeit kann lehrkraftbezogen (eine bestimmte Lehrkraft leistet Überstunden) oder schulweit (zusätzliche Stunden für eine befristete Vakanzüberbrückung) sein. Sie fließt in die Stellenist-Berechnung ein und wird auf der Mehrarbeit-Seite erfasst.

---

**Nachtrag**
Eine nachträgliche, begründete Korrektur eines Deputatswerts für einen vergangenen Monat. Nachträge werden versioniert gespeichert und sind für Prüfzwecke vollständig dokumentiert. Nachträge können auch als offizielle Dokumente für die Bezirksregierung exportiert werden.

---

**Planstelle**
Eine genehmigte, dauerhaft angelegte Lehrerstelle in der Schulplanung. Planstellen entsprechen dem, was die Schule laut Stellensoll an Lehrerstellen besetzen soll. Nicht zu verwechseln mit tatsächlich besetzten Stellen (Ist-Stellen).

---

**Refinanzierung**
Die staatliche Bezuschussung der Personalkosten freier Ersatzschulen. Der Staat erstattet einen bestimmten Prozentsatz der Lehrergehälter, berechnet auf Basis der anerkannten Stellenzahl (Stellensoll). Korrekte Stellenberechnungen sind Voraussetzung für korrekte Refinanzierungsbeträge.

---

**Regeldeputat**
Die gesetzlich festgelegte wöchentliche Unterrichtspflichtzeit für eine Vollzeit-Lehrkraft an einer bestimmten Schulform. Es unterscheidet sich je nach Schulform: An Grundschulen beträgt es 28 Wochenstunden, an Gesamtschulen 27, an Gymnasien und Berufskollegs liegen die Werte je nach aktuellem Erlass zwischen 25,5 und 27 Stunden.

---

**SchFG (Schulfinanzierungsgesetz NRW)**
Das Schulfinanzierungsgesetz regelt die finanzielle Unterstützung von Schulen in NRW. Es ist die übergeordnete gesetzliche Grundlage. Die FESchVO konkretisiert auf dieser Basis die Förderberechnungen für freie Ersatzschulen. § 106 SchFG regelt bestimmte Sonderbedarfe, die in der Software als Typ-A_106-Stellenanteile erfasst werden.

---

**SLR (Schüler-Lehrer-Relation)**
Eine Kennzahl, die angibt, wie viele Schülerinnen und Schüler rechnerisch auf eine Vollzeit-Lehrerstelle kommen. Sie wird vom Land NRW je Schulform festgelegt. Je niedriger die SLR, desto mehr Stellen stehen pro Schüler zu. Die Grundformel lautet: Schülerzahl ÷ SLR = Stellenanspruch.

---

**Stellenanteil**
Ein Anteil einer vollen Lehrerstelle, der über die Grundförderung hinaus beantragt werden kann. Es gibt verschiedene Typen: Typ A erhöht das Stellensoll, Typ A_106 deckt Sonderbedarfe nach § 106 SchFG ab, Typ B ist eine Wahlleistung (Stelle oder Geld), und Typ C ist nur eine Geldleistung ohne Stelleneffekt.

---

**Stellenist**
Siehe "Ist-Stelle". Der Begriff bezeichnet die Summe aller tatsächlich besetzten Lehrerstellen einer Schule, berechnet aus den monatlichen Deputaten aller Lehrkräfte, dividiert durch das Regeldeputat, ggf. ergänzt um Mehrarbeit.

---

**Stellensoll**
Die Anzahl der Lehrerstellen, die einer Schule laut Förderrecht zustehen. Berechnet nach § 3 FESchVO aus Schülerzahl, Schüler-Lehrer-Relation und Stellenanteilen. Das Stellensoll ist die Zielgröße, gegen die das Stellenist gemessen wird.

---

**Stichtag 15. Oktober**
Das Datum, zu dem die amtliche Schulstatistik erhoben wird. Die Schülerzahlen, die an diesem Tag gemeldet werden, gelten als offizielle Grundlage für die Förderberechnung. Es gibt zwei relevante Stichtage im Haushaltsjahr: 15.10. des Vorjahres (gilt für Jan–Jul) und 15.10. des laufenden Jahres (gilt für Aug–Dez).

---

**Untis / Untis-Sync**
Untis ist ein weit verbreitetes Softwaresystem zur Stundenplanung an Schulen. Die drei weiterführenden CREDO-Schulen (GES, GYM, BK) nutzen Untis zur Stundenplanverwaltung. Die Stellenistberechnung empfängt Deputatsdaten automatisch aus Untis via einem n8n-Workflow (Sync). Wichtig: Der Sync überschreibt vorhandene Monatswerte mit den aktuellen Untis-Daten. Manuell eingetragene Nachträge für denselben Monat bleiben erhalten und werden nicht überschrieben.

---

**Webhook / n8n**
Ein Webhook ist eine automatische digitale Benachrichtigung, die ein System an ein anderes sendet, sobald ein bestimmtes Ereignis eintritt. In dieser Software wird ein Webhook genutzt, um Deputatsdaten aus Untis automatisch zu empfangen. Die Konfiguration von Webhooks ist eine IT-Aufgabe und findet sich im Admin-Bereich. HR-Sachbearbeiter müssen Webhooks nicht kennen oder konfigurieren.

---

**Vollzeitäquivalent (VZÄ)**
Eine Maßzahl, die Teilzeitstellen in Vollzeitstellen umrechnet. Eine Lehrkraft mit 50%-Stelle hat ein VZÄ von 0,5. Die Summe aller VZÄ einer Schule ist das Stellenist. Dieser Begriff wird manchmal synonym mit "Stelle" verwendet.

---

*Dieses Handbuch wird bei wesentlichen Software-Updates aktualisiert.*
*Für technischen Support wenden Sie sich an die Systemadministration.*
*Für fachliche Rückfragen zur FESchVO steht Ihnen die Schulrechtsabteilung zur Verfügung.*

---

**Ende des Handbuchs**