"use client";

import { useTemplates } from "@/hooks/useTemplates";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TemplateOption } from "@duckops/shared-types";

function TemplateOptionCard({ option }: { option: TemplateOption }) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{option.displayName}</h3>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{option.name}</p>
        </div>
        <Badge variant="secondary">v{option.version}</Badge>
      </div>
      {option.description && (
        <p className="text-sm text-gray-500 mt-2">{option.description}</p>
      )}
      {Object.keys(option.compatibleWith).length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          Compatible with:{" "}
          {Object.entries(option.compatibleWith)
            .map(([k, v]) => `${k}: ${v.join(", ")}`)
            .join(" | ")}
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const { data: options, isLoading } = useTemplates();

  const layers = [
    { key: "LANGUAGE", label: "Languages" },
    { key: "FRAMEWORK", label: "Frameworks" },
    { key: "DATABASE", label: "Databases" },
    { key: "ORM", label: "ORMs & Query Layers" },
  ] as const;

  return (
    <div>
      <Header
        title="Templates"
        description="Available tech stack options for new projects"
      />

      <div className="p-8 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          layers.map(({ key, label }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
              </CardHeader>
              <CardContent>
                {options?.[key] && options[key]!.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {options[key]!.map((opt) => (
                      <TemplateOptionCard key={opt.id} option={opt} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No options available</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
