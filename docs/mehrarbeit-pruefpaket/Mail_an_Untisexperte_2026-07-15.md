**Betreff:** Untis-Datenprüfung Mehrarbeit / Vertretungen – Rückfragen + Datenblatt zur Durchsicht

**Anhang:** Untis_Mehrarbeit_Datenpruefung_SJ2025-2026.xlsx

---

Sehr geehrter Herr [Name],

im Rahmen unseres Projekts **„Mehrarbeit- / Vertretungs-Controlling"** möchten wir die von unseren Lehrkräften übernommenen Vertretungen künftig **automatisch aus Untis** ermitteln und als Stellenanteil in unsere Refinanzierungsberechnung gegenüber der Bezirksregierung (NRW-Ersatzschulfinanzierung) überführen.

Als Datengrundlage nutzen wir den lokalen Untis-Datenbestand („Alle Tabellen", natives Schema). Die relevanten Tabellen – **Substitution, Absence, AbsenceReason, CountValue/CV_Reason und Teacher** – haben wir bereits ausgewertet, **konzentriert auf das laufende Schuljahr 2025/2026**. An einigen Stellen sind wir dabei auf Punkte gestoßen, die wir gern mit Ihnen als Untis-Experten absichern möchten, bevor wir die Automatik aufbauen.

Anbei finden Sie eine **Excel-Arbeitsmappe** mit unseren konkreten Fragen und – wichtig – den **echten Zahlen und Beispielzeilen aus unserem Bestand** dazu. Die Beispielzeilen (Blatt „09_Beispielzeilen") sind bereits mit **Lehrer-Kürzeln, Klasse, Fach und Grund** aufbereitet, sodass Sie sie in der Untis-Vertretungsansicht direkt wiederfinden. Die **gelb hinterlegten Zellen** sind für Ihre Antworten/Korrekturen gedacht; alles andere ist unsere aus den Daten abgeleitete Interpretation, die Sie gern korrigieren dürfen. Bitte ergänzen Sie auch, was in den Daten aus Ihrer Sicht noch **fehlt** oder anders gepflegt werden müsste.

Die drei Schwerpunkte:

**1. Vertretungen richtig klassifizieren** (Blätter 03/04/09)
Wir müssen echte, übernommene Vertretungen von Tausch, Bereitschaft, Entfall, Freisetzung, Selbstvertretung und Sondereinsätzen (z. B. „Zeugnisausgabe") unterscheiden. Die gesamte Kennzeichnung steckt offenbar im Feld **`Flags`** – wir bräuchten die Bedeutung der einzelnen Buchstaben und welche Kombinationen als zählbare Mehrarbeit gelten. Ergänzend: `BookingType` ist bei uns durchgängig `0`, und `SubstValue` ist zu ~97 % leer (Fragen 5 und 6).

**2. Absenzen & Gründe** (Blätter 05/06)
Bedeutung der Absence-Typen **100/101/102**, Umgang mit den vielen „ohne Grund"-Zeilen bei Typ 101, und welche Abwesenheitsgründe eine **refinanzierbare Vertretungsursache** darstellen bzw. reine Steuergründe sind (`fnz`, `KV`, `BE-V` …). `StatisticCodes` ist bei allen Gründen leer.

**3. Anrechnungen & Stammdaten** (Blätter 07/08)
Amtliche NRW-Codes in `CV_Reason` (u. a. der offiziell entfallene **280** – bereits vorgeklärt), Bedeutung von `Teacher.SalaryPeHour` **{0, 200, 400}** (Schlüssel × 100, vorgeklärt) und die verlässliche **Schulzuordnung** einer Vertretung.

Die vollständige, nummerierte Frageliste steht auf Blatt **„01_Offene_Fragen"**; jede Frage verweist auf das zugehörige Datenblatt. **Einen Teil der Fragen haben wir bereits anhand der NRW-Rechtsgrundlagen vorgeklärt** (blau markiert bzw. Blatt „11_Rechtsdoku_Abgleich") – z. B. den Vergütungsschlüssel `SalaryPeHour` und den entfallenen Code 280. Dort brauchen wir von Ihnen im Wesentlichen nur noch eine **Bestätigung**; die echten offenen Punkte sind als „offen" gekennzeichnet.

Über eine kurze Durchsicht würden wir uns sehr freuen. Für Rückfragen oder einen kurzen Termin (Telefon/Teams) stehe ich jederzeit gern zur Verfügung.

Vielen Dank vorab und beste Grüße

Dimitri Riesen
CREDO Gruppe · Freie Evangelische Schulen Minden
dimitri.riesen@fes-minden.de
