// Adapted from bolt.newer's streamingParser.ts
// Parses <duckops_artifact>/<duckops_action> XML from streaming LLM responses

export enum StepType {
  CreateFile = "CreateFile",
  EditFile = "EditFile",
  RunScript = "RunScript",
  Markup = "Markup",
}

export interface AiStep {
  id: number;
  type: StepType;
  title: string;
  status: "pending" | "in-progress" | "completed";
  code?: string;
  path?: string;
}

export interface ParserCallbacks {
  onStepStarted: (step: AiStep) => void;
  onStepUpdate: (id: number, content: string) => void;
  onStepCompleted: (id: number) => void;
}

export class AiStreamParser {
  private buffer = "";
  private currentStepId: number | null = null;
  private currentMarkupId: number | null = null;
  private nextId: number;
  private callbacks: ParserCallbacks;
  private inArtifact = false;
  private inAction = false;
  private existingPaths: Set<string>;

  constructor(nextId: number, existingPaths: Set<string>, callbacks: ParserCallbacks) {
    this.nextId = nextId;
    this.existingPaths = existingPaths;
    this.callbacks = callbacks;
  }

  parse(chunk: string) {
    this.buffer += chunk;
    this.processBuffer();
  }

  /** Flush any remaining buffer content after streaming ends */
  finalize() {
    if (this.buffer.trim() && !this.inArtifact && !this.inAction) {
      const content = this.buffer.trim();
      if (content) {
        if (this.currentMarkupId === null) {
          const step: AiStep = {
            id: this.nextId++,
            title: "Assistant",
            type: StepType.Markup,
            status: "in-progress",
            code: content,
          };
          this.currentMarkupId = step.id;
          this.callbacks.onStepStarted(step);
        } else {
          this.callbacks.onStepUpdate(this.currentMarkupId, content);
        }
      }
    }
    if (this.currentMarkupId !== null) {
      this.callbacks.onStepCompleted(this.currentMarkupId);
      this.currentMarkupId = null;
    }
    if (this.currentStepId !== null) {
      this.callbacks.onStepCompleted(this.currentStepId);
      this.currentStepId = null;
    }
  }

  private processBuffer() {
    let changed = true;
    while (changed) {
      changed = false;

      // Try to parse a complete artifact open tag
      if (!this.inArtifact && !this.inAction) {
        const artifactMatch = this.buffer.match(/<duckops_artifact[^>]*>/);

        if (artifactMatch) {
          const artifactIndex = artifactMatch.index!;

          // Emit text before the artifact tag as Markup
          if (artifactIndex > 0) {
            const markupContent = this.buffer.substring(0, artifactIndex).trim();
            if (markupContent.length > 0) {
              if (this.currentMarkupId === null) {
                const newStep: AiStep = {
                  id: this.nextId++,
                  title: "Assistant",
                  type: StepType.Markup,
                  status: "in-progress",
                  code: markupContent,
                };
                this.currentMarkupId = newStep.id;
                this.callbacks.onStepStarted(newStep);
              } else {
                this.callbacks.onStepUpdate(this.currentMarkupId, markupContent);
              }
            }
          }

          if (this.currentMarkupId !== null) {
            this.callbacks.onStepCompleted(this.currentMarkupId);
            this.currentMarkupId = null;
          }

          this.inArtifact = true;
          this.buffer = this.buffer.substring(artifactIndex + artifactMatch[0].length);
          changed = true;
          continue;
        }
      }

      // Buffer text before a partial artifact tag arrives
      if (!this.inArtifact && !this.inAction) {
        const partialStart = this.buffer.indexOf("<duckops_artifact");

        if (partialStart !== -1) {
          if (this.buffer.length > partialStart + 150) {
            const markupContent = this.buffer.substring(0, partialStart).trim();
            if (markupContent.length > 0) {
              if (this.currentMarkupId === null) {
                const newStep: AiStep = {
                  id: this.nextId++,
                  title: "Assistant",
                  type: StepType.Markup,
                  status: "in-progress",
                  code: markupContent,
                };
                this.currentMarkupId = newStep.id;
                this.callbacks.onStepStarted(newStep);
              } else {
                this.callbacks.onStepUpdate(this.currentMarkupId, markupContent);
              }
              this.buffer = this.buffer.substring(partialStart);
              changed = true;
            } else {
              return;
            }
          } else {
            return;
          }
        } else {
          // No artifact tag anywhere — emit safe portion as markup
          const safeLength = this.buffer.length > 20 ? this.buffer.length - 20 : 0;
          if (safeLength > 0) {
            const content = this.buffer.substring(0, safeLength);
            if (this.currentMarkupId === null) {
              const newStep: AiStep = {
                id: this.nextId++,
                title: "Assistant",
                type: StepType.Markup,
                status: "in-progress",
                code: content,
              };
              this.currentMarkupId = newStep.id;
              this.callbacks.onStepStarted(newStep);
            } else {
              this.callbacks.onStepUpdate(this.currentMarkupId, content);
            }
            this.buffer = this.buffer.substring(safeLength);
            changed = true;
          } else {
            return;
          }
        }
      }

      // Inside artifact — look for action open tags or artifact close tag
      if (this.inArtifact && !this.inAction) {
        const actionMatch = this.buffer.match(/<duckops_action\s+type="([^"]+)"(?:\s+filePath="([^"]+)")?>/);
        if (actionMatch) {
          this.inAction = true;
          const typeStr = actionMatch[1];
          const filePath = actionMatch[2] || "";

          let type: StepType;
          if (typeStr === "file") {
            type = this.existingPaths.has(filePath) ? StepType.EditFile : StepType.CreateFile;
          } else if (typeStr === "shell") {
            type = StepType.RunScript;
          } else {
            type = StepType.CreateFile;
          }

          const newStep: AiStep = {
            id: this.nextId++,
            title: this.generateTitle(type, filePath),
            type,
            status: "in-progress",
            code: "",
            path: filePath,
          };

          this.currentStepId = newStep.id;
          this.callbacks.onStepStarted(newStep);
          this.existingPaths.add(filePath);

          this.buffer = this.buffer.substring(actionMatch.index! + actionMatch[0].length);
          changed = true;
        } else if (this.buffer.includes("</duckops_artifact>")) {
          this.inArtifact = false;
          this.buffer = this.buffer.substring(
            this.buffer.indexOf("</duckops_artifact>") + "</duckops_artifact>".length,
          );
          changed = true;
        }
      }

      // Inside action — accumulate content until closing tag
      if (this.inAction) {
        const endTagIndex = this.buffer.indexOf("</duckops_action>");
        if (endTagIndex !== -1) {
          const content = this.buffer.substring(0, endTagIndex);
          if (this.currentStepId !== null) {
            this.callbacks.onStepUpdate(this.currentStepId, content);
            this.callbacks.onStepCompleted(this.currentStepId);
          }
          this.inAction = false;
          this.currentStepId = null;
          this.buffer = this.buffer.substring(endTagIndex + "</duckops_action>".length);
          changed = true;
        } else {
          // Stream partial file content safely (keep 17 chars as tag buffer)
          if (this.buffer.length > 20) {
            const safe = this.buffer.length - 17;
            if (safe > 0) {
              const content = this.buffer.substring(0, safe);
              if (this.currentStepId !== null) {
                this.callbacks.onStepUpdate(this.currentStepId, content);
              }
              this.buffer = this.buffer.substring(safe);
              changed = true;
            }
          }
        }
      }
    }
  }

  private generateTitle(type: StepType, path: string): string {
    if (type === StepType.CreateFile) return `Create ${path}`;
    if (type === StepType.EditFile) return `Edit ${path}`;
    if (type === StepType.RunScript) return "Run command";
    return "Action";
  }
}

