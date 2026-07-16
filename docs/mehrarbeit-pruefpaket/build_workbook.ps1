# Baut die Excel-Arbeitsmappe fuer die Untis-Experten-Anfrage via Excel COM.
# ALLE Auswertungen sind auf SCHULJAHR 2025/2026 (SCHOOLYEAR_ID 20252026, Deleted=FALSE) gefiltert.
# Quelle: lokales Power-BI-Modell "Untis Alle Tabellen", abgefragt 16.07.2026.
# Jede .Value2-Zuweisung erfolgt ueber object[,] (Set-Block) wegen PowerShell-COM-Cache-Bug.

$ErrorActionPreference = 'Stop'
$OutDir   = 'C:\Users\driesen\Desktop\Mehrarbeit\Anfrage_Untisexperte_2026-07'
$OutFile  = Join-Path $OutDir 'Untis_Mehrarbeit_Datenpruefung_SJ2025-2026.xlsx'
$OldFile  = Join-Path $OutDir 'Untis_Mehrarbeit_Datenpruefung_2026-07-15.xlsx'
$SampleCsv= Join-Path $OutDir 'data_sample.csv'
if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
if (Test-Path $OldFile) { Remove-Item $OldFile -Force }

function RGBv([int]$r,[int]$g,[int]$b){ return [int]($r + $g*256 + $b*65536) }
$cHeader  = RGBv 87 87 86
$cHeadTxt = RGBv 255 255 255
$cInput   = RGBv 255 242 204
$cTitle   = RGBv 251 201 0
$cNote    = RGBv 89 89 89
$cDoc     = RGBv 221 235 247   # hellblau = aus NRW-Rechtsdoku
$cPropose = RGBv 226 239 218   # hellgruen = unser Vorschlag, bitte bestaetigen

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xlContinuous = 1; $xlThin = 2; $xlOpenXML = 51
$wb = $null

try {
  $wb = $xl.Workbooks.Add()
  $sheetNames = @('00_Anleitung','01_Offene_Fragen','02_Substitution_Ueberblick','03_Flag_Buchstaben','04_Flags_Kombinationen','05_Absence_TypeA','06_Abwesenheitsgruende','07_Anrechnungen_CV_Reason','08_SalaryPeHour','09_Beispielzeilen','10_Feldreferenz','11_Rechtsdoku_Abgleich')
  while ($wb.Worksheets.Count -lt $sheetNames.Count) { $wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) | Out-Null }
  for ($i=0; $i -lt $sheetNames.Count; $i++){ $wb.Worksheets.Item($i+1).Name = $sheetNames[$i] }

  function Set-Block { param($ws,[int]$r1,[int]$c1,$rows2d)
    $nr = $rows2d.Count; $nc = $rows2d[0].Count
    $a = New-Object 'object[,]' $nr,$nc
    for($i=0;$i -lt $nr;$i++){ for($j=0;$j -lt $nc;$j++){
      $v = $rows2d[$i][$j]
      if ($null -eq $v) { $v = '' }
      elseif (($v -is [string]) -and $v.StartsWith('=')) { $v = ' ' + $v }
      $a[$i,$j] = $v
    }}
    $r2 = $r1 + $nr - 1; $c2 = $c1 + $nc - 1
    $ws.Range($ws.Cells.Item($r1,$c1), $ws.Cells.Item($r2,$c2)).Value2 = $a
  }
  function Note { param($ws,[int]$row,[int]$cols,[string]$text)
    Set-Block $ws $row 1 @(,@($text))
    $c = $ws.Cells.Item($row,1); $c.Font.Italic = $true; $c.Font.Color = $cNote
    $ws.Range($ws.Cells.Item($row,1),$ws.Cells.Item($row,$cols)).Merge()
  }
  function Write-Table {
    param($ws,[int]$startRow,[string[]]$headers,$rows,[int[]]$inputCols,[int[]]$textCols,[double[]]$widths,[int[]]$wrapCols)
    $nCols = $headers.Count
    $ws.Cells.Font.Name = 'Arial'; $ws.Cells.Font.Size = 10
    if ($textCols){ foreach($tc in $textCols){ $ws.Columns.Item($tc).NumberFormat = '@' } }
    $all = @(); $all += ,([object[]]$headers)
    foreach($r in $rows){ $all += ,([object[]]$r) }
    Set-Block $ws $startRow 1 $all
    $nRows = $rows.Count
    $hr = $ws.Range($ws.Cells.Item($startRow,1), $ws.Cells.Item($startRow,$nCols))
    $hr.Font.Bold = $true; $hr.Font.Color = $cHeadTxt; $hr.Interior.Color = $cHeader
    $hr.HorizontalAlignment = -4131; $hr.VerticalAlignment = -4108; $hr.WrapText = $true
    $dataTop = $startRow+1; $dataBot = $startRow+[Math]::Max($nRows,1)
    $full = $ws.Range($ws.Cells.Item($startRow,1), $ws.Cells.Item($dataBot,$nCols))
    $full.Borders.LineStyle = $xlContinuous; $full.Borders.Weight = $xlThin
    $full.VerticalAlignment = -4160
    if ($widths){ for($j=0;$j -lt $widths.Count -and $j -lt $nCols;$j++){ if($widths[$j] -gt 0){ $ws.Columns.Item($j+1).ColumnWidth = $widths[$j] } } }
    if ($wrapCols){ foreach($wc in $wrapCols){ $ws.Range($ws.Cells.Item($dataTop,$wc), $ws.Cells.Item($dataBot,$wc)).WrapText = $true } }
    if ($inputCols -and $nRows -gt 0){ foreach($ic in $inputCols){ $ws.Range($ws.Cells.Item($dataTop,$ic), $ws.Cells.Item($dataBot,$ic)).Interior.Color = $cInput } }
    $ws.Range($ws.Cells.Item($startRow,1), $ws.Cells.Item($dataBot,$nCols)).AutoFilter() | Out-Null
    $ws.Activate(); $xl.ActiveWindow.SplitRow = $startRow; $xl.ActiveWindow.FreezePanes = $true
  }

  # =========================== 00 Anleitung ===========================
  $ws = $wb.Worksheets.Item('00_Anleitung')
  $ws.Cells.Font.Name = 'Arial'; $ws.Cells.Font.Size = 11
  $ws.Columns.Item(1).ColumnWidth = 3
  $ws.Columns.Item(2).ColumnWidth = 118
  Set-Block $ws 2 2 @(,@('CREDO Gruppe - Freie Evangelische Schulen Minden'))
  $ws.Cells.Item(2,2).Font.Bold = $true; $ws.Cells.Item(2,2).Font.Size = 12
  Set-Block $ws 3 2 @(,@('Datenpruefung Untis -> Mehrarbeit / Vertretungs-Controlling  -  Schuljahr 2025/2026'))
  $ws.Cells.Item(3,2).Font.Bold = $true; $ws.Cells.Item(3,2).Font.Size = 15
  $ws.Cells.Item(3,2).Interior.Color = $cTitle
  $lines = @(
    '',
    'Ziel: Wir moechten die uebernommenen Vertretungen (Mehrarbeit) automatisch aus Untis ermitteln und als',
    'Stellenanteil in unsere Personal-/Refinanzierungsberechnung (Bezirksregierung NRW) uebernehmen.',
    'Datenquelle: lokaler Power-BI-Bericht "Untis Alle Tabellen" (natives Untis-Schema, 57 Tabellen).',
    'WICHTIG: Alle Zahlen in dieser Mappe betreffen NUR das Schuljahr 2025/2026 (27.08.2025 - 17.07.2026),',
    'gefiltert auf Deleted = FALSE. Stand der Auswertung: 16.07.2026.',
    '',
    'BITTE UM PRUEFUNG:',
    'Die GELB hinterlegten Zellen sind fuer Ihre Antworten/Korrekturen vorgesehen. Alles andere sind von uns',
    'aus den Daten gezogene Fakten - bitte korrigieren Sie, wo unsere Interpretation falsch ist.',
    '',
    'WICHTIGSTE BLAETTER (in dieser Reihenfolge):',
    '   01_Offene_Fragen           - die eigentlichen Fragen, kompakt (Ihre Antworten in Gelb)',
    '   03_Flag_Buchstaben         - Kernpunkt: was bedeutet jeder Buchstabe im Feld "Flags"?',
    '   04_Flags_Kombinationen     - Haeufigkeit der Flag-Kombinationen (welche = zaehlbare Vertretung?)',
    '   05_Absence_TypeA           - Absenztypen 100/101/102 und die "ohne Grund"-Frage',
    '   06_Abwesenheitsgruende     - welche Gruende zaehlen als refinanzierbare Vertretungsursache?',
    '   07_Anrechnungen_CV_Reason  - amtliche NRW-Anrechnungscodes (inkl. veraltetem 280)',
    '   08_SalaryPeHour            - Verguetungsschluessel {0,200,400}',
    '   09_Beispielzeilen          - echte Vertretungszeilen MIT Kuerzel/Name/Fach/Klasse/Grund',
    '   10_Feldreferenz            - unser Verstaendnis der Felder (bitte gegenpruefen)',
    '   11_Rechtsdoku_Abgleich     - was die NRW-Rechtsdoku schon (vor)beantwortet',
    '',
    'HINWEIS: Viele Antworten haben wir als VORSCHLAG (GRUEN) bereits eingetragen - bitte nur bestaetigen (ja) oder korrigieren.',
    'Herleitung/Fundstellen dazu auf Blatt 11_Rechtsdoku_Abgleich.',
    'LEGENDE:   [gruen] = unser VORSCHLAG (bitte bestaetigen)   [gelb] = bitte ausfuellen   [blau] = aus NRW-Rechtsdoku   [grau] = Hinweis',
    '',
    'Beispiel fuer eine ausgefuellte Zeile (Blatt 03):',
    '   Buchstabe "F"  ->  Bedeutung: "frei / faellt aus"  ->  zaehlt als Mehrarbeit? "nein"',
    '',
    'Rueckfragen: Dimitri Riesen, dimitri.riesen@fes-minden.de'
  )
  $block = @(); foreach($ln in $lines){ $block += ,@($ln) }
  Set-Block $ws 4 2 $block
  $r = 4
  foreach($ln in $lines){
    if ($ln -like 'BITTE*' -or $ln -like 'WICHTIGSTE*' -or $ln -like 'LEGENDE*' -or $ln -like 'Beispiel fuer*' -or $ln -like 'WICHTIG:*' -or $ln -like 'HINWEIS:*'){ $ws.Cells.Item($r,2).Font.Bold = $true }
    $r++
  }
  $ws.Activate(); $xl.ActiveWindow.DisplayGridlines = $false

  # =========================== 01 Offene Fragen ===========================
  $ws = $wb.Worksheets.Item('01_Offene_Fragen')
  $fragenCsv = @'
