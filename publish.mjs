#!/usr/bin/env node
/**
 * AnyGen Selected Skills — scan / deploy / publish
 *
 * Usage:
 *   node publish.mjs scan   [--static] [--translate] [skill...]  安全扫描
 *   node publish.mjs deploy [--target openclaw|claude|all] [skill...]  部署到本地 agent
 *   node publish.mjs publish [--method cli|api] [--version X.Y.Z] [skill...]  发布到 ClawHub
 *   node publish.mjs run    [--target ...] [skill...]            完整流程
 *   node publish.mjs list                                        列出所有 skill
 *
 * Env:
 *   OPENAI_API_KEY        LLM 安全评估 (可选)
 *   OPENAI_EVAL_MODEL     安全评估模型 (默认 gpt-5-mini)
 */

import { execSync } from 'node:child_process'
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync,
  readdirSync, statSync, writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import * as readline from 'node:readline'

// ── clawhub-scanner ──
import {
  scanSkill, printResult, printSummaryTable,
  formatResultJson, log, parseFrontmatter,
} from 'clawhub-scanner'

const ROOT = resolve(import.meta.dirname)
const SELECTED_DIR = join(ROOT, 'selected-skills')

const CLAUDE_DIR = join(process.env.HOME, '.claude', 'skills')
const OPENCLAW_DIR = join(process.env.HOME, '.openclaw', 'skills')

// ─── Colors ──────────────────────────────────────────────────────────────────

const R = '\x1b[0m', B = '\x1b[1m', DIM = '\x1b[2m'
const { info, ok, warn, err } = log

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()) })
  })
}

function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'inherit', cwd: ROOT })
  } catch {
    return null
  }
}

// ─── Skill discovery ─────────────────────────────────────────────────────────

/**
 * Auto-discover all skills under selected-skills/<author>/<skill-name>/
 * Returns [{ dir, path, author, skill, clawhub, claude, name }]
 */
function discoverSkills() {
  const skills = []
  if (!existsSync(SELECTED_DIR)) return skills

  for (const author of readdirSync(SELECTED_DIR)) {
    if (author.startsWith('.')) continue
    const authorDir = join(SELECTED_DIR, author)
    if (!statSync(authorDir).isDirectory()) continue

    for (const skill of readdirSync(authorDir)) {
      if (skill.startsWith('.')) continue
      const skillDir = join(authorDir, skill)
      if (!statSync(skillDir).isDirectory()) continue
      if (!existsSync(join(skillDir, 'SKILL.md'))) continue

      // Read name from SKILL.md frontmatter, fallback to directory name
      let displayName
      try {
        const md = readFileSync(join(skillDir, 'SKILL.md'), 'utf-8')
        const fm = parseFrontmatter(md)
        displayName = fm.name || null
      } catch { /* ignore */ }
      if (!displayName) {
        displayName = skill.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }

      skills.push({
        dir: `${author}/${skill}`,
        path: skillDir,
        author,
        skill,
        clawhub: skill,
        claude: `${author}-${skill}`,
        name: displayName,
      })
    }
  }
  return skills
}

function resolveSkills(args) {
  const all = discoverSkills()
  if (args.length === 0) return all
  return args.map(name => {
    // Match by full slug (author/skill), skill name, or partial match
    const found = all.find(s =>
      s.dir === name || s.skill === name || s.dir.endsWith(`/${name}`)
    )
    if (found) return found
    // Assume it's a new skill path
    const parts = name.split('/')
    const skill = parts.pop()
    const author = parts.pop() || 'unknown'
    return {
      dir: `${author}/${skill}`,
      path: join(SELECTED_DIR, author, skill),
      author, skill,
      clawhub: skill,
      claude: `${author}-${skill}`,
      name: skill,
    }
  })
}

// ─── ClawHub version ─────────────────────────────────────────────────────────

