import Handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("scaffold-service");

// Register helpers
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("or", (a: unknown, b: unknown) => a || b);

export interface ScaffoldInput {
  projectName: string;
  language: string;
  framework: string;
  database: string;
  orm: string;
  packageManager: string;
  port?: number;
}

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

const FRONTEND_FRAMEWORKS = new Set(["react", "vue", "nextjs"]);

export async function scaffoldProject(input: ScaffoldInput): Promise<{ outputDir: string }> {
  const port = input.port || 3000;
  const outputDir = path.join("/tmp/duckops-projects", input.projectName);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const healthPath = FRONTEND_FRAMEWORKS.has(input.framework)
    ? input.framework === "nextjs" ? "/api/health" : "/health"
    : "/health";
  const pm = pmCommands(input.packageManager);
  const ctx = { ...input, port, healthPath, pmInstall: pm.install, pmInstallProd: pm.installProd, pmRun: pm.run, pmExec: pm.exec, pmSetup: pm.setup };

  if (input.framework === "turbo") {
    await scaffoldTurbo(input, ctx, outputDir);
  } else if (FRONTEND_FRAMEWORKS.has(input.framework)) {
    await scaffoldFrontend(input, ctx, outputDir);
  } else {
    await scaffoldBackend(input, ctx, outputDir);
  }

  logger.info(`Project scaffolded at: ${outputDir}`);
  return { outputDir };
}

