# Investigation Report

- investigationRunId: 411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57
- investigationDefinitionId: protocol-risk-investigation
- sourceSignalReference: 880cc869abeed97c1d125488ceb69def966068d36c602dfd2c97fb3eefd0e7ba
- sourceSignalType: protocol_risk
- sourceTriggerId: protocol-risk-investigation
- sourceTriggerReference: trigger:protocol-risk-investigation:880cc869abeed97c1d125488ceb69def966068d36c602dfd2c97fb3eefd0e7ba:daily:2026-03-11
- slot: daily:2026-03-11
- status: completed

## Phases
1. intake (intake) - completed
finding: intake_confirmed:protocol_risk
artifact: /workspaces/smartfunds-agent-sandbox/artifacts/investigations/411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57/intake-context.json
2. gather (gather) - completed
finding: protocol_risk:aave:unknown
artifact: /workspaces/smartfunds-agent-sandbox/artifacts/investigations/411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57/gather-evidence.json
3. analyze (analyze) - completed
finding: analysis_ready:protocol_risk
finding: protocol_risk:aave:unknown
artifact: /workspaces/smartfunds-agent-sandbox/artifacts/investigations/411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57/analyze-assessment.json
4. synthesize (synthesize) - completed
finding: protocol_risk:aave:unknown
finding: synthesized:protocol-risk-investigation
artifact: /workspaces/smartfunds-agent-sandbox/artifacts/investigations/411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57/synthesize-findings.json
5. finalize (finalize) - completed
finding: protocol_risk:aave:unknown

## Artifacts
- /workspaces/smartfunds-agent-sandbox/artifacts/investigations/411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57/analyze-assessment.json
- /workspaces/smartfunds-agent-sandbox/artifacts/investigations/411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57/gather-evidence.json
- /workspaces/smartfunds-agent-sandbox/artifacts/investigations/411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57/intake-context.json
- /workspaces/smartfunds-agent-sandbox/artifacts/investigations/411882e95209b9a6499b72b7be10b3ae858b7e7be1f858a35e66655cf528ea57/synthesize-findings.json

## Findings
- analysis_ready:protocol_risk
- intake_confirmed:protocol_risk
- protocol_risk:aave:unknown
- synthesized:protocol-risk-investigation

## Evidence-Backed Findings
- analysis_ready:protocol_risk
  confidence: medium (55)
  reason: score=55 band=medium
  supportingEvidenceIds: f4c31c80073c619c9140c889cfac8df0bc486b84e0892405d715f4d60371042b
  counterEvidenceIds: none
  unresolvedGapIds: none
- intake_confirmed:protocol_risk
  confidence: medium (55)
  reason: score=55 band=medium
  supportingEvidenceIds: e8a45d79288c8ca95fab01f7da93a17bd9604ae2020da14210eac2cf53806d6c
  counterEvidenceIds: none
  unresolvedGapIds: none
- protocol_risk:aave:unknown
  confidence: high (95)
  reason: score=95 band=high
  supportingEvidenceIds: 041dac07249db3234e93e0f93ba365554de769dfe31b6b1f444809102968f06f, 1ad8f8cde68f7371bfad554548b87548c79474493d1ef6d50960e3e62a24bca8, 94f9b4bd406749abe3f1cb62f2b2eaa07c94f048b206a22e512d38622dec14da, b7b0e06316139d65c16b58dc05145d201cdd345f09f5ad56df0ce0a570de2603, c7284598d7666c2fbec00f80fc775a3cd06c4b672e7583870e08ed387b1f81a4, f4c31c80073c619c9140c889cfac8df0bc486b84e0892405d715f4d60371042b
  counterEvidenceIds: none
  unresolvedGapIds: none
- synthesized:protocol-risk-investigation
  confidence: medium (55)
  reason: score=55 band=medium
  supportingEvidenceIds: 041dac07249db3234e93e0f93ba365554de769dfe31b6b1f444809102968f06f
  counterEvidenceIds: none
  unresolvedGapIds: none

## Report Confidence
Band: high
Score: 95
Reason: score=95 band=high
Strengths: cross-cycle confirmation present, supporting evidence records: 7, supporting evidence type diversity: 3
Limitations: none

## Conclusion
Protocol risk signal for aave is classified as high.
Severity: high

## Recommended Next Steps
- Inspect recent governance and operational changes for aave.
- Review downstream exposure linked to aave.
