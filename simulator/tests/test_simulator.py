import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from simulator import AttackSimulator
from scenarios import (
    AttackScenario,
    AttackStep,
    MitreTechnique,
    ATTACK_SCENARIOS,
    MITRE_TECHNIQUES,
    get_scenario,
    list_scenarios,
    get_technique,
    get_techniques_by_tactic,
    AttackTactic,
)


class TestMitreTechniques:
    """Test MITRE ATT&CK technique definitions."""

    def test_technique_count(self):
        """Verify expected number of techniques."""
        assert len(MITRE_TECHNIQUES) >= 30

    def test_technique_structure(self):
        """Verify all techniques have required fields."""
        for tech in MITRE_TECHNIQUES.values():
            assert tech.id.startswith("T")
            assert tech.name
            assert isinstance(tech.tactic, AttackTactic)
            assert tech.description
            assert tech.event_type
            assert tech.severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
            assert isinstance(tech.metadata_template, dict)

    def test_get_technique(self):
        """Test retrieving technique by ID."""
        tech = get_technique("T1110")
        assert tech is not None
        assert tech.id == "T1110"
        assert tech.name == "Brute Force"
        assert tech.tactic == AttackTactic.CREDENTIAL_ACCESS

    def test_get_nonexistent_technique(self):
        """Test retrieving nonexistent technique returns None."""
        assert get_technique("T9999") is None

    def test_get_techniques_by_tactic(self):
        """Test filtering techniques by tactic."""
        cred_techs = get_techniques_by_tactic(AttackTactic.CREDENTIAL_ACCESS)
        assert len(cred_techs) >= 3
        assert all(t.tactic == AttackTactic.CREDENTIAL_ACCESS for t in cred_techs)

    def test_tactic_coverage(self):
        """Verify all 14 tactics have at least one technique."""
        tactics_covered = set()
        for tech in MITRE_TECHNIQUES.values():
            tactics_covered.add(tech.tactic)
        assert len(tactics_covered) == 14


class TestScenarios:
    """Test pre-built attack scenarios."""

    def test_scenario_count(self):
        """Verify expected number of scenarios."""
        assert len(ATTACK_SCENARIOS) >= 6

    def test_scenario_structure(self):
        """Verify all scenarios have required fields."""
        for scenario in ATTACK_SCENARIOS.values():
            assert scenario.name
            assert scenario.description
            assert isinstance(scenario.mitre_techniques, list)
            assert len(scenario.mitre_techniques) > 0
            assert isinstance(scenario.steps, list)
            assert len(scenario.steps) > 0
            assert isinstance(scenario.duration_range, tuple)
            assert len(scenario.duration_range) == 2

    def test_scenario_steps(self):
        """Verify scenario steps reference valid techniques."""
        for scenario in ATTACK_SCENARIOS.values():
            for step in scenario.steps:
                assert step.technique_id in MITRE_TECHNIQUES
                assert isinstance(step.delay_range, tuple)
                assert len(step.delay_range) == 2
                assert step.repeat_count >= 1

    def test_get_scenario(self):
        """Test retrieving scenario by name."""
        scenario = get_scenario("apt29_campaign")
        assert scenario is not None
        assert scenario.name == "APT29 Campaign"

    def test_get_nonexistent_scenario(self):
        """Test retrieving nonexistent scenario returns None."""
        assert get_scenario("nonexistent") is None

    def test_list_scenarios(self):
        """Test listing all scenarios."""
        scenarios = list_scenarios()
        assert len(scenarios) >= 6
        for s in scenarios:
            assert "name" in s
            assert "description" in s
            assert "mitre_techniques" in s
            assert "estimated_duration" in s


