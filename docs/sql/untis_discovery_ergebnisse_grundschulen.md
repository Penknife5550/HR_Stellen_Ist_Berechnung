# Untis-Discovery Grundschulen — Ergebnisse (Q1–Q10)

**Quelle:** Live-Abfrage per DAX gegen das Power-BI-Modell `Deputate_Snapshot` (PBIDesktop, Port 65325), das exakt dieselben 57 Untis-Rohtabellen enthält wie die SQL-Discovery vorsah (Teacher, Department, Terms, Substitution, School, SchoolYear, ...).
**Datum:** 23.07.2026
**Hinweis:** Diese Abfrage lief gegen das Power-BI-Modell, nicht direkt gegen die MSSQL-Quelle. Sollte das Modell nicht 1:1 tagesaktuell mit der Untis-DB synchron sein, bitte Stichproben in Untis direkt gegenprüfen — insbesondere vor produktiven Entscheidungen.

---

## Kernaussage vorab

Die Frage aus der Kopfzeile der SQL-Datei ist **eindeutig beantwortet**: Es handelt sich um **echten Multi-Mandanten-Betrieb**, nicht um Departments im bestehenden Mandanten. Das ändert den Charakter der Aufgabe von "Schema-Migration" zu "mandantenfähiges Lehrer-/Perioden-Mapping", wie im Kommentarblock der SQL-Datei bereits antizipiert.

---

## Q1 — Ein Mandant mit Departments oder mehrere Mandanten?

**Ergebnis: Mehrere Mandanten.**

| SCHOOL_ID | SCHOOLYEAR_ID | Lehrer | Perioden | Beispiel OwnSchool |
|---|---|---|---|---|
| 1 | 20262027 | 99 | 1 | BK |
| 2 | 20262027 | 15 | 1 | *(leer)* |
| 3 | 20262027 | 14 | 1 | *(leer)* |
| 4 | 20262027 | 12 | 1 | *(leer)* |

SCHOOL_ID 2, 3, 4 existieren **ausschließlich** im Schuljahr 2026/2027 (nirgends in den Vorjahren) — passend zu drei neuen, gerade angelegten Grundschul-Mandanten. Größenordnung (12–15 Lehrkräfte je Schule) ist für Grundschulen plausibel.

## Q2 — Departments = Quelle der Deputat-Aufteilung?

**Ergebnis: Bestätigt, und zwar negativ für die neuen Schulen.**

Die Tabelle `Department` enthält **ausschließlich SCHOOL_ID = 1** mit den bekannten drei Einträgen (DEPARTMENT_ID 1=GES, 2=GYM, 3=BK), konsistent über alle Schuljahre 2020–2026. Für SCHOOL_ID 2, 3, 4 existiert **kein einziger** Department-Eintrag. Die neuen Schulen sind also strukturell komplett getrennte Mandanten ohne jede Department-Ebene.

## Q3 — Stammschul-Kürzel (Teacher.OwnSchool)

**Ergebnis: Kritischer Befund — inzwischen aufgelöst über die `School`-Tabelle (siehe Q3b).**

Für SCHOOL_ID 2, 3 und 4 ist `Teacher.OwnSchool` **bei ausnahmslos jeder Zeile NULL** (15/15, 14/14, 12/12). Auf Ebene der einzelnen Lehrer-Zeile ist also kein Kürzel gepflegt.

➜ Die bestehende sync-v2-Logik (Abgleich gegen `schulen.untis_code`, route.ts:113–117), die pro Lehrkraft ein `OwnSchool`-Kürzel erwartet, wird für alle drei neuen Schulen **komplett leer laufen**, solange sie auf `Teacher.OwnSchool` aufsetzt.

**Aber:** Dimitri hat die `School`-Tabelle nachgereicht, und die enthält genau die fehlende Zuordnung — auf Mandanten-Ebene statt auf Lehrer-Ebene. Siehe **Q3b**. Die praktikable Lösung ist damit, die Sync-Logik von "match auf Teacher.OwnSchool" auf "match auf SCHOOL_ID → School.Text" umzustellen, statt auf eine Pflege von OwnSchool pro Lehrkraft zu warten.

