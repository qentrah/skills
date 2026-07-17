#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skills = {
  "architecture-guardian": {
    name: "Architecture Guardian",
    repository: "https://github.com/qentrah/skill-architecture-guardian.git",
  },
  "code-review": {
    name: "Code Review",
    repository: "https://github.com/qentrah/skill-code-review.git",
  },
  "content-design": {
    name: "Content Design",
    repository: "https://github.com/qentrah/skill-content-design.git",
  },
  "design-critique": {
    name: "Design Critique",
    repository: "https://github.com/qentrah/skill-design-critique.git",
  },
  "release-readiness": {
    name: "Release Readiness",
    repository: "https://github.com/qentrah/skill-release-readiness.git",
  },
  "repository-guide": {
    name: "Repository Guide",
    repository: "https://github.com/qentrah/skill-repository-guide.git",
  },
  "ui-implementation": {
    name: "UI Implementation",
    repository: "https://github.com/qentrah/skill-ui-implementation.git",
  },
};

function help() {
  console.log(`Qentrah Skills

Usage:
  qentrah-skills list
  qentrah-skills add <skill...> [--cwd <directory>] [--force]
  qentrah-skills --version

Examples:
  npx @qentrah/skills list
  npx @qentrah/skills add architecture-guardian
  npx @qentrah/skills add code-review ui-implementation

Skills are installed from their canonical public GitHub repositories into
.agents/skills/ in the selected project.`);
}

function fail(message) {
  console.error(`Qentrah Skills: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args.shift();

if (!command || command === "help" || command === "--help" || command === "-h") {
  help();
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
  console.log(JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(packagePath, "utf8"))).version);
  process.exit(0);
}

if (command === "list") {
  console.log("Available Qentrah skills:\n");
  for (const [slug, skill] of Object.entries(skills)) {
    console.log(`  ${slug.padEnd(24)} ${skill.name}`);
  }
  process.exit(0);
}

if (command !== "add") {
  fail(`unknown command \"${command}\"`);
}

let targetRoot = process.cwd();
let force = false;
const requested = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--force") {
    force = true;
  } else if (arg === "--cwd") {
    targetRoot = args[index + 1] ? resolve(args[index + 1]) : fail("--cwd requires a directory");
    index += 1;
  } else if (arg.startsWith("-")) {
    fail(`unknown option \"${arg}\"`);
  } else {
    requested.push(arg);
  }
}

if (requested.length === 0) {
  fail("provide at least one skill, for example: qentrah-skills add architecture-guardian");
}

for (const slug of requested) {
  const skill = skills[slug];
  if (!skill) {
    fail(`unknown skill \"${slug}\". Run \"qentrah-skills list\" to see available skills.`);
  }

  const destination = resolve(targetRoot, ".agents", "skills", slug);
  if (existsSync(destination)) {
    if (!force) {
      fail(`${destination} already exists. Use --force to replace it.`);
    }
    rmSync(destination, { recursive: true, force: true });
  }

  const result = spawnSync("git", ["clone", "--depth", "1", skill.repository, destination], {
    stdio: "inherit",
  });

  if (result.error || result.status !== 0) {
    fail(`could not install ${slug}`);
  }

  console.log(`Installed ${skill.name} in ${destination}`);
}
