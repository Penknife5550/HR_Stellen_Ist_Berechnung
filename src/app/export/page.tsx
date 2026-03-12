import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileDown } from "lucide-react";

export default function ExportPage() {
  return (
    <PageContainer>
      <Header
        title="Export"
        subtitle="Berichte für die Bezirksregierung und interne Dokumentation"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Export" },
        ]}
      />

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#6BAA24]/10 rounded-lg">
              <FileDown size={28} className="text-[#6BAA24]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">
                Stellenplanübersicht (Anlage 2a)
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Offizielles Format für die Bezirksregierung mit Stellensoll, Stellenist und Vergleich.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" size="sm">PDF</Button>
                <Button variant="secondary" size="sm">Excel</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FBC900]/10 rounded-lg">
              <FileDown size={28} className="text-[#FBC900]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">
                Deputatsübersicht (intern)
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Monatliche Wochenstunden aller Lehrkräfte für die interne Dokumentation.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" size="sm">PDF</Button>
                <Button variant="secondary" size="sm">Excel</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#5C82A5]/10 rounded-lg">
              <FileDown size={28} className="text-[#5C82A5]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">
                Schülerzahlen-Übersicht
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Schülerzahlen aller Schulen nach Stichtag und Schuljahr.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" size="sm">Excel</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#575756]/10 rounded-lg">
              <FileDown size={28} className="text-[#575756]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">
                Berechnungsnachweis
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Detaillierter Berechnungsnachweis mit allen Zwischenschritten für die Prüfung.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" size="sm">PDF</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 p-4 bg-[#FEF7CC] border border-[#FBC900] rounded-lg text-sm text-[#575756]">
        <strong>Hinweis:</strong> Export-Funktionen werden in Phase 6 implementiert.
        Aktuell werden Beispiel-Vorschauen angezeigt.
      </div>
    </PageContainer>
  );
}