Nebenbefund, jetzt aufgelöst: Seit 2022/2023 taucht in SCHOOL_ID 1 vereinzelt (1–2 Lehrkräfte/Jahr) der Wert **"GSM"** in `Teacher.OwnSchool` auf. Das ist exakt das Kürzel, das laut `School.Text` heute offiziell zu SCHOOL_ID 3 (GS Minderheide) gehört. Das spricht dafür, dass einzelne Minderheide-Lehrkräfte **schon vor Einrichtung des eigenen Untis-Mandanten** provisorisch im Hauptmandanten (SCHOOL_ID 1) mit diesem Kürzel geführt wurden. Das ist ein konkreter Dubletten-Kandidat: zu prüfen, ob diese historischen "GSM"-Datensätze dieselben Personen sind, die jetzt unter SCHOOL_ID 3 neu angelegt wurden (Abgleich über Name/Personalnummer empfohlen, bevor der Sync live geht).

## Q3b — School-Tabelle: offizielle Zuordnung SCHOOL_ID ↔ Schule (von Dimitri nachgereicht, per DAX verifiziert)

| SCHOOL_ID | Name (Lizense1) | Adresse (Lizense2) | Kürzel (Text) | Lizenz-Ablauf |
|---|---|---|---|---|
| 1 | FES Minden | D-32425, Kingsleyallee 5 | FES GES/GYM | 0 (unbefristet) |
| 2 | Freie Evangel. Grundschule Minden | D-32429, Haberbreede 17 | **FES GSH** | 01.10.2026 |
| 3 | GS Minderheide Freie Ev. Schule Minden | Petershäger Weg 201 | **FES GSM** | 01.10.2026 |
| 4 | Freie Evangelische Grundschule Stemwede | DE-32351 Stemwede, Am Winkel 8 | **FES GSS** | 01.10.2026 |

Damit sind die drei erwarteten Grundschul-Kürzel jetzt zweifelsfrei identifiziert und den SCHOOL_IDs zugeordnet:
- **SCHOOL_ID 2 = GSH** (Grundschule Haberbreede, Minden)
- **SCHOOL_ID 3 = GSM** (Grundschule Minderheide, Minden)
- **SCHOOL_ID 4 = GSS** (Grundschule Stemwede)

**Wichtiger operativer Hinweis:** Die Untis-Lizenzen aller drei neuen Schulen laufen laut `ExpirationDate` am **01.10.2026** ab (SCHOOL_ID 1 dagegen unbefristet: `0`). Falls das eine reguläre/dauerhafte Lizenz werden soll, sollte das rechtzeitig vor diesem Datum verlängert werden — sonst bricht die Datenquelle für den Sync kurz nach Start des neuen Schuljahres wieder weg. Bitte gegenprüfen, ob das eine Testlizenz ist oder ob eine Verlängerung ansteht.

## Q4 — Rohformat von PlannedPerDept

**Ergebnis: Bestätigt, plus ein wichtiger Zusatzbefund.**

Format ist `DEPTID~WERT;DEPTID~WERT,,,` (Semikolon zwischen Department-Anteilen, Komma-Suffix mit drei leeren Feldern). Beispiel Mehrfachanteil: `"1~6000;2~25500,,,"`. Das bestätigt die Warnung in der SQL-Datei: `CHARINDEX('1~'/'2~'/'3~')` ist nicht feldgrenzen-sicher (z. B. würde eine zweistellige Dept-ID wie "12~" fälschlich auf "1~" matchen).

**Zusatzbefund SCHOOL_ID 2:** `PlannedPerDept` ist dort für **alle** Lehrkräfte nur `",,,"` — komplett leer, weil (konsistent mit Q2) keine Departments existieren, auf die aufgeteilt werden könnte. Für die neuen Schulen kann/darf die App also nicht versuchen, PlannedPerDept zu parsen; sie muss direkt auf `PlannedWeek` (Gesamt-Soll) zugreifen.

## Q5 — Perioden je Mandant / PK-Kollision

**Ergebnis: Aktuell nicht entscheidbar — aber aus gutem Grund.**

Für das Schuljahr 2026/2027 existieren **in der gesamten Terms-Tabelle keine Einträge**, weder für SCHOOL_ID 1 noch für 2/3/4 (letzte vorhandene Perioden sind 2025/2026). Das ist zum jetzigen Zeitpunkt (Sommerferien, neues Schuljahr startet erst) plausibel — die Perioden werden vermutlich erst kurz vor/mit Schuljahresbeginn in Untis angelegt.

Die Kollisionsprüfung (gleiche SCHOOLYEAR_ID+TERM_ID, aber unterschiedliche Datumsgrenzen) läuft für die Vorjahre mit 0 Treffern durch — aber das ist für Q5 nicht aussagekräftig, weil dort nie mehrere Mandanten gleichzeitig existierten. **Diese Prüfung muss wiederholt werden, sobald für 2026/2027 Perioden angelegt sind** — erst dann zeigt sich, ob `untis_terms` (PK ohne SCHOOL_ID) tatsächlich kollidiert.

