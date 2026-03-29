"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useCreateProject } from "@/hooks/useProjects";
import { useTemplates, useCompatibleTemplates } from "@/hooks/useTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TemplateOption } from "@duckops/shared-types";
import { cn } from "@/lib/utils";
import { Check, Rocket, AlertCircle } from "lucide-react";

function OptionButton({
  option,
  selected,
  onClick,
}: {
  option: TemplateOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border text-left transition-all",
        selected
          ? "border-amber-500 bg-accent-muted shadow-lg shadow-amber-900/20"
          : "border-border-2 bg-surface-3/50 hover:border-muted hover:bg-surface-3",
      )}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
      <div className={cn("font-semibold text-sm", selected ? "text-amber-300" : "text-foreground")}>
        {option.displayName}
      </div>
      <div className="text-xs text-muted mt-0.5 font-mono">v{option.version}</div>
      {option.description && (
        <div className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">
          {option.description}
        </div>
      )}
    </button>
  );
}

function SectionHeader({ step, title, done }: { step: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
        done ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
      )}>
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

export function CreateProjectForm() {
  const router = useRouter();
  const createMutation = useCreateProject();
  const { data: allOptions, isLoading } = useTemplates();

  const [form, setForm] = useState({
    displayName: "",
    description: "",
    language: "",
    framework: "",
    database: "",
    orm: "",
  });

  const FRONTEND_FRAMEWORKS = new Set(["react", "vue", "nextjs"]);
  const isFrontend = FRONTEND_FRAMEWORKS.has(form.framework);

  const compatParams: Record<string, string> = {};
  if (form.language) compatParams.language = form.language;
  if (form.database) compatParams.database = form.database;

  const { data: compatOptions, isLoading: isCompatLoading } = useCompatibleTemplates(compatParams);
  // Fallback to allOptions if compatOptions is not yet available to prevent UI "stuck" state while loading
  const options = (Object.keys(compatParams).length > 0 && compatOptions) ? compatOptions : allOptions;

  const handleSelect = (layer: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [layer.toLowerCase()]: value };
      if (layer === "language") {
        next.framework = "";
        next.database = "";
        next.orm = "";
      }
      if (layer === "framework") {
        if (FRONTEND_FRAMEWORKS.has(value)) {
          next.database = "none";
          next.orm = "none";
        } else {
          next.database = "";
          next.orm = "";
        }
      }
      if (layer === "database") next.orm = "";
      return next;
    });
  };

  const isReady =
    form.displayName &&
    form.language &&
    form.framework &&
    form.database &&
    form.orm;

  const handleSubmit = () => {
    const name = form.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    createMutation.mutate(
      { ...form, name },
      {
        onSuccess: (project) => {
          router.push(`/projects/${project.id}`);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-8">
      {/* Project Info */}
      <Card>
        <CardHeader className="pb-4">
          <SectionHeader step={1} title="Project Details" done={!!form.displayName} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Project Name</Label>
            <Input
              id="displayName"
              placeholder="my-api"
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
            />
            {form.displayName && (
              <p className="text-xs text-muted">
                Slug:{" "}
                <span className="font-mono text-muted-2">
                  {form.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
                </span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-muted font-normal">(optional)</span></Label>
            <Input
              id="description"
              placeholder="A simple REST API"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader className="pb-4">
          <SectionHeader step={2} title="Language" done={!!form.language} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {/* Always use allOptions for languages so user can switch between TS and JS freely */}
            {allOptions?.LANGUAGE?.map((opt) => (
              <OptionButton
                key={opt.name}
                option={opt}
                selected={form.language === opt.name}
                onClick={() => handleSelect("language", opt.name)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Framework */}
      {(form.language) && (
        <Card className={cn(isCompatLoading && "opacity-50 pointer-events-none")}>
          <CardHeader className="pb-4">
            <SectionHeader step={3} title="Framework" done={!!form.framework} />
          </CardHeader>
          <CardContent>
            {options?.FRAMEWORK && options.FRAMEWORK.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {options.FRAMEWORK.map((opt) => (
                  <OptionButton
                    key={opt.name}
                    option={opt}
                    selected={form.framework === opt.name}
                    onClick={() => handleSelect("framework", opt.name)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-surface-2 rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted">Loading compatible frameworks...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Database */}
      {form.framework && !isFrontend && (
        <Card className={cn(isCompatLoading && "opacity-50 pointer-events-none")}>
          <CardHeader className="pb-4">
            <SectionHeader step={4} title="Database" done={!!form.database} />
          </CardHeader>
          <CardContent>
            {options?.DATABASE && options.DATABASE.filter((o: any) => o.name !== "none").length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {options.DATABASE.filter((o: any) => o.name !== "none").map((opt: any) => (
                  <OptionButton
                    key={opt.name}
                    option={opt}
                    selected={form.database === opt.name}
                    onClick={() => handleSelect("database", opt.name)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-surface-2 rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted">Loading compatible databases...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ORM */}
      {form.database && !isFrontend && form.database !== "none" && (
        <Card className={cn(isCompatLoading && "opacity-50 pointer-events-none")}>
          <CardHeader className="pb-4">
            <SectionHeader step={5} title="ORM / Query Layer" done={!!form.orm} />
          </CardHeader>
          <CardContent>
            {options?.ORM && options.ORM.filter((o: any) => o.name !== "none").length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {options.ORM.filter((o: any) => o.name !== "none").map((opt: any) => (
                  <OptionButton
                    key={opt.name}
                    option={opt}
                    selected={form.orm === opt.name}
                    onClick={() => handleSelect("orm", opt.name)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-surface-2 rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted">Loading compatible ORMs...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary + Submit */}
      {isReady && (
        <Card className="border-accent-border bg-accent-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-amber-300">Ready to deploy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {[
                { label: "Language", value: form.language },
                { label: "Framework", value: form.framework },
                ...(!isFrontend ? [
                  { label: "Database", value: form.database },
                  { label: "ORM", value: form.orm },
                ] : []),
              ].map(({ label, value }) => (
                <Fragment key={label}>
                  <span className="text-muted">{label}</span>
                  <span className="text-foreground font-mono capitalize">{value}</span>
                </Fragment>
              ))}
            </div>

            {createMutation.error && (
              <div className="flex items-center gap-2 text-red-400 text-xs p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {createMutation.error.message}
              </div>
            )}

            <Button onClick={handleSubmit} isLoading={createMutation.isPending} className="w-full" size="lg">
              <Rocket className="h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Create & Deploy"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