async function scaffoldFrontend(
  input: ScaffoldInput,
  ctx: Record<string, unknown>,
  outputDir: string,
) {
  const fw = input.framework;
  const lang = input.language; // "typescript" or "javascript"
  const isTS = lang === "typescript";
  const ext = isTS ? "ts" : "js";
  const jsxExt = isTS ? "tsx" : "jsx";

  if (fw === "react") {
    const appTpl = await loadTemplate(`frontend/react/${lang}/App.${jsxExt}.hbs`);
    await writeFile(path.join(outputDir, "src", `App.${jsxExt}`), appTpl(ctx));

    const cssTpl = await loadTemplate(`frontend/react/typescript/App.css.hbs`);
    await writeFile(path.join(outputDir, "src", "App.css"), cssTpl(ctx));

    const mainTpl = await loadTemplate(`frontend/react/${lang}/main.${jsxExt}.hbs`);
    await writeFile(path.join(outputDir, "src", `main.${jsxExt}`), mainTpl(ctx));

    const htmlTpl = await loadTemplate(`frontend/react/${lang}/index.html.hbs`);
    await writeFile(path.join(outputDir, "index.html"), htmlTpl(ctx));

    const viteTpl = await loadTemplate(`frontend/react/typescript/vite.config.ts.hbs`);
    await writeFile(path.join(outputDir, `vite.config.${ext}`), viteTpl(ctx));

    const dockerTpl = await loadTemplate("devops/Dockerfile.react.hbs");
    await writeFile(path.join(outputDir, "Dockerfile"), dockerTpl(ctx));

    const nginxTpl = await loadTemplate("devops/nginx.conf.hbs");
    await writeFile(path.join(outputDir, "nginx.conf"), nginxTpl(ctx));

    if (isTS) {
      const tsConfigTpl = await loadTemplate("devops/tsconfig.frontend.json.hbs");
      await writeFile(path.join(outputDir, "tsconfig.json"), tsConfigTpl(ctx));
      const tsNodeConfigTpl = await loadTemplate("devops/tsconfig.node.json.hbs");
      await writeFile(path.join(outputDir, "tsconfig.node.json"), tsNodeConfigTpl(ctx));
    }
  } else if (fw === "vue") {
    // Vue uses .vue files which work for both but with script setup lang="ts"
    const appPath = isTS
      ? "frontend/vue/typescript/App.vue.hbs"
      : "frontend/vue/javascript/App.vue.hbs";
    const appTpl = await loadTemplate(appPath);
    await writeFile(path.join(outputDir, "src", "App.vue"), appTpl(ctx));

    const mainTpl = await loadTemplate(`frontend/vue/${lang}/main.${ext}.hbs`);
    await writeFile(path.join(outputDir, "src", `main.${ext}`), mainTpl(ctx));

    const htmlTpl = await loadTemplate(`frontend/vue/${lang}/index.html.hbs`);
    await writeFile(path.join(outputDir, "index.html"), htmlTpl(ctx));

    const viteTpl = await loadTemplate(`frontend/vue/typescript/vite.config.ts.hbs`);
    await writeFile(path.join(outputDir, `vite.config.${ext}`), viteTpl(ctx));

    const dockerTpl = await loadTemplate("devops/Dockerfile.vue.hbs");
    await writeFile(path.join(outputDir, "Dockerfile"), dockerTpl(ctx));

    const nginxTpl = await loadTemplate("devops/nginx.conf.hbs");
    await writeFile(path.join(outputDir, "nginx.conf"), nginxTpl(ctx));

    if (isTS) {
      const tsConfigTpl = await loadTemplate("devops/tsconfig.frontend.json.hbs");
      await writeFile(path.join(outputDir, "tsconfig.json"), tsConfigTpl(ctx));
      const tsNodeConfigTpl = await loadTemplate("devops/tsconfig.node.json.hbs");
      await writeFile(path.join(outputDir, "tsconfig.node.json"), tsNodeConfigTpl(ctx));
    }
  } else if (fw === "nextjs") {
    // Next.js fallback to typescript templates for now as they are smarter
    const tLang = "typescript";
    const pageTpl = await loadTemplate(`frontend/nextjs/${tLang}/page.tsx.hbs`);
    await writeFile(path.join(outputDir, "app", "page.tsx"), pageTpl(ctx));

    const layoutTpl = await loadTemplate(`frontend/nextjs/${tLang}/layout.tsx.hbs`);
    await writeFile(path.join(outputDir, "app", "layout.tsx"), layoutTpl(ctx));

    const itemsTpl = await loadTemplate(`frontend/nextjs/${tLang}/api-items.ts.hbs`);
    await writeFile(
      path.join(outputDir, "app", "api", "items", "route.ts"),
      itemsTpl(ctx),
    );

    const healthTpl = await loadTemplate(`frontend/nextjs/${tLang}/api-health.ts.hbs`);
    await writeFile(
      path.join(outputDir, "app", "api", "health", "route.ts"),
      healthTpl(ctx),
    );

    const configTpl = await loadTemplate(`frontend/nextjs/${tLang}/next.config.ts.hbs`);
    await writeFile(path.join(outputDir, "next.config.ts"), configTpl(ctx));

    const cssTpl = await loadTemplate(`frontend/nextjs/${tLang}/globals.css.hbs`);
    await writeFile(path.join(outputDir, "app", "globals.css"), cssTpl(ctx));

    await writeFile(path.join(outputDir, "public", ".gitkeep"), "");

    const dockerTpl = await loadTemplate("devops/Dockerfile.nextjs.hbs");
    await writeFile(path.join(outputDir, "Dockerfile"), dockerTpl(ctx));

    // Next.js always needs tsconfig even if JS (until we make JS templates)
    const tsConfigTpl = await loadTemplate("devops/tsconfig.frontend.json.hbs");
    await writeFile(path.join(outputDir, "tsconfig.json"), tsConfigTpl(ctx));
  }

  // All frontends get K8s manifests and Jenkinsfile
  const deployTpl = await loadTemplate("devops/deployment.yaml.hbs");
  await writeFile(path.join(outputDir, "k8s", "deployment.yaml"), deployTpl(ctx));

  const svcTpl = await loadTemplate("devops/service.yaml.hbs");
  await writeFile(path.join(outputDir, "k8s", "service.yaml"), svcTpl(ctx));

  const jenkinsTpl = await loadTemplate("devops/Jenkinsfile.hbs");
  await writeFile(path.join(outputDir, "Jenkinsfile"), jenkinsTpl(ctx));

  await writeFile(
    path.join(outputDir, "package.json"),
    JSON.stringify(generateFrontendPackageJson(input), null, 2),
  );

  await writeFile(
    path.join(outputDir, ".env.example"),
    fw === "nextjs" ? "PORT=3000\n" : "VITE_API_URL=\n",
  );
}

