"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateProject } from "@/hooks/useProjects";
import { useTemplates, useCompatibleTemplates } from "@/hooks/useTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TemplateOption } from "@duckops/shared-types";
import { cn } from "@/lib/utils";
import { CheckCircle, Circle } from "lucide-react";

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
        "relative p-4 rounded-lg border-2 text-left transition-all hover:shadow-sm",
        selected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:border-blue-300",
      )}
    >
      {selected && (
        <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-blue-500" />
      )}
      <div className="font-medium text-sm">{option.displayName}</div>
      <div className="text-xs text-gray-500 mt-1">v{option.version}</div>
      {option.description && (
        <div className="text-xs text-gray-400 mt-1 line-clamp-2">
          {option.description}
        </div>
      )}
    </button>
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

  const { data: compatOptions } = useCompatibleTemplates(compatParams);
  const options = Object.keys(compatParams).length > 0 ? compatOptions : allOptions;

  const handleSelect = (layer: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [layer.toLowerCase()]: value };
      if (layer === "language") { next.framework = ""; next.database = ""; next.orm = ""; }
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-8">
      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle>Project Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Project Name *</Label>
            <Input
              id="displayName"
              placeholder="My Todo API"
              value={form.displayName}
              onChange={(e) =>
                setForm((p) => ({ ...p, displayName: e.target.value }))
              }
            />
            {form.displayName && (
              <p className="text-xs text-gray-400">
                Slug:{" "}
                <span className="font-mono">
                  {form.displayName
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")}
                </span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="A simple REST API for managing todos"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle>Language</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {options?.LANGUAGE?.map((opt) => (
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
      {form.language && options?.FRAMEWORK && options.FRAMEWORK.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Framework</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Database — hidden for frontend frameworks */}
      {form.framework && !isFrontend && (
        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {options?.DATABASE?.filter((o) => o.name !== "none").map((opt) => (
                <OptionButton
                  key={opt.name}
                  option={opt}
                  selected={form.database === opt.name}
                  onClick={() => handleSelect("database", opt.name)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ORM — hidden for frontend frameworks */}
      {form.database && !isFrontend && (
        <Card>
          <CardHeader>
            <CardTitle>ORM / Query Layer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {options?.ORM?.filter((o) => o.name !== "none").map((opt) => (
                <OptionButton
                  key={opt.name}
                  option={opt}
                  selected={form.orm === opt.name}
                  onClick={() => handleSelect("orm", opt.name)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary + Submit */}
      {isReady && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Ready to Create</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-600">Language:</span>
              <span className="font-medium capitalize">{form.language}</span>
              <span className="text-gray-600">Framework:</span>
              <span className="font-medium capitalize">{form.framework}</span>
              {!isFrontend && (
                <>
                  <span className="text-gray-600">Database:</span>
                  <span className="font-medium capitalize">{form.database}</span>
                  <span className="text-gray-600">ORM:</span>
                  <span className="font-medium capitalize">{form.orm}</span>
                </>
              )}
            </div>

            {createMutation.error && (
              <p className="text-sm text-red-600">
                {createMutation.error.message}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              isLoading={createMutation.isPending}
              className="w-full"
              size="lg"
            >
              Create Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
