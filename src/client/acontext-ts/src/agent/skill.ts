/**
 * Skill tools for agent operations.
 */

import { AcontextClient } from '../client';
import { FileUpload } from '../uploads';
import { AbstractBaseTool, BaseContext, BaseToolPool } from './base';

export interface SkillContext extends BaseContext {
  client: AcontextClient;
}

export class CreateSkillTool extends AbstractBaseTool {
  readonly name = 'create_skill';
  readonly description =
    'Create a new agent skill by uploading a ZIP file. ' +
    'The ZIP file must contain a SKILL.md file (case-insensitive) with YAML format ' +
    "containing 'name' and 'description' fields. " +
    'Returns the created skill with its ID, name, description, and file index.';
  readonly arguments = {
    file_path: {
      type: 'string',
      description: 'Local file path to the ZIP file containing the skill.',
    },
    meta: {
      type: 'object',
      description: 'Optional custom metadata as a JSON object.',
    },
  };
  readonly requiredArguments = ['file_path'];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const filePath = llmArguments.file_path as string;
    const meta = llmArguments.meta as Record<string, unknown> | undefined;

    if (!filePath) {
      throw new Error('file_path is required');
    }

    // Check if we're in a Node.js environment
    if (typeof process === 'undefined' || !process.versions?.node) {
      throw new Error(
        'create_skill tool with file_path is only available in Node.js environments. ' +
          'In browser environments, use the SDK directly with File/Blob objects.'
      );
    }

    // Dynamic import for Node.js fs module
    const fs = await import('fs/promises');
    let fileContent: Buffer;
    try {
      fileContent = await fs.readFile(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`File not found: ${filePath} - ${error.message}`);
      }
      throw new Error(`Failed to read file: ${filePath}`);
    }

    const filename = filePath.split(/[/\\]/).pop() || 'skill.zip';
    const upload = new FileUpload({
      filename,
      content: fileContent,
      contentType: 'application/zip',
    });

    const skill = await ctx.client.skills.create({ file: upload, meta });
    const fileCount = skill.file_index.length;
    return (
      `Skill '${skill.name}' created successfully (ID: ${skill.id}). ` +
      `Description: ${skill.description}. ` +
      `Contains ${fileCount} file(s).`
    );
  }
}

export class GetSkillTool extends AbstractBaseTool {
  readonly name = 'get_skill';
  readonly description =
    'Get a skill by its ID or name. ' +
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

export class ListSkillsTool extends AbstractBaseTool {
  readonly name = 'list_skills';
  readonly description =
    'List all skills in the project. ' +
    'Returns a list of skills with their names, descriptions, and file counts.';
  readonly arguments = {
    limit: {
      type: 'number',
      description: 'Maximum number of skills to return. Defaults to 20.',
    },
    time_desc: {
      type: 'boolean',
      description:
        'Order by created_at descending if true, ascending if false. Defaults to false.',
    },
  };
  readonly requiredArguments: string[] = [];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const limit = (llmArguments.limit as number) || 20;
    const timeDesc = (llmArguments.time_desc as boolean) || false;

    const result = await ctx.client.skills.list({ limit, timeDesc });

    if (result.items.length === 0) {
      return 'No skills found in the project.';
    }

    const outputParts = [`Found ${result.items.length} skill(s):`];
    for (const skill of result.items) {
      const fileCount = skill.file_index.length;
      outputParts.push(
        `  - ${skill.name} (ID: ${skill.id}): ${skill.description} ` +
          `(${fileCount} file(s))`
      );
    }

    if (result.has_more) {
      outputParts.push('\n(More skills available, use cursor for pagination)');
    }

    return outputParts.join('\n');
  }
}

export class UpdateSkillTool extends AbstractBaseTool {
  readonly name = 'update_skill';
  readonly description =
    "Update a skill's metadata (name, description, or custom metadata). " +
    'Note: This only updates metadata, not the skill files themselves.';
  readonly arguments = {
    skill_id: {
      type: 'string',
      description: 'The UUID of the skill to update.',
    },
    name: {
      type: 'string',
      description: 'Optional new name for the skill.',
    },
    description: {
      type: 'string',
      description: 'Optional new description for the skill.',
    },
    meta: {
      type: 'object',
      description: 'Optional custom metadata as a JSON object.',
    },
  };
  readonly requiredArguments = ['skill_id'];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const skillId = llmArguments.skill_id as string;
    const name = llmArguments.name as string | undefined;
    const description = llmArguments.description as string | undefined;
    const meta = llmArguments.meta as Record<string, unknown> | undefined;

    if (!skillId) {
      throw new Error('skill_id is required');
    }

    if (!name && !description && !meta) {
      throw new Error(
        'At least one of name, description, or meta must be provided'
      );
    }

    const skill = await ctx.client.skills.update(skillId, {
      name: name || null,
      description: description || null,
      meta: meta || null,
    });

    return (
      `Skill '${skill.name}' (ID: ${skill.id}) updated successfully. ` +
      `Description: ${skill.description}`
    );
  }
}

export class DeleteSkillTool extends AbstractBaseTool {
  readonly name = 'delete_skill';
  readonly description =
    'Delete a skill by its ID. ' +
    'This will delete the skill and all its associated files from storage.';
  readonly arguments = {
    skill_id: {
      type: 'string',
      description: 'The UUID of the skill to delete.',
    },
  };
  readonly requiredArguments = ['skill_id'];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const skillId = llmArguments.skill_id as string;

    if (!skillId) {
      throw new Error('skill_id is required');
    }

    await ctx.client.skills.delete(skillId);

    return `Skill (ID: ${skillId}) deleted successfully.`;
  }
}

export class ListSkillsCatalogTool extends AbstractBaseTool {
  readonly name = 'list_skills_catalog';
  readonly description =
    'Get a catalog of all skills in the project. Returns a JSON object containing skill names and descriptions only.';

  readonly arguments = {
    limit: {
      type: 'number',
      description: 'Maximum number of skills to return. Defaults to 100.',
    },
    time_desc: {
      type: 'boolean',
      description:
        'Order by created_at descending if true, ascending if false. Defaults to false.',
    },
  };
  readonly requiredArguments: string[] = [];

  async execute(
    ctx: SkillContext,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const limit = (llmArguments.limit as number | undefined) || 100;
    const timeDesc = (llmArguments.time_desc as boolean | undefined) || false;

    const catalog = await ctx.client.skills.listCatalog({
      limit,
      timeDesc,
    });

    return JSON.stringify(catalog, null, 2);
  }
}

export class GetSkillFileTool extends AbstractBaseTool {
  readonly name = 'get_skill_file';
  readonly description =
    'Get a file from a skill by ID or name. ' +
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
      // Show content preview (first 500 chars for long files)
      let contentPreview = result.content.raw;
      if (contentPreview.length > 500) {
        contentPreview = contentPreview.substring(0, 500) + '\n... (truncated)';
      }
      outputParts.push(contentPreview);
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
SKILL_TOOLS.addTool(new CreateSkillTool());
SKILL_TOOLS.addTool(new GetSkillTool());
SKILL_TOOLS.addTool(new ListSkillsTool());
SKILL_TOOLS.addTool(new ListSkillsCatalogTool());
SKILL_TOOLS.addTool(new UpdateSkillTool());
SKILL_TOOLS.addTool(new DeleteSkillTool());
SKILL_TOOLS.addTool(new GetSkillFileTool());

