"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
// driver.js base CSS is inlined in globals.css

const CREATE_PROJECT_STEPS = [
  {
    element: "[data-tour='mode-toggle']",
    popover: {
      title: "AI or Manual",
      description: "Choose <strong>AI Recommended</strong> to let the AI pick the stack from your description, or <strong>Manual Setup</strong> to select every option yourself.",
      side: "bottom" as const,
      align: "center" as const,
    },
  },
  {
    element: "[data-tour='ai-prompt']",
    popover: {
      title: "Describe your project",
      description: "Type what you want to build in plain language. The AI will recommend language, framework, database, and package manager automatically.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='project-name']",
    popover: {
      title: "Name your project",
      description: "A display name for your project. DuckOps generates a URL-safe slug which becomes your Kubernetes namespace and Docker image name.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='repo-visibility']",
    popover: {
      title: "Repository visibility",
      description: "Choose whether the GitHub repository is <strong>private</strong> (only you) or <strong>public</strong> (anyone can read the source code).",
      side: "top" as const,
      align: "start" as const,
    },
  },
];

const PROJECT_DETAIL_STEPS = [
  {
    element: "[data-tour='status-bar']",
    popover: {
      title: "Project status",
      description: "Live status of your project — from INITIALIZING through RUNNING. Updates in real time via WebSockets.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='tab-pipeline']",
    popover: {
      title: "Pipeline",
      description: "The 7-stage provisioning pipeline: scaffold, repo, Docker build, Terraform, Ansible, Jenkins, deploy. Each stage expands to show sub-steps.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='tab-logs']",
    popover: {
      title: "Logs",
      description: "Jenkins build output and live pod logs from Kubernetes. Color-coded for errors, success, and informational lines.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='tab-ai']",
    popover: {
      title: "AI Builder",
      description: "Give the AI a follow-up prompt. It clones your repo, generates code, fixes errors, commits, and pushes — Jenkins picks it up automatically.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='tab-infra']",
    popover: {
      title: "Infrastructure",
      description: "An interactive topology showing your full stack — GitHub, Jenkins, Registry, Kubernetes, Pod, Traefik. Click any node for details.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='tab-health']",
    popover: {
      title: "Health",
      description: "The health service pings your app every 30 seconds. See response times, uptime, and historical check results.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
];

const TOUR_KEY_CREATE = "duckops_tour_create_v1";
const TOUR_KEY_DETAIL = "duckops_tour_detail_v1";

export function resetAndRunTour(pathname: string) {
  const isCreatePage = pathname === "/projects/new";
  const isDetailPage = /^\/projects\/[^/]+$/.test(pathname) && pathname !== "/projects/new";
  if (isCreatePage) {
    localStorage.removeItem(TOUR_KEY_CREATE);
    runTour(CREATE_PROJECT_STEPS, TOUR_KEY_CREATE);
  } else if (isDetailPage) {
    localStorage.removeItem(TOUR_KEY_DETAIL);
    runTour(PROJECT_DETAIL_STEPS, TOUR_KEY_DETAIL);
  }
}

export function OnboardingTour() {
  const pathname = usePathname();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;

    const isCreatePage = pathname === "/projects/new";
    const isDetailPage = /^\/projects\/[^/]+$/.test(pathname) && pathname !== "/projects/new";

    if (isCreatePage && !localStorage.getItem(TOUR_KEY_CREATE)) {
      started.current = true;
      // Small delay for page to render
      setTimeout(() => runTour(CREATE_PROJECT_STEPS, TOUR_KEY_CREATE), 800);
    } else if (isDetailPage && !localStorage.getItem(TOUR_KEY_DETAIL)) {
      const timer = setTimeout(() => {
        started.current = true;
        runTour(PROJECT_DETAIL_STEPS, TOUR_KEY_DETAIL);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null;
}

async function runTour(
  steps: { element?: string; popover: { title: string; description: string; side?: "top" | "bottom" | "left" | "right"; align?: "start" | "center" | "end" } }[],
  storageKey: string,
) {
  const { driver } = await import("driver.js");

  const filtered = steps.filter(
    (step) => !step.element || !!document.querySelector(step.element),
  );

  if (filtered.length === 0) return;

  const driverObj = driver({
    showProgress: true,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayOpacity: 0.5,
    stagePadding: 8,
    stageRadius: 8,
    popoverClass: "duckops-tour-popover",
    progressText: "{{current}} / {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    onDestroyed: () => {
      localStorage.setItem(storageKey, "1");
    },
    steps: filtered,
  });

  driverObj.drive();
}