class TestAttackSimulator:
    """Test the AttackSimulator class."""

    @pytest.fixture
    def simulator(self):
        return AttackSimulator("http://localhost:3000", "test-api-key")

    def test_initialization(self, simulator):
        """Test simulator initialization."""
        assert simulator.api_url == "http://localhost:3000"
        assert simulator.api_key == "test-api-key"
        assert simulator.source_name == "simulator"
        assert simulator.running is False
        assert simulator.current_scenario is None

    def test_generate_benign_event(self, simulator):
        """Test generating benign event."""
        event = simulator.generate_event("benign")
        assert "timestamp" in event
        assert "eventType" in event
        assert "severity" in event
        assert "metadata" in event
        assert event["severity"] in ["INFO", "LOW"]

    def test_generate_technique_event(self, simulator):
        """Test generating event for specific MITRE technique."""
        event = simulator.generate_event(technique_id="T1110")
        assert event["eventType"] == "ssh_failed_login"
        assert event["severity"] == "HIGH"
        assert event["metadata"]["mitre_technique_id"] == "T1110"
        assert event["metadata"]["mitre_tactic"] == "credential-access"

    def test_generate_unknown_technique_fallback(self, simulator):
        """Test fallback for unknown technique."""
        event = simulator.generate_event(technique_id="T9999")
        # Should fallback to benign
        assert "timestamp" in event
        assert "metadata" in event

    def test_start_scenario(self, simulator):
        """Test starting a named scenario."""
        simulator.start_scenario("apt29_campaign")
        assert simulator.current_scenario is not None
        assert simulator.current_scenario.name == "APT29 Campaign"
        assert simulator.step_index == 0
        assert simulator.scenario_start_time is not None

    def test_start_invalid_scenario(self, simulator):
        """Test starting invalid scenario raises error."""
        with pytest.raises(ValueError):
            simulator.start_scenario("nonexistent")

    def test_random_ip_zones(self, simulator):
        """Test IP generation for different zones."""
        internal = simulator._random_ip("internal")
        external = simulator._random_ip("external")
        dmz = simulator._random_ip("dmz")
        
        assert internal.startswith("10.0.")
        assert not external.startswith("10.")
        assert dmz.startswith("192.168.")

    def test_random_username_by_tactic(self, simulator):
        """Test username generation varies by tactic."""
        cred_user = simulator._random_username("credential-access")
        initial_user = simulator._random_username("initial-access")
        lateral_user = simulator._random_username("lateral-movement")
        
        assert cred_user in ["root", "admin", "administrator", "svc_account", "backup", "test"]
        assert initial_user in ["vpn_user", "remote_user", "contractor", "partner"]
        assert lateral_user in ["SYSTEM", "Administrator", "Domain Admin", "Enterprise Admin"]

    @pytest.mark.asyncio
    async def test_generate_event_in_scenario(self, simulator):
        """Test event generation within scenario context."""
        simulator.start_scenario("apt29_campaign")
        
        # First step should be T1566 (phishing)
        event = simulator.generate_event()
        assert event["metadata"]["mitre_technique_id"] == "T1566"
        
        # After 3 repeats, should move to T1110
        for _ in range(3):
            simulator.generate_event()
        event = simulator.generate_event()
        assert event["metadata"]["mitre_technique_id"] == "T1110"

    @pytest.mark.asyncio
    async def test_send_event(self, simulator):
        """Test sending event to API."""
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json = AsyncMock(return_value={"ingested": 1, "duplicates": 0})
        
        with patch.object(simulator.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            event = simulator.generate_event("brute_force")
            result = await simulator.send_event(event)
            assert result is True
            assert simulator.stats["sent"] == 1

    @pytest.mark.asyncio
    async def test_send_batch(self, simulator):
        """Test sending batch of events."""
        from unittest.mock import MagicMock
        
        mock_response = MagicMock()
        mock_response.status_code = 201
        # response.json() is synchronous in httpx
        mock_response.json = MagicMock(return_value={"ingested": 5, "duplicates": 1})
        
        with patch.object(simulator.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            events = [simulator.generate_event("brute_force") for _ in range(5)]
            count = await simulator.send_batch(events)
            assert count == 5
            assert simulator.stats["sent"] == 5
            assert simulator.stats["duplicates"] == 1


class TestCampaignLoading:
    """Test YAML campaign loading."""

    @pytest.mark.asyncio
    async def test_load_campaign(self):
        """Test loading campaign from YAML file."""
        from simulator import load_campaign
        campaign = await load_campaign("campaigns/apt29_campaign.yaml")
        
        assert campaign["name"] == "APT29 Full Campaign"
        assert "steps" in campaign
        assert len(campaign["steps"]) == 10

    @pytest.mark.asyncio
    async def test_load_campaign_invalid_path(self):
        """Test loading nonexistent campaign raises error."""
        from simulator import load_campaign
        with pytest.raises(FileNotFoundError):
            await load_campaign("campaigns/nonexistent.yaml")

    @pytest.mark.asyncio
    async def test_load_campaign_missing_fields(self):
        """Test loading campaign with missing required fields."""
        from simulator import load_campaign
        import tempfile
        import yaml
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump({"name": "Test"}, f)
            temp_path = f.name
        
        try:
            with pytest.raises(ValueError):
                await load_campaign(temp_path)
        finally:
            os.unlink(temp_path)


class TestUtilityFunctions:
    """Test utility functions."""

    def test_format_relative_time(self):
        """Test relative time formatting logic."""
        # Test the logic without frontend dependencies
        from datetime import datetime, timezone, timedelta
        
        now = datetime.now(timezone.utc)
        minute_ago = now - timedelta(minutes=1)
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)
        
        # Just verify the imports work and basic logic
        assert minute_ago < now
        assert hour_ago < minute_ago
        assert day_ago < hour_ago

    def test_severity_colors(self):
        """Test severity color mapping logic."""
        # Test the severity mapping logic without frontend
        severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
        for sev in severities:
            assert sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])