Nr|Gruppe|Frage|Warum wichtig (Refinanzierung)|Bezug (Tabelle/Feld/Blatt)
1|A Vertretung|Flags-Systematik: Was bedeutet jeder einzelne Buchstabe im Feld Flags? Welche Kombination kennzeichnet eine echte, zaehlbare Vertretung (uebernommene Mehrarbeit) - im Unterschied zu Tausch, Bereitschaft ohne Einsatz, Entfall, Freisetzung, Selbstvertretung, Mitbetreuung?|Nur echte uebernommene Vertretungen duerfen als Mehrarbeit/Stellenanteil gezaehlt werden.|Substitution.Flags / Blatt 03+04
2|A Vertretung|Ist TEACHER_IDSubst > 0 der richtige und ausreichende Filter fuer "es gab einen echten Vertreter"?|Grundfilter der gesamten Auswertung.|Substitution.TEACHER_IDSubst
3|A Vertretung|Selbstvertretung: Zeilen mit TEACHER_IDSubst = TEACHER_IDLessn (Vertreter = ausgefallene LK) - als Mehrarbeit ausschliessen? (Beispiele auf Blatt 09)|Vermeidet Ueberzaehlung.|Blatt 09
4|A Vertretung|TEACHER_IDLessn = 0 zusammen mit Event-Text (z.B. "Zeugnisausgabe", Flags SGg/rSGg): kein ausgefallener Kollege - zaehlt das als Mehrarbeit oder nicht? (Beispiele auf Blatt 09)|Sondereinsaetze sind evtl. keine refinanzierbare Vertretung.|Blatt 09
5|A Vertretung|BookingType ist im GESAMTEN Export durchgaengig 0. Traegt das Feld wirklich keine Information, oder wird es bei Ihnen nicht gepflegt? Koennen wir es ignorieren?|Wir wollten BookingType zur Klassifikation nutzen - scheint aber leer.|Substitution.BookingType
6|A Vertretung|SubstValue ist auch in 2025/2026 zu 97% leer (6.213 von 6.408) und sonst fast nur "0"/"0.000" - nur 8 Zeilen tragen "1". Ist die Wertigkeit (Wertrechnung/Faktor) im Export enthalten, oder muss jede vertretene Stunde als 1,0 gezaehlt werden? (Nebenbei: gemischte Dezimaltrenner "0.000" vs "0,000".)|Entscheidet, ob wir zaehlen (1 Zeile = 1 Std.) oder summieren.|Substitution.SubstValue / Blatt 02
7|A Vertretung|Dauervertretung vs. Tagesvertretung: Wie unterscheidet man im Export eine Dauervertretung, die bereits ins (Perioden-)Deputat uebergegangen ist, von einer zusaetzlichen taeglichen Vertretung?|Verhindert Doppelzaehlung (Ueber-Deputat steckt schon im Periodendeputat).|Substitution / Terms
8|A Vertretung|AbsenceIds verweist auf Absence.ABSENCE_ID; darueber haben wir den Grund je Vertretung aufgeloest (Blatt 09). Ist das der verlaessliche Weg?|Grund entscheidet ueber "zaehlt / zaehlt nicht".|Substitution.AbsenceIds -> Absence
9|B Absenzen|Absence.TypeA 100/101/102: Was bedeuten die drei Typen genau? Welcher ist grundpflichtig, welcher entsteht automatisch / als Freisetzung?|Klaert, ob "ohne Grund" ein Fehler oder normal ist.|Absence.TypeA / Blatt 05
10|B Absenzen|Warum tragen so viele Typ-101-Absenzen keinen Grund (in 2025/2026: 1.456 von 2.667)? Erwartet (Freisetzung -> eigene Stunde entfaellt) oder Pflegeluecke?|Direkte Auswirkung auf Datenqualitaet/Vollstaendigkeit.|Absence (TypeA=101)
11|B Absenzen|Bitte je Kuerzel bestaetigen/korrigieren, welche Abwesenheitsgruende eine refinanzierbare Vertretungsursache sind und welche Steuergruende (z.B. fnz, KV, BE-V, KOR-V).|Kern des Grund-Mappings.|Blatt 06 (AbsenceReason)
12|B Absenzen|StatisticCodes ist bei ALLEN Gruenden (AbsenceReason und CV_Reason) leer. Sollen die amtlichen Kennzeichen gepflegt werden? Wie ordnet Untis sonst "anrechenbar / nicht" zu?|Ohne amtl. Code muessen wir manuell mappen.|AbsenceReason/CV_Reason.StatisticCodes
13|C Stammdaten|CV_Reason traegt die amtlichen NRW-Codes im Name-Feld (110 Mehrarbeit, 945 Vertretungsreserve, 200/210/220 Ermaessigungen ...). Ist das der massgebliche Schluessel? Welche Codes sind fuer Mehrarbeit/Verrechnung relevant?|Verbindung zu amtlicher Systematik.|Blatt 07 (CV_Reason)
14|C Stammdaten|Anrechnungscode 280 ("Berufsbegleitender Vorbereitungsdienst") ist offiziell entfallen, aber im Bestand vorhanden - wie damit umgehen?|Alt-Code kann Auswertung verzerren.|CV_Reason Name=280
15|C Stammdaten|Teacher.SalaryPeHour hat 2025/2026 die Werte {0,200,400} (frueher zusaetzlich 100) - was bedeuten sie genau (Verguetungsschluessel)? Teacher.Status ist leer - wo steht sonst Beamter/Angestellter?|Nur fuer den getrennten Verguetungs-/Euro-Pfad relevant.|Blatt 08 (Teacher.SalaryPeHour)
16|C Stammdaten|Schulzuordnung einer Vertretung: Ueber welche Beziehung (Klasse/Abteilung/SCHOOL_ID) ordnet man eine Vertretung verlaesslich der Unterrichtsschule zu? Und soll refinanzierungsseitig die Unterrichts- oder die Stammschule zaehlen?|Wir bilanzieren je Schule.|Substitution.SCHOOL_ID / Class / Department
'@
  $fragen = $fragenCsv | ConvertFrom-Csv -Delimiter '|'
  $docNote = @{
    '1'='[Rechtsdoku] Art V=Vertretung / F=Freisetzung / -F=Entfall (3.3) stuetzt F=frei, E=Entfall'
    '2'='[Rechtsdoku] nur erteilter Unterricht zaehlt; Wert 0 zaehlt nicht (1.3 / 2.1)'
    '3'='[Rechtsdoku] Selbstvertretung = kein Zusatzeinsatz einer anderen Kraft'
    '4'='[Rechtsdoku] Events/Aufsichten/Feste nicht verguetbar (1.3)'
    '5'=''
    '6'='[Rechtsdoku] Wert 0 = NICHT gewertet, 1 = normal (2.3 / VAL-005) -> "0"-Zeilen ausschliessen'
    '7'='[Rechtsdoku] Mehrarbeit = IST ueber individuellem Soll (UVD)'
    '8'='[Rechtsdoku] ABSENZ traegt Grund + Art -> Weg bestaetigt'
    '9'=''
    '10'='[Rechtsdoku] koennte Freisetzung sein (eigene Kategorie, 1.5)'
    '11'='[Rechtsdoku] Kategorien s. Blatt 06 + 11'
    '12'='[Rechtsdoku] Teacher.StatisticCodes IST gepflegt (L/P/U/B, T=TZ); nur Gruende leer'
    '13'='[Rechtsdoku] numer. Codes = ASD-Anrechnungsgruende (2.3)'
    '14'='[Rechtsdoku] GEKLAERT: 280 offiziell entfallen, vor Export pruefen (2.3/3.7)'
    '15'='[Rechtsdoku] GEKLAERT: SalaryPeHour = Schluessel x100 (1.6); Rechtsverh. in StatisticCodes'
    '16'=''
  }
  $prop = @{
    '1'='VORSCHLAG: F=Freisetzung, E=Entfall, L=echte Vertretung (bitte Flags gesamt bestaetigen/ergaenzen)'
    '2'='VORSCHLAG: ja, IDSubst>0 = erteilte Vertretung; Wert-0-Zeilen ausgenommen (bitte bestaetigen)'
    '3'='VORSCHLAG: ja, Selbstvertretung (IDSubst=IDLessn) ausschliessen (bitte bestaetigen)'
    '4'='VORSCHLAG: ja, Events ohne Ausfall-LK (z.B. Zeugnisausgabe) ausschliessen (bitte bestaetigen)'
    '5'=''
    '6'='VORSCHLAG: jede Vertretung = 1,0 zaehlen; SubstValue "0"/"0.000" ausschliessen (bitte bestaetigen)'
    '7'='VORSCHLAG: Dauervertretung steckt im Deputat, nicht zusaetzlich zaehlen (Weg im Export bitte bestaetigen)'
    '8'='VORSCHLAG: ja, Grund ueber AbsenceIds -> Absence -> AbsenceReason (bitte bestaetigen)'
    '9'=''
    '10'='VORSCHLAG: grundlose Typ-101 = Freisetzungen (bitte bestaetigen)'
    '11'='VORSCHLAG: CREDO-Steuergruende (fnz/KV/BE-V/KOR-V) nicht zaehlen, sonst zaehlt Vertretung (s. Blatt 06, bitte bestaetigen)'
    '12'='VORSCHLAG: Teacher-Codes ok; Grund-StatisticCodes optional pflegen (bitte klaeren)'
    '13'='VORSCHLAG: ja, CV_Reason.Name = amtl. ASD-Code (bitte bestaetigen)'
    '14'='VORSCHLAG: 280 nicht verwenden (offiziell entfallen) (bitte bestaetigen)'
    '15'='VORSCHLAG: SalaryPeHour/100 = Schluessel 1-4; Rechtsverhaeltnis in StatisticCodes (bitte bestaetigen)'
    '16'=''
  }
  $rows = @()
  foreach($f in $fragen){ $rows += ,@($f.Nr, $f.Gruppe, $f.Frage, $f.'Warum wichtig (Refinanzierung)', $f.'Bezug (Tabelle/Feld/Blatt)', $prop[$f.Nr], $docNote[$f.Nr]) }
  Write-Table $ws 1 @('Nr','Gruppe','Frage','Warum wichtig (Refinanzierung)','Bezug (Tabelle/Feld/Blatt)','ANTWORT (gruen = VORSCHLAG, bitte bestaetigen)','Quelle / [Rechtsdoku]') $rows @(6) @(1) @(6,13,50,24,18,44,34) @(3,4,5,6,7)
  $ws.Range($ws.Cells.Item(2,7), $ws.Cells.Item(1+$rows.Count,7)).Interior.Color = $cDoc
  for($i=0;$i -lt $rows.Count;$i++){ if($prop[$fragen[$i].Nr] -ne ''){ $ws.Cells.Item(2+$i,6).Interior.Color = $cPropose } }

  # =========================== 02 Substitution Ueberblick ===========================
  $ws = $wb.Worksheets.Item('02_Substitution_Ueberblick')
  $ovRows = @(
    ,@('Substitution-Zeilen gesamt (SJ 2025/2026)', 13196, 'nur Schuljahr 2025/2026, Deleted=FALSE')
    ,@('davon echte Vertretung (TEACHER_IDSubst > 0)', 6408, 'unser Mehrarbeits-Grundfilter')
    ,@('davon mit leerem SubstValue', 6213, 'ca. 97% der Vertretungen -> Zaehlen statt Summieren')
    ,@('Zeitraum von (Date)', 20250827, 'entspricht 27.08.2025')
    ,@('Zeitraum bis (Date)', 20260717, 'entspricht 17.07.2026')
  )
  Write-Table $ws 1 @('Kennzahl','Wert','Erlaeuterung') $ovRows @() @() @(48,14,58) @(3)
  $sr = 9
  Set-Block $ws $sr 1 @(,@('SubstValue-Verteilung (nur echte Vertretungen, SJ 2025/2026)'))
  $ws.Cells.Item($sr,1).Font.Bold = $true
  $svRows = @(
    ,@('(leer / NULL)', 6213, 'Wertigkeit nicht exportiert?')
    ,@('0', 108, 'Text; evtl. "nicht gezaehlt"?')
    ,@('0.000', 77, 'Dezimaltrenner Punkt')
    ,@('1.000', 5, 'Wertigkeit vorhanden')
    ,@('1', 3, 'Wertigkeit vorhanden')
    ,@('0,000', 2, 'Dezimaltrenner Komma (!) - Inkonsistenz')
  )
  Write-Table $ws ($sr+1) @('SubstValue','Anzahl Zeilen','Anmerkung') $svRows @() @(1) @(18,16,45) @(3)
  Note $ws ($sr+9) 3 'NRW-Rechtsdoku (2.3): Wert 0 = NICHT gewertet, 1 = normal. => Zeilen mit SubstValue "0"/"0.000" aus der Zaehlung ausschliessen; NULL vermutlich Standard 1 (Untis-Experte bestaetigen). Siehe Blatt 01/11.'
  $ws.Cells.Item($sr+9,1).Interior.Color = $cDoc

  # =========================== 03 Flag Buchstaben ===========================
  $ws = $wb.Worksheets.Item('03_Flag_Buchstaben')
  Note $ws 1 5 'KERNFRAGE: Bitte je Buchstabe die Bedeutung ergaenzen (gelbe Spalten). Jede Flag-Kombination in Untis setzt sich aus diesen Buchstaben zusammen.'
  $letterRows = @(
    ,@('g (klein)','kommt in ALLEN Flags am Ende vor','konstanter Marker in jeder Zeile','','')
    ,@('L','Lg, BLg, Lsg, LSGg','fast immer MIT Vertreter -> echte Vertretung?','','')
    ,@('F','Fg, FLg, EFLg, BFLg','praktisch NIE mit Vertreter; Rechtsdoku: F = Freisetzung (3.3)','VORSCHLAG: Freisetzung / frei','nein (bitte bestaetigen)')
    ,@('E','ELg, EFLg, Eg, ELRg','praktisch NIE mit Vertreter; Rechtsdoku: -F = Entfall (3.3)','VORSCHLAG: Entfall','nein (bitte bestaetigen)')
    ,@('B','BLg, BLrg, BLrZg, BLZg','meist mit Vertreter -> Bereitschaft/Einsatz?','','')
    ,@('S','SGg, Sg, rSGg','meist mit Vertreter; oft OHNE Absenz (z.B. "Zeugnisausgabe") -> Sondereinsatz/Standby?','','')
    ,@('R (gross)','Rg, LRsg, FRsg','','','')
    ,@('r (klein)','rSGg, Lrg, LrZg, BLrg','','','')
    ,@('s (klein)','Lsg, BLsg, FRsg, SsGg','','','')
    ,@('Z','LZg, LrZg, BLZg, BLrZg','','','')
    ,@('G (gross)','SGg, rSGg, LGg, SWGg','','','')
    ,@('W','SWGg, SWg, rSwg','','','')
    ,@('t (klein)','Ltg, Lstg','','','')
    ,@('M','LMsg, ELMg','','','')
  )
  Write-Table $ws 3 @('Buchstabe','Beispiel-Kombinationen','Beobachtung aus den Daten','Bedeutung laut Untis (bitte ergaenzen)','Zaehlt als uebernommene Mehrarbeit? (ja/nein/kommt drauf an)') $letterRows @(4,5) @() @(12,26,46,34,30) @(2,3,4,5)
  for($rr=4; $rr -le 3+$letterRows.Count; $rr++){ $k=$ws.Cells.Item($rr,1).Value2; if($k -eq 'F' -or $k -eq 'E'){ $ws.Cells.Item($rr,4).Interior.Color=$cPropose; $ws.Cells.Item($rr,5).Interior.Color=$cPropose } }

  # =========================== 04 Flags Kombinationen ===========================
  $ws = $wb.Worksheets.Item('04_Flags_Kombinationen')
  $flagsCsv = @'
