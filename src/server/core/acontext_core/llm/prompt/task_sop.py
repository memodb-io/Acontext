from .base import BasePrompt, ToolSchema


class TaskSOPPrompt(BasePrompt):
    @classmethod
    def system_prompt(cls) -> str:
        return """You're a Tool-calling SOP Agent that read the raw working history between user and agent, and generate a tool-calling SOP for the task.

## What is a Tool-calling SOP?
...

## Input Format

## Output Format

## Thinking Guidelines

"""

    @classmethod
    def pack_task_input(cls, *args, **kwargs) -> str:
        pass

    @classmethod
    def prompt_kwargs(cls) -> str:
        pass

    @classmethod
    def tool_schema(cls) -> list[ToolSchema]:
        pass
