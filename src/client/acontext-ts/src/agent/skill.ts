/**
 * Skill tools for agent operations.
 */

import { AcontextClient } from '../client';
import { AbstractBaseTool, BaseContext, BaseToolPool } from './base';

export interface SkillContext extends BaseContext {
  client: AcontextClient;
}

export class GetSkillTool extends AbstractBaseTool {
  readonly name = 'get_skill';
  readonly description =
    'Get a skill by its ID. Return the skill information including the relative paths of the files and their mime type categories';
  readonly arguments = {
    skill_id: {
      type: 'string',
      description: 'The UUID of the skill.',
    },
  };
  readonly requiredArguments = ['skill_id'];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const skillId = llmArguments.skill_id as string | undefined;

    if (!skillId) {
      throw new Error('skill_id is required');
    }

    const skill = await ctx.client.skills.get(skillId);

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
      `${fileList}\n` +
      `Created: ${skill.created_at}\n` +
      `Updated: ${skill.updated_at}`
    );
  }
}

export class GetSkillFileTool extends AbstractBaseTool {
  readonly name = 'get_skill_file';
  readonly description =
    "Get a file from a skill by ID. The file_path should be a relative path within the skill (e.g., 'scripts/extract_text.json').";
  readonly arguments = {
    skill_id: {
      type: 'string',
      description: 'The UUID of the skill.',
    },
    file_path: {
      type: 'string',
      description:
        "Relative path to the file within the skill (e.g., 'scripts/extract_text.json').",
    },
    expire: {
      type: 'number',
      description:
        'URL expiration time in seconds (only used for non-parseable files). Defaults to 900 (15 minutes).',
    },
  };
  readonly requiredArguments = ['skill_id', 'file_path'];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const skillId = llmArguments.skill_id as string | undefined;
    const filePath = llmArguments.file_path as string;
    const expire = llmArguments.expire as number | undefined;

    if (!filePath) {
      throw new Error('file_path is required');
    }
    if (!skillId) {
      throw new Error('skill_id is required');
    }

    const result = await ctx.client.skills.getFile({
      skillId,
      filePath,
      expire: expire || null,
    });

    const outputParts: string[] = [
      `File '${result.path}' (MIME: ${result.mime}) from skill '${skillId}':`,
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
  formatContext(client: AcontextClient): SkillContext {
    return {
      client,
    };
  }
}

export const SKILL_TOOLS = new SkillToolPool();
SKILL_TOOLS.addTool(new GetSkillTool());
SKILL_TOOLS.addTool(new GetSkillFileTool());
