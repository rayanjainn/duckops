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
  port?: number;
}

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

const FRONTEND_FRAMEWORKS = new Set(["react", "vue", "nextjs"]);

export async function scaffoldProject(input: ScaffoldInput): Promise<{ outputDir: string }> {
  const port = input.port || 3000;
  const outputDir = path.join("/tmp/duckops-projects", input.projectName);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const ctx = { ...input, port };

  if (FRONTEND_FRAMEWORKS.has(input.framework)) {
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

  if (fw === "react") {
    const appTpl = await loadTemplate("frontend/react/App.tsx.hbs");
    await writeFile(path.join(outputDir, "src", "App.tsx"), appTpl(ctx));

    const cssTpl = await loadTemplate("frontend/react/App.css.hbs");
    await writeFile(path.join(outputDir, "src", "App.css"), cssTpl(ctx));

    const mainTpl = await loadTemplate("frontend/react/main.tsx.hbs");
    await writeFile(path.join(outputDir, "src", "main.tsx"), mainTpl(ctx));

    const htmlTpl = await loadTemplate("frontend/react/index.html.hbs");
    await writeFile(path.join(outputDir, "index.html"), htmlTpl(ctx));

    const viteTpl = await loadTemplate("frontend/react/vite.config.ts.hbs");
    await writeFile(path.join(outputDir, "vite.config.ts"), viteTpl(ctx));

    const dockerTpl = await loadTemplate("devops/Dockerfile.react.hbs");
    await writeFile(path.join(outputDir, "Dockerfile"), dockerTpl(ctx));

    const nginxTpl = await loadTemplate("devops/nginx.conf.hbs");
    await writeFile(path.join(outputDir, "nginx.conf"), nginxTpl(ctx));

  } else if (fw === "vue") {
    const appTpl = await loadTemplate("frontend/vue/App.vue.hbs");
    await writeFile(path.join(outputDir, "src", "App.vue"), appTpl(ctx));

    const mainTpl = await loadTemplate("frontend/vue/main.ts.hbs");
    await writeFile(path.join(outputDir, "src", "main.ts"), mainTpl(ctx));

    const htmlTpl = await loadTemplate("frontend/vue/index.html.hbs");
    await writeFile(path.join(outputDir, "index.html"), htmlTpl(ctx));

    const viteTpl = await loadTemplate("frontend/vue/vite.config.ts.hbs");
    await writeFile(path.join(outputDir, "vite.config.ts"), viteTpl(ctx));

    const dockerTpl = await loadTemplate("devops/Dockerfile.vue.hbs");
    await writeFile(path.join(outputDir, "Dockerfile"), dockerTpl(ctx));

    const nginxTpl = await loadTemplate("devops/nginx.conf.hbs");
    await writeFile(path.join(outputDir, "nginx.conf"), nginxTpl(ctx));

  } else if (fw === "nextjs") {
    const pageTpl = await loadTemplate("frontend/nextjs/page.tsx.hbs");
    await writeFile(path.join(outputDir, "app", "page.tsx"), pageTpl(ctx));

    const layoutTpl = await loadTemplate("frontend/nextjs/layout.tsx.hbs");
    await writeFile(path.join(outputDir, "app", "layout.tsx"), layoutTpl(ctx));

    const itemsTpl = await loadTemplate("frontend/nextjs/api-items.ts.hbs");
    await writeFile(path.join(outputDir, "app", "api", "items", "route.ts"), itemsTpl(ctx));

    const healthTpl = await loadTemplate("frontend/nextjs/api-health.ts.hbs");
    await writeFile(path.join(outputDir, "app", "api", "health", "route.ts"), healthTpl(ctx));

    const configTpl = await loadTemplate("frontend/nextjs/next.config.ts.hbs");
    await writeFile(path.join(outputDir, "next.config.ts"), configTpl(ctx));

    // Next.js needs a public dir
    await fs.mkdir(path.join(outputDir, "public"), { recursive: true });

    const dockerTpl = await loadTemplate("devops/Dockerfile.nextjs.hbs");
    await writeFile(path.join(outputDir, "Dockerfile"), dockerTpl(ctx));
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
  // 1. Main application file
  const appTpl = await loadTemplate(`nodejs/${input.framework}/index.ts.hbs`);
  await writeFile(path.join(outputDir, "src", "index.ts"), appTpl(ctx));

  // 2. Database client
  const dbTpl = await loadTemplate(
    `databases/${input.database}/${input.orm}/client.ts.hbs`,
  );
  await writeFile(path.join(outputDir, "src", "db.ts"), dbTpl(ctx));

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
      `databases/${input.database}/drizzle/schema.ts.hbs`,
    );
    await writeFile(path.join(outputDir, "src", "schema.ts"), schemaTpl(ctx));
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

  // 9. tsconfig.json
  await writeFile(
    path.join(outputDir, "tsconfig.json"),
    JSON.stringify(generateBackendTsConfig(), null, 2),
  );

  // 10. .env.example
  await writeFile(path.join(outputDir, ".env.example"), generateEnvExample(input));
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

function generateFrontendPackageJson(input: ScaffoldInput) {
  const fw = input.framework;

  if (fw === "react") {
    return {
      name: input.projectName,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc -b && vite build",
        preview: "vite preview",
        test: "vitest run",
      },
      dependencies: {
        react: "^18.3.0",
        "react-dom": "^18.3.0",
      },
      devDependencies: {
        "@types/react": "^18.3.0",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.0",
        typescript: "^5.7.0",
        vite: "^6.0.0",
        vitest: "^2.1.0",
      },
    };
  }

  if (fw === "vue") {
    return {
      name: input.projectName,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vue-tsc -b && vite build",
        preview: "vite preview",
        test: "vitest run",
      },
      dependencies: {
        vue: "^3.5.0",
      },
      devDependencies: {
        "@vitejs/plugin-vue": "^5.2.0",
        "vue-tsc": "^2.1.0",
        typescript: "^5.7.0",
        vite: "^6.0.0",
        vitest: "^2.1.0",
      },
    };
  }

  // nextjs
  return {
    name: input.projectName,
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
    devDependencies: {
      "@types/node": "^22.0.0",
      "@types/react": "^18.3.0",
      "@types/react-dom": "^18.3.0",
      typescript: "^5.7.0",
      vitest: "^2.1.0",
    },
  };
}

function generateBackendPackageJson(input: ScaffoldInput) {
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
    typescript: "^5.7.0",
    tsx: "^4.19.0",
    "@types/node": "^22.0.0",
    vitest: "^2.1.0",
  };

  if (input.framework === "express") {
    devDeps["@types/express"] = "^5.0.0";
    devDeps["@types/cors"] = "^2.8.17";
  }

  return {
    name: input.projectName,
    version: "1.0.0",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
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
      module: "commonjs",
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