Flags|Gesamt|MitVertreter
Lg|3463|3132
ELg|2300|2
Fg|2009|
FLg|1807|
BLg|906|897
SGg|734|717
Lsg|676|675
rSGg|200|200
g|178|25
Rg|113|113
Sg|99|99
EFLg|90|
LZg|85|84
LrZg|70|70
BLrg|45|45
Lrg|35|35
Ltg|34|34
LsZg|32|32
FRsg|29|29
LSGg|25|25
BFLg|20|
BLrZg|16|16
BLZg|14|14
LRsg|12|12
SsGg|12|12
rSg|12|12
SWGg|12|12
ELRg|12|
StGg|11|11
BELg|9|
rSZGg|8|8
BLsg|7|7
BLrsg|7|7
FLRg|6|
BSGg|6|6
Eg|6|
LrsZg|6|6
BLSGg|6|6
ELMg|5|
LGg|5|5
rSwg|5|5
LMsg|5|5
'@
  $flags = $flagsCsv | ConvertFrom-Csv -Delimiter '|'
  $rows = @()
  foreach($f in $flags){
    $mv = if ($f.MitVertreter -ne '') { [int]$f.MitVertreter } else { '' }
    $rows += ,@($f.Flags, [int]$f.Gesamt, $mv, '', '')
  }
  Write-Table $ws 2 @('Flags','Zeilen gesamt','davon mit Vertreter','Art der Vertretung (bitte erlaeutern)','zaehlbare Mehrarbeit? (ja/nein/teilw.)') $rows @(4,5) @(1) @(12,13,16,44,26) @(4,5)
  Note $ws 1 5 'Flag-Kombinationen im SJ 2025/2026 mit >= 5 Vorkommen (42 von 73). Die 31 selteneren (je < 5) sind ausgeblendet. Leere "mit Vertreter"-Zelle = kein echter Vertreter (Entfall/frei).'

  # =========================== 05 Absence TypeA ===========================
  $ws = $wb.Worksheets.Item('05_Absence_TypeA')
  $taRows = @(
    ,@(100, 447, 438, 9, 'meist ganztags/mehrtags, fast immer mit Grund', '', '')
    ,@(101, 2667, 1211, 1456, 'operativer Hauptbestand; 55% OHNE Grund (!)', '', '')
    ,@(102, 109, 49, 60, 'Pruefungs-/Sondertermine?; meist ohne Grund', '', '')
  )
  Write-Table $ws 2 @('TypeA','Zeilen','mit Grund','ohne Grund','Beobachtung (abgeleitet)','Bedeutung des Typs (bitte ergaenzen)','grundpflichtig / automatisch? (bitte ergaenzen)') $taRows @(6,7) @() @(10,10,12,12,42,34,34) @(5,6,7)
  Note $ws 1 7 'Absence im SJ 2025/2026. Kernfrage: Sind die vielen "ohne Grund"-Zeilen bei Typ 101 Freisetzungen (eigene Stunde faellt aus -> traegt keinen Grund) oder Pflegeluecken?'

  # =========================== 06 Abwesenheitsgruende ===========================
  $ws = $wb.Worksheets.Item('06_Abwesenheitsgruende')
  $reasonCsv = @'
