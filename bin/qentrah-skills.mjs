#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  note,
  outro,
  spinner,
} from "@clack/prompts";

const skills = {
  "architecture-guardian": {
    name: "Architecture Guardian",
    category: "Architecture",
    description: "Protect data models, domain interfaces, indexes, and backend ownership.",
    repository: "https://github.com/qentrah/skill-architecture-guardian.git",
  },
  "code-review": {
    name: "Code Review",
    category: "Engineering",
    description: "Review changes for correctness, maintainability, and production risk.",
    repository: "https://github.com/qentrah/skill-code-review.git",
  },
  "content-design": {
    name: "Content Design",
    category: "Product & design",
    description: "Write concise, translation-ready product interface copy.",
    repository: "https://github.com/qentrah/skill-content-design.git",
  },
  "design-critique": {
    name: "Design Critique",
    category: "Product & design",
    description: "Review interfaces for accessibility and system consistency.",
    repository: "https://github.com/qentrah/skill-design-critique.git",
  },
  "release-readiness": {
    name: "Release Readiness",
    category: "Engineering",
    description: "Check metadata, routing, performance, and deployment readiness.",
    repository: "https://github.com/qentrah/skill-release-readiness.git",
  },
  "repository-guide": {
    name: "Repository Guide",
    category: "Engineering",
    description: "Orient contributors in source, registry, and documentation structure.",
    repository: "https://github.com/qentrah/skill-repository-guide.git",
  },
  "ui-implementation": {
    name: "UI Implementation",
    category: "Product & design",
    description: "Build responsive, design-system-aligned React interfaces.",
    repository: "https://github.com/qentrah/skill-ui-implementation.git",
  },
};

function help() {
  console.log(`Qentrah Skills

Usage:
  qentrah-skills
  qentrah-skills list
  qentrah-skills add [skill...] [--cwd <directory>] [--force] [--yes]
  qentrah-skills add --all [--cwd <directory>] [--force] [--yes]
  qentrah-skills --version

Examples:
  npx @qentrah/skills
  npx @qentrah/skills list
  npx @qentrah/skills add architecture-guardian
  npx @qentrah/skills add code-review ui-implementation

Skills are installed from their canonical public GitHub repositories into
.agents/skills/ in the selected project.`);
}

function fail(message) {
  log.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const topLevelFlags = new Set(["--help", "-h", "--version", "-v"]);
const command = topLevelFlags.has(args[0])
  ? args.shift()
  : args[0]?.startsWith("-")
    ? "add"
    : (args.shift() ?? "add");

if (command === "help" || command === "--help" || command === "-h") {
  help();
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
  console.log(JSON.parse(await readFile(packagePath, "utf8")).version);
  process.exit(0);
}

if (command === "list") {
  intro("Qentrah Skills");
  for (const [slug, skill] of Object.entries(skills)) {
    log.info(`${skill.name} · ${skill.category}\n  ${slug}\n  ${skill.description}`);
  }
  outro(`${Object.keys(skills).length} skills available`);
  process.exit(0);
}

if (command !== "add") {
  fail(`Unknown command "${command}".`);
}

let targetRoot = process.cwd();
let force = false;
let installAll = false;
let skipConfirmation = false;
const requested = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--force") {
    force = true;
  } else if (arg === "--all") {
    installAll = true;
  } else if (arg === "--yes" || arg === "-y") {
    skipConfirmation = true;
  } else if (arg === "--cwd") {
    targetRoot = args[index + 1] ? resolve(args[index + 1]) : fail("--cwd requires a directory.");
    index += 1;
  } else if (arg.startsWith("-")) {
    fail(`Unknown option "${arg}".`);
  } else {
    requested.push(arg);
  }
}

if (installAll) {
  requested.push(...Object.keys(skills));
}

if (requested.length === 0) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail("Interactive selection needs a terminal. Provide skill names or use --all.");
  }

  intro("Qentrah Skills");
  const selected = await multiselect({
    message: "Select skills to install",
    options: Object.entries(skills).map(([slug, skill]) => ({
      value: slug,
      label: skill.name,
      hint: `${skill.category} · ${skill.description}`,
    })),
    required: true,
  });

  if (isCancel(selected)) {
    cancel("Installation cancelled.");
    process.exit(0);
  }

  requested.push(...selected);
}

const uniqueRequested = [...new Set(requested)];
for (const slug of uniqueRequested) {
  if (!skills[slug]) {
    fail(`Unknown skill "${slug}". Run "qentrah-skills list" to see available skills.`);
  }
}

const installationRoot = resolve(targetRoot, ".agents", "skills");
note(
  `${uniqueRequested.map((slug) => `• ${skills[slug].name}`).join("\n")}\n\nDestination\n${installationRoot}`,
  `${uniqueRequested.length} skill${uniqueRequested.length === 1 ? "" : "s"} selected`,
);

if (!skipConfirmation && process.stdin.isTTY && process.stdout.isTTY) {
  const approved = await confirm({
    message: "Install the selected skills?",
    initialValue: true,
  });

  if (isCancel(approved) || !approved) {
    cancel("Installation cancelled.");
    process.exit(0);
  }
}

let installedCount = 0;
for (const slug of uniqueRequested) {
  const skill = skills[slug];
  const destination = resolve(installationRoot, slug);

  if (existsSync(destination)) {
    if (!force) {
      fail(`${destination} already exists. Use --force to replace it.`);
    }
    rmSync(destination, { recursive: true, force: true });
  }

  const progress = spinner();
  progress.start(`Installing ${skill.name}`);
  const result = spawnSync("git", ["clone", "--depth", "1", skill.repository, destination], {
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    progress.stop(`Could not install ${skill.name}`, 1);
    if (result.stderr) {
      log.error(result.stderr.trim());
    }
    fail(`Could not install ${slug}.`);
  }

  installedCount += 1;
  progress.stop(`Installed ${skill.name}`);
}

outro(`Installed ${installedCount} skill${installedCount === 1 ? "" : "s"} in ${installationRoot}`);
