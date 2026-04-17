import { PrismaClient, Layer } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Remove legacy "nodejs" language if it exists
  await prisma.templateOption.deleteMany({
    where: { layer: Layer.LANGUAGE, name: "nodejs" },
  });

  const languages = [
    {
      layer: Layer.LANGUAGE,
      name: "typescript",
      displayName: "TypeScript",
      description: "Typed superset of JavaScript that compiles to plain JS",
      icon: "typescript",
      version: "5.7",
      compatibleWith: {},
    },
    {
      layer: Layer.LANGUAGE,
      name: "javascript",
      displayName: "JavaScript",
      description: "Dynamic language powering the modern web",
      icon: "javascript",
      version: "ES2024",
      compatibleWith: {},
    },
  ];

  const frameworks = [
    {
      layer: Layer.FRAMEWORK,
      name: "react",
      displayName: "React",
      description: "Build UIs with the world's most popular frontend library",
      icon: "react",
      version: "18.x",
      compatibleWith: { language: ["typescript", "javascript"] },
    },
    {
      layer: Layer.FRAMEWORK,
      name: "vue",
      displayName: "Vue",
      description: "Progressive JavaScript framework for building UIs",
      icon: "vue",
      version: "3.x",
      compatibleWith: { language: ["typescript", "javascript"] },
    },
    {
      layer: Layer.FRAMEWORK,
      name: "nextjs",
      displayName: "Next.js",
      description: "Full-stack React framework with SSR and App Router",
      icon: "nextjs",
      version: "15.x",
      compatibleWith: { language: ["typescript", "javascript"] },
    },
    {
      layer: Layer.FRAMEWORK,
      name: "express",
      displayName: "Express",
      description: "Fast, minimal web framework for server-side apps",
      icon: "express",
      version: "5.x",
      compatibleWith: { language: ["typescript", "javascript"] },
    },
    {
      layer: Layer.FRAMEWORK,
      name: "fastify",
      displayName: "Fastify",
      description: "High-performance web framework focused on speed",
      icon: "fastify",
      version: "5.x",
      compatibleWith: { language: ["typescript", "javascript"] },
    },
    {
      layer: Layer.FRAMEWORK,
      name: "turbo",
      displayName: "Turborepo Fullstack",
      description: "Monorepo with Next.js frontend + Express API + Prisma + mock seed data",
      icon: "turbo",
      version: "2.x",
      compatibleWith: { language: ["typescript"] },
    },
  ];

  const databases = [
    {
      layer: Layer.DATABASE,
      name: "postgresql",
      displayName: "PostgreSQL",
      description: "Advanced open-source relational database",
      icon: "postgresql",
      version: "16",
      compatibleWith: {},
    },
    {
      layer: Layer.DATABASE,
      name: "mysql",
      displayName: "MySQL",
      description: "Popular open-source relational database",
      icon: "mysql",
      version: "8.4",
      compatibleWith: {},
    },
    {
      layer: Layer.DATABASE,
      name: "none",
      displayName: "None",
      description: "No database — frontend-only project",
      icon: "none",
      version: "—",
      compatibleWith: { framework: ["react", "vue", "nextjs"] },
    },
  ];

  const orms = [
    {
      layer: Layer.ORM,
      name: "prisma",
      displayName: "Prisma",
      description: "Next-generation TypeScript ORM with auto-generated types",
      icon: "prisma",
      version: "6.x",
      compatibleWith: { database: ["postgresql", "mysql"] },
    },
    {
      layer: Layer.ORM,
      name: "drizzle",
      displayName: "Drizzle",
      description: "Lightweight TypeScript ORM with SQL-like syntax",
      icon: "drizzle",
      version: "0.36.x",
      compatibleWith: { database: ["postgresql", "mysql"] },
    },
    {
      layer: Layer.ORM,
      name: "raw",
      displayName: "Raw SQL (pg driver)",
      description: "Direct database queries without ORM overhead",
      icon: "sql",
      version: "latest",
      compatibleWith: { database: ["postgresql", "mysql"] },
    },
    {
      layer: Layer.ORM,
      name: "none",
      displayName: "None",
      description: "No ORM — frontend-only project",
      icon: "none",
      version: "—",
      compatibleWith: { database: ["none"] },
    },
  ];

  const packageManagers = [
    {
      layer: Layer.PACKAGE_MANAGER,
      name: "npm",
      displayName: "npm",
      description: "The default Node.js package manager, universally available",
      icon: "npm",
      version: "10.x",
      compatibleWith: {},
    },
    {
      layer: Layer.PACKAGE_MANAGER,
      name: "pnpm",
      displayName: "pnpm",
      description: "Fast, disk-efficient package manager using hard links",
      icon: "pnpm",
      version: "9.x",
      compatibleWith: {},
    },
    {
      layer: Layer.PACKAGE_MANAGER,
      name: "yarn",
      displayName: "Yarn",
      description: "Reliable package manager with workspaces support",
      icon: "yarn",
      version: "4.x",
      compatibleWith: {},
    },
    {
      layer: Layer.PACKAGE_MANAGER,
      name: "bun",
      displayName: "Bun",
      description: "All-in-one JS runtime and ultra-fast package manager",
      icon: "bun",
      version: "1.x",
      compatibleWith: {},
    },
  ];

  const allItems = [...languages, ...frameworks, ...databases, ...orms, ...packageManagers];

  for (const item of allItems) {
    await prisma.templateOption.upsert({
      where: {
        layer_name: {
          layer: item.layer,
          name: item.name,
        },
      },
      update: item,
      create: item,
    });
  }

  console.log("✅ Seed data inserted/updated successfully");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
