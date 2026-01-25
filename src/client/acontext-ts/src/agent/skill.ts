/**
 * Skill tools for agent operations.
 */

import { AcontextClient } from '../client';
import { Skill } from '../types';
import { AbstractBaseTool, BaseContext, BaseToolPool } from './base';

/**
 * Context for skill tools with preloaded skill name mapping.
 */
export interface SkillContext extends BaseContext {
  client: AcontextClient;
  skills: Map<string, Skill>;
  getContextPrompt(): string;
}

/**
 * Create a SkillContext by preloading skills from a list of skill IDs.
 *
 * @param client - The Acontext client instance.
 * @param skillIds - List of skill UUIDs to preload.
 * @returns SkillContext with preloaded skills mapped by name.
 * @throws Error if duplicate skill names are found.
 */
export async function createSkillContext(
  client: AcontextClient,
  skillIds: string[]
): Promise<SkillContext> {
  const skills = new Map<string, Skill>();

  for (const skillId of skillIds) {
    const skill = await client.skills.get(skillId);
    if (skills.has(skill.name)) {
      const existingSkill = skills.get(skill.name)!;
      throw new Error(
        `Duplicate skill name '${skill.name}' found. ` +
        `Existing ID: ${existingSkill.id}, New ID: ${skill.id}`
      );
    }
    skills.set(skill.name, skill);
  }

  return {
    client,
    skills,
    getContextPrompt(): string {
      if (skills.size === 0) {
        return '';
      }

      const lines: string[] = ['<available_skills>'];
      for (const [skillName, skill] of skills.entries()) {
        lines.push('<skill>');
        lines.push(`<name>${skillName}</name>`);
        lines.push(`<description>${skill.description}</description>`);
        lines.push('</skill>');
      }
      lines.push('</available_skills>');
      const skillSection = lines.join('\n');
      return `<skill_view>
Use get_skill and get_skill_file to view the available skills and their contexts.
Below is the list of available skills:
${skillSection}        
</skill_view>
`;
    },
  };
}

/**
 * Get a skill by name from the preloaded skills.
 *
 * @param ctx - The skill context.
 * @param skillName - The name of the skill.
 * @returns The Skill object.
 * @throws Error if the skill is not found in the context.
 */
export function getSkillFromContext(ctx: SkillContext, skillName: string): Skill {
  const skill = ctx.skills.get(skillName);
  if (!skill) {
    const available =
      ctx.skills.size > 0 ? Array.from(ctx.skills.keys()).join(', ') : '[none]';
    throw new Error(
      `Skill '${skillName}' not found in context. Available skills: ${available}`
    );
  }
  return skill;
}

/**
 * Return list of available skill names in this context.
 */
export function listSkillNamesFromContext(ctx: SkillContext): string[] {
  return Array.from(ctx.skills.keys());
}

export class GetSkillTool extends AbstractBaseTool {
  readonly name = 'get_skill';
  readonly description =
    'Get a skill by its name. Returns the skill information including the relative paths of the files and their mime type categories.';
  readonly arguments = {
    skill_name: {
      type: 'string',
      description: 'The name of the skill.',
    },
  };
  readonly requiredArguments = ['skill_name'];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const skillName = llmArguments.skill_name as string | undefined;

    if (!skillName) {
      throw new Error('skill_name is required');
    }

    const skill = getSkillFromContext(ctx, skillName);

    const fileCount = skill.file_index.length;

    // Format all files with path and MIME type
    let fileList: string;
    if (skill.file_index.length > 0) {
      fileList = skill.file_index
        .map((file) => `  - ${file.path} (${file.mime})`)
        .join('\n');
    } else {
      fileList = '  [NO FILES]';
    }

    return (
      `Skill: ${skill.name} (ID: ${skill.id})\n` +
      `Description: ${skill.description}\n` +
      `Files: ${fileCount} file(s)\n` +
      `${fileList}`
    );
  }
}

export class GetSkillFileTool extends AbstractBaseTool {
  readonly name = 'get_skill_file';
  readonly description =
    "Get a file from a skill by name. The file_path should be a relative path within the skill (e.g., 'scripts/extract_text.json')." +
    'Tips: SKILL.md is the first file you should read to understand the full picture of this skill\'s content.';
  readonly arguments = {
    skill_name: {
      type: 'string',
      description: 'The name of the skill.',
    },
    file_path: {
      type: 'string',
      description:
        "Relative path to the file within the skill (e.g., 'scripts/extract_text.json').",
    },
    expire: {
      type: ['integer', 'null'],
      description:
        'URL expiration time in seconds (only used for non-parseable files). Defaults to 900 (15 minutes).',
    },
  };
  readonly requiredArguments = ['skill_name', 'file_path'];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const skillName = llmArguments.skill_name as string | undefined;
    const filePath = llmArguments.file_path as string;
    const expire = llmArguments.expire as number | undefined;

    if (!skillName) {
      throw new Error('skill_name is required');
    }
    if (!filePath) {
      throw new Error('file_path is required');
    }

    const skill = getSkillFromContext(ctx, skillName);

    const result = await ctx.client.skills.getFile({
      skillId: skill.id,
      filePath,
      expire: expire || null,
    });

    const outputParts: string[] = [
      `File '${result.path}' (MIME: ${result.mime}) from skill '${skillName}':`,
    ];

    if (result.content) {
      outputParts.push(`\nContent (type: ${result.content.type}):`);
      outputParts.push(result.content.raw);
    }

    if (result.url) {
      const expireSeconds = expire || 900;
      outputParts.push(
        `\nDownload URL (expires in ${expireSeconds} seconds):`
      );
      outputParts.push(result.url);
    }

    if (!result.content && !result.url) {
      return `File '${filePath}' retrieved but no content or URL returned.`;
    }

    return outputParts.join('\n');
  }
}

export class SkillToolPool extends BaseToolPool {
  /**
   * Create a SkillContext by preloading skills from a list of skill IDs.
   *
   * @param client - The Acontext client instance.
   * @param skillIds - List of skill UUIDs to preload.
   * @returns Promise resolving to SkillContext with preloaded skills mapped by name.
   */
  async formatContext(
    client: AcontextClient,
    skillIds: string[]
  ): Promise<SkillContext> {
    return createSkillContext(client, skillIds);
  }
}

export const SKILL_TOOLS = new SkillToolPool();
SKILL_TOOLS.addTool(new GetSkillTool());
SKILL_TOOLS.addTool(new GetSkillFileTool());
