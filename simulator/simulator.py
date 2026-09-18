#!/usr/bin/env python3
"""
CyberSentinel Attack Simulator

Generates synthetic security events for testing and development.
Supports MITRE ATT&CK scenarios, YAML campaign configurations, and realistic attack patterns.
"""

import asyncio
import json
import random
import time
import argparse
import signal
import sys
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import httpx
import hashlib

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

from scenarios import (
    AttackScenario,
    AttackStep,
    MitreTechnique,
    ATTACK_SCENARIOS,
    MITRE_TECHNIQUES,
    get_scenario,
    list_scenarios,
    AttackTactic,
)


class AttackSimulator:
    def __init__(self, api_url: str, api_key: str, source_name: str = "simulator"):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.source_name = source_name
        self.running = False
        self.client = httpx.AsyncClient(timeout=30.0)
        self.stats = {"sent": 0, "failed": 0, "duplicates": 0}
        self.current_scenario: Optional[AttackScenario] = None
        self.scenario_start_time: Optional[datetime] = None
        self.step_index = 0
        self.repeat_counts: Dict[int, int] = {}

    async def close(self):
        await self.client.aclose()

    def generate_event(self, attack_type: str = "random", technique_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate a single event based on attack type or specific MITRE technique."""
        now = datetime.now(timezone.utc)
        base_event = {
            # ISO-8601 with 'Z' suffix (no +00:00 offset), as required by the API.
            "timestamp": now.isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
            "metadata": {}
        }

        # If technique specified, use MITRE technique
        if technique_id and technique_id in MITRE_TECHNIQUES:
            return self._technique_event(base_event, technique_id)

        # If running a scenario, use scenario-driven generation
        if self.current_scenario:
            return self._scenario_event(base_event)

        # Fallback to legacy attack types
        if attack_type == "brute_force" or (attack_type == "random" and random.random() < 0.3):
            return self._brute_force_event(base_event)
        elif attack_type == "port_scan" or (attack_type == "random" and random.random() < 0.2):
            return self._port_scan_event(base_event)
        elif attack_type == "c2_beacon" or (attack_type == "random" and random.random() < 0.1):
            return self._c2_beacon_event(base_event)
        elif attack_type == "malware" or (attack_type == "random" and random.random() < 0.1):
            return self._malware_event(base_event)
        else:
            return self._benign_event(base_event)

    def _technique_event(self, base: Dict, technique_id: str) -> Dict:
        """Generate event based on MITRE technique."""
        technique = MITRE_TECHNIQUES[technique_id]
        event = base.copy()
        
        # Use technique's metadata template
        metadata = technique.metadata_template.copy()
        
        # Add dynamic values
        if "attempts" in metadata:
            metadata["attempts"] = random.randint(1, 20)
        if "port" in metadata and isinstance(metadata["port"], int):
            metadata["port"] = random.randint(1, 65535)
        if "hash" in metadata:
            metadata["hash"] = hashlib.sha256(str(random.random()).encode()).hexdigest()
        if "count" in metadata:
            metadata["count"] = random.randint(1, 100)
        
        # Add MITRE context
        metadata["mitre_technique_id"] = technique.id
        metadata["mitre_technique_name"] = technique.name
        metadata["mitre_tactic"] = technique.tactic.value

        event.update({
            "eventType": technique.event_type,
            "severity": technique.severity,
            "sourceIp": self._random_ip("external" if technique.tactic in [AttackTactic.INITIAL_ACCESS, AttackTactic.RECONNAISSANCE] else "internal"),
            "destIp": self._random_ip("internal") if random.random() > 0.3 else None,
            "username": self._random_username(technique.tactic) if random.random() > 0.4 else None,
            "metadata": metadata,
        })
        return event

    def _scenario_event(self, base: Dict) -> Dict:
        """Generate event based on current scenario step."""
        if not self.current_scenario or self.step_index >= len(self.current_scenario.steps):
            # Scenario complete, fallback to benign
            return self._benign_event(base)
        
        step = self.current_scenario.steps[self.step_index]
        technique_id = step.technique_id
        
        # Check if we should advance step
        current_repeats = self.repeat_counts.get(self.step_index, 0)
        if current_repeats >= step.repeat_count:
            self.step_index += 1
            self.repeat_counts[self.step_index] = 0
            if self.step_index >= len(self.current_scenario.steps):
                # Scenario complete
                self.current_scenario = None
                return self._benign_event(base)
            step = self.current_scenario.steps[self.step_index]
            technique_id = step.technique_id
        
        self.repeat_counts[self.step_index] = current_repeats + 1
        return self._technique_event(base, technique_id)

    def start_scenario(self, scenario_name: str):
        """Start a named attack scenario."""
        scenario = get_scenario(scenario_name)
        if not scenario:
            raise ValueError(f"Unknown scenario: {scenario_name}")
        
        self.current_scenario = scenario
        self.scenario_start_time = datetime.now(timezone.utc)
        self.step_index = 0
        self.repeat_counts = {0: 0}
        print(f"Started scenario: {scenario.name}")
        print(f"Description: {scenario.description}")
        print(f"MITRE Techniques: {', '.join(scenario.mitre_techniques)}")
        print(f"Steps: {len(scenario.steps)}")

    def _brute_force_event(self, base: Dict) -> Dict:
        event = base.copy()
        event.update({
            "eventType": "ssh_failed_login",
            "severity": random.choice(["HIGH", "MEDIUM", "CRITICAL"]),
            "sourceIp": f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
            "destIp": f"10.0.0.{random.randint(1,50)}",
            "username": random.choice(["root", "admin", "user", "test", "ubuntu", "centos"]),
            "metadata": {
                "attempts": random.randint(1, 20),
                "port": 22,
                "protocol": "ssh",
                "mitre_technique_id": "T1110",
                "mitre_tactic": "credential-access"
            }
        })
        return event

    def _port_scan_event(self, base: Dict) -> Dict:
        event = base.copy()
        event.update({
            "eventType": "connection_attempt",
            "severity": random.choice(["MEDIUM", "LOW"]),
            "sourceIp": f"203.0.113.{random.randint(1,255)}",
            "destIp": f"10.0.0.{random.randint(1,50)}",
            "username": None,
            "metadata": {
                "port": random.randint(1, 65535),
                "protocol": random.choice(["tcp", "udp"]),
                "flags": random.choice(["SYN", "ACK", "FIN", "RST"]),
                "mitre_technique_id": "T1046",
                "mitre_tactic": "discovery"
            }
        })
        return event

    def _c2_beacon_event(self, base: Dict) -> Dict:
        event = base.copy()
        event.update({
            "eventType": "dns_query",
            "severity": random.choice(["HIGH", "CRITICAL"]),
            "sourceIp": f"10.0.{random.randint(1,255)}.{random.randint(1,255)}",
            "destIp": "8.8.8.8",
            "username": None,
            "metadata": {
                "domain": random.choice([
                    "evil-c2.example.com",
                    "malicious.ddns.net",
                    "c2.badactor.org",
                    "beacon.apt29.net"
                ]),
                "queryType": "A",
                "responseCode": "NOERROR",
                "mitre_technique_id": "T1071",
                "mitre_tactic": "command-and-control"
            }
        })
        return event

    def _malware_event(self, base: Dict) -> Dict:
        event = base.copy()
        event.update({
            "eventType": "file_modification",
            "severity": random.choice(["CRITICAL", "HIGH"]),
            "sourceIp": f"10.0.{random.randint(1,255)}.{random.randint(1,255)}",
            "destIp": None,
            "username": random.choice(["SYSTEM", "admin", "user"]),
            "metadata": {
                "filePath": random.choice([
                    "C:\\Windows\\Temp\\malware.exe",
                    "/tmp/.hidden/payload.sh",
                    "C:\\Users\\Public\\Documents\\ransomware.exe"
                ]),
                "hash": hashlib.sha256(str(random.random()).encode()).hexdigest(),
                "operation": random.choice(["create", "modify", "execute"]),
                "mitre_technique_id": "T1059",
                "mitre_tactic": "execution"
            }
        })
        return event

    def _benign_event(self, base: Dict) -> Dict:
        event = base.copy()
        event_types = [
            ("ssh_success_login", "INFO"),
            ("http_request", "LOW"),
            ("dns_query", "INFO"),
            ("file_access", "INFO"),
            ("process_start", "LOW"),
            ("user_logon", "INFO"),
        ]
        event_type, severity = random.choice(event_types)
        event.update({
            "eventType": event_type,
            "severity": severity,
            "sourceIp": f"10.0.{random.randint(1,255)}.{random.randint(1,255)}",
            "destIp": f"10.0.0.{random.randint(1,50)}" if random.random() > 0.3 else None,
            "username": random.choice(["john", "jane", "bob", "alice", "svc_account"]) if random.random() > 0.5 else None,
            "metadata": {
                "count": random.randint(1, 5),
            }
        })
        return event

    def _random_ip(self, zone: str = "internal") -> str:
        """Generate IP based on network zone."""
        if zone == "internal":
            return f"10.0.{random.randint(1,255)}.{random.randint(1,255)}"
        elif zone == "external":
            return f"{random.randint(1,223)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}"
        elif zone == "dmz":
            return f"192.168.{random.randint(1,255)}.{random.randint(1,255)}"
        return f"10.0.{random.randint(1,255)}.{random.randint(1,255)}"

    def _random_username(self, tactic: AttackTactic) -> Optional[str]:
        """Generate username based on attack tactic."""
        if tactic == AttackTactic.CREDENTIAL_ACCESS:
            return random.choice(["root", "admin", "administrator", "svc_account", "backup", "test"])
        elif tactic == AttackTactic.INITIAL_ACCESS:
            return random.choice(["vpn_user", "remote_user", "contractor", "partner"])
        elif tactic in [AttackTactic.LATERAL_MOVEMENT, AttackTactic.PRIVILEGE_ESCALATION]:
            return random.choice(["SYSTEM", "Administrator", "Domain Admin", "Enterprise Admin"])
        return random.choice(["john", "jane", "bob", "alice", "svc_account", "developer"])

    async def send_event(self, event: Dict) -> bool:
        try:
            response = await self.client.post(
                f"{self.api_url}/api/v1/events",
                json=event,
                headers={"X-API-Key": self.api_key}
            )
            if response.status_code == 201:
                self.stats["sent"] += 1
                return True
            elif response.status_code == 409:
                self.stats["duplicates"] += 1
                return True
            else:
                self.stats["failed"] += 1
                print(f"Failed to send event: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.stats["failed"] += 1
            print(f"Error sending event: {e}")
            return False

    async def send_batch(self, events: List[Dict]) -> int:
        try:
            response = await self.client.post(
                f"{self.api_url}/api/v1/events",
                json=events,
                headers={"X-API-Key": self.api_key}
            )
            if response.status_code == 201:
                data = response.json()
                self.stats["sent"] += data.get("ingested", 0)
                self.stats["duplicates"] += data.get("duplicates", 0)
                return data.get("ingested", 0)
            else:
                self.stats["failed"] += len(events)
                print(f"Batch failed: {response.status_code} - {response.text}")
                return 0
        except Exception as e:
            self.stats["failed"] += len(events)
            print(f"Batch error: {e}")
            return 0

    async def run_continuous(self, rate: float, attack_type: str = "random", batch_size: int = 1):
        self.running = True
        # `rate` is events/sec: each iteration sends `batch_size` events.
        interval = (batch_size / rate) if rate > 0 else 0

        mode = f"scenario: {self.current_scenario.name}" if self.current_scenario else f"attack_type={attack_type}"
        print(f"Starting simulator: {rate} events/sec, {mode}, batch_size={batch_size}")
        print("Press Ctrl+C to stop")

        last_stats = time.time()
        try:
            while self.running:
                start = time.time()

                if batch_size > 1:
                    events = [self.generate_event(attack_type) for _ in range(batch_size)]
                    await self.send_batch(events)
                else:
                    event = self.generate_event(attack_type)
                    await self.send_event(event)

                if time.time() - last_stats >= 10:
                    print(f"Stats: {self.stats}")
                    if self.current_scenario:
                        elapsed = (datetime.now(timezone.utc) - self.scenario_start_time).total_seconds()
                        print(f"Scenario progress: step {self.step_index + 1}/{len(self.current_scenario.steps)}, elapsed: {elapsed:.0f}s")
                    last_stats = time.time()

                elapsed = time.time() - start
                if elapsed < interval:
                    await asyncio.sleep(interval - elapsed)

        except asyncio.CancelledError:
            pass
        finally:
            print(f"Final stats: {self.stats}")

    def stop(self):
        self.running = False


async def load_campaign(filepath: str) -> Dict[str, Any]:
    """Load campaign from YAML file."""
    if not YAML_AVAILABLE:
        raise RuntimeError("PyYAML not installed. Install with: pip install pyyaml")
    
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Campaign file not found: {filepath}")
    
    with open(filepath, 'r') as f:
        campaign = yaml.safe_load(f)
    
    # Validate required fields
    required = ["name", "description", "steps"]
    for field in required:
        if field not in campaign:
            raise ValueError(f"Campaign missing required field: {field}")
    
    return campaign


async def run_campaign(simulator: AttackSimulator, campaign: Dict[str, Any], rate: float, batch_size: int):
    """Run a campaign from parsed YAML."""
    print(f"Running campaign: {campaign['name']}")
    print(f"Description: {campaign.get('description', 'N/A')}")
    print(f"Steps: {len(campaign['steps'])}")
    
    simulator.running = True
    interval = 1.0 / rate if rate > 0 else 0
    last_stats = time.time()
    
    for step_idx, step in enumerate(campaign["steps"]):
        if not simulator.running:
            break
        
        technique_id = step.get("technique_id")
        repeat = step.get("repeat", 1)
        delay_range = step.get("delay_range", [0, 60])
        duration = step.get("duration", 0)
        
        print(f"\nStep {step_idx + 1}/{len(campaign['steps'])}: {technique_id} (x{repeat})")
        
        for i in range(repeat):
            if not simulator.running:
                break
            
            start = time.time()
            
            if batch_size > 1:
                events = [simulator.generate_event(technique_id=technique_id) for _ in range(batch_size)]
                await simulator.send_batch(events)
            else:
                event = simulator.generate_event(technique_id=technique_id)
                await simulator.send_event(event)
            
            # Handle delay
            if duration > 0:
                await asyncio.sleep(duration)
            else:
                delay = random.uniform(delay_range[0], delay_range[1])
                await asyncio.sleep(delay)
            
            if time.time() - last_stats >= 10:
                print(f"Stats: {simulator.stats}")
                last_stats = time.time()
    
    print(f"\nCampaign complete. Final stats: {simulator.stats}")


async def main():
    parser = argparse.ArgumentParser(description="CyberSentinel Attack Simulator")
    parser.add_argument("--api-url", default="http://localhost:3000", help="Backend API URL")
    parser.add_argument("--api-key", default="local-dev-ingestion-key-change-in-prod", help="Ingestion API key")
    parser.add_argument("--rate", type=float, default=10.0, help="Events per second")
    parser.add_argument("--attack-type", choices=["random", "brute_force", "port_scan", "c2_beacon", "malware"],
                        default="random", help="Type of attack to simulate")
    parser.add_argument("--batch-size", type=int, default=1, help="Batch size for sending events")
    parser.add_argument("--duration", type=int, help="Run duration in seconds")
    parser.add_argument("--count", type=int, help="Total events to send")
    parser.add_argument("--scenario", choices=list(ATTACK_SCENARIOS.keys()), help="Attack scenario to run")
    parser.add_argument("--campaign", help="Path to YAML campaign file")
    parser.add_argument("--list-scenarios", action="store_true", help="List available scenarios")
    parser.add_argument("--list-techniques", action="store_true", help="List MITRE techniques")
    parser.add_argument("--tactic", choices=[t.value for t in AttackTactic], help="Filter techniques by tactic")
    args = parser.parse_args()

    if args.list_scenarios:
        print("Available Attack Scenarios:")
        for s in list_scenarios():
            print(f"  {s['name']}: {s['description']}")
            print(f"    MITRE: {', '.join(s['mitre_techniques'])}")
            print(f"    Duration: {s['estimated_duration']}")
            print(f"    Metadata: {s['metadata']}")
        return

    if args.list_techniques:
        techniques = MITRE_TECHNIQUES.values()
        if args.tactic:
            techniques = [t for t in techniques if t.tactic.value == args.tactic]
        print(f"MITRE ATT&CK Techniques ({'all' if not args.tactic else args.tactic}):")
        for t in sorted(techniques, key=lambda x: x.id):
            print(f"  {t.id}: {t.name} ({t.tactic.value}) - {t.severity}")
            print(f"    {t.description}")
        return

    simulator = AttackSimulator(args.api_url, args.api_key)

    def signal_handler(sig, frame):
        print("\nShutting down...")
        simulator.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        if args.campaign:
            if not YAML_AVAILABLE:
                print("Error: PyYAML not installed. Install with: pip install pyyaml")
                return
            campaign = await load_campaign(args.campaign)
            await run_campaign(simulator, campaign, args.rate, args.batch_size)
        elif args.scenario:
            simulator.start_scenario(args.scenario)
            await simulator.run_continuous(args.rate, batch_size=args.batch_size)
        elif args.count:
            print(f"Sending {args.count} events...")
            for i in range(0, args.count, args.batch_size):
                batch = [simulator.generate_event(args.attack_type) for _ in range(min(args.batch_size, args.count - i))]
                await simulator.send_batch(batch)
                if i % 100 == 0:
                    print(f"Sent {i}/{args.count} events")
            print(f"Done. Stats: {simulator.stats}")
        elif args.duration:
            task = asyncio.create_task(simulator.run_continuous(args.rate, args.attack_type, args.batch_size))
            await asyncio.sleep(args.duration)
            simulator.stop()
            await task
        else:
            await simulator.run_continuous(args.rate, args.attack_type, args.batch_size)
    finally:
        await simulator.close()


if __name__ == "__main__":
    asyncio.run(main())