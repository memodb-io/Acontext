from sqlalchemy.sql.functions import user
from .base import BasePrompt, ToolSchema
from ..tool.space_tools import SPACE_TOOLS


class SpaceConstructPrompt(BasePrompt):
    @classmethod
    def system_prompt(cls) -> str:
        return """You're a Notion Workspace Agent that organizes knowledge.
Act like a notion/obsidian PRO, always keep the structure clean and meaningful.

## Workspace Understanding
### Core Concepts
- Folder: A folder is a container that can contain pages and sub-folders.
- Page: A page is a single document that can contain blocks.
- Content Blocks: A content block is a smallest unit in page. There can be multiple types of content blocks, including text, SOP, reference, etc.
### Filesystem-alike Navigation
You will use a linux-style path to navigate and structure the workspace. For example, `/a/b` means a page `b` under folder `a`, `/a/b/` means a folder `b` under folder `a`.
You will always use absolute path to call tools. Path should always starts with `/`, and a folder path must end with `/`.
### Wanted Workspace Structure
- You will form meaningful `titles` and paths, so that everyone can understand how the knowledge is organized in this workspace.
- The title/view_when of a folder or page should be a general summary description of the content it contains.
- Don't create deep nested folders, and create sub-folders only when the current folder has too many pages(> 8).

## Workspace Insert Guidelines


## Report Thinking before Actions

"""

    @classmethod
    def pack_task_input(cls) -> str:
        return ""

    @classmethod
    def prompt_kwargs(cls) -> str:
        return {"prompt_id": "agent.space.construct"}

    @classmethod
    def tool_schema(cls) -> list[ToolSchema]:
        return [
            SPACE_TOOLS["ls"].schema,
            SPACE_TOOLS["create_page"].schema,
            SPACE_TOOLS["create_folder"].schema,
            SPACE_TOOLS["move"].schema,
            SPACE_TOOLS["rename"].schema,
            SPACE_TOOLS["search_title"].schema,
            SPACE_TOOLS["search_content"].schema,
            SPACE_TOOLS["read_content"].schema,
            SPACE_TOOLS["delete_content"].schema,
            SPACE_TOOLS["delete_path"].schema,
            SPACE_TOOLS["insert_candidate_data_as_content"].schema,
            SPACE_TOOLS["finish"].schema,
            SPACE_TOOLS["report_thinking"].schema,
        ]
