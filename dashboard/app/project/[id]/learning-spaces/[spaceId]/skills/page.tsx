"use client";

import { useRouter } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
import { SkillList, type SkillItem } from "@/components/skill-list";
import { AgentSkill } from "@/types";
import { useLearningSpaceContext } from "../learning-space-layout-client";

export default function SkillsPage() {
  const router = useRouter();
  const { encodedProjectId, skills, returnTo, setExcludeTarget } =
    useLearningSpaceContext();

  const getAgentSkillHref = (skill: SkillItem) => {
    const encodedSkillId = encodeId(skill.id);
    return `/project/${encodedProjectId}/agent-skills/${encodedSkillId}?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const navigateToAgentSkills = (skill: SkillItem) => {
    router.push(getAgentSkillHref(skill));
  };

  return (
    <SkillList
      skills={skills}
      onSkillClick={navigateToAgentSkills}
      getSkillHref={getAgentSkillHref}
      onSkillDelete={(skill) => setExcludeTarget(skill as AgentSkill)}
      emptyMessage="No skills associated. Add a skill to get started."
      deleteLabel="Remove"
      className="overflow-auto flex-1"
    />
  );
}
