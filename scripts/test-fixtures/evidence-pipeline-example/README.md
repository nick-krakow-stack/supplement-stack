# Offline evidence-pipeline example

This directory is a static, fictional and fully offline example for the
evidence-pipeline builder. It contains no research data and must not be used as
health evidence or publication input.

Run it from the repository root:

```powershell
$out = Join-Path $env:TEMP 'supplement-stack-evidence-example'
node scripts/build-evidence-pipeline.mjs `
  --manifest scripts/test-fixtures/evidence-pipeline-example/manifest.json `
  --out $out
```

The manifest deliberately uses `mode: "test"`,
`allow_isolated_test_catalog: true`, fictional `.invalid` URLs and
`stage4_requested: false`. The command performs no remote call.

Production differs materially: it uses the canonical production catalog and
real hash-bound source artifacts and reviews. If Stage 4 is requested, the
self-executing live Wrangler/D1 preflight and its `execution_mode=live`
attestation are mandatory. Offline examples, test locks and file-provided D1
results are never production-eligible.
