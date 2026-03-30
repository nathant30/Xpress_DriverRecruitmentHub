/**
 * Dependency Security Scanner
 * Checks for known vulnerabilities in dependencies
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BACKEND_DIR = './backend';
const FRONTEND_DIR = './frontend';

function runNpmAudit(dir, name) {
  console.log(`\n🔍 Scanning ${name} dependencies...`);
  
  try {
    const result = execSync('npm audit --json', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    return JSON.parse(result);
  } catch (error) {
    // npm audit returns non-zero when vulnerabilities found
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        return { error: 'Failed to parse audit output' };
      }
    }
    return { error: error.message };
  }
}

function formatSeverity(severity) {
  const colors = {
    critical: '\x1b[31m', // Red
    high: '\x1b[91m',     // Light Red
    moderate: '\x1b[93m', // Yellow
    low: '\x1b[94m',      // Blue
    info: '\x1b[96m',     // Cyan
  };
  const reset = '\x1b[0m';
  return `${colors[severity] || ''}${severity.toUpperCase()}${reset}`;
}

function analyzeResults(results, name) {
  console.log(`\n📊 ${name} Security Analysis`);
  console.log('═'.repeat(50));
  
  if (results.error) {
    console.log(`❌ Error: ${results.error}`);
    return;
  }

  const { metadata, vulnerabilities } = results;
  
  if (!metadata || !metadata.vulnerabilities) {
    console.log('✅ No vulnerabilities detected');
    return;
  }

  const counts = metadata.vulnerabilities;
  const total = counts.total || 0;
  
  console.log(`\nVulnerability Summary:`);
  console.log(`  Critical: ${counts.critical || 0}`);
  console.log(`  High: ${counts.high || 0}`);
  console.log(`  Moderate: ${counts.moderate || 0}`);
  console.log(`  Low: ${counts.low || 0}`);
  console.log(`  Info: ${counts.info || 0}`);
  console.log(`  Total: ${total}`);

  if (vulnerabilities && Object.keys(vulnerabilities).length > 0) {
    console.log(`\nDetailed Findings:`);
    console.log('-'.repeat(50));
    
    Object.entries(vulnerabilities).forEach(([id, vuln]) => {
      console.log(`\n📦 ${vuln.name}@${vuln.range}`);
      console.log(`   Severity: ${formatSeverity(vuln.severity)}`);
      console.log(`   Title: ${vuln.via?.[0]?.title || 'N/A'}`);
      console.log(`   Range: ${vuln.range}`);
      
      if (vuln.fixAvailable) {
        console.log(`   ✅ Fix available: ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}`);
      } else {
        console.log(`   ⚠️  No fix available`);
      }
    });
  }

  return {
    name,
    total,
    critical: counts.critical || 0,
    high: counts.high || 0,
    moderate: counts.moderate || 0,
    low: counts.low || 0,
  };
}

function generateReport(backendResults, frontendResults) {
  const report = {
    timestamp: new Date().toISOString(),
    scans: [backendResults, frontendResults].filter(Boolean),
    summary: {
      totalVulnerabilities: 0,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
    },
  };

  [backendResults, frontendResults].forEach(result => {
    if (result) {
      report.summary.totalVulnerabilities += result.total;
      report.summary.critical += result.critical;
      report.summary.high += result.high;
      report.summary.moderate += result.moderate;
      report.summary.low += result.low;
    }
  });

  fs.writeFileSync(
    'security-audit-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n' + '═'.repeat(50));
  console.log('📋 Overall Security Summary');
  console.log('═'.repeat(50));
  console.log(`Total Vulnerabilities: ${report.summary.totalVulnerabilities}`);
  console.log(`  Critical: ${report.summary.critical} ${report.summary.critical > 0 ? '🔴' : ''}`);
  console.log(`  High: ${report.summary.high} ${report.summary.high > 0 ? '🟠' : ''}`);
  console.log(`  Moderate: ${report.summary.moderate} ${report.summary.moderate > 0 ? '🟡' : ''}`);
  console.log(`  Low: ${report.summary.low} ${report.summary.low > 0 ? '🔵' : ''}`);
  console.log(`\n📄 Report saved to: security-audit-report.json`);

  // Exit with error if critical or high vulnerabilities found
  if (report.summary.critical > 0 || report.summary.high > 0) {
    console.log('\n❌ Critical or High vulnerabilities found!');
    process.exit(1);
  }

  console.log('\n✅ Security audit completed successfully');
}

// Main execution
console.log('🔒 Driver Recruitment Hub - Dependency Security Scanner');
console.log('═'.repeat(50));

const backendResults = analyzeResults(
  runNpmAudit(BACKEND_DIR, 'Backend'),
  'Backend'
);

const frontendResults = analyzeResults(
  runNpmAudit(FRONTEND_DIR, 'Frontend'),
  'Frontend'
);

generateReport(backendResults, frontendResults);
