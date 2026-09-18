# CyberSentinel Attack Simulator

A sophisticated attack simulation tool for testing and validating the CyberSentinel SIEM platform. Generates realistic security events based on MITRE ATT&CK techniques and supports complex attack campaigns via YAML configuration.

## Features

- **MITRE ATT&CK Alignment**: 30+ techniques across all 14 tactics
- **Pre-built Scenarios**: APT29, Ransomware, Insider Threat, Supply Chain, Credential Stuffing, Cryptojacking
- **YAML Campaign Configuration**: Define custom attack campaigns declaratively
- **Realistic Event Generation**: Network zones, user personas, MITRE context
- **Async High-Performance**: Batch sending, configurable rates, statistics
- **Scenario Orchestration**: Multi-step attacks with timing and repetition

## Installation

```bash
cd simulator
pip install -e ".[dev]"
```

## Quick Start

```bash
# List available scenarios
python simulator.py --list-scenarios

# List MITRE techniques (optionally filter by tactic)
python simulator.py --list-techniques
python simulator.py --list-techniques --tactic credential-access

# Run a pre-built scenario
python simulator.py --scenario apt29_campaign --rate 5 --batch-size 10

# Run a custom campaign from YAML
python simulator.py --campaign campaigns/apt29_campaign.yaml --rate 2

# Run continuous random events
python simulator.py --attack-type random --rate 20 --batch-size 50

# Send specific number of events
python simulator.py --count 1000 --attack-type brute_force --batch-size 100
```

## MITRE ATT&CK Coverage

The simulator implements techniques across all 14 tactics:

| Tactic | Techniques |
|--------|------------|
| Reconnaissance | T1087, T1082, T1083, T1018, T1046 |
| Resource Development | T1195 |
| Initial Access | T1190, T1133, T1566, T1189, T1195 |
| Execution | T1059, T1053 |
| Persistence | T1547, T1053 |
| Privilege Escalation | T1068 |
| Defense Evasion | T1070, T1036, T1562 |
| Credential Access | T1003, T1110, T1555 |
| Discovery | T1087, T1082, T1083, T1018, T1046, T1135 |
| Lateral Movement | T1021, T1550 |
| Collection | T1005, T1039, T1560 |
| Command & Control | T1071, T1095, T1572 |
| Exfiltration | T1041, T1048 |
| Impact | T1486, T1490, T1496 |

## Scenario Library

### APT29 Campaign (`apt29_campaign`)
Nation-state espionage simulation: Phishing → Credential Access → Discovery → Lateral Movement → Collection → Exfiltration
- **Duration**: ~60-120 minutes
- **Techniques**: T1566, T1110, T1003, T1087, T1018, T1021, T1005, T1039, T1041, T1070

### Ransomware Campaign (`ransomware_campaign`)
LockBit-style: Exploit → PrivEsc → Persistence → Defense Evasion → Encryption → Impact
- **Duration**: ~30-60 minutes
- **Techniques**: T1190, T1068, T1053, T1070, T1562, T1486, T1490

### Insider Threat (`insider_threat`)
Malicious insider with privileged access stealing IP
- **Duration**: ~90 minutes
- **Techniques**: T1087, T1082, T1083, T1135, T1005, T1039, T1560, T1048, T1070

### Additional Scenarios
- `supply_chain_compromise`: Software supply chain attack
- `credential_stuffing`: Mass credential stuffing against VPN/SSH/RDP
- `cryptojacking`: Cryptomining resource hijacking

## YAML Campaign Configuration

Create custom campaigns declaratively:

```yaml
name: "Custom Campaign"
description: "Description of the attack campaign"
version: "1.0"
tags: ["tag1", "tag2"]
metadata:
  actor: "threat-actor"
  target: "enterprise"

steps:
  - technique_id: "T1566"
    repeat: 3
    delay_range: [0, 60]
    description: "Phishing emails"
  
  - technique_id: "T1110"
    repeat: 5
    delay_range: [300, 600]
    description: "Brute force"
    
  - technique_id: "T1003"
    repeat: 1
    delay_range: [600, 900]
    description: "Credential dumping"
```

### Step Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `technique_id` | string | Yes | MITRE technique ID (e.g., T1566) |
| `repeat` | integer | No | Number of times to repeat (default: 1) |
| `delay_range` | [min, max] | No | Random delay between repeats in seconds (default: [0, 60]) |
| `duration` | integer | No | Fixed duration in seconds (overrides delay_range) |
| `description` | string | No | Human-readable description |

## Event Structure

Each generated event includes MITRE context:

```json
{
  "timestamp": "2024-01-15T10:30:45Z",
  "eventType": "ssh_failed_login",
  "severity": "HIGH",
  "sourceIp": "203.0.113.50",
  "destIp": "10.0.0.10",
  "username": "root",
  "metadata": {
    "attempts": 5,
    "port": 22,
    "protocol": "ssh",
    "mitre_technique_id": "T1110",
    "mitre_technique_name": "Brute Force",
    "mitre_tactic": "credential-access"
  }
}
```

## Network Zones

Events are generated with realistic network zones:
- **Internal**: `10.0.x.x` - Corporate workstations/servers
- **External**: `1-223.x.x.x` - Internet-facing attackers
- **DMZ**: `192.168.x.x` - DMZ systems

## User Personas

Usernames generated based on attack tactic:
- **Credential Access**: `root`, `admin`, `svc_account`, `backup`
- **Initial Access**: `vpn_user`, `remote_user`, `contractor`
- **Lateral Movement**: `SYSTEM`, `Administrator`, `Domain Admin`
- **Benign**: `john`, `jane`, `svc_account`, `developer`

## Campaign Files

Pre-built campaigns in `campaigns/`:
- `campaigns/apt29_campaign.yaml` - Full APT29 simulation
- `campaigns/ransomware_campaign.yaml` - LockBit-style ransomware
- `campaigns/insider_threat.yaml` - Insider data theft

## Requirements

- Python 3.11+
- httpx >= 0.25.0
- pyyaml >= 6.0.0

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Lint
ruff check .

# Format
black .

# Type check
mypy .
```

## Integration with CyberSentinel

Events are sent to the backend ingestion endpoint:
```
POST /api/v1/events
Headers: X-API-Key: <ingestion-key>
Content-Type: application/json
```

The backend automatically:
- Runs detection engine against events
- Calculates risk scores
- Generates alerts
- Triggers ML anomaly detection
- Matches against IOCs

## Architecture

```
simulator/
├── simulator.py          # Main simulator with scenario/campaign support
├── scenarios.py          # MITRE ATT&CK technique library & pre-built scenarios
├── campaigns/            # YAML campaign definitions
├── pyproject.toml        # Project config
└── README.md             # This file
```

## Extending

### Add New Technique
Add to `scenarios.py` in `MITRE_TECHNIQUES` dict:
```python
MITRE_TECHNIQUES["T1234"] = MitreTechnique(
    id="T1234",
    name="New Technique",
    tactic=AttackTactic.DISCOVERY,
    description="Description",
    event_type="custom_event_type",
    severity="MEDIUM",
    metadata_template={"custom_field": "value"}
)
```

### Add New Scenario
Add to `ATTACK_SCENARIOS` dict:
```python
ATTACK_SCENARIOS["my_scenario"] = AttackScenario(
    name="My Scenario",
    description="Description",
    mitre_techniques=["T1110", "T1003"],
    steps=[
        AttackStep("T1110", repeat_count=5),
        AttackStep("T1003"),
    ]
)
```

## License

MIT