function fetchNextVersion(slug) {
  try {
    const out = execSync(`clawhub inspect "${slug}" --json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    const data = JSON.parse(out.replace(/^[^{]*/, ''))
    const current = data.latestVersion?.version
    if (!current) return '1.0.0'
    const parts = current.split('.').map(Number)
    parts[2] = (parts[2] || 0) + 1
    return parts.join('.')
  } catch {
    return '1.0.0'
  }
}

// ─── ClawHub API publish ─────────────────────────────────────────────────────

function readClawHubConfig() {
  const candidates = [
    join(process.env.HOME, 'Library', 'Application Support', 'clawhub', 'config.json'),
    join(process.env.HOME, '.config', 'clawhub', 'config.json'),
    join(process.env.HOME, '.clawhub', 'config.json'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      const data = JSON.parse(readFileSync(p, 'utf8'))
      if (data.registry && data.token) return data
    }
  }
  return null
}

function listSkillFiles(dir) {
  const results = []
  function walk(current, rel) {
    for (const entry of readdirSync(current)) {
      if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__') continue
      const full = join(current, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full, rel ? `${rel}/${entry}` : entry)
      } else if (st.isFile()) {
        const relPath = rel ? `${rel}/${entry}` : entry
        results.push({ relPath, fullPath: full })
      }
    }
  }
  walk(dir, '')
  return results
}

async function publishViaApi(slug, displayName, version, skillDir, config) {
  const files = listSkillFiles(skillDir)
  if (files.length === 0) throw new Error('No files found')
  if (!files.some(f => f.relPath.toLowerCase() === 'skill.md')) {
    throw new Error('SKILL.md required')
  }

  const form = new FormData()
  form.set('payload', JSON.stringify({
    slug, displayName, version,
    changelog: '',
    acceptLicenseTerms: true,
    tags: ['latest'],
  }))

  for (const file of files) {
    const content = readFileSync(file.fullPath)
    const blob = new Blob([content], { type: 'text/plain' })
    form.append('files', blob, file.relPath)
  }

  const url = `${config.registry.replace(/\/$/, '')}/api/v1/skills`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json',
    },
    body: form,
  })

  const text = await resp.text()
  if (!resp.ok) throw new Error(text || `HTTP ${resp.status}`)
  return JSON.parse(text)
}

function copyDir(src, dest) {
  let target = dest
  try {
    if (lstatSync(dest).isSymbolicLink()) {
      target = resolve(join(dest, '..'), readlinkSync(dest))
    }
  } catch { /* dest doesn't exist yet */ }

  if (existsSync(target)) {
    execSync(`rm -rf "${target}"`, { stdio: 'ignore' })
  }
  mkdirSync(target, { recursive: true })
  execSync(`cp -r "${src}/"* "${target}/"`, { stdio: 'ignore' })
}

// ─── Flag parsers ────────────────────────────────────────────────────────────

function extractFlag(args, flag, validValues) {
  const idx = args.indexOf(flag)
  if (idx === -1) return { value: null, remaining: args }
  if (idx + 1 >= args.length) {
    err(`${flag} requires a value: ${validValues.join(', ')}`)
    process.exit(1)
  }
  const val = args[idx + 1]
  if (!validValues.includes(val)) {
    err(`Invalid ${flag} value: ${val}. Use: ${validValues.join(', ')}`)
    process.exit(1)
  }
  const remaining = [...args.slice(0, idx), ...args.slice(idx + 2)]
  return { value: val, remaining }
}

function extractVersion(args) {
  const idx = args.indexOf('--version')
  if (idx === -1) return { version: null, remaining: args }
  if (idx + 1 >= args.length) { err('--version requires X.Y.Z'); process.exit(1) }
  const val = args[idx + 1]
  if (!/^\d+\.\d+\.\d+$/.test(val)) { err(`Invalid version: ${val}`); process.exit(1) }
  return { version: val, remaining: [...args.slice(0, idx), ...args.slice(idx + 2)] }
}

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdList() {
  const skills = discoverSkills()
  console.log(`\n${B}Available Skills${R} (${skills.length})\n`)
  console.log(`  ${'Author'.padEnd(16)} ${'Skill'.padEnd(28)} Display Name`)
  console.log(`  ${'─'.repeat(16)} ${'─'.repeat(28)} ${'─'.repeat(24)}`)
  for (const s of skills) {
    console.log(`  ${s.author.padEnd(16)} ${s.skill.padEnd(28)} ${s.name}`)
  }
  console.log()
}

async function cmdScan(skills, isStaticOnly = false) {
  console.log(`\n${B}Security Scan${R} (${skills.length} skill(s))${isStaticOnly ? ' [static only]' : ''}\n`)

  const results = []
  for (const s of skills) {
    const r = await scanSkill(s.path, { staticOnly: isStaticOnly })
    if (!r) {
      warn(`Skipping ${s.dir}: no SKILL.md found`)
      continue
    }

    printResult(r.name, r.result, r.staticScan)
    if (isStaticOnly && r.injectionSignals?.length > 0) {
      console.log(`\n${B}Injection Signals:${R} ${r.injectionSignals.join(', ')}`)
    }
    results.push(r)

    // Save result
    const outDir = join(ROOT, 'scan-results')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(
      join(outDir, `${s.author}--${s.skill}.json`),
      JSON.stringify(formatResultJson(r.name, r.staticScan, r.result, r.injectionSignals), null, 2)
    )
  }

  if (results.length > 1) printSummaryTable(results)

  if (!isStaticOnly) {
    const safe = results.filter(r => r.verdict === 'benign').length
    const sus = results.filter(r => r.verdict === 'suspicious').length
    const mal = results.filter(r => r.verdict === 'malicious').length
    const fail = results.filter(r => !r.verdict).length
    info(`Done. benign=${safe} suspicious=${sus} malicious=${mal}${fail ? ` failed=${fail}` : ''}`)
  }

  ok('Scan complete.')
  info('Results saved to scan-results/')
}

function cmdDeploy(skills, target) {
  const deployClaude = target === 'claude' || target === 'all'
  const deployOpenclaw = target === 'openclaw' || target === 'all'

  if (!deployClaude && !deployOpenclaw) {
    info('Deploy target is "none", skipping deploy.')
    return
  }

  const targets = []
  if (deployClaude) targets.push('Claude Code')
  if (deployOpenclaw) targets.push('OpenClaw')

  console.log(`\n${B}Deploy to ${targets.join(' + ')}${R} (${skills.length} skill(s))\n`)

  if (deployClaude && !existsSync(CLAUDE_DIR)) {
    err(`Claude skills directory not found: ${CLAUDE_DIR}`)
    if (!deployOpenclaw) process.exit(1)
    warn('Skipping Claude Code deploy.')
  }
  if (deployOpenclaw && !existsSync(OPENCLAW_DIR)) {
    err(`OpenClaw skills directory not found: ${OPENCLAW_DIR}`)
    if (!deployClaude) process.exit(1)
    warn('Skipping OpenClaw deploy.')
  }

  let deployed = 0
  for (const s of skills) {
    if (!existsSync(join(s.path, 'SKILL.md'))) {
      warn(`Skipping ${s.dir}: no SKILL.md`)
      continue
    }

    if (deployClaude && existsSync(CLAUDE_DIR)) {
      const dest = join(CLAUDE_DIR, s.claude)
      copyDir(s.path, dest)
      ok(`${s.dir} → ~/.claude/skills/${s.claude}/`)
    }

    if (deployOpenclaw && existsSync(OPENCLAW_DIR)) {
      const dest = join(OPENCLAW_DIR, s.clawhub)
      copyDir(s.path, dest)
      ok(`${s.dir} → ~/.openclaw/skills/${s.clawhub}/`)
    }

    deployed++
  }

  console.log()
  ok(`Deployed ${deployed} skill(s).`)
  if (deployClaude && existsSync(CLAUDE_DIR)) info('Claude Code: restart agent to reload skills.')
  if (deployOpenclaw && existsSync(OPENCLAW_DIR)) info('OpenClaw:    restart agent to reload skills.')
}

async function cmdPublish(skills, method = 'cli', fixedVersion = null) {
  if (method === 'cli') {
    try {
      execSync('which clawhub', { stdio: 'ignore' })
    } catch {
      err('clawhub CLI not found. Install: npm i -g clawhub')
      process.exit(1)
    }
  }

  if (method === 'api') {
    const config = readClawHubConfig()
    if (!config) {
      err('ClawHub config not found. Run `clawhub login` first.')
      process.exit(1)
    }
    info(`Using direct API publish → ${config.registry}`)
  }

  console.log(`\n${B}Publish to ClawHub${R} (${skills.length} skill(s), method: ${method})\n`)

  if (fixedVersion) {
    info(`Using fixed version: ${fixedVersion}`)
  } else {
    info('Fetching latest versions from ClawHub ...')
  }
  const plan = skills.map(s => {
    const nextVer = fixedVersion || fetchNextVersion(s.clawhub)
    return { ...s, nextVer }
  })

  console.log()
  console.log(`  ${'Skill'.padEnd(35)} ${'Current'.padEnd(10)} Next`)
  console.log(`  ${'─'.repeat(35)} ${'─'.repeat(10)} ${'─'.repeat(10)}`)
  for (const p of plan) {
    const parts = p.nextVer.split('.').map(Number)
    const current = parts[2] > 0 ? `${parts[0]}.${parts[1]}.${parts[2] - 1}` : '(new)'
    console.log(`  ${p.dir.padEnd(35)} ${current.padEnd(10)} ${p.nextVer}`)
  }

  console.log(`\n${DIM}Commands:${R}`)
  for (const p of plan) {
    if (method === 'api') {
      console.log(`  ${DIM}[API] POST /api/v1/skills  slug=${p.clawhub}  version=${p.nextVer}${R}`)
    } else {
      console.log(`  ${DIM}clawhub publish "${p.path}" --slug "${p.clawhub}" --version "${p.nextVer}"${R}`)
    }
  }
  console.log()

  const answer = await ask('  Continue? [y/N] ')
  if (answer.toLowerCase() !== 'y') {
    info('Aborted.')
    return
  }

  console.log()
  let published = 0, failed = 0

  for (const p of plan) {
    info(`Publishing ${p.dir} → ${p.clawhub} v${p.nextVer} ... (${method})`)

    if (method === 'api') {
      try {
        const config = readClawHubConfig()
        const result = await publishViaApi(p.clawhub, p.name, p.nextVer, p.path, config)
        ok(`${p.clawhub} v${p.nextVer} published. (versionId: ${result.versionId})`)
        published++
      } catch (e) {
        err(`Failed to publish ${p.clawhub}: ${e.message}`)
        failed++
      }
    } else {
      const result = run(`clawhub publish "${p.path}" --slug "${p.clawhub}" --version "${p.nextVer}"`)
      if (result !== null) {
        ok(`${p.clawhub} v${p.nextVer} published.`)
        published++
      } else {
        err(`Failed to publish ${p.clawhub}`)
        failed++
      }
    }
  }

  console.log()
  if (failed === 0) {
    ok(`All ${published} skill(s) published successfully.`)
  } else {
    warn(`Published: ${published}, Failed: ${failed}`)
  }
}

async function cmdRun(skills, target, method = 'cli', fixedVersion = null) {
  console.log(`\n${B}Full Pipeline: Scan → Deploy → Publish${R}\n`)

  // Step 1: Scan
  info('Step 1/3: Security Scan')
  await cmdScan(skills)

  const a1 = await ask('\n  Scan complete. Continue to deploy? [y/N] ')
  if (a1.toLowerCase() !== 'y') { info('Stopped after scan.'); return }

  // Step 2: Deploy
  console.log()
  info('Step 2/3: Local Deploy')
  cmdDeploy(skills, target)

  const a2 = await ask('\n  Deploy complete. Test locally, then continue to publish? [y/N] ')
  if (a2.toLowerCase() !== 'y') {
    info("Stopped after deploy. Run 'node publish.mjs publish' when ready.")
    return
  }

  // Step 3: Publish
  console.log()
  info('Step 3/3: Publish to ClawHub')
  await cmdPublish(skills, method, fixedVersion)
}

// ─── Main ────────────────────────────────────────────────────────────────────

const USAGE = `
${B}AnyGen Selected Skills — scan / deploy / publish${R}

Usage:
  node publish.mjs scan   [--static] [skill...]                 安全扫描
  node publish.mjs deploy [--target openclaw|claude|all|none] [skill...]  部署到本地
  node publish.mjs publish [--method cli|api] [--version X.Y.Z] [skill...]  发布到 ClawHub
  node publish.mjs run    [--target ...] [skill...]              完整流程
  node publish.mjs list                                         列出所有 skill

Skill argument:
  Can be author/skill (e.g. kasparchen/forecast-intelligence)
  or just skill name  (e.g. forecast-intelligence)
  Omit to operate on all discovered skills.

Options:
  --static          只做静态扫描（不需要 API Key）
  --target <agent>  部署目标 (默认: openclaw)
  --method <mode>   发布方式 (默认: cli)
  --version <ver>   指定发布版本号 (默认: 自动 patch+1)

Security scanning powered by clawhub-scanner.

Env:
  OPENAI_API_KEY        LLM 安全评估 (可选)
  OPENAI_EVAL_MODEL     安全评估模型 (默认 gpt-5-mini)
`

const args = process.argv.slice(2)
if (args.length === 0 || ['-h', '--help', 'help'].includes(args[0])) {
  console.log(USAGE)
  process.exit(0)
}

const cmd = args[0]
const rest = args.slice(1)

switch (cmd) {
  case 'list':
    cmdList()
    break
  case 'scan': {
    const isStatic = rest.includes('--static')
    const skillArgs = rest.filter(a => !a.startsWith('-'))
    await cmdScan(resolveSkills(skillArgs), isStatic)
    break
  }
  case 'deploy': {
    const { value: target, remaining } = extractFlag(rest, '--target', ['openclaw', 'claude', 'all', 'none'])
    cmdDeploy(resolveSkills(remaining.filter(a => !a.startsWith('-'))), target || 'openclaw')
    break
  }
  case 'publish': {
    const { value: method, remaining: r1 } = extractFlag(rest, '--method', ['cli', 'api'])
    const { version, remaining: r2 } = extractVersion(r1)
    await cmdPublish(resolveSkills(r2.filter(a => !a.startsWith('-'))), method || 'cli', version)
    break
  }
  case 'run': {
    const { value: target, remaining: r1 } = extractFlag(rest, '--target', ['openclaw', 'claude', 'all', 'none'])
    const { value: method, remaining: r2 } = extractFlag(r1, '--method', ['cli', 'api'])
    const { version, remaining: r3 } = extractVersion(r2)
    await cmdRun(resolveSkills(r3.filter(a => !a.startsWith('-'))), target || 'openclaw', method || 'cli', version)
    break
  }
  default:
    err(`Unknown command: ${cmd}`)
    console.log(USAGE)
    process.exit(1)
}
