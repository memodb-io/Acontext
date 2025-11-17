"""
Tests for SOP Agent Customization Feature

Tests custom scoring rules functionality.
"""
import pytest
from acontext_core.llm.prompt.sop_customization import SOPPromptCustomization
from acontext_core.llm.prompt.task_sop import TaskSOPPrompt
from acontext_core.schema.config import CustomScoringRule, ProjectConfig


class TestSOPPromptCustomization:
    """Test SOPPromptCustomization class"""

    def test_build_custom_scoring_section_empty(self):
        """Test building custom scoring section with no rules"""
        customization = SOPPromptCustomization()
        result = customization.build_custom_scoring_section()
        assert result == ""

    def test_build_custom_scoring_section_normal(self):
        """Test building custom scoring section with normal level rules"""
        rule1 = CustomScoringRule(
            description="If the task involves database operations",
            level="normal"
        )
        rule2 = CustomScoringRule(
            description="If the task requires file I/O",
            level="normal"
        )
        customization = SOPPromptCustomization(custom_scoring_rules=[rule1, rule2])
        result = customization.build_custom_scoring_section(start_index=5)
        
        assert "(c.5)" in result
        assert "(c.6)" in result
        assert "If the task involves database operations" in result
        assert "If the task requires file I/O" in result
        assert "+ 1 point" in result  # normal level = 1 point

    def test_build_custom_scoring_section_critical(self):
        """Test building custom scoring section with critical level rules"""
        rule = CustomScoringRule(
            description="If the task requires external API calls",
            level="critical"
        )
        customization = SOPPromptCustomization(custom_scoring_rules=[rule])
        result = customization.build_custom_scoring_section(start_index=5)
        
        assert "(c.5)" in result
        assert "If the task requires external API calls" in result
        assert "+ 3 points" in result  # critical level = 3 points

    def test_build_custom_scoring_section_mixed(self):
        """Test building custom scoring section with mixed normal and critical rules"""
        rule1 = CustomScoringRule(description="Normal rule", level="normal")
        rule2 = CustomScoringRule(description="Critical rule", level="critical")
        customization = SOPPromptCustomization(custom_scoring_rules=[rule1, rule2])
        result = customization.build_custom_scoring_section(start_index=5)
        
        assert "(c.5)" in result
        assert "(c.6)" in result
        assert "Normal rule" in result
        assert "Critical rule" in result
        assert "+ 1 point" in result  # normal
        assert "+ 3 points" in result  # critical

    def test_get_all_rule_indices_no_custom(self):
        """Test getting rule indices with no custom rules"""
        customization = SOPPromptCustomization()
        indices = customization.get_all_rule_indices(base_count=4)
        assert indices == ["(c.1)", "(c.2)", "(c.3)", "(c.4)"]

    def test_get_all_rule_indices_with_custom(self):
        """Test getting rule indices with custom rules"""
        rule1 = CustomScoringRule(description="Rule 1", level="normal")
        rule2 = CustomScoringRule(description="Rule 2", level="critical")
        customization = SOPPromptCustomization(custom_scoring_rules=[rule1, rule2])
        indices = customization.get_all_rule_indices(base_count=4)
        
        assert len(indices) == 6
        assert indices == ["(c.1)", "(c.2)", "(c.3)", "(c.4)", "(c.5)", "(c.6)"]


class TestTaskSOPPromptWithCustomization:
    """Test TaskSOPPrompt with customization"""

    def test_system_prompt_without_customization(self):
        """Test system prompt generation without customization"""
        prompt = TaskSOPPrompt.system_prompt()
        
        # Should contain base rules
        assert "(c.1)" in prompt
        assert "(c.2)" in prompt
        assert "(c.3)" in prompt
        assert "(c.4)" in prompt
        
        # Should not contain custom rules
        assert "(c.5)" not in prompt
        
        # Report section should reference base rules only
        assert "Give your judgement on (c.1), (c.2), (c.3), (c.4)" in prompt

    def test_system_prompt_with_customization(self):
        """Test system prompt generation with customization"""
        rule1 = CustomScoringRule(
            description="If the task involves database operations",
            level="normal"
        )
        rule2 = CustomScoringRule(
            description="If the task requires external API calls",
            level="critical"
        )
        customization = SOPPromptCustomization(custom_scoring_rules=[rule1, rule2])
        prompt = TaskSOPPrompt.system_prompt(customization=customization)
        
        # Should contain base rules
        assert "(c.1)" in prompt
        assert "(c.2)" in prompt
        assert "(c.3)" in prompt
        assert "(c.4)" in prompt
        
        # Should contain custom rules
        assert "(c.5)" in prompt
        assert "(c.6)" in prompt
        assert "If the task involves database operations" in prompt
        assert "If the task requires external API calls" in prompt
        assert "+ 1 point" in prompt  # normal
        assert "+ 3 points" in prompt  # critical
        
        # Report section should reference all rules
        assert "(c.5)" in prompt
        assert "(c.6)" in prompt
        # Check that report section includes custom rules
        assert "Give your judgement on" in prompt

    def test_system_prompt_customization_appended_not_replaced(self):
        """Test that custom rules are appended, not replacing base rules"""
        rule = CustomScoringRule(description="Custom rule", level="normal")
        customization = SOPPromptCustomization(custom_scoring_rules=[rule])
        prompt = TaskSOPPrompt.system_prompt(customization=customization)
        
        # Base rules should still be present
        assert "(c.1)" in prompt
        assert "(c.2)" in prompt
        assert "(c.3)" in prompt
        assert "(c.4)" in prompt
        
        # Custom rule should be appended
        assert "(c.5)" in prompt
        assert "Custom rule" in prompt


class TestProjectConfigIntegration:
    """Test integration with ProjectConfig"""

    def test_project_config_with_custom_rules(self):
        """Test ProjectConfig with custom scoring rules"""
        custom_rules = [
            CustomScoringRule(description="Test rule 1", level="normal"),
            CustomScoringRule(description="Test rule 2", level="critical"),
        ]
        config = ProjectConfig(
            sop_agent_custom_scoring_rules=custom_rules
        )
        
        assert len(config.sop_agent_custom_scoring_rules) == 2
        assert config.sop_agent_custom_scoring_rules[0].description == "Test rule 1"
        assert config.sop_agent_custom_scoring_rules[0].level == "normal"
        assert config.sop_agent_custom_scoring_rules[1].description == "Test rule 2"
        assert config.sop_agent_custom_scoring_rules[1].level == "critical"

    def test_project_config_without_custom_rules(self):
        """Test ProjectConfig without custom scoring rules (default)"""
        config = ProjectConfig()
        
        assert config.sop_agent_custom_scoring_rules == []
        assert isinstance(config.sop_agent_custom_scoring_rules, list)