Kuerzel|Langname|Verwendung|KategorieVorschlag
SO|Sondertaetigkeit|795|Sondertaetigkeit
K|krank|339|Krankheit
wetter|Unwetter/Hitzefrei|137|Sonstiges
KLA|mehrt. Klassenfahrt|68|Schulveranstaltung
WTG|Wandertag|46|Schulveranstaltung
BESPR|Besprechung|41|Dienstbesprechung
fnz|Freisetzung nicht zaehlen|41|Steuergrund (nicht zaehlen)
EXK|Exkursion|39|Schulveranstaltung
FOR|Fortbildung|26|Fortbildung
BUB|Betreuer f. UB|22|Unterrichtsbesuch
dist|Distanzunterricht|21|Sonstiges
BE-V|beurlaubt (Verrechnung mit Mehrarbeit)|19|Steuergrund (Verrechnung)
BE|beurlaubt|17|Beurlaubung
pob|Praktikum ohne Besuch|13|Praktikum
pmb|Praktikum mit Besuch|12|Praktikum
UB|Unterrichtsbesuch|10|Unterrichtsbesuch
KV|Kein Vertretungsunterricht|9|Steuergrund (nicht zaehlen)
KK-B1|Kind krank Beamte bezahlt|8|Kind krank
KOR-V|Korrekturtag Verrechnung mit Mehrarbeit|8|Steuergrund (Verrechnung)
BE-U|beurlaubt unbezahlt|7|Beurlaubung
sjb|Schuljahresbeginn|6|Schulorganisation
abs|Abschluss Jahrgang 10|6|Schulorganisation
PRIV|private Gruende|4|privat
KK-B2|Kind krank unbezahlt|3|Kind krank
KK-A|Kind krank Angestellte|1|Kind krank
FOR-U|FortbUnbezahlt|0|Fortbildung
KOR|Korrekturtag|0|Korrektur
ZA|Zeugnisausgabe|0|Schulorganisation
'@
  $reasons = $reasonCsv | ConvertFrom-Csv -Delimiter '|'
  $rHint = @{
    'K'='anrechenbarer Ausfall (Krankheit) 1.4'
    'KK-B1'='Krankheit (Kind) - anrechenbar 1.4'
    'KK-B2'='Kind krank unbezahlt - klaeren'
    'KK-A'='Krankheit (Kind) - anrechenbar 1.4'
    'BE'='anrechenbar nur mit Bezuegen (1.4)'
    'BE-U'='unbezahlt -> ggf. nicht anrechenbar'
    'BE-V'='CREDO-Steuergrund: Verrechnung mit Mehrarbeit'
    'KOR-V'='CREDO-Steuergrund: Verrechnung mit Mehrarbeit'
    'fnz'='CREDO-Steuergrund: nicht zaehlen'
    'KV'='CREDO-Steuergrund: keine Vertretung'
    'BESPR'='Betroffener: nicht verguetbar (Besprechung) 1.3'
    'FOR'='Betroffener: nicht verguetbar (Fortbildung) 1.3'
    'FOR-U'='Betroffener: nicht verguetbar (Fortbildung) 1.3'
    'KLA'='Schulfahrt-Begleitung nicht verguetbar 1.3'
    'EXK'='Schulfahrt-Begleitung nicht verguetbar 1.3'
    'WTG'='Schulfahrt-Begleitung nicht verguetbar 1.3'
    'PRIV'='privat -> i.d.R. nicht anrechenbar'
    'SO'='je nach Taetigkeit (Sondertaetigkeit)'
    'UB'='Unterrichtsbesuch - klaeren'
    'BUB'='Betreuung Unterrichtsbesuch - klaeren'
  }
  $steuer = @('fnz','KV','BE-V','KOR-V')
  $rows = @()
  foreach($x in $reasons){
    $h = $rHint[$x.Kuerzel]; if(-not $h){ $h='' }
    $refin = if($steuer -contains $x.Kuerzel){ 'VORSCHLAG: nein - Steuergrund (bitte bestaetigen)' } else { 'VORSCHLAG: ja - Vertretung zaehlt (bitte bestaetigen)' }
    $rows += ,@($x.Kuerzel, $x.Langname, [int]$x.Verwendung, '(leer)', $x.KategorieVorschlag, $h, '', $refin, '')
  }
  Write-Table $ws 2 @('Kuerzel','Langname','Verwendung (Absenzen SJ 25/26)','StatisticCodes','Kategorie (Vorschlag)','Hinweis (NRW-Rechtsdoku)','Kategorie bestaetigt (Experte)','Refinanzierbar? (gruen = VORSCHLAG)','Anmerkung') $rows @(7,9) @(1) @(9,36,15,11,22,30,24,24,20) @(2,5,6,8,9)
  $ws.Range($ws.Cells.Item(3,6), $ws.Cells.Item(2+$rows.Count,6)).Interior.Color = $cDoc
  $ws.Range($ws.Cells.Item(3,8), $ws.Cells.Item(2+$rows.Count,8)).Interior.Color = $cPropose
  Note $ws 1 9 'Abwesenheitsgruende SJ 2025/2026 (ueber Kuerzel dedupliziert). Hinweis-Spalte (blau) = Einordnung lt. NRW-Rechtsdoku. ACHTUNG Perspektive: 1.3/1.4 betreffen die ABWESENDE Kraft (Verguetungssicht); fuer die VERTRETER-Mehrarbeit sind v.a. die CREDO-Steuergruende (fnz/KV/BE-V/KOR-V) entscheidend. StatisticCodes bei allen Gruenden leer.'

  # =========================== 07 CV_Reason ===========================
  $ws = $wb.Worksheets.Item('07_Anrechnungen_CV_Reason')
  $cvCsv = @'
