import { PrismaClient, Layer } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed Languages
  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.LANGUAGE, name: "nodejs" } },
    update: {},
    create: {
      layer: Layer.LANGUAGE,
      name: "nodejs",
      displayName: "Node.js",
      description: "JavaScript runtime built on Chrome's V8 engine",
      icon: "nodejs",
      version: "22.x LTS",
      compatibleWith: {},
    },
  });

  // Seed Frameworks
  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.FRAMEWORK, name: "react" } },
    update: {},
    create: {
      layer: Layer.FRAMEWORK,
      name: "react",
      displayName: "React",
      description: "Build UIs with the world's most popular frontend library",
      icon: "react",
      version: "18.x",
      compatibleWith: { language: ["nodejs"] },
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.FRAMEWORK, name: "vue" } },
    update: {},
    create: {
      layer: Layer.FRAMEWORK,
      name: "vue",
      displayName: "Vue",
      description: "Progressive JavaScript framework for building UIs",
      icon: "vue",
      version: "3.x",
      compatibleWith: { language: ["nodejs"] },
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.FRAMEWORK, name: "nextjs" } },
    update: {},
    create: {
      layer: Layer.FRAMEWORK,
      name: "nextjs",
      displayName: "Next.js",
      description: "Full-stack React framework with SSR and App Router",
      icon: "nextjs",
      version: "15.x",
      compatibleWith: { language: ["nodejs"] },
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.FRAMEWORK, name: "express" } },
    update: {},
    create: {
      layer: Layer.FRAMEWORK,
      name: "express",
      displayName: "Express",
      description: "Fast, minimal web framework for Node.js",
      icon: "express",
      version: "5.x",
      compatibleWith: { language: ["nodejs"] },
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.FRAMEWORK, name: "fastify" } },
    update: {},
    create: {
      layer: Layer.FRAMEWORK,
      name: "fastify",
      displayName: "Fastify",
      description: "High-performance web framework focused on speed",
      icon: "fastify",
      version: "5.x",
      compatibleWith: { language: ["nodejs"] },
    },
  });

  // Seed Databases
  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.DATABASE, name: "postgresql" } },
    update: {},
    create: {
      layer: Layer.DATABASE,
      name: "postgresql",
      displayName: "PostgreSQL",
      description: "Advanced open-source relational database",
      icon: "postgresql",
      version: "16",
      compatibleWith: {},
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.DATABASE, name: "mysql" } },
    update: {},
    create: {
      layer: Layer.DATABASE,
      name: "mysql",
      displayName: "MySQL",
      description: "Popular open-source relational database",
      icon: "mysql",
      version: "8.4",
      compatibleWith: {},
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.DATABASE, name: "none" } },
    update: {},
    create: {
      layer: Layer.DATABASE,
      name: "none",
      displayName: "None",
      description: "No database — frontend-only project",
      icon: "none",
      version: "—",
      compatibleWith: { framework: ["react", "vue", "nextjs"] },
    },
  });

  // Seed ORMs
  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.ORM, name: "prisma" } },
    update: {},
    create: {
      layer: Layer.ORM,
      name: "prisma",
      displayName: "Prisma",
      description: "Next-generation TypeScript ORM with auto-generated types",
      icon: "prisma",
      version: "6.x",
      compatibleWith: { database: ["postgresql", "mysql"] },
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.ORM, name: "drizzle" } },
    update: {},
    create: {
      layer: Layer.ORM,
      name: "drizzle",
      displayName: "Drizzle",
      description: "Lightweight TypeScript ORM with SQL-like syntax",
      icon: "drizzle",
      version: "0.36.x",
      compatibleWith: { database: ["postgresql", "mysql"] },
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.ORM, name: "raw" } },
    update: {},
    create: {
      layer: Layer.ORM,
      name: "raw",
      displayName: "Raw SQL (pg driver)",
      description: "Direct database queries without ORM overhead",
      icon: "sql",
      version: "latest",
      compatibleWith: { database: ["postgresql", "mysql"] },
    },
  });

  await prisma.templateOption.upsert({
    where: { layer_name: { layer: Layer.ORM, name: "none" } },
    update: {},
    create: {
      layer: Layer.ORM,
      name: "none",
      displayName: "None",
      description: "No ORM — frontend-only project",
      icon: "none",
      version: "—",
      compatibleWith: { database: ["none"] },
    },
  });

  console.log("✅ Seed data inserted successfully");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