## Q6 — TEACHER_ID-Kollision zwischen Mandanten

**Ergebnis: Bestätigtes, konkretes Risiko — 17 Fälle, echte unterschiedliche Personen.**

Die TEACHER_IDs 1–17 kommen in bis zu vier verschiedenen SCHOOL_IDs gleichzeitig vor. Stichproben zeigen **eindeutig verschiedene reale Personen**, z. B.:

| TEACHER_ID | SCHOOL_ID 1 | SCHOOL_ID 2 | SCHOOL_ID 3 | SCHOOL_ID 4 |
|---|---|---|---|---|
| 2 | Bergen, Bettina | — | Blank, Antje | Dick, Tabea |
| 3 | Braun, Diana | Bürger, Barbara | Esau, Olga | Dück, Anna |
| 7 | Elsanowski, Dr. Simone | — | Kromer, Magdalena | Hoffmann, Sonja |

Das bestätigt exakt das befürchtete Szenario: Die neuen Untis-Mandanten vergeben ihre TEACHER_IDs unabhängig neu ab 1 aufwärts, was mit den (immer noch aktiven) niedrigen TEACHER_IDs aus dem langjährigen Mandanten SCHOOL_ID=1 kollidiert. Da `lehrer.untis_teacher_id` UNIQUE ist, würde ein naiver Sync hier Datensätze verschiedener Personen gegenseitig überschreiben. **Der Sync-Schlüssel muss zwingend `(SCHOOL_ID, TEACHER_ID)` sein, nicht `TEACHER_ID` allein.**

**Geprüft: Gilt das auch für andere Bereiche des Untis-Modells? Ja.** Alle Tabellen im Modell, die überhaupt einen Teacher-Bezug führen, führen auch `SCHOOL_ID` — der Fix ist also strukturell überall anwendbar und auch überall nötig:

| Tabelle | Teacher-Referenz | Hat SCHOOL_ID |
|---|---|---|
| Teacher | TEACHER_ID | ✅ |
| **Substitution** (IST-Quelle Mehrarbeit!) | TEACHER_IDSubst, TEACHER_IDLessn | ✅ |
| Class | — | ✅ |
| CountValue | — | ✅ |
| Glaettung | — | ✅ |
| Prebooking | — | ✅ |
| Transfer | — | ✅ |
| ValueCorrection | — | ✅ |

Besonders wichtig: **`Substitution`** — die laut Projektentscheidung genutzte IST-Quelle für die Mehrarbeitsberechnung — referenziert Lehrkräfte über `TEACHER_IDSubst` (Vertretungslehrer) und `TEACHER_IDLessn` (planmäßiger Lehrer) und führt ebenfalls `SCHOOL_ID`. Jeder Join von `Substitution` auf `Teacher` **muss** also zusätzlich auf `SCHOOL_ID` matchen — sonst werden Vertretungsstunden sobald die neuen Schulen live sind, an die falsche Person (z. B. Bettina Bergen statt Antje Blank) verrechnet. Dasselbe gilt sinngemäß für Class, CountValue, Glaettung, Prebooking, Transfer und ValueCorrection, sofern diese im Mehrarbeit-Flow verwendet werden.

## Q7 — Statistik-Codes der neuen Lehrkräfte

**Ergebnis: Unkritisch.**

Alle bei SCHOOL_ID 2/3/4 verwendeten Codes (`L, LT, P... `→ tatsächlich beobachtet: `B, BT, L, LT, PT, U, UT`) liegen vollständig innerhalb des bereits bekannten Sets. Kein Bedarf, `statistik_codes` zu erweitern. Je Schule gibt es jeweils genau **1 Lehrkraft ohne Code** (NULL) — das sind vermutlich dieselben Personen ohne OwnSchool/PNumber (unvollständig angelegte Datensätze, s. Q8), kein systemisches Mapping-Problem.

## Q8 — Personalnummern-Abgleich (Dublettenrisiko)

**Ergebnis: Gemischtes und für Claude Code direkt relevantes Bild.**

| SCHOOL_ID | Lehrkräfte gesamt | echte Personalnummer (6-stellig, wie 600xxx/300xxx) | Platzhalter "000xxx" | ohne PNumber |
|---|---|---|---|---|
| 2 | 15 | 10 | 0 | 4 (+1 ganz ohne Namen) |
| 3 | 14 | 7 | 5 | 2 |
| 4 | 12 | 0 | 9 | 3 |