async function scaffoldBackend(
  input: ScaffoldInput,
  ctx: Record<string, unknown>,
  outputDir: string,
) {
  const isTS = input.language === "typescript";
  const ext = isTS ? "ts" : "js";

  // 1. Main application file
  const appTpl = await loadTemplate(`backend/${input.language}/${input.framework}/index.${ext}.hbs`);
  await writeFile(path.join(outputDir, "src", `index.${ext}`), appTpl(ctx));

  // 2. Database client
  const dbTpl = await loadTemplate(
    `databases/${input.database}/${input.orm}/client.${ext}.hbs`,
  );
  await writeFile(path.join(outputDir, "src", `db.${ext}`), dbTpl(ctx));

  // 3. Prisma schema if needed
  if (input.orm === "prisma") {
    const schemaTpl = await loadTemplate(
      `databases/${input.database}/prisma/schema.prisma.hbs`,
    );
    await writeFile(path.join(outputDir, "prisma", "schema.prisma"), schemaTpl(ctx));
  }

  // 4. Drizzle schema if needed
  if (input.orm === "drizzle") {
    const schemaTpl = await loadTemplate(
      `databases/${input.database}/drizzle/schema.${ext}.hbs`,
    );
    await writeFile(path.join(outputDir, "src", `schema.${ext}`), schemaTpl(ctx));
  }

  // 5. Dockerfile
  const dockerTpl = await loadTemplate("devops/Dockerfile.hbs");
  await writeFile(path.join(outputDir, "Dockerfile"), dockerTpl(ctx));

  // 6. Kubernetes manifests
  const deployTpl = await loadTemplate("devops/deployment.yaml.hbs");
  await writeFile(path.join(outputDir, "k8s", "deployment.yaml"), deployTpl(ctx));

  const svcTpl = await loadTemplate("devops/service.yaml.hbs");
  await writeFile(path.join(outputDir, "k8s", "service.yaml"), svcTpl(ctx));

  // 7. Jenkinsfile
  const jenkinsTpl = await loadTemplate("devops/Jenkinsfile.hbs");
  await writeFile(path.join(outputDir, "Jenkinsfile"), jenkinsTpl(ctx));

  // 8. package.json
  await writeFile(
    path.join(outputDir, "package.json"),
    JSON.stringify(generateBackendPackageJson(input), null, 2),
  );

  // 9. tsconfig.json (only for TS)
  if (isTS) {
    await writeFile(
      path.join(outputDir, "tsconfig.json"),
      JSON.stringify(generateBackendTsConfig(), null, 2),
    );
  }

  // 10. .env.example
  await writeFile(path.join(outputDir, ".env.example"), generateEnvExample(input));
}

