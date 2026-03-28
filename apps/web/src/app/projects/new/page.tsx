import { Header } from "@/components/layout/Header";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";

export default function NewProjectPage() {
  return (
    <div>
      <Header
        title="Create New Project"
        description="Pick your tech stack and DuckOps handles the rest"
      />
      <CreateProjectForm />
    </div>
  );
}