**Wichtiger Befund:** Die "000xxx"-Werte sind **keine echten Personalnummern**, sondern offensichtlich schulinterne Platzhalter/Zähler — Beweis: In SCHOOL_ID 4 tragen sowohl *Krzemien, Marion* als auch *Nickel, Andreas* identisch `PNumber = "000006"`. Die Nummer ist also nicht einmal **innerhalb desselben Mandanten** eindeutig, geschweige denn als globaler Merge-Schlüssel brauchbar.

➜ Für SCHOOL_ID 4 (fast komplett Platzhalter) und die 5 Platzhalter-Fälle in SCHOOL_ID 3 kann der Merge **nicht automatisiert über PNumber laufen** — das braucht entweder eine manuelle Zuordnungsliste oder saubere Personalnummern in Untis, bevor programmiert wird. SCHOOL_ID 2 ist in deutlich besserem Zustand (10 von 15 mit plausibler Nummer).

### Nachtrag: Löst "SCHOOL_ID vor die PNumber schalten" das Dublettenproblem? **Nein — nicht vollständig, und das Problem ist größer als gedacht.**

Geprüft wurde, ob `(SCHOOL_ID, PNumber)` als zusammengesetzter Schlüssel eindeutig ist. Ergebnis: **Nein.** Es gibt bereits **innerhalb des bestehenden, seit Jahren laufenden Mandanten SCHOOL_ID=1** echte Personalnummern-Dubletten — also unabhängig von den neuen Grundschulen und unabhängig davon, ob SCHOOL_ID vorgeschaltet wird oder nicht:

| PNumber | Person A | Person B | Seit Schuljahr |
|---|---|---|---|
| 600084 | Diercks, Daniel (BK) | Gerhold, Birke (GES) | 2020/2021 durchgängig bis heute |
| 600123 | Könemann, Gesine (GYM) | Küpper, Andreas (GES) | 2020/2021 durchgängig bis heute |
| 600125 | Riesen, Helena (GYM) | *(weitere Person, gleiche Nummer)* | 2020/2021 durchgängig bis heute |
| 600136 | Esau, Dietrich (GYM) | Penner, Eugen (GYM) | 2020/2021 durchgängig bis heute |
| 600172 | Meyer, Eva (GYM) | Olfert, Paul (GES) | 2020/2021 durchgängig bis heute |
| 600280 | Klassen, Anna (GYM) | Schott, Daniel (GES) | Wilms, Henriette (BK) — **3-fach!** | seit 2024/2025 |

Das sind **eindeutig unterschiedliche, real existierende Personen** (unterschiedliche Namen, teils unterschiedliche Departments) — keine Zeilenduplikate desselben Menschen. Diese Kollisionen bestehen konstant über alle Schuljahre seit 2020/2021 (600280 ist neuer, erst ab 2024/2025), betreffen also den **produktiven Bestand**, nicht nur die neuen Schulen.

**Konsequenz:** `PNumber` — selbst kombiniert mit `SCHOOL_ID` — ist **kein verlässlicher eindeutiger Schlüssel**, weder für die neuen Grundschulen noch für den bestehenden Mandanten. Das ist vermutlich ein eigenständiges, seit Jahren bestehendes Datenqualitätsproblem in der Untis-/Personalnummern-Pflege, unabhängig vom aktuellen Grundschul-Projekt — aber es muss berücksichtigt werden, sobald irgendwo im Code eine Eindeutigkeit von PNumber (mit oder ohne SCHOOL_ID-Präfix) vorausgesetzt wird.

**Empfehlung:** PNumber nur als *Matching-Hinweis* verwenden, nicht als harten Unique-Key — zusätzlich immer über Name (Longname + FirstName) validieren, bevor automatisch gemerged wird. Für die oben gelisteten ~6 bekannten Kollisionsfälle in SCHOOL_ID=1 unabhängig vom Grundschul-Projekt eine Rückmeldung an die HR-/Personalnummern-Pflege (OPTIGEM-Seite?) erwägen, da das echte Personen im laufenden Betrieb betrifft.

## Q10 — Mandantenübergreifende Personen

**Ergebnis: Mindestens 1 konkret bestätigter Fall.**

Abgleich der "echten" Personalnummern (ohne 000xxx-Platzhalter) aus SCHOOL_ID 2/3/4 gegen SCHOOL_ID 1 (Schuljahr 2026/2027) ergibt genau einen Treffer:

