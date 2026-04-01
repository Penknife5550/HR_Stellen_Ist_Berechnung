CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tabelle" varchar(50) NOT NULL,
	"datensatz_id" integer NOT NULL,
	"aktion" varchar(20) NOT NULL,
	"alte_werte" jsonb,
	"neue_werte" jsonb,
	"benutzer" varchar(100),
	"zeitpunkt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benutzer" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(200) NOT NULL,
	"passwort_hash" varchar(200) NOT NULL,
	"name" varchar(200) NOT NULL,
	"rolle" varchar(20) DEFAULT 'betrachter' NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"letzter_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benutzer_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "berechnung_stellenist" (
	"id" serial PRIMARY KEY NOT NULL,
	"schule_id" integer NOT NULL,
	"haushaltsjahr_id" integer NOT NULL,
	"zeitraum" varchar(10) NOT NULL,
	"monats_durchschnitt_stunden" numeric(10, 4),
	"regelstundendeputat" numeric(6, 2),
	"stellenist" numeric(8, 4) NOT NULL,
	"stellenist_gerundet" numeric(8, 1) NOT NULL,
	"mehrarbeit_stellen" numeric(8, 4) DEFAULT '0' NOT NULL,
	"stellenist_gesamt" numeric(8, 1) NOT NULL,
	"details" jsonb,
	"berechnet_am" timestamp with time zone DEFAULT now() NOT NULL,
	"berechnet_von" varchar(100),
	"ist_aktuell" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "berechnung_stellensoll" (
	"id" serial PRIMARY KEY NOT NULL,
	"schule_id" integer NOT NULL,
	"haushaltsjahr_id" integer NOT NULL,
	"zeitraum" varchar(10) NOT NULL,
	"grundstellen_details" jsonb NOT NULL,
	"grundstellen_summe" numeric(8, 2) NOT NULL,
	"grundstellen_gerundet" numeric(8, 1) NOT NULL,
	"zuschlaege_summe" numeric(8, 4) DEFAULT '0' NOT NULL,
	"zuschlaege_details" jsonb,
	"stellensoll" numeric(8, 1) NOT NULL,
	"berechnet_am" timestamp with time zone DEFAULT now() NOT NULL,
	"berechnet_von" varchar(100),
	"ist_aktuell" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "berechnung_vergleich" (
	"id" serial PRIMARY KEY NOT NULL,
	"schule_id" integer NOT NULL,
	"haushaltsjahr_id" integer NOT NULL,
	"stellensoll_id" integer,
	"stellenist_id" integer,
	"stellensoll" numeric(8, 1) NOT NULL,
	"stellenist" numeric(8, 1) NOT NULL,
	"differenz" numeric(8, 1) NOT NULL,
	"status" varchar(20) NOT NULL,
	"refinanzierung" numeric(8, 1),
	"berechnet_am" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deputat_aenderungen" (
	"id" serial PRIMARY KEY NOT NULL,
	"lehrer_id" integer NOT NULL,
	"haushaltsjahr_id" integer NOT NULL,
	"monat" integer NOT NULL,
	"deputat_gesamt_alt" numeric(8, 3),
	"deputat_ges_alt" numeric(8, 3),
	"deputat_gym_alt" numeric(8, 3),
	"deputat_bk_alt" numeric(8, 3),
	"deputat_gesamt_neu" numeric(8, 3),
	"deputat_ges_neu" numeric(8, 3),
	"deputat_gym_neu" numeric(8, 3),
	"deputat_bk_neu" numeric(8, 3),
	"aenderungstyp" varchar(30) NOT NULL,
	"ist_gehaltsrelevant" boolean DEFAULT false NOT NULL,
	"term_id_alt" integer,
	"term_id_neu" integer,
	"geaendert_am" timestamp with time zone DEFAULT now() NOT NULL,
	"tatsaechliches_datum" date,
	"datum_korrigiert_von" varchar(100),
	"datum_korrigiert_am" timestamp with time zone,
	"nachtrag_status" varchar(20),
	"nachtrag_erstellt_am" timestamp with time zone,
	"nachtrag_erstellt_von" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "deputat_monatlich" (
	"id" serial PRIMARY KEY NOT NULL,
	"lehrer_id" integer NOT NULL,
	"haushaltsjahr_id" integer NOT NULL,
	"monat" integer NOT NULL,
	"deputat_gesamt" numeric(8, 3),
	"deputat_ges" numeric(8, 3) DEFAULT '0',
	"deputat_gym" numeric(8, 3) DEFAULT '0',
	"deputat_bk" numeric(8, 3) DEFAULT '0',
	"quelle" varchar(20) DEFAULT 'untis',
	"untis_schoolyear_id" integer,
	"untis_term_id" integer,
	"sync_datum" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deputat_monatlich_unique" UNIQUE("lehrer_id","haushaltsjahr_id","monat")
);
--> statement-breakpoint
CREATE TABLE "deputat_sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_datum" timestamp with time zone DEFAULT now() NOT NULL,
	"schuljahr_text" varchar(20),
	"term_id" integer,
	"anzahl_lehrer" integer,
	"anzahl_aenderungen" integer,
	"status" varchar(20) DEFAULT 'success' NOT NULL,
	"fehler_details" text,
	"rohdaten" jsonb
);
--> statement-breakpoint
CREATE TABLE "haushaltsjahre" (
	"id" serial PRIMARY KEY NOT NULL,
	"jahr" integer NOT NULL,
	"stichtag_vorjahr" date,
	"stichtag_laufend" date,
	"gesperrt" boolean DEFAULT false NOT NULL,
	CONSTRAINT "haushaltsjahre_jahr_unique" UNIQUE("jahr")
);
--> statement-breakpoint
CREATE TABLE "lehrer" (
	"id" serial PRIMARY KEY NOT NULL,
	"untis_teacher_id" integer NOT NULL,
	"personalnummer" varchar(20),
	"name" varchar(50) NOT NULL,
	"vollname" varchar(200) NOT NULL,
	"stammschule_id" integer,
	"stammschule_code" varchar(10),
	"aktiv" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lehrer_untis_teacher_id_unique" UNIQUE("untis_teacher_id")
);
--> statement-breakpoint
CREATE TABLE "mehrarbeit" (
	"id" serial PRIMARY KEY NOT NULL,
	"lehrer_id" integer NOT NULL,
	"haushaltsjahr_id" integer NOT NULL,
	"monat" integer NOT NULL,
	"stunden" numeric(8, 2) DEFAULT '0' NOT NULL,
	"schule_id" integer,
	"bemerkung" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mehrarbeit_unique" UNIQUE("lehrer_id","haushaltsjahr_id","monat","schule_id")
);
--> statement-breakpoint
CREATE TABLE "regeldeputate" (
	"id" serial PRIMARY KEY NOT NULL,
	"schulform_code" varchar(10) NOT NULL,
	"schulform_name" varchar(100) NOT NULL,
	"regeldeputat" numeric(4, 1) NOT NULL,
	"rechtsgrundlage" varchar(300),
	"bass_fundstelle" varchar(100),
	"gueltig_ab" date,
	"bemerkung" text,
	"aktiv" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regeldeputate_unique" UNIQUE("schulform_code")
);
--> statement-breakpoint
CREATE TABLE "schuelerzahlen" (
	"id" serial PRIMARY KEY NOT NULL,
	"schule_id" integer NOT NULL,
	"schul_stufe_id" integer NOT NULL,
	"stichtag" date NOT NULL,
	"anzahl" integer NOT NULL,
	"bemerkung" text,
	"erfasst_von" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schuelerzahlen_unique" UNIQUE("schule_id","schul_stufe_id","stichtag")
);
--> statement-breakpoint
CREATE TABLE "schul_stufen" (
	"id" serial PRIMARY KEY NOT NULL,
	"schule_id" integer NOT NULL,
	"stufe" varchar(50) NOT NULL,
	"schulform_typ" varchar(50) NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	CONSTRAINT "schul_stufen_unique" UNIQUE("schule_id","stufe")
);
--> statement-breakpoint
CREATE TABLE "schulen" (
	"id" serial PRIMARY KEY NOT NULL,
	"schulnummer" varchar(10) NOT NULL,
	"name" varchar(200) NOT NULL,
	"kurzname" varchar(10) NOT NULL,
	"untis_code" varchar(10),
	"schulform" varchar(50) NOT NULL,
	"adresse" varchar(300),
	"plz" varchar(5),
	"ort" varchar(100),
	"farbe" varchar(7) DEFAULT '#575756' NOT NULL,
	"ist_im_aufbau" boolean DEFAULT false NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schulen_schulnummer_unique" UNIQUE("schulnummer")
);
--> statement-breakpoint
CREATE TABLE "schuljahre" (
	"id" serial PRIMARY KEY NOT NULL,
	"bezeichnung" varchar(20) NOT NULL,
	"start_datum" date NOT NULL,
	"end_datum" date NOT NULL,
	"untis_schoolyear_id" integer,
	"aktiv" boolean DEFAULT true NOT NULL,
	CONSTRAINT "schuljahre_bezeichnung_unique" UNIQUE("bezeichnung"),
	CONSTRAINT "schuljahre_untis_schoolyear_id_unique" UNIQUE("untis_schoolyear_id")
);
--> statement-breakpoint
CREATE TABLE "slr_historie" (
	"id" serial PRIMARY KEY NOT NULL,
	"slr_wert_id" integer NOT NULL,
	"schuljahr_id" integer NOT NULL,
	"schulform_typ" varchar(50) NOT NULL,
	"relation_alt" numeric(6, 2) NOT NULL,
	"relation_neu" numeric(6, 2) NOT NULL,
	"quelle_alt" varchar(200),
	"quelle_neu" varchar(200),
	"grund" text,
	"geaendert_von" varchar(100) NOT NULL,
	"geaendert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slr_werte" (
	"id" serial PRIMARY KEY NOT NULL,
	"schuljahr_id" integer NOT NULL,
	"schulform_typ" varchar(50) NOT NULL,
	"relation" numeric(6, 2) NOT NULL,
	"quelle" varchar(200),
	"geaendert_von" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slr_werte_unique" UNIQUE("schuljahr_id","schulform_typ")
);
--> statement-breakpoint
CREATE TABLE "zuschlaege" (
	"id" serial PRIMARY KEY NOT NULL,
	"schule_id" integer NOT NULL,
	"haushaltsjahr_id" integer NOT NULL,
	"zuschlag_art_id" integer NOT NULL,
	"wert" numeric(8, 4) NOT NULL,
	"zeitraum" varchar(10) DEFAULT 'ganzjahr' NOT NULL,
	"bemerkung" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zuschlaege_unique" UNIQUE("schule_id","haushaltsjahr_id","zuschlag_art_id","zeitraum")
);
--> statement-breakpoint
CREATE TABLE "zuschlag_arten" (
	"id" serial PRIMARY KEY NOT NULL,
	"bezeichnung" varchar(100) NOT NULL,
	"beschreibung" text,
	"ist_standard" boolean DEFAULT false NOT NULL,
	"sortierung" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "zuschlag_arten_bezeichnung_unique" UNIQUE("bezeichnung")
);
--> statement-breakpoint
ALTER TABLE "berechnung_stellenist" ADD CONSTRAINT "berechnung_stellenist_schule_id_schulen_id_fk" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berechnung_stellenist" ADD CONSTRAINT "berechnung_stellenist_haushaltsjahr_id_haushaltsjahre_id_fk" FOREIGN KEY ("haushaltsjahr_id") REFERENCES "public"."haushaltsjahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berechnung_stellensoll" ADD CONSTRAINT "berechnung_stellensoll_schule_id_schulen_id_fk" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berechnung_stellensoll" ADD CONSTRAINT "berechnung_stellensoll_haushaltsjahr_id_haushaltsjahre_id_fk" FOREIGN KEY ("haushaltsjahr_id") REFERENCES "public"."haushaltsjahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berechnung_vergleich" ADD CONSTRAINT "berechnung_vergleich_schule_id_schulen_id_fk" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berechnung_vergleich" ADD CONSTRAINT "berechnung_vergleich_haushaltsjahr_id_haushaltsjahre_id_fk" FOREIGN KEY ("haushaltsjahr_id") REFERENCES "public"."haushaltsjahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berechnung_vergleich" ADD CONSTRAINT "berechnung_vergleich_stellensoll_id_berechnung_stellensoll_id_fk" FOREIGN KEY ("stellensoll_id") REFERENCES "public"."berechnung_stellensoll"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berechnung_vergleich" ADD CONSTRAINT "berechnung_vergleich_stellenist_id_berechnung_stellenist_id_fk" FOREIGN KEY ("stellenist_id") REFERENCES "public"."berechnung_stellenist"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deputat_aenderungen" ADD CONSTRAINT "deputat_aenderungen_lehrer_id_lehrer_id_fk" FOREIGN KEY ("lehrer_id") REFERENCES "public"."lehrer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deputat_aenderungen" ADD CONSTRAINT "deputat_aenderungen_haushaltsjahr_id_haushaltsjahre_id_fk" FOREIGN KEY ("haushaltsjahr_id") REFERENCES "public"."haushaltsjahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deputat_monatlich" ADD CONSTRAINT "deputat_monatlich_lehrer_id_lehrer_id_fk" FOREIGN KEY ("lehrer_id") REFERENCES "public"."lehrer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deputat_monatlich" ADD CONSTRAINT "deputat_monatlich_haushaltsjahr_id_haushaltsjahre_id_fk" FOREIGN KEY ("haushaltsjahr_id") REFERENCES "public"."haushaltsjahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lehrer" ADD CONSTRAINT "lehrer_stammschule_id_schulen_id_fk" FOREIGN KEY ("stammschule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mehrarbeit" ADD CONSTRAINT "mehrarbeit_lehrer_id_lehrer_id_fk" FOREIGN KEY ("lehrer_id") REFERENCES "public"."lehrer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mehrarbeit" ADD CONSTRAINT "mehrarbeit_haushaltsjahr_id_haushaltsjahre_id_fk" FOREIGN KEY ("haushaltsjahr_id") REFERENCES "public"."haushaltsjahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mehrarbeit" ADD CONSTRAINT "mehrarbeit_schule_id_schulen_id_fk" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schuelerzahlen" ADD CONSTRAINT "schuelerzahlen_schule_id_schulen_id_fk" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schuelerzahlen" ADD CONSTRAINT "schuelerzahlen_schul_stufe_id_schul_stufen_id_fk" FOREIGN KEY ("schul_stufe_id") REFERENCES "public"."schul_stufen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schul_stufen" ADD CONSTRAINT "schul_stufen_schule_id_schulen_id_fk" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slr_historie" ADD CONSTRAINT "slr_historie_slr_wert_id_slr_werte_id_fk" FOREIGN KEY ("slr_wert_id") REFERENCES "public"."slr_werte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slr_historie" ADD CONSTRAINT "slr_historie_schuljahr_id_schuljahre_id_fk" FOREIGN KEY ("schuljahr_id") REFERENCES "public"."schuljahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slr_werte" ADD CONSTRAINT "slr_werte_schuljahr_id_schuljahre_id_fk" FOREIGN KEY ("schuljahr_id") REFERENCES "public"."schuljahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuschlaege" ADD CONSTRAINT "zuschlaege_schule_id_schulen_id_fk" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuschlaege" ADD CONSTRAINT "zuschlaege_haushaltsjahr_id_haushaltsjahre_id_fk" FOREIGN KEY ("haushaltsjahr_id") REFERENCES "public"."haushaltsjahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuschlaege" ADD CONSTRAINT "zuschlaege_zuschlag_art_id_zuschlag_arten_id_fk" FOREIGN KEY ("zuschlag_art_id") REFERENCES "public"."zuschlag_arten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_tabelle" ON "audit_log" USING btree ("tabelle","datensatz_id");--> statement-breakpoint
CREATE INDEX "idx_berechnung_stellenist_aktuell" ON "berechnung_stellenist" USING btree ("schule_id","haushaltsjahr_id") WHERE ist_aktuell = true;--> statement-breakpoint
CREATE INDEX "idx_berechnung_stellensoll_aktuell" ON "berechnung_stellensoll" USING btree ("schule_id","haushaltsjahr_id") WHERE ist_aktuell = true;--> statement-breakpoint
CREATE INDEX "idx_deputat_aenderungen_lehrer" ON "deputat_aenderungen" USING btree ("lehrer_id","haushaltsjahr_id");--> statement-breakpoint
CREATE INDEX "idx_deputat_aenderungen_gehaltsrelevant" ON "deputat_aenderungen" USING btree ("haushaltsjahr_id","ist_gehaltsrelevant") WHERE ist_gehaltsrelevant = true;--> statement-breakpoint
CREATE INDEX "idx_deputat_monatlich_lehrer" ON "deputat_monatlich" USING btree ("lehrer_id");--> statement-breakpoint
CREATE INDEX "idx_deputat_monatlich_hj_monat" ON "deputat_monatlich" USING btree ("haushaltsjahr_id","monat");--> statement-breakpoint
CREATE INDEX "idx_lehrer_stammschule" ON "lehrer" USING btree ("stammschule_id");--> statement-breakpoint
CREATE INDEX "idx_schuelerzahlen_stichtag" ON "schuelerzahlen" USING btree ("stichtag");--> statement-breakpoint
CREATE INDEX "idx_schuelerzahlen_schule" ON "schuelerzahlen" USING btree ("schule_id");--> statement-breakpoint
CREATE INDEX "idx_slr_historie_slr_wert" ON "slr_historie" USING btree ("slr_wert_id");--> statement-breakpoint
CREATE INDEX "idx_slr_historie_schuljahr" ON "slr_historie" USING btree ("schuljahr_id");