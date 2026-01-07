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
    'Get a skill by its name. ' +
    'Returns the skill information including name, description, file index, and metadata.';
  readonly arguments = {
    name: {
      type: 'string',
      description: 'The name of the skill (unique within project).',
    },
  };
  readonly requiredArguments = ['name'];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const name = llmArguments.name as string | undefined;

    if (!name) {
      throw new Error('name is required');
    }

    const skill = await ctx.client.skills.getByName(name);

    const fileCount = skill.file_index.length;
    const fileList = skill.file_index.slice(0, 10).join(', ');
    const moreFiles =
      skill.file_index.length > 10
        ? `, ... (${skill.file_index.length - 10} more)`
        : '';

    return (
      `Skill: ${skill.name} (ID: ${skill.id})\n` +
      `Description: ${skill.description}\n` +
      `Files: ${fileCount} file(s) - ${fileList}${moreFiles}\n` +
      `Created: ${skill.created_at}\n` +
      `Updated: ${skill.updated_at}`
    );
  }
}

export class GetSkillFileTool extends AbstractBaseTool {
  readonly name = 'get_skill_file';
  readonly description =
    'Get a file from a skill by name. ' +
    "The file_path should be a relative path within the skill (e.g., 'scripts/extract_text.json'). " +
    'Can return the file content directly or a presigned URL for downloading. ' +
    'Supports text files, JSON, CSV, and code files.';
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
      type: 'number',
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

    if (!filePath) {
      throw new Error('file_path is required');
    }
    if (!skillName) {
      throw new Error('skill_name is required');
    }

    const result = await ctx.client.skills.getFileByName({
      skillName,
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
  formatContext(client: AcontextClient): SkillContext {
    return {
      client,
    };
  }
}

export const SKILL_TOOLS = new SkillToolPool();
SKILL_TOOLS.addTool(new GetSkillTool());
SKILL_TOOLS.addTool(new GetSkillFileTool());
