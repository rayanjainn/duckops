"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@duckops/shared-types";

interface DeleteProjectDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteProjectDialog({
  project,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false
}: DeleteProjectDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const isValid = confirmText === project.displayName;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/20 bg-surface-2 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5 text-red-500">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Delete Project</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-muted hover:bg-surface-3 hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted leading-relaxed">
                This action is <strong className="text-foreground">permanent</strong> and will delete the 
                <span className="px-1.5 py-0.5 mx-1 rounded bg-surface-3 font-mono text-amber-500">{project.name}</span> 
                project along with its deployment, pipeline, and logs.
              </p>

              <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/10 space-y-2.5">
                <p className="text-[12px] text-muted-2">
                  To confirm, type <span className="font-bold text-foreground select-all">{project.displayName}</span> below:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type project name..."
                  className="bg-surface border-red-500/20 focus:border-red-500/50 text-sm h-10"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1 h-10 text-sm font-medium"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={onConfirm}
                  disabled={!isValid || isDeleting}
                  className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-sm font-medium gap-2 disabled:opacity-30 transition-all"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete Project
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