Code|Langname|Hinweis
100|Beschaeftigungsphase Sabbatjahr|
110|Mehrarbeit (angeordnet und regelmaessig)|vermutlich zentral fuer Mehrarbeit
150|Aufrundung der Pflichtstundenzahl wegen Abrundung im folgenden Schuljahr|
160|Ueberschreitung der Pflichtstundenzahl aus organisatorischen Gruenden (z.B. Epochenunterricht)|
170|Ueberschreitung der Pflichtstundenzahl wegen Pflichtstunden-Bandbreite|
200|Pflichtstundenermaessigung nach Vollendung des 55. bzw. 60. Lebensjahres|
210|Pflichtstundenermaessigung wegen Schwerbehinderung (Regelermaessigung)|
220|Pflichtstundenermaessigung wegen Schwerbehinderung (Erhoehung auf Antrag)|
230|Beurlaubung (auch Elternzeit), Rueckkehr im Laufe des Schuljahres|
240|Langfristige Erkrankung|
250|Abwesend wegen Beschaeftigungsverbot gem. Paragraph 3 MuSchG|
260|Wiedereingliederungsmassnahme|
270|Rueckgabe vorgeleisteter Stunden wegen Nichtinanspruchnahme von Altersteilzeit|
280|Berufsbegleitender Vorbereitungsdienst (Seiteneinsteigerentlastung)|OFFIZIELL ENTFALLEN - bestaetigt NRW-Rechtsdoku 2.3/3.7 - nicht mehr verwenden
290|Freistellungsphase Sabbatjahr|
300|Besondere persoenliche Gruende (nur mit Genehmigung der oberen Schulaufsichtsbehoerde)|
350|Abrundung der Pflichtstundenzahl wegen Aufrundung im vorhergehenden Schuljahr|
360|Unterschreitung der Pflichtstundenzahl aus organisatorischen Gruenden (z.B. Epochenunterricht)|
370|Unterschreitung der Pflichtstundenzahl wegen Pflichtstunden-Bandbreite|
500|Wahrnehmung besonderer schulischer Aufgaben|
510|Entlastung fuer Schulleitungstaetigkeiten|
520|Schueluebergreifende Aufgaben kleineren Umfangs|
530|SV-Verbindungslehrer, Beratungslehrer|
550|Laufbahnberatung und -kontrolle in der gymnasialen Oberstufe|
600|Gemeinsamer Unterricht (Teamabsprachen, Unterrichtsvorbereitung)|
605|Fachleiter an Studienseminaren|
610|Lehrerratstaetigkeit|
615|Schwerbehindertenvertretung|
625|Fortbildungslehrgaenge fuer technische Lehrer aus Entwicklungslaendern|
635|Fortbildung und Qualifikation, Medien und Datenschutz|
640|Fachberater Schulaufsicht/Verband|
675|Nachmittagsangebot|
850|Foerderung lernschwacher und begabter Schuelerinnen und Schueler|
860|Einstiegshilfen in Beruf/Ausbildung|
875|Landes- und Bundeswettbewerbe, Landesschuelertheater|
900|Ausbildungskoordination|
930|Einsatz als Sozialpaedagogische Fachkraft|
945|Lehrerwochenstunden, die nicht verplant sind (z.B. Vertretungsreserve)|evtl. relevant (Vertretungsreserve)
950|Entlastung fuer die Klassenleitung|
970|sonstige nichtunterrichtliche Taetigkeiten (mit Genehmigung des Schultraegers)|
'@
  $cv = $cvCsv | ConvertFrom-Csv -Delimiter '|'
  $rows = @()
  foreach($x in $cv){
    $rel = ''
    if($x.Code -eq '110'){ $rel='VORSCHLAG: ja - Mehrarbeit (bitte bestaetigen)' }
    elseif($x.Code -eq '280'){ $rel='VORSCHLAG: nein - offiziell entfallen (bitte bestaetigen)' }
    elseif($x.Code -eq '945'){ $rel='VORSCHLAG: evtl. - Vertretungsreserve (bitte bestaetigen)' }
    $rows += ,@($x.Code, $x.Langname, $x.Hinweis, '', $rel, '')
  }
  Write-Table $ws 2 @('Code (Name)','Langname (amtlich)','Hinweis von uns','Im Bestand aktiv genutzt? (j/n)','Relevant fuer Mehrarbeit/Verrechnung? (gruen = VORSCHLAG)','Anmerkung') $rows @(4,5,6) @(1) @(11,58,26,20,26,24) @(2,3,5,6)
  for($rr=3; $rr -le 2+$cv.Count; $rr++){ $cd=$ws.Cells.Item($rr,1).Text; if($cd -eq '110' -or $cd -eq '280' -or $cd -eq '945'){ $ws.Cells.Item($rr,5).Interior.Color=$cPropose } }
  Note $ws 1 6 'CV_Reason (CountValue-Gruende): das Name-Feld IST der amtliche NRW-Anrechnungscode. StatisticCodes-Spalte trotzdem leer. Liste ist jahresunabhaengig; welche Codes werden real genutzt?'

  # =========================== 08 SalaryPeHour ===========================
  $ws = $wb.Worksheets.Item('08_SalaryPeHour')
  $salRows = @(
    ,@(0, 4, 'kein Schluessel gepflegt', 'VORSCHLAG: nicht gepflegt (bitte bestaetigen)', '')
    ,@(200, 36, 'Schluessel 2: geh. Dienst ab A12 / hoeh. Dienst GS/HS (~31 EUR) - Rechtsdoku 1.6', 'VORSCHLAG: Schluessel 2 (bitte bestaetigen)', '')
    ,@(400, 53, 'Schluessel 4: hoeherer Dienst GY/BK (~38 EUR) - Rechtsdoku 1.6', 'VORSCHLAG: Schluessel 4 (bitte bestaetigen)', '')
  )
  Write-Table $ws 2 @('SalaryPeHour','Lehrkraefte (distinct, SJ 25/26)','Bedeutung lt. NRW-Rechtsdoku (SalaryPeHour / 100 = Schluessel 1-4)','Bestaetigung (gruen = VORSCHLAG)','Anmerkung') $salRows @(5) @() @(14,26,54,32,24) @(3,4,5)
  $ws.Range($ws.Cells.Item(3,3), $ws.Cells.Item(5,3)).Interior.Color = $cDoc
  $ws.Range($ws.Cells.Item(3,4), $ws.Cells.Item(5,4)).Interior.Color = $cPropose
  Note $ws 1 5 'Teacher.SalaryPeHour im SJ 2025/2026: {0,200,400}. Laut NRW-Rechtsdoku (1.6) = Verguetungsschluessel x100 (1 geh.Dienst ~26, 2 ~31, 3 ~35, 4 hoeh.Dienst GY/BK ~38 EUR). Wert 100 (=Schluessel 1) nur in Altjahren. Nur fuer den Euro-/Verguetungs-Pfad, nicht fuer das Stellenist.'
  $rv = 8
  Set-Block $ws $rv 1 @(,@('Teacher.StatisticCodes = Rechtsverhaeltnis (SJ 2025/2026) - HIER steht Beamter/Angestellter (NICHT in Status)'))
  $ws.Cells.Item($rv,1).Font.Bold = $true; $ws.Cells.Item($rv,1).Interior.Color = $cDoc
  $rvRows = @(
    ,@('L / LT', 35, 'Beamter auf Lebenszeit (LT = Teilzeit)')
    ,@('P / PT', 24, 'Beamter auf Probe (PT = Teilzeit)')
    ,@('U / UT', 19, 'Angestellte unbefristet TV-L (UT = Teilzeit)')
    ,@('B / BT', 26, 'Angestellte befristet TV-L (BT = Teilzeit)')
    ,@('(leer)', 5, 'kein Rechtsverhaeltnis gepflegt')
  )
  Write-Table $ws ($rv+1) @('StatisticCodes','Lehrkraefte','Bedeutung (NRW-Rechtsdoku 1.7)') $rvRows @() @(1) @(16,14,52) @(3)

  # =========================== 09 Beispielzeilen (angereichert) ===========================
  $ws = $wb.Worksheets.Item('09_Beispielzeilen')
  $sample = Import-Csv -Path $SampleCsv -Delimiter '|' -Encoding UTF8
  $rows = @()
  foreach($s in $sample){
    $rows += ,@($s.Block, $s.Datum, [int]$s.Std, $s.Klasse, $s.Fach, $s.Vertreter, $s.AusfallLK, $s.Grund, $s.Flags, $s.Beobachtung, [int]$s.IDSubst, [int]$s.IDLessn, $s.AbsenceIds, $s.SubstValue, '')
  }
  Write-Table $ws 2 @('Block','Datum','Std','Klasse','Fach','Vertreter (Kuerzel)','Ausfall-LK (Kuerzel)','Grund / Text','Flags','Beobachtung von uns','IDSubst','IDLessn','AbsenceIds','SubstValue','zaehlbare Mehrarbeit? (Experte)') $rows @(15) @(2,4,5,13,14) @(11,11,5,7,7,12,12,26,9,34,9,9,11,10,26) @(8,10,15)
  Note $ws 1 15 'Echte Vertretungszeilen (SJ 2025/2026) mit aufgeloesten Kuerzeln, Klasse, Fach und Grund - so wie in der Untis-Vertretungsliste. "Typisch" = 30.06.2026 (Regelbetrieb); "Sonderfall" = Selbstvertretung / Event (17.07.2026, Zeugnisausgabe).'

  # =========================== 10 Feldreferenz ===========================
  $ws = $wb.Worksheets.Item('10_Feldreferenz')
  $fieldRows = @(
    ,@('Substitution','Date','YYYYMMDD-Integer (Tagesdatum der Vertretung)','')
    ,@('Substitution','SCHOOLYEAR_ID','Schuljahr; 2025/2026 = 20252026','')
    ,@('Substitution','TEACHER_IDSubst','ID des Vertreters; > 0 = echte Vertretung','')
    ,@('Substitution','TEACHER_IDLessn','ID der ausgefallenen/originalen Lehrkraft; 0 = keine','')
    ,@('Substitution','Lesson','Stundennummer am Tag','')
    ,@('Substitution','Flags','Kennzeichnungs-String (Art der Vertretung) - siehe Blatt 03','')
    ,@('Substitution','BookingType','durchgaengig 0 -> unklar ob genutzt','')
    ,@('Substitution','SubstValue','Wertigkeit; zu 97% leer -> vermutlich nicht nutzbar','')
    ,@('Substitution','SUBJECT_IDSubst','Fach der Vertretung -> Subjects.Name','')
    ,@('Substitution','ClassIds','Klasse(n) der Vertretung, Format ,ID, -> Class.Name','')
    ,@('Substitution','AbsenceIds','Verweis auf Absence.ABSENCE_ID (ausloesende Absenz)','')
    ,@('Absence','ABSENCE_ID','Schluessel, auf den Substitution.AbsenceIds zeigt','')
    ,@('Absence','IDA','Lehrer-ID der abwesenden Kraft','')
    ,@('Absence','TypeA','Absenztyp 100/101/102 (Bedeutung offen)','')
    ,@('Absence','ABSENCE_REASON_ID','Verweis auf AbsenceReason; 0/leer = ohne Grund','')
    ,@('AbsenceReason','Name / Longname','Kuerzel + Klartext des Abwesenheitsgrundes','')
    ,@('CV_Reason','Name','amtlicher NRW-Anrechnungscode (z.B. 110, 280, 945)','')
    ,@('Teacher','SalaryPeHour','Verguetungsschluessel x100 {0,200,400} (frueher auch 100) - Rechtsdoku 1.6','')
    ,@('Teacher','StatisticCodes','Rechtsverhaeltnis L/P/U/B (T=Teilzeit) - GEPFLEGT (Status dagegen leer) - Rechtsdoku 1.7','')
    ,@('Teacher','PlannedWeek','Wochendeputat x1000 (25500 -> 25,5 Std.)','')
    ,@('Teacher','Name / PNumber','Kuerzel / Personalnummer','')
  )
  Write-Table $ws 1 @('Tabelle','Feld','Unser Verstaendnis','Korrektur / Ergaenzung (Experte)') $fieldRows @(4) @() @(16,20,58,40) @(3,4)

  # =========================== 11 Rechtsdoku-Abgleich ===========================
  $ws = $wb.Worksheets.Item('11_Rechtsdoku_Abgleich')
  $abgleichCsv = @'
