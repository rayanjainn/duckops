"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useCreateProject } from "@/hooks/useProjects";
import { useTemplates, useCompatibleTemplates } from "@/hooks/useTemplates";
import { aiApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TemplateOption } from "@duckops/shared-types";
import { cn } from "@/lib/utils";
import {
  Check,
  Rocket,
  AlertCircle,
  Lock,
  Globe,
  Bot,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2,
  RotateCcw,
} from "lucide-react";

// ─── Option button ────────────────────────────────────────────────────────────

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
        "relative p-4 rounded-xl border text-left transition-all duration-200",
        selected
          ? "border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-900/20"
          : "border-border bg-surface-2 hover:border-border-2 hover:bg-surface-3",
      )}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
      <div
        className={cn(
          "font-semibold text-sm",
          selected ? "text-amber-500" : "text-foreground",
        )}
      >
        {option.displayName}
      </div>
      <div className="text-xs text-muted mt-0.5 font-mono">
        v{option.version}
      </div>
      {option.description && (
        <div className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">
          {option.description}
        </div>
      )}
    </button>
  );
}

function SectionHeader({
  step,
  title,
  done,
}: {
  step: number;
  title: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
          done ? "bg-emerald-600 text-white" : "bg-amber-600 text-white",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

// ─── AI Recommendation banner ─────────────────────────────────────────────────

function AiBanner({
  reasoning,
  onAccept,
  onDismiss,
}: {
  reasoning: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="relative p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start gap-3 relative">
        <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-purple-300 mb-1">
            AI Recommendation applied
          </p>
          <p className="text-xs text-muted leading-relaxed">{reasoning}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onAccept}
            className="text-xs text-emerald-600 hover:text-emerald-500 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg transition-colors"
          >
            Keep
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-muted hover:text-foreground px-3 py-1.5 bg-surface-3 border border-border rounded-lg transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function CreateProjectForm() {
  const router = useRouter();
  const createMutation = useCreateProject();
  const { data: allOptions, isLoading } = useTemplates();

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState("");
  const [aiApplied, setAiApplied] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    description: "",
    language: "",
    framework: "",
    database: "",
    orm: "",
    packageManager: "",
    repoVisibility: "private" as "public" | "private",
  });

  const FRONTEND_FRAMEWORKS = new Set(["react", "vue", "nextjs"]);
  const isFrontend = FRONTEND_FRAMEWORKS.has(form.framework);
  const isTurbo = form.framework === "turbo";

  const compatParams: Record<string, string> = {};
  if (form.language) compatParams.language = form.language;
  if (form.database) compatParams.database = form.database;

  const { data: compatOptions, isLoading: isCompatLoading } =
    useCompatibleTemplates(compatParams);
  const options =
    Object.keys(compatParams).length > 0 && compatOptions
      ? compatOptions
      : allOptions;

  const handleSelect = (layer: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [layer.toLowerCase()]: value };
      if (layer === "language") {
        next.framework = "";
        next.database = "";
        next.orm = "";
      }
      if (layer === "framework") {
        if (FRONTEND_FRAMEWORKS.has(value) || value === "turbo") {
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

  const handleAiRecommend = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const rec = await aiApi.recommendStack(aiPrompt);
      setForm((prev) => ({
        ...prev,
        language: rec.language || prev.language,
        framework: rec.framework || prev.framework,
        database: rec.database || prev.database,
        orm: rec.orm || prev.orm,
        packageManager: rec.packageManager || prev.packageManager,
      }));
      setAiReasoning(rec.reasoning);
      setAiApplied(true);
      setShowManual(true);
    } catch {
      // AI service unavailable — just show manual form
      setAiApplied(false);
    } finally {
      setAiLoading(false);
    }
  };

  const isReady =
    form.displayName &&
    form.language &&
    form.framework &&
    form.database &&
    form.orm &&
    form.packageManager;

  const handleSubmit = () => {
    const name = form.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    createMutation.mutate(
      {
        ...form,
        name,
        repoVisibility: form.repoVisibility,
        aiPrompt: mode === "ai" ? aiPrompt : undefined,
      },
      { onSuccess: (project) => router.push(`/projects/${project.id}`) },
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
      {/* ── Mode toggle ── */}
      <div
        data-tour="mode-toggle"
        className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-xl w-fit mx-auto"
      >
        {(["ai", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              if (m === "manual") setShowManual(true);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
              mode === m
                ? "bg-amber-600 text-white shadow-lg shadow-amber-900/40"
                : "text-muted hover:text-foreground",
            )}
          >
            {m === "ai" ? (
              <Bot className="h-3.5 w-3.5" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {m === "ai" ? "AI Recommended" : "Manual Setup"}
          </button>
        ))}
      </div>
 
       {/* ── Project Details (Always Visible) ── */}
       <Card>
         <CardHeader className="pb-4">
           <SectionHeader
             step={1}
             title="Project Details"
             done={!!form.displayName}
           />
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="space-y-1.5">
             <Label htmlFor="displayName">Project Name</Label>
             <Input
               id="displayName"
               data-tour="project-name"
               placeholder="my-api"
               value={form.displayName}
               onChange={(e) =>
                 setForm((p) => ({ ...p, displayName: e.target.value }))
               }
             />
             {form.displayName && (
               <p className="text-xs text-muted">
                 Slug:{" "}
                 <span className="font-mono text-muted-2">
                   {form.displayName
                     .toLowerCase()
                     .replace(/[^a-z0-9]+/g, "-")
                     .replace(/^-|-$/g, "")}
                 </span>
               </p>
             )}
           </div>
           <div className="space-y-1.5">
             <Label htmlFor="description">
               Description{" "}
               <span className="text-muted font-normal">(optional)</span>
             </Label>
             <Input
               id="description"
               placeholder="A simple REST API"
               value={form.description}
               onChange={(e) =>
                 setForm((p) => ({ ...p, description: e.target.value }))
               }
             />
           </div>
           <div className="space-y-1.5">
             <Label>Repository Visibility</Label>
             <div
               data-tour="repo-visibility"
               className="grid grid-cols-2 gap-3"
             >
               {(["private", "public"] as const).map((vis) => (
                 <button
                   key={vis}
                   type="button"
                   onClick={() =>
                     setForm((p) => ({ ...p, repoVisibility: vis }))
                   }
                   className={cn(
                     "relative p-3 rounded-xl border text-left transition-all flex items-center gap-3",
                     form.repoVisibility === vis
                       ? "border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-900/20"
                       : "border-border bg-surface-2 hover:border-border-2 hover:bg-surface-3",
                   )}
                 >
                   {vis === "private" ? (
                     <Lock
                       className={cn(
                         "h-4 w-4 shrink-0",
                         form.repoVisibility === vis
                           ? "text-amber-500"
                           : "text-muted",
                       )}
                     />
                   ) : (
                     <Globe
                       className={cn(
                         "h-4 w-4 shrink-0",
                         form.repoVisibility === vis
                           ? "text-amber-500"
                           : "text-muted",
                       )}
                     />
                   )}
                   <div>
                     <div
                       className={cn(
                         "font-semibold text-sm capitalize",
                         form.repoVisibility === vis
                           ? "text-amber-500"
                           : "text-foreground",
                       )}
                     >
                       {vis}
                     </div>
                     <div className="text-xs text-muted mt-0.5">
                       {vis === "private"
                         ? "Only you can see it"
                         : "Anyone can see it"}
                     </div>
                   </div>
                   {form.repoVisibility === vis && (
                     <div className="absolute top-2 right-2 w-4 h-4 bg-amber-600 rounded-full flex items-center justify-center">
                       <Check className="h-2.5 w-2.5 text-white" />
                     </div>
                   )}
                 </button>
               ))}
             </div>
           </div>
         </CardContent>
       </Card>

      {/* ── AI prompt box ── */}
      {mode === "ai" && (
        <Card className="border-purple-500/20 bg-purple-500/3">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-sm text-foreground">
                  Describe your project
                </CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  AI will recommend the right stack automatically
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              data-tour="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. A REST API for a SaaS app with user authentication and PostgreSQL..."
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleAiRecommend();
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">⌘+Enter to submit</p>
              <Button
                onClick={handleAiRecommend}
                disabled={!aiPrompt.trim() || aiLoading}
                size="sm"
                className="bg-purple-600 hover:bg-purple-500 text-white border-purple-600"
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
                {aiLoading ? "Analyzing..." : "Recommend stack"}
              </Button>
            </div>

            {aiApplied && aiReasoning && (
              <AiBanner
                reasoning={aiReasoning}
                onAccept={() => setShowManual(false)}
                onDismiss={() => {
                  setShowManual(true);
                  setAiApplied(false);
                }}
              />
            )}

            {aiApplied && (
              <button
                type="button"
                onClick={() => setShowManual(!showManual)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors w-full justify-center py-1"
              >
                {showManual ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {showManual
                  ? "Hide manual overrides"
                  : "Review / override stack"}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Show recommendation summary (when AI applied and manual hidden) ── */}
      {aiApplied && !showManual && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted">
                Recommended Stack
              </p>
              <button
                onClick={() => setShowManual(true)}
                className="text-xs text-amber-500 hover:text-amber-500 flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Override
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Language", value: form.language },
                { label: "Framework", value: form.framework },
                { label: "Database", value: form.database || "none" },
                { label: "ORM", value: form.orm || "none" },
                { label: "Pkg Mgr", value: form.packageManager },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="p-2.5 bg-surface-3 border border-border rounded-lg"
                >
                  <p className="text-[10px] text-muted uppercase tracking-wider">
                    {label}
                  </p>
                  <p className="text-xs font-mono text-amber-500 capitalize mt-0.5">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Manual / override stack selection ── */}
      {(mode === "manual" || showManual) && (
        <>

          {/* Language */}
          <Card>
            <CardHeader className="pb-4">
              <SectionHeader step={2} title="Language" done={!!form.language} />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
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
          {form.language && (
            <Card
              className={cn(
                isCompatLoading && "opacity-50 pointer-events-none",
              )}
            >
              <CardHeader className="pb-4">
                <SectionHeader
                  step={3}
                  title="Framework"
                  done={!!form.framework}
                />
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
                    <p className="text-sm text-muted">
                      Loading compatible frameworks...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Database */}
          {form.framework && !isFrontend && !isTurbo && (
            <Card
              className={cn(
                isCompatLoading && "opacity-50 pointer-events-none",
              )}
            >
              <CardHeader className="pb-4">
                <SectionHeader
                  step={4}
                  title="Database"
                  done={!!form.database}
                />
              </CardHeader>
              <CardContent>
                {options?.DATABASE &&
                options.DATABASE.filter((o: any) => o.name !== "none").length >
                  0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {options.DATABASE.filter((o: any) => o.name !== "none").map(
                      (opt: any) => (
                        <OptionButton
                          key={opt.name}
                          option={opt}
                          selected={form.database === opt.name}
                          onClick={() => handleSelect("database", opt.name)}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-surface-2 rounded-xl border border-dashed border-border">
                    <p className="text-sm text-muted">
                      Loading compatible databases...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ORM */}
          {form.database &&
            !isFrontend &&
            !isTurbo &&
            form.database !== "none" && (
              <Card
                className={cn(
                  isCompatLoading && "opacity-50 pointer-events-none",
                )}
              >
                <CardHeader className="pb-4">
                  <SectionHeader
                    step={5}
                    title="ORM / Query Layer"
                    done={!!form.orm}
                  />
                </CardHeader>
                <CardContent>
                  {options?.ORM &&
                  options.ORM.filter((o: any) => o.name !== "none").length >
                    0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {options.ORM.filter((o: any) => o.name !== "none").map(
                        (opt: any) => (
                          <OptionButton
                            key={opt.name}
                            option={opt}
                            selected={form.orm === opt.name}
                            onClick={() => handleSelect("orm", opt.name)}
                          />
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-surface-2 rounded-xl border border-dashed border-border">
                      <p className="text-sm text-muted">
                        Loading compatible ORMs...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          {/* Package Manager */}
          {(form.orm || (form.framework && (isFrontend || isTurbo))) && (
            <Card>
              <CardHeader className="pb-4">
                <SectionHeader
                  step={isFrontend || isTurbo ? 4 : 6}
                  title="Package Manager"
                  done={!!form.packageManager}
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {allOptions?.PACKAGE_MANAGER?.map((opt) => (
                    <OptionButton
                      key={opt.name}
                      option={opt}
                      selected={form.packageManager === opt.name}
                      onClick={() =>
                        setForm((p) => ({ ...p, packageManager: opt.name }))
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Submit ── */}
      {isReady && (
        <Card className="border-amber-500/20 bg-amber-500/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-amber-500 flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Ready to deploy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stack summary — only shown if project name filled */}
            {form.displayName && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {[
                  { label: "Language", value: form.language },
                  { label: "Framework", value: form.framework },
                  ...(!isFrontend && !isTurbo
                    ? [
                        { label: "Database", value: form.database },
                        { label: "ORM", value: form.orm },
                      ]
                    : []),
                  ...(isTurbo
                    ? [{ label: "Stack", value: "Next.js + Express + Prisma" }]
                    : []),
                  { label: "Package Manager", value: form.packageManager },
                ].map(({ label, value }) => (
                  <Fragment key={label}>
                    <span className="text-muted">{label}</span>
                    <span className="text-foreground font-mono capitalize">
                      {value}
                    </span>
                  </Fragment>
                ))}
              </div>
            )}

            {createMutation.error && (
              <div className="flex items-center gap-2 text-red-400 text-xs p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {createMutation.error.message}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              isLoading={createMutation.isPending}
              className="w-full"
              size="lg"
            >
              <Rocket className="h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Create & Deploy"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