async function scaffoldTurbo(
  input: ScaffoldInput,
  ctx: Record<string, unknown>,
  outputDir: string,
) {
  const tplDir = "frontend/turbo/typescript";

  // Root monorepo files
  const rootPkgTpl = await loadTemplate(`${tplDir}/root-package.json.hbs`);
  await writeFile(path.join(outputDir, "package.json"), rootPkgTpl(ctx));

  const turboTpl = await loadTemplate(`${tplDir}/turbo.json.hbs`);
  await writeFile(path.join(outputDir, "turbo.json"), turboTpl(ctx));

  await writeFile(
    path.join(outputDir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: true } }, null, 2),
  );

  // ── apps/web (Next.js) ────────────────────────────────────────
  const webPkgTpl = await loadTemplate(`${tplDir}/web-package.json.hbs`);
  await writeFile(path.join(outputDir, "apps", "web", "package.json"), webPkgTpl(ctx));

  const webPageTpl = await loadTemplate(`${tplDir}/web-page.tsx.hbs`);
  await writeFile(path.join(outputDir, "apps", "web", "app", "page.tsx"), webPageTpl(ctx));

  const webLayoutTpl = await loadTemplate(`${tplDir}/web-layout.tsx.hbs`);
  await writeFile(path.join(outputDir, "apps", "web", "app", "layout.tsx"), webLayoutTpl(ctx));

  const webNextTpl = await loadTemplate(`${tplDir}/web-next.config.ts.hbs`);
  await writeFile(path.join(outputDir, "apps", "web", "next.config.ts"), webNextTpl(ctx));

  await writeFile(
    path.join(outputDir, "apps", "web", "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    }, null, 2),
  );

  await writeFile(path.join(outputDir, "apps", "web", "app", "globals.css"), "* { box-sizing: border-box; } body { margin: 0; }\n");
  await writeFile(path.join(outputDir, "apps", "web", ".env.example"), "NEXT_PUBLIC_API_URL=http://localhost:4000\n");

  // ── apps/api (Express + Prisma) ───────────────────────────────
  const apiPkgTpl = await loadTemplate(`${tplDir}/api-package.json.hbs`);
  await writeFile(path.join(outputDir, "apps", "api", "package.json"), apiPkgTpl(ctx));

  const apiIndexTpl = await loadTemplate(`${tplDir}/api-index.ts.hbs`);
  await writeFile(path.join(outputDir, "apps", "api", "src", "index.ts"), apiIndexTpl(ctx));

  const apiDbTpl = await loadTemplate(`${tplDir}/api-db.ts.hbs`);
  await writeFile(path.join(outputDir, "apps", "api", "src", "db.ts"), apiDbTpl(ctx));

  const apiSchemaTpl = await loadTemplate(`${tplDir}/api-schema.prisma.hbs`);
  await writeFile(path.join(outputDir, "apps", "api", "prisma", "schema.prisma"), apiSchemaTpl(ctx));

  const apiSeedTpl = await loadTemplate(`${tplDir}/api-seed.ts.hbs`);
  await writeFile(path.join(outputDir, "apps", "api", "prisma", "seed.ts"), apiSeedTpl(ctx));

  const apiTsCfgTpl = await loadTemplate(`${tplDir}/api-tsconfig.json.hbs`);
  await writeFile(path.join(outputDir, "apps", "api", "tsconfig.json"), apiTsCfgTpl(ctx));

  await writeFile(path.join(outputDir, "apps", "api", ".env.example"), "DATABASE_URL=postgresql://user:password@localhost:5432/{{projectName}}\nPORT=4000\n");

  // ── DevOps ─────────────────────────────────────────────────────
  const dockerTpl = await loadTemplate("devops/Dockerfile.turbo.hbs");
  await writeFile(path.join(outputDir, "Dockerfile"), dockerTpl(ctx));

  const deployTpl = await loadTemplate("devops/deployment.turbo.yaml.hbs");
  await writeFile(path.join(outputDir, "k8s", "deployment.yaml"), deployTpl(ctx));

  const svcTpl = await loadTemplate("devops/service.turbo.yaml.hbs");
  await writeFile(path.join(outputDir, "k8s", "service.yaml"), svcTpl(ctx));

  const jenkinsTpl = await loadTemplate("devops/Jenkinsfile.hbs");
  await writeFile(path.join(outputDir, "Jenkinsfile"), jenkinsTpl(ctx));

  // pnpm workspace config (suppresses pnpm warning about npm workspaces field)
  await writeFile(
    path.join(outputDir, "pnpm-workspace.yaml"),
    "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
  );
}

async function loadTemplate(templatePath: string) {
  const fullPath = path.join(TEMPLATES_DIR, templatePath);
  const content = await fs.readFile(fullPath, "utf-8");
  return Handlebars.compile(content);
}

async function writeFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

// Returns the install / run commands for a given package manager
function pmCommands(pm: string): { install: string; installProd: string; run: string; exec: string; setup: string } {
  switch (pm) {
    case "pnpm": return { install: "npm install -g pnpm && pnpm install", installProd: "npm install -g pnpm && pnpm install --prod", run: "pnpm run", exec: "pnpm exec", setup: "" };
    case "yarn": return { install: "npm install -g yarn && yarn install", installProd: "npm install -g yarn && yarn install --production", run: "yarn", exec: "yarn", setup: "" };
    case "bun":  return { install: "npm install -g bun && bun install",   installProd: "npm install -g bun && bun install --production", run: "bun run", exec: "bunx", setup: "" };
    default:     return { install: "npm install", installProd: "npm install --omit=dev", run: "npm run", exec: "npx", setup: "" };
  }
}