Nr|Thema|Was die NRW-Rechtsdoku sagt (Fundstelle)|Status|Bleibt offen fuer Untis-Experten
1|Flags / Vertretungsart|Kennt konzeptionell Art V=Vertretung, F=Freisetzung, -F=Entfall (3.3); trennt verguetbare Unterrichtstaetigkeit von nicht verguetbaren (Konferenz/Fortbildung/Schulfahrt, 1.3). Stuetzt F=frei, E=Entfall.|teilw. geklaert|Exakte Decodierung ALLER Flag-Buchstaben im DB-Export
2|Filter IDSubst>0|Nur erteilter Unterricht ueber Soll zaehlt (1.3); Betreuung mit Wert 0 zaehlt nicht (2.1 P5).|teilw. geklaert|Bestaetigen: IDSubst>0 = erteilte Vertretung
3|Selbstvertretung|Mehrarbeit = Unterricht der vertretenden Kraft ueber ihr Soll; Selbstvertretung ist kein Zusatzeinsatz.|Hinweis|Bestaetigen: IDSubst=IDLessn ausschliessen
4|Event ohne Ausfall-LK|Nicht verguetbar: Feste, Konferenzen, Aufsichten (1.3). Zeugnisausgabe = Sondereinsatz.|Hinweis|Bestaetigen: IDLessn=0 / Event ausschliessen
5|BookingType=0|Doku nennt Statistik-Kz (Sondereinsatz 0-8) und Wert; BookingType nicht erwaehnt.|offen|Bedeutung/Nutzung von BookingType
6|SubstValue / Wert|Wert 0 = NICHT gewertet, 1 = normal (2.3 / 3.3 / VAL-005). => "0"-Zeilen ausschliessen; NULL vermutlich Standard 1.|teilw. geklaert|NULL-Bedeutung (Standard 1?) bestaetigen
7|Dauer- vs Tagesvertretung|Mehrarbeit immer IST ueber individuellem Soll (UVD); Dauervertretung steckt im Soll.|Hinweis|DB-Unterscheidung Dauer-/Tagesvertretung
8|AbsenceIds -> Grund|ABSENZ traegt Grund + Art (anrechenbar/nicht) (3.3). Verknuepfung sinnvoll bestaetigt.|bestaetigt|nur formale Bestaetigung
9|TypeA 100/101/102|Doku kennt keine TypeA-Nummern; nur anrechenbar/nicht anrechenbar (1.4).|offen|Bedeutung 100/101/102
10|Typ 101 ohne Grund|Doku kennt Freisetzung als eigene Kategorie (1.5 / 2.1 P4). Grundlos = evtl. Freisetzung.|Hinweis|Freisetzung vs Pflegeluecke bestaetigen
11|Grund-Mapping|Anrechenbar = Krankheit, Beurlaubung m. Bezuegen, Ferien/Feiertage, Dienstbefreiung (1.4). Nicht verguetbar (fuer Betroffenen) = Konferenz/Besprechung, Fortbildung, Schulfahrt-Begleitung, Aufsichten (1.3).|teilw. geklaert (Blatt 06)|Uebertragung auf VERTRETER-Sicht + CREDO-Steuergruende
12|StatisticCodes leer|Teacher.StatisticCodes IST gepflegt (L/P/U/B, T=Teilzeit)! Nur AbsenceReason/CV_Reason leer. Gruende brauchen laut Doku UntStat/ASD-Zuordnung (2.3).|teilw. geklaert|Sollen Grund-StatisticCodes gepflegt werden?
13|CV_Reason Codes|Numerische Codes = ASD-Anrechnungsgruende; 280 offiziell entfallen (2.3 / 3.7).|bestaetigt|welche Codes real genutzt
14|Code 280|280 existiert offiziell nicht mehr, kann in Altdateien stehen -> vor Export pruefen/zuordnen, nicht verwenden (2.3 / 3.7).|GEKLAERT|-
15|SalaryPeHour|Verguetungsschluessel 1-4 nach Besoldung (1.6): 1 geh.Dienst ~26, 2 ~31, 3 ~35, 4 hoeh.Dienst GY/BK ~38 EUR. SalaryPeHour = Schluessel x100. Rechtsverhaeltnis in Teacher.StatisticCodes.|GEKLAERT|nur Bestaetigung
16|Schulzuordnung|Personalkosten bis Hoehe vergleichbarer oeffentl. Schule (1.8); keine klare Unterrichts- vs Stammschul-Regel.|offen (intern)|Untis-Beziehung Vertretung -> Schule
Z1|ZUSATZ Bagatellgrenze|Verguetung Vollzeit ab 3 Std/Monat, max 24/Monat, 288/Jahr; Teilzeit 3 x Quote seit 07.06.2025 (1.4/1.5). Gilt nur fuer den Euro-/Verguetungs-Pfad, NICHT fuer das Stellenist.|Info|bestaetigt: Stellenist ohne Bagatellgrenze
Z2|ZUSATZ Verrechnungszeitraum|Vollzeit = Kalendermonat, Teilzeit = Kalenderwoche (1.4/1.5).|Info|fuer Verguetungs-Pfad
Z3|ZUSATZ Freisetzungen|Reduzieren Mehrarbeit (Vollzeit); Teilzeit erst ab Vollzeitgrenze (1.5 / 3.2).|Info|fuer Verguetungs-Pfad
'@
  $abgleich = $abgleichCsv | ConvertFrom-Csv -Delimiter '|'
  $rows = @()
  foreach($a in $abgleich){ $rows += ,@($a.Nr, $a.Thema, $a.'Was die NRW-Rechtsdoku sagt (Fundstelle)', $a.Status, $a.'Bleibt offen fuer Untis-Experten') }
  Write-Table $ws 2 @('Nr','Thema','Was die NRW-Rechtsdoku sagt (Fundstelle)','Status','Bleibt offen fuer Untis-Experten') $rows @() @(1) @(6,24,72,16,40) @(2,3,5)
  $ws.Range($ws.Cells.Item(3,3), $ws.Cells.Item(2+$rows.Count,3)).Interior.Color = $cDoc
  Note $ws 1 5 'Abgleich unserer Fragen (Blatt 01) gegen die NRW-Rechtsdoku (Stand 17.06.2026). Blaue Spalte = aus der Rechtsdoku. GEKLAERT = brauchen wir vom Experten nur noch als Bestaetigung; offen = weiterhin Untis-Wissen noetig.'

  $wb.Worksheets.Item('00_Anleitung').Activate()
  $wb.SaveAs($OutFile, $xlOpenXML)
  Write-Output ("OK gespeichert: " + $OutFile)
  Write-Output ("Blaetter: " + $wb.Worksheets.Count)
}
catch {
  Write-Output ("FEHLER: " + $_.Exception.Message + " @ Zeile " + $_.InvocationInfo.ScriptLineNumber)
  throw
}
finally {
  if ($wb) { $wb.Close($false) }
  $xl.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
