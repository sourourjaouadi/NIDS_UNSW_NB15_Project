import { ChatMessage, FlowRecord, UploadedFile } from "../types/nids";

export const baseFlows: FlowRecord[] = [
  {
    id: "FL-10021",
    sourceIp: "10.10.14.23",
    destIp: "172.16.9.18",
    protocol: "TCP",
    packetCount: 642,
    bytes: 582193,
    duration: 18.3,
    prediction: "Malicious",
    attackFamily: "DoS",
    timestamp: "2026-03-26T08:12:00Z",
    confidence: 98.4,
    summary:
      "High packet volume and unusual TTL behavior indicate an aggressive service exhaustion attempt.",
    recommendations: [
      "Rate-limit the originating host at the edge firewall.",
      "Inspect whether the destination service exposes a weak unauthenticated endpoint.",
      "Correlate this source IP with IDS and firewall logs for repeated bursts."
    ],
    shapFeatures: [
      {
        name: "spkts",
        rawValue: "642",
        impact: 0.93,
        plainEnglish:
          "The source sent far more packets than typical user traffic, which strongly raises the attack score."
      },
      {
        name: "sttl",
        rawValue: "254",
        impact: 0.84,
        plainEnglish:
          "The source TTL looks abnormal for this segment, suggesting crafted or replayed traffic."
      },
      {
        name: "dur",
        rawValue: "18.3s",
        impact: 0.76,
        plainEnglish:
          "This flow lasted long enough to resemble a sustained flood rather than a normal short request."
      },
      {
        name: "sbytes",
        rawValue: "582193",
        impact: 0.7,
        plainEnglish:
          "Large outbound byte volume reinforces the idea of resource abuse rather than routine traffic."
      },
      {
        name: "ct_state_ttl",
        rawValue: "7",
        impact: 0.61,
        plainEnglish:
          "The TTL-state pattern matches combinations the model has seen frequently in malicious sessions."
      }
    ]
  },
  {
    id: "FL-10022",
    sourceIp: "192.168.10.45",
    destIp: "10.0.3.9",
    protocol: "UDP",
    packetCount: 124,
    bytes: 16780,
    duration: 2.6,
    prediction: "Suspicious",
    attackFamily: "Reconnaissance",
    timestamp: "2026-03-26T08:26:00Z",
    confidence: 73.2,
    summary:
      "Short repetitive UDP probes across a privileged subnet suggest service discovery or scanning behavior.",
    recommendations: [
      "Check whether the source host is an approved scanner.",
      "Review lateral movement detections around the same time window.",
      "Limit east-west reconnaissance with segmentation policies."
    ],
    shapFeatures: [
      {
        name: "dur",
        rawValue: "2.6s",
        impact: 0.69,
        plainEnglish:
          "Very short bursty connections often look like scanning rather than real application use."
      },
      {
        name: "dttl",
        rawValue: "32",
        impact: 0.58,
        plainEnglish:
          "Destination TTL sits outside the normal baseline for this environment."
      },
      {
        name: "ct_dst_ltm",
        rawValue: "11",
        impact: 0.54,
        plainEnglish:
          "The same destination has been touched repeatedly in a short period, which resembles probing."
      },
      {
        name: "service",
        rawValue: "dns",
        impact: 0.49,
        plainEnglish:
          "The service context lines up with metadata commonly associated with discovery traffic."
      },
      {
        name: "sbytes",
        rawValue: "16780",
        impact: 0.33,
        plainEnglish:
          "The byte count is not large, but it still supports a lightweight scan pattern."
      }
    ]
  },
  {
    id: "FL-10023",
    sourceIp: "172.19.4.51",
    destIp: "8.8.8.8",
    protocol: "TCP",
    packetCount: 28,
    bytes: 4120,
    duration: 0.8,
    prediction: "Benign",
    attackFamily: "Normal Traffic",
    timestamp: "2026-03-26T08:41:00Z",
    confidence: 91.1,
    summary:
      "Low-volume, low-duration traffic with expected TTL and byte distribution maps cleanly to normal behavior.",
    recommendations: [
      "No immediate action required.",
      "Keep the baseline profile for comparison against later anomalies."
    ],
    shapFeatures: [
      {
        name: "sttl",
        rawValue: "64",
        impact: 0.28,
        plainEnglish:
          "A standard TTL for this host lowers the chance that the traffic is malicious."
      },
      {
        name: "sbytes",
        rawValue: "4120",
        impact: 0.22,
        plainEnglish:
          "The byte volume looks normal for a routine connection."
      },
      {
        name: "dur",
        rawValue: "0.8s",
        impact: 0.18,
        plainEnglish:
          "The flow duration fits a typical request-response pattern."
      },
      {
        name: "spkts",
        rawValue: "28",
        impact: 0.16,
        plainEnglish:
          "Packet count stays within the range of ordinary user activity."
      },
      {
        name: "ct_state_ttl",
        rawValue: "1",
        impact: 0.11,
        plainEnglish:
          "State and TTL behavior are close to the benign training baseline."
      }
    ]
  },
  {
    id: "FL-10024",
    sourceIp: "185.23.91.14",
    destIp: "10.20.1.44",
    protocol: "TCP",
    packetCount: 207,
    bytes: 91344,
    duration: 7.2,
    prediction: "Malicious",
    attackFamily: "Exploits",
    timestamp: "2026-03-26T09:05:00Z",
    confidence: 95.7,
    summary:
      "Packet pacing and payload size distribution resemble exploit delivery against an internal application host.",
    recommendations: [
      "Isolate the destination workload if it is externally exposed.",
      "Review WAF or reverse proxy logs for matching exploit signatures.",
      "Inspect the destination for process creation or privilege escalation events."
    ],
    shapFeatures: [
      {
        name: "dbytes",
        rawValue: "91344",
        impact: 0.86,
        plainEnglish:
          "The return traffic size suggests a non-standard application response tied to exploitation attempts."
      },
      {
        name: "ct_srv_src",
        rawValue: "15",
        impact: 0.81,
        plainEnglish:
          "The same source has targeted the service repeatedly, which strongly matches exploit behavior."
      },
      {
        name: "dur",
        rawValue: "7.2s",
        impact: 0.67,
        plainEnglish:
          "This interaction lasted long enough to look like a staged exploit exchange rather than a failed scan."
      },
      {
        name: "sttl",
        rawValue: "241",
        impact: 0.54,
        plainEnglish:
          "The TTL value is out of profile for legitimate remote clients."
      },
      {
        name: "sload",
        rawValue: "5.1Mb/s",
        impact: 0.46,
        plainEnglish:
          "The source load is elevated and consistent with repeated payload delivery."
      }
    ]
  },
  {
    id: "FL-10025",
    sourceIp: "10.32.8.17",
    destIp: "172.16.2.8",
    protocol: "ICMP",
    packetCount: 58,
    bytes: 9692,
    duration: 4.1,
    prediction: "Suspicious",
    attackFamily: "Analysis",
    timestamp: "2026-03-26T09:17:00Z",
    confidence: 68.9,
    summary:
      "ICMP volume is modest, but repetition and timing look like environmental mapping rather than health checks.",
    recommendations: [
      "Validate whether the source belongs to an infrastructure monitoring tool.",
      "If unapproved, throttle or block repeated ICMP discovery behavior.",
      "Review adjacent flows from this host for service enumeration."
    ],
    shapFeatures: [
      {
        name: "ct_src_dport_ltm",
        rawValue: "9",
        impact: 0.64,
        plainEnglish:
          "The host is touching multiple ports and destinations over a short period, which resembles mapping activity."
      },
      {
        name: "dur",
        rawValue: "4.1s",
        impact: 0.52,
        plainEnglish:
          "The timing is a little too regular for normal ad hoc pings."
      },
      {
        name: "spkts",
        rawValue: "58",
        impact: 0.41,
        plainEnglish:
          "The packet count is elevated for a single diagnostic check."
      },
      {
        name: "ct_state_ttl",
        rawValue: "4",
        impact: 0.37,
        plainEnglish:
          "TTL-state behavior deviates from the most common benign ICMP pattern."
      },
      {
        name: "dttl",
        rawValue: "40",
        impact: 0.31,
        plainEnglish:
          "The destination TTL pattern adds weak but non-zero suspicion."
      }
    ]
  },
  {
    id: "FL-10026",
    sourceIp: "10.12.44.91",
    destIp: "34.117.59.81",
    protocol: "TLS",
    packetCount: 74,
    bytes: 22648,
    duration: 1.7,
    prediction: "Benign",
    attackFamily: "Normal Traffic",
    timestamp: "2026-03-26T09:33:00Z",
    confidence: 88.4,
    summary:
      "Encrypted outbound traffic shows a healthy request size and balanced packet exchange pattern.",
    recommendations: [
      "No immediate action required.",
      "Consider allow-listing the destination if it is a known SaaS dependency."
    ],
    shapFeatures: [
      {
        name: "dbytes",
        rawValue: "22648",
        impact: 0.24,
        plainEnglish:
          "The response size looks normal for an encrypted web request."
      },
      {
        name: "sttl",
        rawValue: "64",
        impact: 0.21,
        plainEnglish:
          "The source TTL aligns with internal workstation traffic."
      },
      {
        name: "dur",
        rawValue: "1.7s",
        impact: 0.18,
        plainEnglish:
          "The connection completes quickly without looking bursty or stalled."
      },
      {
        name: "sbytes",
        rawValue: "22648",
        impact: 0.16,
        plainEnglish:
          "Outbound bytes remain well within the benign baseline."
      },
      {
        name: "spkts",
        rawValue: "74",
        impact: 0.14,
        plainEnglish:
          "Packet volume fits a modest encrypted session."
      }
    ]
  },
  {
    id: "FL-10027",
    sourceIp: "203.0.113.52",
    destIp: "10.20.4.77",
    protocol: "TCP",
    packetCount: 338,
    bytes: 124504,
    duration: 10.2,
    prediction: "Malicious",
    attackFamily: "Backdoor",
    timestamp: "2026-03-26T09:58:00Z",
    confidence: 97.3,
    summary:
      "The session shows repeated long-lived command-and-control style communication with abnormal TTL values.",
    recommendations: [
      "Block the source immediately at the perimeter.",
      "Perform host triage on the destination for persistence artifacts.",
      "Review outbound DNS, TLS, and process execution around this session."
    ],
    shapFeatures: [
      {
        name: "dur",
        rawValue: "10.2s",
        impact: 0.9,
        plainEnglish:
          "The connection persists longer than typical transactional traffic, matching control-channel behavior."
      },
      {
        name: "sttl",
        rawValue: "247",
        impact: 0.82,
        plainEnglish:
          "The TTL is inconsistent with expected client origins, which supports malicious attribution."
      },
      {
        name: "sbytes",
        rawValue: "124504",
        impact: 0.74,
        plainEnglish:
          "The data volume is heavy for a single remote command exchange."
      },
      {
        name: "ct_dst_src_ltm",
        rawValue: "13",
        impact: 0.69,
        plainEnglish:
          "The same source-destination pair has repeated recent activity, which often appears in beaconing."
      },
      {
        name: "ct_state_ttl",
        rawValue: "8",
        impact: 0.57,
        plainEnglish:
          "The state and TTL combination strongly resembles malicious control sessions in training."
      }
    ]
  },
  {
    id: "FL-10028",
    sourceIp: "10.0.7.13",
    destIp: "10.0.7.1",
    protocol: "DNS",
    packetCount: 34,
    bytes: 5280,
    duration: 0.6,
    prediction: "Benign",
    attackFamily: "Normal Traffic",
    timestamp: "2026-03-26T10:21:00Z",
    confidence: 92.7,
    summary:
      "Routine internal DNS request with low byte count and expected packet symmetry.",
    recommendations: [
      "No action required.",
      "Retain as a reference for local DNS baseline behavior."
    ],
    shapFeatures: [
      {
        name: "service",
        rawValue: "dns",
        impact: 0.23,
        plainEnglish:
          "The service aligns with expected internal DNS usage, which lowers risk."
      },
      {
        name: "dur",
        rawValue: "0.6s",
        impact: 0.2,
        plainEnglish:
          "The duration matches a simple query-response exchange."
      },
      {
        name: "spkts",
        rawValue: "34",
        impact: 0.16,
        plainEnglish:
          "Packet count stays small and ordinary."
      },
      {
        name: "sttl",
        rawValue: "64",
        impact: 0.14,
        plainEnglish:
          "TTL looks standard for an internal endpoint."
      },
      {
        name: "dbytes",
        rawValue: "5280",
        impact: 0.12,
        plainEnglish:
          "Reply size is consistent with harmless DNS resolution."
      }
    ]
  },
  {
    id: "FL-10029",
    sourceIp: "198.51.100.9",
    destIp: "10.20.6.31",
    protocol: "TCP",
    packetCount: 189,
    bytes: 60491,
    duration: 5.9,
    prediction: "Suspicious",
    attackFamily: "Fuzzers",
    timestamp: "2026-03-26T10:46:00Z",
    confidence: 77.1,
    summary:
      "The destination is receiving repeated varied payloads that suggest malformed input testing or fuzzing.",
    recommendations: [
      "Check the target application for crashes, resets, or 5xx responses.",
      "Throttle repeated payload variation from the same origin.",
      "Look for exploit escalation tied to this session."
    ],
    shapFeatures: [
      {
        name: "sbytes",
        rawValue: "60491",
        impact: 0.72,
        plainEnglish:
          "Payload sizes change enough to resemble malformed input testing."
      },
      {
        name: "ct_srv_dst",
        rawValue: "12",
        impact: 0.63,
        plainEnglish:
          "The same service has been hit repeatedly, which is common during fuzzing."
      },
      {
        name: "dur",
        rawValue: "5.9s",
        impact: 0.55,
        plainEnglish:
          "The session is long enough to include many varied attempts."
      },
      {
        name: "sload",
        rawValue: "2.4Mb/s",
        impact: 0.38,
        plainEnglish:
          "Source load is higher than expected for benign interactive use."
      },
      {
        name: "sttl",
        rawValue: "236",
        impact: 0.35,
        plainEnglish:
          "TTL is not conclusive alone, but it leans away from a trusted user profile."
      }
    ]
  },
  {
    id: "FL-10030",
    sourceIp: "10.11.22.80",
    destIp: "172.217.16.174",
    protocol: "TLS",
    packetCount: 91,
    bytes: 31284,
    duration: 2.1,
    prediction: "Benign",
    attackFamily: "Normal Traffic",
    timestamp: "2026-03-26T11:14:00Z",
    confidence: 89.8,
    summary:
      "Traffic profile matches a normal SaaS session with balanced encrypted exchange patterns.",
    recommendations: [
      "No action required.",
      "Keep monitoring as part of the outbound SaaS profile."
    ],
    shapFeatures: [
      {
        name: "dbytes",
        rawValue: "31284",
        impact: 0.26,
        plainEnglish:
          "The response size is typical for a web application session."
      },
      {
        name: "dur",
        rawValue: "2.1s",
        impact: 0.22,
        plainEnglish:
          "The connection duration looks ordinary and non-persistent."
      },
      {
        name: "sttl",
        rawValue: "64",
        impact: 0.18,
        plainEnglish:
          "Normal TTL lowers the chance of suspicious routing or spoofing."
      },
      {
        name: "spkts",
        rawValue: "91",
        impact: 0.17,
        plainEnglish:
          "Packet volume is modest and expected for encrypted app use."
      },
      {
        name: "ct_state_ttl",
        rawValue: "1",
        impact: 0.14,
        plainEnglish:
          "The state/TTL signature is close to the benign baseline."
      }
    ]
  }
];

export const attackTimeline = [
  { label: "08:00", malicious: 2, suspicious: 1, benign: 3 },
  { label: "08:30", malicious: 1, suspicious: 2, benign: 4 },
  { label: "09:00", malicious: 3, suspicious: 1, benign: 2 },
  { label: "09:30", malicious: 2, suspicious: 2, benign: 5 },
  { label: "10:00", malicious: 2, suspicious: 1, benign: 4 },
  { label: "10:30", malicious: 1, suspicious: 2, benign: 3 },
  { label: "11:00", malicious: 1, suspicious: 1, benign: 4 }
];

export const starterUploads: UploadedFile[] = [
  {
    id: "upload-demo-01",
    name: "edge-gateway-baseline.pcapng",
    size: 14876321,
    extension: "pcapng",
    progress: 100,
    status: "ready"
  }
];

export const starterConversation: ChatMessage[] = [
  {
    id: "chat-1",
    role: "assistant",
    content:
      "I can explain why a flow was flagged, translate SHAP features into plain English, and suggest next investigation steps."
  }
];
