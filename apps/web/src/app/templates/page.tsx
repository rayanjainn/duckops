"use client";

import Link from "next/link";
import { useTemplates } from "@/hooks/useTemplates";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { TemplateOption } from "@duckops/shared-types";

function TemplateOptionCard({ option }: { option: TemplateOption }) {
  if (option.name === "none") return null;
  return (
    <div className="p-4 border border-border bg-surface-3/40 rounded-xl hover:border-border-2 hover:bg-surface-3/70 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="font-semibold text-sm text-foreground">{option.displayName}</h3>
          <p className="text-xs text-muted font-mono mt-0.5">{option.name}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">v{option.version}</Badge>
      </div>
      {option.description && (
        <p className="text-xs text-muted leading-relaxed">{option.description}</p>
      )}
      {Object.keys(option.compatibleWith).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(option.compatibleWith).flatMap(([, vals]) =>
            (vals as string[]).filter(v => v !== "none").map((v) => (
              <span key={v} className="text-xs bg-surface-4 text-muted-2 px-1.5 py-0.5 rounded font-mono">{v}</span>
            ))
          )}
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
    <div className="min-h-screen bg-surface">
      <Header
        title="Templates"
        description="Available tech stack options for new projects"
        actions={
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />

      <div className="p-8 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-48 rounded-xl" />
            ))}
          </div>
        ) : (
          layers.map(({ key, label }) => (
            <Card key={key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                {options?.[key] && options[key]!.filter(o => o.name !== "none").length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {options[key]!.map((opt) => (
                      <TemplateOptionCard key={opt.id} option={opt} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No options available</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
