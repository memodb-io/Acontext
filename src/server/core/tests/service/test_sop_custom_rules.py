"""
Integration tests for custom scoring rules in SOP agent.

Tests the complete flow from database config storage to prompt generation.
"""
import pytest
import json
from acontext_core.infra.db import DatabaseClient
from acontext_core.schema.orm import Project
from acontext_core.schema.config import ProjectConfig, CustomScoringRule
from acontext_core.service.data.project import get_project_config
from acontext_core.llm.prompt.task_sop import TaskSOPPrompt
from acontext_core.llm.prompt.sop_customization import SOPPromptCustomization


class TestSOPCustomRules:
    @pytest.mark.asyncio
    async def test_custom_rules_storage_and_loading(self):
        """Test storing and loading custom scoring rules from database"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create Project with custom rules
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            # Set custom scoring rules
            custom_rules = [
                CustomScoringRule(
                    description="If the task involves database operations",
                    level="normal"
                ),
                CustomScoringRule(
                    description="If the task requires external API calls",
                    level="critical"
                ),
            ]
            project_config = ProjectConfig(
                sop_agent_custom_scoring_rules=custom_rules
            )
            project.configs = {
                "project_config": json.loads(project_config.model_dump_json())
            }
            await session.commit()

            # Load config from database
            r = await get_project_config(session, project.id)
            assert r.ok()
            loaded_config, _ = r.unpack()
            
            # Verify custom rules are correctly loaded
            assert len(loaded_config.sop_agent_custom_scoring_rules) == 2
            assert loaded_config.sop_agent_custom_scoring_rules[0].description == "If the task involves database operations"
            assert loaded_config.sop_agent_custom_scoring_rules[0].level == "normal"
            assert loaded_config.sop_agent_custom_scoring_rules[1].description == "If the task requires external API calls"
            assert loaded_config.sop_agent_custom_scoring_rules[1].level == "critical"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_custom_rules_prompt_generation(self):
        """Test prompt generation with custom rules loaded from database"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create Project with custom rules
            project = Project(
                secret_key_hmac="test_key_hmac2", secret_key_hash_phc="test_key_hash2"
            )
            session.add(project)
            await session.flush()

            # Set custom scoring rules
            custom_rules = [
                CustomScoringRule(
                    description="If the task involves database operations",
                    level="normal"
                ),
                CustomScoringRule(
                    description="If the task requires external API calls",
                    level="critical"
                ),
            ]
            project_config = ProjectConfig(
                sop_agent_custom_scoring_rules=custom_rules
            )
            project.configs = {
                "project_config": json.loads(project_config.model_dump_json())
            }
            await session.commit()

            # Load config from database
            r = await get_project_config(session, project.id)
            assert r.ok()
            loaded_config, _ = r.unpack()
            
            # Generate prompt with loaded config
            customization = SOPPromptCustomization(
                custom_scoring_rules=loaded_config.sop_agent_custom_scoring_rules
            )
            prompt = TaskSOPPrompt.system_prompt(customization=customization)
            
            # Verify base rules are present
            assert "(c.1)" in prompt
            assert "(c.2)" in prompt
            assert "(c.3)" in prompt
            assert "(c.4)" in prompt
            
            # Verify custom rules are appended
            assert "(c.5)" in prompt
            assert "(c.6)" in prompt
            assert "If the task involves database operations" in prompt
            assert "If the task requires external API calls" in prompt
            
            # Verify scores are correct
            assert "+ 1 point" in prompt  # normal level
            assert "+ 3 points" in prompt  # critical level
            
            # Verify report section includes all rules
            assert "Give your judgement on" in prompt
            assert "(c.5)" in prompt
            assert "(c.6)" in prompt

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_default_config_without_custom_rules(self):
        """Test default behavior when no custom rules are configured"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create Project without custom rules
            project = Project(
                secret_key_hmac="test_key_hmac3", secret_key_hash_phc="test_key_hash3"
            )
            session.add(project)
            await session.flush()
            await session.commit()

            # Load config from database (should use default)
            r = await get_project_config(session, project.id)
            assert r.ok()
            loaded_config, _ = r.unpack()
            
            # Verify no custom rules
            assert len(loaded_config.sop_agent_custom_scoring_rules) == 0

            # Verify prompt generation without custom rules
            prompt = TaskSOPPrompt.system_prompt()
            
            # Should only have base rules
            assert "(c.1)" in prompt
            assert "(c.2)" in prompt
            assert "(c.3)" in prompt
            assert "(c.4)" in prompt
            assert "(c.5)" not in prompt
            
            # Report section should only reference base rules
            assert "Give your judgement on (c.1), (c.2), (c.3), (c.4)" in prompt

            await session.delete(project)

