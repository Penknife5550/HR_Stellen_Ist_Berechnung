-- Coverage-Metadaten fuer deputat_monatlich.
--
-- Hintergrund:
-- Untis liefert pro Kalendermonat oft MEHRERE Perioden (Terms). Wenn
-- zwei Perioden denselben Monat beruehren, schrieb der Sync-Endpoint
-- bisher bei jedem Periodencall diesen Monat neu — was einen taeglichen
-- Flip-Flop in der Aenderungshistorie erzeugte.
--
-- Loesung: Pro Monat gewinnt die Periode mit den meisten Kalendertagen
-- im Monat. Dafuer muss der Sync-Endpoint wissen, welcher Datumsbereich
-- den aktuell gespeicherten Wert geschrieben hat.
--
-- Die Spalten sind nullable fuer Backwards-Compatibility — Altdaten ohne
-- Coverage-Info werden beim naechsten Sync automatisch ueberschrieben.
ALTER TABLE "deputat_monatlich" ADD COLUMN "untis_term_date_from" date;--> statement-breakpoint
ALTER TABLE "deputat_monatlich" ADD COLUMN "untis_term_date_to" date;
