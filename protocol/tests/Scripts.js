const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('bench.mjs', function () {
  const epoch = 777;
  const protocolRoot = path.join(__dirname, '..');
  const repoRoot = path.join(protocolRoot, '..');
  const sampleFile = path.join(protocolRoot, `samples_epoch_${epoch}.json`);
  const dataDir = path.join(protocolRoot, 'data', `epoch_${epoch}`);
  const benchJson = path.join(repoRoot, 'reports', 'data', 'bench.json');
  const benchCsv = path.join(repoRoot, 'reports', 'data', 'bench.csv');
  let benchJsonBackup;
  let benchCsvBackup;

  before(function () {
    benchJsonBackup = fs.readFileSync(benchJson, 'utf8');
    benchCsvBackup = fs.readFileSync(benchCsv, 'utf8');
    fs.writeFileSync(sampleFile, JSON.stringify([{ a: 1 }]));
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'batch1.json'), JSON.stringify({
      data: { a: [{ issuer: 1 }, { issuer: 2 }] }
    }));
    fs.writeFileSync(path.join(dataDir, 'batch2.json'), JSON.stringify({
      data: { a: [{ issuer: 1 }], b: [{ issuer: 2 }, { issuer: 3 }] }
    }));
  });

  after(function () {
    fs.writeFileSync(benchJson, benchJsonBackup);
    fs.writeFileSync(benchCsv, benchCsvBackup);
    fs.rmSync(sampleFile, { force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('records homogeneity statistics in bench.json', function () {
    execSync(`node ${path.join(protocolRoot, 'src/scripts/bench.mjs')} ${epoch}`);
    const benchData = JSON.parse(fs.readFileSync(benchJson, 'utf8'));
    const record = benchData.find(r => r.epoch === epoch);
    expect(record).to.exist;
    expect(record.homogeneitySamples).to.be.a('number');
    expect(record.homogeneityNodes).to.be.a('number');
  });
});

describe('generate-report.mjs', function () {
  const protocolRoot = path.join(__dirname, '..');
  const repoRoot = path.join(protocolRoot, '..');
  const dataDir = path.join(repoRoot, 'reports', 'data');
  const benchFile = path.join(dataDir, 'bench.json');
  const experimentsFile = path.join(dataDir, 'experiments.json');
  const reportFile = path.join(repoRoot, 'reports', 'REPORT.md');
  let benchBackup;
  let experimentsBackup;
  let reportBackup;

  before(function () {
    benchBackup = fs.readFileSync(benchFile, 'utf8');
    experimentsBackup = fs.readFileSync(experimentsFile, 'utf8');
    reportBackup = fs.readFileSync(reportFile, 'utf8');
    const bench = [{
      epoch: 42,
      sampleBytes: 100,
      batchesBytes: 50,
      compressionRatio: 2,
      originalCells: 10,
      compressedCells: 2,
      gasEstimate: 200,
      homogeneitySamples: 0.75,
      homogeneityNodes: 0.5,
      resDistribution: {}
    }];
    fs.writeFileSync(benchFile, JSON.stringify(bench, null, 2));
    const experiments = [{
      epoch: 42,
      volume: 1000,
      params: { maxLeavesPerBatch: 1024 }
    }];
    fs.writeFileSync(experimentsFile, JSON.stringify(experiments, null, 2));
  });

  after(function () {
    fs.writeFileSync(benchFile, benchBackup);
    fs.writeFileSync(experimentsFile, experimentsBackup);
    fs.writeFileSync(reportFile, reportBackup);
  });

  it('includes homogeneity table when fields are present', function () {
    execSync(`node ${path.join(protocolRoot, 'src/scripts/generate-report.mjs')}`);
    const report = fs.readFileSync(reportFile, 'utf8');
    expect(report).to.include('### Homogeneidade');
    expect(report).to.include('| Cenário | Homog. amostras | Homog. nodes |');
    expect(report).to.include('| C1K-1024 | 0.75 | 0.50 |');
  });
});