function generateFrontendPackageJson(input: ScaffoldInput) {
  const fw = input.framework;
  const isTS = input.language === "typescript";

  if (fw === "react") {
    const devDeps: Record<string, string> = {
      "@vitejs/plugin-react": "^4.3.0",
      vite: "^6.0.0",
    };
    if (isTS) {
      devDeps.typescript = "^5.7.0";
      devDeps["@types/react"] = "^18.3.0";
      devDeps["@types/react-dom"] = "^18.3.0";
      devDeps["@types/node"] = "^22.0.0";
    }

    return {
      name: input.projectName.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: isTS ? "tsc -b && vite build" : "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.0",
        "react-dom": "^18.3.0",
      },
      devDependencies: devDeps,
    };
  }

  if (fw === "vue") {
    const devDeps: Record<string, string> = {
      "@vitejs/plugin-vue": "^5.2.0",
      vite: "^6.0.0",
    };
    if (isTS) {
      devDeps.typescript = "^5.7.0";
      devDeps["vue-tsc"] = "^2.1.0";
      devDeps["@types/node"] = "^22.0.0";
    }

    return {
      name: input.projectName.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: isTS ? "vue-tsc -b && vite build" : "vite build",
        preview: "vite preview",
      },
      dependencies: {
        vue: "^3.5.0",
      },
      devDependencies: devDeps,
    };
  }

  // nextjs
  const nextDevDeps: Record<string, string> = {
    vitest: "^2.1.0",
  };
  if (isTS) {
    nextDevDeps.typescript = "^5.7.0";
    nextDevDeps["@types/node"] = "^22.0.0";
    nextDevDeps["@types/react"] = "^18.3.0";
    nextDevDeps["@types/react-dom"] = "^18.3.0";
  }

  return {
    name: input.projectName.toLowerCase().replace(/\s+/g, "-"),
    version: "1.0.0",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      test: "vitest run",
    },
    dependencies: {
      next: "^15.0.0",
      react: "^18.3.0",
      "react-dom": "^18.3.0",
    },
    devDependencies: nextDevDeps,
  };
}

function generateBackendPackageJson(input: ScaffoldInput) {
  const isTS = input.language === "typescript";
  const ext = isTS ? "ts" : "js";

  const baseDeps: Record<string, string> = {
    express: "^5.0.0",
    cors: "^2.8.5",
    dotenv: "^16.4.0",
  };

  if (input.framework === "fastify") {
    delete baseDeps.express;
    baseDeps.fastify = "^5.0.0";
    baseDeps["@fastify/cors"] = "^10.0.0";
  }

  const ormDeps: Record<string, Record<string, string>> = {
    prisma: { "@prisma/client": "^6.0.0", prisma: "^6.0.0" },
    drizzle: {
      "drizzle-orm": "^0.36.0",
      "drizzle-kit": "^0.28.0",
      pg: "^8.13.0",
    },
    raw: { pg: "^8.13.0" },
  };

  const devDeps: Record<string, string> = {
    tsx: "^4.19.0",
    vitest: "^2.1.0",
  };

  if (isTS) {
    devDeps.typescript = "^5.7.0";
    devDeps["@types/node"] = "^22.0.0";
    if (input.framework === "express") {
      devDeps["@types/express"] = "^5.0.0";
      devDeps["@types/cors"] = "^2.8.17";
    }
  }

  return {
    name: input.projectName,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: `tsx watch src/index.${ext}`,
      build: isTS ? "tsc" : "echo 'Nothing to build'",
      start: `node ${isTS ? "dist" : "src"}/index.js`,
      test: "vitest run",
    },
    dependencies: { ...baseDeps, ...(ormDeps[input.orm] || {}) },
    devDependencies: devDeps,
  };
}

function generateBackendTsConfig() {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      lib: ["ES2022"],
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };
}

function generateEnvExample(input: ScaffoldInput): string {
  const port = input.port || 3000;
  let dbUrl = "";
  if (input.database === "postgresql") {
    dbUrl = `DATABASE_URL=postgresql://user:password@localhost:5432/${input.projectName}`;
  } else if (input.database === "mysql") {
    dbUrl = `DATABASE_URL=mysql://user:password@localhost:3306/${input.projectName}`;
  }
  return `PORT=${port}\n${dbUrl}\n`;
}
