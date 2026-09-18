"""
MITRE ATT&CK Scenario Library for CyberSentinel Attack Simulator

Maps attack scenarios to MITRE ATT&CK techniques and tactics.
Each scenario defines a sequence of events that simulate a specific attack pattern.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import random
import hashlib
from datetime import datetime, timedelta


class AttackTactic(str, Enum):
    RECONNAISSANCE = "reconnaissance"
    RESOURCE_DEVELOPMENT = "resource-development"
    INITIAL_ACCESS = "initial-access"
    EXECUTION = "execution"
    PERSISTENCE = "persistence"
    PRIVILEGE_ESCALATION = "privilege-escalation"
    DEFENSE_EVASION = "defense-evasion"
    CREDENTIAL_ACCESS = "credential-access"
    DISCOVERY = "discovery"
    LATERAL_MOVEMENT = "lateral-movement"
    COLLECTION = "collection"
    COMMAND_AND_CONTROL = "command-and-control"
    EXFILTRATION = "exfiltration"
    IMPACT = "impact"


@dataclass
class MitreTechnique:
    id: str
    name: str
    tactic: AttackTactic
    description: str
    event_type: str
    severity: str
    metadata_template: Dict[str, Any] = field(default_factory=dict)


# MITRE ATT&CK Technique Library
MITRE_TECHNIQUES: Dict[str, MitreTechnique] = {
    # Initial Access
    "T1190": MitreTechnique(
        id="T1190",
        name="Exploit Public-Facing Application",
        tactic=AttackTactic.INITIAL_ACCESS,
        description="Adversaries exploit vulnerabilities in public-facing applications",
        event_type="web_exploit_attempt",
        severity="HIGH",
        metadata_template={"vulnerability": "CVE-2021-44228", "exploit_type": "RCE"}
    ),
    "T1133": MitreTechnique(
        id="T1133",
        name="External Remote Services",
        tactic=AttackTactic.INITIAL_ACCESS,
        description="Adversaries leverage external remote services like VPNs, Citrix, etc.",
        event_type="vpn_login_attempt",
        severity="MEDIUM",
        metadata_template={"service": "vpn", "auth_method": "password"}
    ),
    "T1566": MitreTechnique(
        id="T1566",
        name="Phishing",
        tactic=AttackTactic.INITIAL_ACCESS,
        description="Adversaries send phishing messages to gain access",
        event_type="email_received",
        severity="MEDIUM",
        metadata_template={"attachment_type": "malicious", "sender": "spoofed@domain.com"}
    ),
    "T1189": MitreTechnique(
        id="T1189",
        name="Drive-by Compromise",
        tactic=AttackTactic.INITIAL_ACCESS,
        description="Adversaries gain access via compromised websites",
        event_type="web_drive_by",
        severity="HIGH",
        metadata_template={"exploit_kit": "rig", "browser": "Chrome"}
    ),

    # Execution
    "T1059": MitreTechnique(
        id="T1059",
        name="Command and Scripting Interpreter",
        tactic=AttackTactic.EXECUTION,
        description="Adversaries execute commands via shell, PowerShell, etc.",
        event_type="process_execution",
        severity="HIGH",
        metadata_template={"interpreter": "powershell", "command": "Invoke-Expression"}
    ),
    "T1053": MitreTechnique(
        id="T1053",
        name="Scheduled Task/Job",
        tactic=AttackTactic.EXECUTION,
        description="Adversaries schedule tasks for persistence or execution",
        event_type="scheduled_task_created",
        severity="MEDIUM",
        metadata_template={"task_name": "Updater", "trigger": "logon"}
    ),

    # Persistence
    "T1547": MitreTechnique(
        id="T1547",
        name="Boot or Logon Autostart Execution",
        tactic=AttackTactic.PERSISTENCE,
        description="Adversaries configure autostart mechanisms",
        event_type="registry_modification",
        severity="MEDIUM",
        metadata_template={"registry_key": "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"}
    ),

    # Privilege Escalation
    "T1068": MitreTechnique(
        id="T1068",
        name="Exploitation for Privilege Escalation",
        tactic=AttackTactic.PRIVILEGE_ESCALATION,
        description="Adversaries exploit vulnerabilities for higher privileges",
        event_type="privilege_escalation_attempt",
        severity="CRITICAL",
        metadata_template={"vulnerability": "CVE-2021-34527", "target": "SYSTEM"}
    ),

    # Defense Evasion
    "T1070": MitreTechnique(
        id="T1070",
        name="Indicator Removal",
        tactic=AttackTactic.DEFENSE_EVASION,
        description="Adversaries delete logs, files, or other artifacts",
        event_type="log_cleared",
        severity="HIGH",
        metadata_template={"log_type": "Security", "method": "wevtutil"}
    ),
    "T1036": MitreTechnique(
        id="T1036",
        name="Masquerading",
        tactic=AttackTactic.DEFENSE_EVASION,
        description="Adversaries disguise malicious artifacts as legitimate",
        event_type="file_masquerade",
        severity="MEDIUM",
        metadata_template={"original_name": "svchost.exe", "fake_path": "C:\\Temp\\svchost.exe"}
    ),

    # Credential Access
    "T1003": MitreTechnique(
        id="T1003",
        name="OS Credential Dumping",
        tactic=AttackTactic.CREDENTIAL_ACCESS,
        description="Adversaries dump credentials from memory",
        event_type="credential_dump",
        severity="CRITICAL",
        metadata_template={"tool": "mimikatz", "target": "lsass.exe"}
    ),
    "T1110": MitreTechnique(
        id="T1110",
        name="Brute Force",
        tactic=AttackTactic.CREDENTIAL_ACCESS,
        description="Adversaries brute force credentials",
        event_type="ssh_failed_login",
        severity="HIGH",
        metadata_template={"protocol": "ssh", "attempts": 0}
    ),
    "T1555": MitreTechnique(
        id="T1555",
        name="Credentials from Password Stores",
        tactic=AttackTactic.CREDENTIAL_ACCESS,
        description="Adversaries extract credentials from password managers",
        event_type="credential_store_access",
        severity="HIGH",
        metadata_template={"store": "Chrome", "method": "SQLite query"}
    ),

    # Discovery
    "T1087": MitreTechnique(
        id="T1087",
        name="Account Discovery",
        tactic=AttackTactic.DISCOVERY,
        description="Adversaries enumerate accounts",
        event_type="account_enumeration",
        severity="LOW",
        metadata_template={"method": "net user", "domain": "corp"}
    ),
    "T1018": MitreTechnique(
        id="T1018",
        name="Remote System Discovery",
        tactic=AttackTactic.DISCOVERY,
        description="Adversaries scan for remote systems",
        event_type="network_scan",
        severity="MEDIUM",
        metadata_template={"method": "arp-scan", "subnet": "10.0.0.0/24"}
    ),
    "T1082": MitreTechnique(
        id="T1082",
        name="System Information Discovery",
        tactic=AttackTactic.DISCOVERY,
        description="Adversaries gather system info",
        event_type="system_info_query",
        severity="LOW",
        metadata_template={"query": "systeminfo", "fields": ["OS", "Hotfixes"]}
    ),
    "T1046": MitreTechnique(
        id="T1046",
        name="Network Service Scanning",
        tactic=AttackTactic.DISCOVERY,
        description="Adversaries scan for open ports/services",
        event_type="port_scan",
        severity="MEDIUM",
        metadata_template={"scanner": "nmap", "ports": "1-65535"}
    ),

    # Lateral Movement
    "T1021": MitreTechnique(
        id="T1021",
        name="Remote Services",
        tactic=AttackTactic.LATERAL_MOVEMENT,
        description="Adversaries use remote services for lateral movement",
        event_type="smb_session_created",
        severity="HIGH",
        metadata_template={"service": "SMB", "target": "ADMIN$"}
    ),
    "T1550": MitreTechnique(
        id="T1550",
        name="Use Alternate Authentication Material",
        tactic=AttackTactic.LATERAL_MOVEMENT,
        description="Adversaries use stolen tokens/hashes for lateral movement",
        event_type="pass_the_hash",
        severity="CRITICAL",
        metadata_template={"hash": "aad3b435b51404eeaad3b435b51404ee", "type": "NTLM"}
    ),

    # Collection
    "T1005": MitreTechnique(
        id="T1005",
        name="Data from Local System",
        tactic=AttackTactic.COLLECTION,
        description="Adversaries collect files from local system",
        event_type="file_collection",
        severity="HIGH",
        metadata_template={"paths": ["C:\\Users\\*\\Documents", "C:\\Users\\*\\Desktop"], "size_mb": 500}
    ),
    "T1039": MitreTechnique(
        id="T1039",
        name="Data from Network Shared Drive",
        tactic=AttackTactic.COLLECTION,
        description="Adversaries collect data from network shares",
        event_type="network_share_access",
        severity="HIGH",
        metadata_template={"share": "\\\\fileserver\\data", "files_accessed": 150}
    ),

    # Command and Control
    "T1071": MitreTechnique(
        id="T1071",
        name="Application Layer Protocol",
        tactic=AttackTactic.COMMAND_AND_CONTROL,
        description="Adversaries use application layer protocols for C2",
        event_type="c2_http_beacon",
        severity="CRITICAL",
        metadata_template={"protocol": "HTTP", "domain": "c2.example.com", "interval": 60}
    ),
    "T1095": MitreTechnique(
        id="T1095",
        name="Non-Application Layer Protocol",
        tactic=AttackTactic.COMMAND_AND_CONTROL,
        description="Adversaries use non-standard protocols for C2",
        event_type="c2_dns_tunnel",
        severity="CRITICAL",
        metadata_template={"protocol": "DNS", "domain": "tunnel.example.com"}
    ),
    "T1572": MitreTechnique(
        id="T1572",
        name="Protocol Tunneling",
        tactic=AttackTactic.COMMAND_AND_CONTROL,
        description="Adversaries tunnel traffic through legitimate protocols",
        event_type="protocol_tunnel",
        severity="HIGH",
        metadata_template={"outer_protocol": "HTTPS", "inner_protocol": "SSH"}
    ),

    # Exfiltration
    "T1041": MitreTechnique(
        id="T1041",
        name="Exfiltration Over Command and Control Channel",
        tactic=AttackTactic.EXFILTRATION,
        description="Adversaries exfiltrate data over C2 channel",
        event_type="data_exfiltration",
        severity="CRITICAL",
        metadata_template={"data_size_mb": 2048, "channel": "C2 HTTP"}
    ),
    "T1048": MitreTechnique(
        id="T1048",
        name="Exfiltration Over Alternative Protocol",
        tactic=AttackTactic.EXFILTRATION,
        description="Adversaries exfiltrate via non-C2 protocols",
        event_type="exfiltration_dns",
        severity="CRITICAL",
        metadata_template={"protocol": "DNS", "data_size_kb": 1024}
    ),

    # Impact
    "T1486": MitreTechnique(
        id="T1486",
        name="Data Encrypted for Impact",
        tactic=AttackTactic.IMPACT,
        description="Adversaries encrypt data for ransomware",
        event_type="ransomware_encryption",
        severity="CRITICAL",
        metadata_template={"variant": "LockBit 3.0", "files_encrypted": 50000}
    ),
    "T1490": MitreTechnique(
        id="T1490",
        name="Inhibit System Recovery",
        tactic=AttackTactic.IMPACT,
        description="Adversaries delete backups/shadow copies",
        event_type="shadow_copy_deletion",
        severity="CRITICAL",
        metadata_template={"method": "vssadmin delete shadows", "target": "all"}
    ),
}


@dataclass
class AttackStep:
    technique_id: str
    delay_range: tuple = (0, 60)  # seconds between steps
    repeat_count: int = 1
    conditions: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AttackScenario:
    name: str
    description: str
    mitre_techniques: List[str]
    steps: List[AttackStep]
    duration_range: tuple = (300, 3600)  # total scenario duration in seconds
    metadata: Dict[str, Any] = field(default_factory=dict)


# Pre-built Attack Scenarios
ATTACK_SCENARIOS: Dict[str, AttackScenario] = {
    "apt29_campaign": AttackScenario(
        name="APT29 Campaign",
        description="Simulates APT29 (Cozy Bear) style campaign: phishing -> credential access -> lateral movement -> exfiltration",
        mitre_techniques=["T1566", "T1110", "T1003", "T1021", "T1005", "T1041"],
        steps=[
            AttackStep("T1566", delay_range=(0, 60), repeat_count=3),  # Phishing emails
            AttackStep("T1110", delay_range=(300, 600), repeat_count=5),  # Brute force after phishing
            AttackStep("T1003", delay_range=(600, 900)),  # Credential dumping
            AttackStep("T1021", delay_range=(1200, 1800), repeat_count=3),  # Lateral movement
            AttackStep("T1005", delay_range=(2400, 3000)),  # Data collection
            AttackStep("T1041", delay_range=(3000, 3600)),  # Exfiltration
        ],
        duration_range=(3600, 7200),
        metadata={"actor": "APT29", "sophistication": "high", "target_sector": "government"}
    ),

    "ransomware_attack": AttackScenario(
        name="Ransomware Attack",
        description="Ransomware campaign: initial access -> privilege escalation -> encryption -> ransom",
        mitre_techniques=["T1190", "T1068", "T1547", "T1070", "T1486", "T1490"],
        steps=[
            AttackStep("T1190", delay_range=(0, 60)),  # Exploit public app
            AttackStep("T1068", delay_range=(60, 300)),  # Privilege escalation
            AttackStep("T1547", delay_range=(300, 600), repeat_count=2),  # Persistence
            AttackStep("T1070", delay_range=(600, 900)),  # Clear logs
            AttackStep("T1486", delay_range=(900, 1800), repeat_count=5),  # Encrypt files
            AttackStep("T1490", delay_range=(1800, 2100)),  # Delete shadow copies
        ],
        duration_range=(1800, 3600),
        metadata={"variant": "LockBit 3.0", "ransom_amount": "$50000", "target": "enterprise"}
    ),

    "insider_threat": AttackScenario(
        name="Insider Threat Data Theft",
        description="Malicious insider collecting and exfiltrating sensitive data",
        mitre_techniques=["T1087", "T1082", "T1005", "T1039", "T1048"],
        steps=[
            AttackStep("T1087", delay_range=(0, 300), repeat_count=2),  # Account discovery
            AttackStep("T1082", delay_range=(300, 600)),  # System info
            AttackStep("T1005", delay_range=(600, 1800), repeat_count=3),  # Local collection
            AttackStep("T1039", delay_range=(1800, 2400), repeat_count=2),  # Network share collection
            AttackStep("T1048", delay_range=(2400, 3600)),  # DNS exfiltration
        ],
        duration_range=(3600, 7200),
        metadata={"actor": "malicious_insider", "access_level": "privileged", "data_target": "IP"}
    ),

    "supply_chain_compromise": AttackScenario(
        name="Supply Chain Compromise",
        description="Compromised software update delivering malware",
        mitre_techniques=["T1195", "T1059", "T1547", "T1071", "T1005", "T1041"],
        steps=[
            AttackStep("T1195", delay_range=(0, 60)),  # Supply chain compromise
            AttackStep("T1059", delay_range=(60, 180), repeat_count=3),  # Command execution
            AttackStep("T1547", delay_range=(180, 300)),  # Persistence
            AttackStep("T1071", delay_range=(300, 1800), repeat_count=10),  # C2 beacons
            AttackStep("T1005", delay_range=(1800, 3000)),  # Data collection
            AttackStep("T1041", delay_range=(3000, 3600)),  # Exfiltration
        ],
        duration_range=(3600, 7200),
        metadata={"vector": "software_update", "target": "customers", "scale": "mass"}
    ),

    "credential_stuffing": AttackScenario(
        name="Credential Stuffing",
        description="Large-scale credential stuffing against VPN/SSH/RDP",
        mitre_techniques=["T1110", "T1110", "T1110", "T1021"],
        steps=[
            AttackStep("T1110", delay_range=(1, 5), repeat_count=50),  # Mass brute force
            AttackStep("T1110", delay_range=(1, 5), repeat_count=30),  # VPN brute force
            AttackStep("T1110", delay_range=(1, 5), repeat_count=20),  # RDP brute force
            AttackStep("T1021", delay_range=(300, 600), repeat_count=5),  # Successful lateral
        ],
        duration_range=(600, 1800),
        metadata={"source": "credential_dump", "scale": "mass", "success_rate": 0.02}
    ),

    "cryptojacking": AttackScenario(
        name="Cryptojacking Campaign",
        description="Cryptocurrency mining malware deployment",
        mitre_techniques=["T1190", "T1059", "T1547", "T1496"],
        steps=[
            AttackStep("T1190", delay_range=(0, 60)),  # Initial exploit
            AttackStep("T1059", delay_range=(60, 180), repeat_count=2),  # Deploy miner
            AttackStep("T1547", delay_range=(180, 300)),  # Persistence
            AttackStep("T1496", delay_range=(300, 3600), repeat_count=100),  # Resource hijacking
        ],
        duration_range=(1800, 7200),
        metadata={"miner": "XMRig", "currency": "Monero", "persistence": "systemd"}
    ),
}


def get_scenario(name: str) -> Optional[AttackScenario]:
    """Get a scenario by name."""
    return ATTACK_SCENARIOS.get(name)


def list_scenarios() -> List[Dict[str, Any]]:
    """List all available scenarios with metadata."""
    return [
        {
            "name": name,
            "description": scenario.description,
            "mitre_techniques": scenario.mitre_techniques,
            "estimated_duration": f"{scenario.duration_range[0]//60}-{scenario.duration_range[1]//60} minutes",
            "metadata": scenario.metadata,
        }
        for name, scenario in ATTACK_SCENARIOS.items()
    ]


def get_technique(technique_id: str) -> Optional[MitreTechnique]:
    """Get a MITRE technique by ID."""
    return MITRE_TECHNIQUES.get(technique_id)


def get_techniques_by_tactic(tactic: AttackTactic) -> List[MitreTechnique]:
    """Get all techniques for a given tactic."""
    return [t for t in MITRE_TECHNIQUES.values() if t.tactic == tactic]


# Add T1195 for supply chain
MITRE_TECHNIQUES["T1195"] = MitreTechnique(
    id="T1195",
    name="Supply Chain Compromise",
    tactic=AttackTactic.INITIAL_ACCESS,
    description="Adversaries manipulate software supply chain",
    event_type="supply_chain_compromise",
    severity="CRITICAL",
    metadata_template={"vector": "software_update", "package": "legitimate-package@1.0.0"}
)

# Add T1496 for resource hijacking
MITRE_TECHNIQUES["T1496"] = MitreTechnique(
    id="T1496",
    name="Resource Hijacking",
    tactic=AttackTactic.IMPACT,
    description="Adversaries hijack compute resources for mining",
    event_type="cryptomining",
    severity="HIGH",
    metadata_template={"miner": "xmrig", "cpu_usage": 85, "pool": "pool.minexmr.com"}
)

# Reconnaissance
MITRE_TECHNIQUES["T1590"] = MitreTechnique(
    id="T1590",
    name="Active Scanning",
    tactic=AttackTactic.RECONNAISSANCE,
    description="Adversaries actively scan targets",
    event_type="network_scan",
    severity="LOW",
    metadata_template={"method": "nmap", "target": "10.0.0.0/24"}
)

MITRE_TECHNIQUES["T1591"] = MitreTechnique(
    id="T1591",
    name="Gather Victim Network Information",
    tactic=AttackTactic.RECONNAISSANCE,
    description="Adversaries gather information about victim networks",
    event_type="recon_dns_query",
    severity="LOW",
    metadata_template={"query_type": "AXFR", "target": "victim.com"}
)

MITRE_TECHNIQUES["T1592"] = MitreTechnique(
    id="T1592",
    name="Gather Victim Host Information",
    tactic=AttackTactic.RECONNAISSANCE,
    description="Adversaries gather information about victim hosts",
    event_type="recon_host_info",
    severity="LOW",
    metadata_template={"source": "shodan", "fields": ["OS", "ports", "services"]}
)

MITRE_TECHNIQUES["T1593"] = MitreTechnique(
    id="T1593",
    name="Gather Victim Identity Information",
    tactic=AttackTactic.RECONNAISSANCE,
    description="Adversaries gather information about victim identities",
    event_type="recon_identity",
    severity="LOW",
    metadata_template={"source": "linkedin", "target": "employees"}
)

# Resource Development
MITRE_TECHNIQUES["T1583"] = MitreTechnique(
    id="T1583",
    name="Acquire Infrastructure",
    tactic=AttackTactic.RESOURCE_DEVELOPMENT,
    description="Adversaries acquire infrastructure for operations",
    event_type="infra_acquisition",
    severity="LOW",
    metadata_template={"type": "vps", "provider": "digitalocean", "region": "nyc1"}
)

MITRE_TECHNIQUES["T1584"] = MitreTechnique(
    id="T1584",
    name="Compromise Infrastructure",
    tactic=AttackTactic.RESOURCE_DEVELOPMENT,
    description="Adversaries compromise existing infrastructure",
    event_type="infra_compromise",
    severity="MEDIUM",
    metadata_template={"type": "web_server", "vuln": "CVE-2021-44228"}
)

MITRE_TECHNIQUES["T1585"] = MitreTechnique(
    id="T1585",
    name="Establish Accounts",
    tactic=AttackTactic.RESOURCE_DEVELOPMENT,
    description="Adversaries create accounts for operations",
    event_type="account_creation",
    severity="LOW",
    metadata_template={"platform": "github", "username": "attacker123"}
)

MITRE_TECHNIQUES["T1586"] = MitreTechnique(
    id="T1586",
    name="Compromise Accounts",
    tactic=AttackTactic.RESOURCE_DEVELOPMENT,
    description="Adversaries compromise existing accounts",
    event_type="account_compromise",
    severity="HIGH",
    metadata_template={"platform": "aws", "method": "credential_stuffing"}
)

MITRE_TECHNIQUES["T1587"] = MitreTechnique(
    id="T1587",
    name="Develop Capabilities",
    tactic=AttackTactic.RESOURCE_DEVELOPMENT,
    description="Adversaries develop custom malware/tools",
    event_type="malware_development",
    severity="LOW",
    metadata_template={"language": "go", "target": "windows", "type": "loader"}
)

MITRE_TECHNIQUES["T1588"] = MitreTechnique(
    id="T1588",
    name="Obtain Capabilities",
    tactic=AttackTactic.RESOURCE_DEVELOPMENT,
    description="Adversaries obtain existing tools/capabilities",
    event_type="tool_acquisition",
    severity="LOW",
    metadata_template={"tool": "cobalt_strike", "version": "4.5"}
)

MITRE_TECHNIQUES["T1589"] = MitreTechnique(
    id="T1589",
    name="Gather Victim Credentials",
    tactic=AttackTactic.RESOURCE_DEVELOPMENT,
    description="Adversaries gather credentials for future use",
    event_type="credential_gathering",
    severity="MEDIUM",
    metadata_template={"source": "leak", "count": 10000}
)