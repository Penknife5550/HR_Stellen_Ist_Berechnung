"use client";

import { SCHULFORM_CONFIG, type SchulformCode } from "@/lib/constants";

interface School {
  id: number;
  kurzname: string;
  name: string;
  schulnummer: string;
}

interface SchoolTabsProps {
  schools: School[];
  activeSchool?: string;  // kurzname
  onSelect: (kurzname: string) => void;
}

export function SchoolTabs({ schools, activeSchool, onSelect }: SchoolTabsProps) {
  return (
    <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
      {schools.map((school) => {
        const config = SCHULFORM_CONFIG[school.kurzname as SchulformCode];
        const isActive = school.kurzname === activeSchool;
        const farbe = config?.farbe ?? "#575756";

        return (
          <button
            key={school.kurzname}
            onClick={() => onSelect(school.kurzname)}
            className={`
              px-5 py-3 text-[15px] font-medium transition-colors
              border-b-3 -mb-px
              ${isActive
                ? "text-[#1A1A1A] font-bold"
                : "text-[#6B7280] hover:text-[#1A1A1A]"
              }
            `}
            style={{
              borderBottomColor: isActive ? farbe : "transparent",
              borderBottomWidth: "3px",
            }}
          >
            <span className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: farbe }}
              />
              {school.kurzname}
            </span>
          </button>
        );
      })}
    </div>
  );
}