/**
 * Parse a complete (non-streaming) LLM response into steps.
 * Used for displaying historical messages loaded from the database.
 */
export function parseAiResponse(response: string): AiStep[] {
  const steps: AiStep[] = [];
  let stepId = 1;

  const artifactStart = response.indexOf("<duckops_artifact");

  // Text before artifact = intro markup
  if (artifactStart > 0) {
    const before = response.substring(0, artifactStart).trim();
    if (before) {
      steps.push({ id: stepId++, title: "Assistant", type: StepType.Markup, status: "completed", code: before });
    }
  }

  // Extract all file/shell actions from artifact
  const artifactRe = /<duckops_artifact[^>]*>([\s\S]*?)(?:<\/duckops_artifact>|$)/g;
  let artMatch;
  while ((artMatch = artifactRe.exec(response)) !== null) {
    const xmlContent = artMatch[1];
    const actionRe = /<duckops_action\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)(?:<\/duckops_action>|$)/g;
    let actMatch;
    while ((actMatch = actionRe.exec(xmlContent)) !== null) {
      const [, type, filePath, content] = actMatch;
      if (type === "file" && filePath) {
        steps.push({
          id: stepId++,
          title: `Create ${filePath}`,
          type: StepType.CreateFile,
          status: "completed",
          code: content.trim(),
          path: filePath,
        });
      } else if (type === "shell") {
        steps.push({
          id: stepId++,
          title: "Run command",
          type: StepType.RunScript,
          status: "completed",
          code: content.trim(),
        });
      }
    }
  }

  // Text after artifact = conclusion markup
  const artifactEnd = response.lastIndexOf("</duckops_artifact>");
  if (artifactEnd !== -1) {
    const after = response.substring(artifactEnd + "</duckops_artifact>".length).trim();
    if (after) {
      steps.push({ id: stepId++, title: "Assistant", type: StepType.Markup, status: "completed", code: after });
    }
  }

  // No artifact at all — plain text response
  if (artifactStart === -1 && response.trim()) {
    steps.push({ id: stepId++, title: "Assistant", type: StepType.Markup, status: "completed", code: response.trim() });
  }

  return steps;
}
