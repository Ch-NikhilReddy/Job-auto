# Adaptive Cognitive Firewall (ACF) — Offline-First Host Security Architecture

> **Mini Project — Anurag University** | Offline rule-based filtering + lightweight local ML classifier with privacy-preserving fallback and conversational assistant.

![Python](https://img.shields.io/badge/Core-Python%20%7C%20ML-blue)
![Security](https://img.shields.io/badge/Architecture-Offline--First%20%7C%20Privacy--Preserving-green)
![Status](https://img.shields.io/badge/Status-Proposal%20%7C%20Architecture%20Ready-orange)

### Abstract
Modern systems face a trade-off: offline rule-based firewalls work without connectivity but miss novel attacks, while cloud AI security detects novel threats but requires constant internet and exposes host activity to third parties. **ACF** is an offline-first host security architecture that combines rule-based filtering with a lightweight, locally-run ML classifier to detect suspicious activity without continuous internet dependency.

### Core Idea
```
Host Events (process, network, file-system)
        ↓
Feature Extraction → Local Rules + On-Device ML Classifier
        ↓                           ↓
  High Confidence → Resolve Locally (Block/Allow + Log)
        ↓
  Low Confidence → [Optional] Anonymized Query to External Threat-Intel/AI
        ↓
  Response → Convert to New Local Rule (future events handled offline)
        ↓
  Alert Module + Conversational Security Assistant (local, plain language)
```

### Key Components
1. **Host Monitor** — Continuously monitors process execution, network connections, file-system behaviour (via `psutil`/OS APIs/eBPF placeholder)
2. **Feature Pipeline** — Converts events to features for analysis (e.g., process anomaly score, network port entropy, file write frequency)
3. **Detection Engine** — Two-layer: local rule matching + lightweight classifier (e.g., Isolation Forest/Random Forest, <5MB model)
4. **Privacy-Preserving Fallback** — Only anonymized indicators (hashes, header patterns) leave the device; raw logs never sent
5. **Rule Synthesizer** — Converts external response into new local rule (JSON/YAML) for offline future handling
6. **Conversational Assistant** — Locally-run (e.g., TinyLlama/Ollama) to query alerts, blocked activity, rule changes in plain language — no log parsing needed

### Architecture
```
[Host Monitor] → [Feature Extractor] → [Rule Engine + Local ML] → Decision
                                              ↓ Low Confidence
                                    [Anonymizer] → [External Intel (optional)]
                                              ↓
                                    [Rule Synthesizer] → [Local Rule Store]
                                              ↓
                                    [Alert Module] → [Conversational Assistant]
```

### Tech Stack (Proposed MVP)
**Core:** Python, scikit-learn (Isolation Forest / Random Forest), psutil
**Host Monitoring:** Python `psutil`, `watchdog` (file events), sockets
**Rule Engine:** JSON rules, SQLite for rule storage
**Assistant:** Ollama + TinyLlama / Phi-2 (local inference)
**Evaluation:** NSL-KDD / CICIDS datasets for classifier training

### MVP Scope (For Mini Project Timeline)
- **Week 1-2:** Host monitor for 3 signals (process spawn, outbound connection, file write) + feature logging
- **Week 3-4:** Train lightweight classifier on sample dataset + rule engine (5 baseline rules)
- **Week 5:** Anonymized query stub + rule synthesis (manual → auto)
- **Week 6:** Local conversational assistant (Q&A over alerts/rules) + demo video

### Getting Started (Prototype)
```bash
# Clone (create repo first)
git clone https://github.com/Ch-NikhilReddy/ACF.git
cd ACF

# Setup
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run host monitor (demo)
python src/monitor.py --mode demo

# Run detection engine
python src/detect.py --input logs/sample_events.json

# Query assistant (local)
python src/assistant.py --query "What was blocked in last hour?"
```

**requirements.txt (sample):**
```
scikit-learn
psutil
watchdog
```

### Evaluation Plan
| Metric | Target |
|--------|--------|
| Classifier accuracy (on sample dataset) | >85% |
| False positive rate | <10% |
| Offline detection rate (without external query) | >90% of known rules |
| Assistant response latency (local) | <2s |

### What I Learned / Why It Matters
- Balances **privacy, offline availability, and adaptive detection** in one architecture — unlike pure-cloud or pure-rule solutions
- Demonstrates **systems thinking**: host monitoring, ML pipeline, rule management, and UX for security logs

### Future Work
- eBPF-based real-time syscall monitoring
- On-device model retraining from new rules
- Integration with Windows Firewall / iptables for enforcement

---
**Author:** Nikhil Reddy Chittepu — B.Tech IT, Anurag University (2023-2027) | [LinkedIn](https://linkedin.com/in/ch-nikhil-reddy) | [Portfolio](https://nikhilreddy.dpdns.org)
**Supervisor Signatures:** _________________________
