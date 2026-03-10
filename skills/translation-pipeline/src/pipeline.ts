import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(ROOT, "output");

// ── types ──────────────────────────────────────────────────────────

interface Step {
  name: string;
  prompt: string;
  outputFile: string;
}

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

// ── claude runner ──────────────────────────────────────────────────

async function runClaude(prompt: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["-p", prompt], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      process.stdout.write(chunk); // live stream to terminal
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

// ── pipeline ───────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

async function runPipeline() {
  if (!DRY_RUN) await mkdir(OUTPUT_DIR, { recursive: true });

  const inputPath = join(ROOT, "input.md");
  const inputText = await readFile(inputPath, "utf-8");

  const languages = ["Russian", "Arabic", "Portuguese", "English"];
  let previousOutput = inputText;

  for (const [i, targetLang] of languages.entries()) {
    const name = `${i + 1}-${targetLang.toLowerCase()}`;
    const prompt = buildTranslationPrompt(previousOutput, targetLang);

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  STEP: ${name} → translate to ${targetLang}`);
    console.log(`${"═".repeat(60)}\n`);
    console.log(prompt);

    if (DRY_RUN) {
      previousOutput = `[${targetLang} translation would go here]`;
      continue;
    }

    const result = await runClaude(prompt);

    if (result.code !== 0) {
      console.error(`\n✗ Step "${name}" failed (exit ${result.code})`);
      process.exit(1);
    }

    const outputPath = join(OUTPUT_DIR, `${name}.md`);
    await writeFile(outputPath, result.stdout.trim(), "utf-8");
    console.log(`\n→ saved: ${outputPath}`);

    previousOutput = result.stdout.trim();
  }

  if (!DRY_RUN) {
    console.log(`\n${"═".repeat(60)}`);
    console.log("  DONE — all steps complete");
    console.log(`${"═".repeat(60)}`);
    console.log(`\nOriginal:\n${inputText.slice(0, 200)}...`);
    console.log(`\nFinal (back to English):\n${previousOutput.slice(0, 200)}...`);
  }
}

// ── helpers ────────────────────────────────────────────────────────

function buildTranslationPrompt(text: string, targetLang: string): string {
  return [
    `Translate the following text to ${targetLang}.`,
    `Output ONLY the translated text, no explanations, no markdown fences, no preamble.`,
    ``,
    `---`,
    text,
    `---`,
  ].join("\n");
}

// ── main ───────────────────────────────────────────────────────────

runPipeline().catch((err) => {
  console.error("Pipeline error:", err);
  process.exit(1);
});
