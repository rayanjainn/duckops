import { Header } from "@/components/layout/Header";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Header
        title="New Project"
        description="Pick your tech stack — DuckOps handles scaffolding, deployment, and CI/CD"
      />
      <CreateProjectForm />
    </div>
  );
}