- **PNumber 600085 → Florian Stahlschmidt**, gleichzeitig geführt bei SCHOOL_ID 1 (OwnSchool = GES) **und** bei SCHOOL_ID 2 (neue Grundschule).

Das bestätigt, dass das im Kopf der SQL-Datei beschriebene Szenario (eine Person mit Anteilen in zwei Mandanten) real vorkommt und PNumber grundsätzlich als Klammer funktioniert — **aber nur dort, wo die Nummer echt und gepflegt ist**. Da SCHOOL_ID 4 praktisch keine echten Nummern hat, sind dortige Cross-Mandant-Fälle mit den aktuellen Daten **nicht erkennbar** — das ist ein blinder Fleck, kein "es gibt keine".

Gegenprobe "Lehrkräfte ohne Personalnummer" (für die kein automatischer Merge möglich ist): siehe Tabelle in Q8 — insgesamt 9 Personen über alle drei neuen Schulen plus 3 komplett leere Platzhalter-Zeilen ohne jeden Namen (SCHOOL_ID 2/3/4, je TEACHER_ID=1) — letztere sehen nach technischen Leerzeilen/Systemplatzhaltern aus, nicht nach echten Personen.

---

## Offene Punkte, die vor der Programmierung noch zu klären sind

1. **Terms/Perioden 2026/2027** existieren noch nicht — Q5-Kollisionsprüfung muss wiederholt werden, sobald sie angelegt sind.
2. ~~OwnSchool-Kürzel für die drei neuen Schulen~~ — **erledigt:** Kürzel sind über `School.Text` bekannt (GSH/GSM/GSS, siehe Q3b). Die Sync-Logik sollte darauf umgestellt werden, statt auf `Teacher.OwnSchool` zu warten.
3. **Personalnummern-Bereinigung** bei SCHOOL_ID 3 (5 Fälle) und SCHOOL_ID 4 (9 von 12!) nötig, bevor ein automatischer PNumber-Merge sinnvoll ist.
4. **"GSM"-Altfälle** in SCHOOL_ID 1 (seit 2022/2023): jetzt als möglicher Dublettenfall mit SCHOOL_ID 3 identifiziert (siehe Q3) — vor Sync-Start per Name/Personalnummer gegenprüfen.
5. **Lizenzablauf 01.10.2026** bei allen drei neuen Schulen (SCHOOL_ID 1 unbefristet) — klären, ob Verlängerung ansteht, sonst reißt die Datenquelle kurz nach Schuljahresbeginn ab.
6. Diese Auswertung stammt aus dem Power-BI-Snapshot — vor der finalen Implementierung eine kurze Stichprobe direkt gegen die Untis-MSSQL-DB fahren, um Modell-Aktualität zu bestätigen.

## Empfehlung für die Claude-Code-Aufgabe

Basierend auf den obigen Befunden sollte die Migration **mandantenfähig** ausgelegt werden:
- Sync-Schlüssel: `(SCHOOL_ID, TEACHER_ID)` statt `TEACHER_ID` allein — **überall**, wo im Untis-Modell auf Teacher referenziert wird (bestätigt für Teacher, Substitution, Class, CountValue, Glaettung, Prebooking, Transfer, ValueCorrection). Besonders kritisch bei `Substitution`, der IST-Quelle der Mehrarbeitsberechnung.
- Schul-Zuordnung über `SCHOOL_ID → School.Text` (GSH/GSM/GSS) auflösen, nicht über `Teacher.OwnSchool` — letzteres ist bei den neuen Schulen durchgehend leer.
- PlannedPerDept-Parsing nur anwenden, wenn Departments existieren (Q2/Q4) — sonst direkt PlannedWeek verwenden.
- **PNumber niemals als harten Unique-Key behandeln** — auch nicht mit SCHOOL_ID-Präfix. Es gibt mind. 6 bestätigte Kollisionsfälle unterschiedlicher, realer Personen bereits innerhalb des bestehenden Mandanten SCHOOL_ID=1 (siehe Q8-Nachtrag). PNumber + Name gemeinsam validieren; für die "000xxx"-Platzhalterfälle ohnehin eine manuelle Review-Liste vorsehen.
- Vor Go-live: historische "GSM"-Datensätze in SCHOOL_ID 1 gegen die neuen SCHOOL_ID-3-Lehrkräfte auf Dubletten prüfen.
- Die 6 bestehenden PNumber-Kollisionen in SCHOOL_ID 1 sind unabhängig vom Grundschul-Projekt — ggf. separat an die Personalnummern-Pflege zurückmelden.
