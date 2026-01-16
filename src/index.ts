import crypto from "crypto";
import fs from "fs";
import lodash from "lodash";
import os from "os";
import path from "path";
import yaml from "js-yaml";

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as http from "@actions/http-client";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";

type FileType = "json" | "yaml";

// Reserved environment variables that should not be overwritten
const RESERVED_ENV_VARS = new Set([
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "GITHUB_TOKEN",
  "GITHUB_WORKSPACE",
  "GITHUB_REPOSITORY",
  "GITHUB_ACTION",
  "GITHUB_ACTOR",
  "GITHUB_SHA",
  "GITHUB_REF",
  "GITHUB_ENV",
  "GITHUB_PATH",
  "GITHUB_OUTPUT",
  "GITHUB_STATE",
  "RUNNER_TEMP",
  "RUNNER_TOOL_CACHE",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_REGION",
  "AWS_DEFAULT_REGION",
]);

interface ReleaseAsset {
  name: string;
  digest: string;
  browser_download_url: string;
}

interface ReleaseResponse {
  assets: ReleaseAsset[];
}

/**
 * Fetch the expected SHA256 checksum for an asset from GitHub's release API.
 *
 * @param version - The release version (e.g., "0.0.4")
 * @param filename - The asset filename to look up
 * @returns The SHA256 hash string (without "sha256:" prefix)
 * @throws Error if the asset is not found or API request fails
 */
async function fetchExpectedChecksum(
  version: string,
  filename: string,
): Promise<string> {
  const client = new http.HttpClient("ejsonkms-action");
  const apiUrl = `https://api.github.com/repos/runlevel5/ejsonkms-rs/releases/tags/v${version}`;

  core.debug(`Fetching release info from ${apiUrl}`);

  const response = await client.getJson<ReleaseResponse>(apiUrl);

  if (!response.result) {
    throw new Error(`Failed to fetch release info for v${version}`);
  }

  const asset = response.result.assets.find((a) => a.name === filename);

  if (!asset) {
    throw new Error(`Asset ${filename} not found in release v${version}`);
  }

  if (!asset.digest) {
    throw new Error(`No checksum available for ${filename}`);
  }

  // digest format is "sha256:hash", extract just the hash
  const checksum = asset.digest.replace(/^sha256:/, "");
  core.debug(`Expected checksum for ${filename}: ${checksum}`);

  return checksum;
}

/**
 * Compute the SHA256 checksum of a file.
 *
 * @param filePath - Path to the file to hash
 * @returns The SHA256 hash as a hex string
 */
function computeFileChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  return hash;
}

/**
 * Verify the checksum of a downloaded file against the expected value.
 *
 * @param filePath - Path to the downloaded file
 * @param expectedChecksum - Expected SHA256 hash
 * @throws Error if checksums don't match
 */
function verifyChecksum(filePath: string, expectedChecksum: string): void {
  const actualChecksum = computeFileChecksum(filePath);
  core.debug(`Actual checksum: ${actualChecksum}`);

  if (actualChecksum !== expectedChecksum) {
    throw new Error(
      `Checksum verification failed!\n` +
        `Expected: ${expectedChecksum}\n` +
        `Actual:   ${actualChecksum}`,
    );
  }

  core.info("Checksum verification passed");
}

async function install() {
  const machine = os.arch();
  let architecture = "";

  switch (machine) {
    case "x64":
      architecture = "x86_64-unknown-linux-gnu";
      break;
    case "arm64":
      architecture = "aarch64-unknown-linux-gnu";
      break;
    case "ppc64le":
      architecture = "powerpc64le-unknown-linux-gnu";
      break;
    default:
      console.error(`${machine} Unsupported platform`);
      process.exit(1);
  }

  core.info("Install ejsonkms...");

  const destination = path.join(os.homedir(), ".ejsonkms", "bin");
  core.debug(`Install destination is ${destination}`);

  await io
    .rmRF(path.join(destination))
    .catch()
    .then(() => {
      core.debug(`Successfully deleted pre-existing ${path.join(destination)}`);
    });

  await io.mkdirP(destination);
  core.debug(`Successfully created ${destination}`);

  const version = "0.0.4";
  const filename = `ejsonkms-${version}-${architecture}.tar.xz`;
  const url = `https://github.com/runlevel5/ejsonkms-rs/releases/download/v${version}/${filename}`;

  // Fetch expected checksum from GitHub API
  const expectedChecksum = await fetchExpectedChecksum(version, filename);

  const downloaded = await tc.downloadTool(url);
  core.debug(`Successfully downloaded ejsonkms to ${downloaded}`);

  // Verify checksum before extracting
  verifyChecksum(downloaded, expectedChecksum);

  const extractedPath = await tc.extractTar(downloaded, destination, "xJ");
  core.debug(`Successfully extracted ${downloaded} to ${extractedPath}`);

  const cachedPath = await tc.cacheDir(destination, "ejsonkms", version);
  core.addPath(cachedPath);
}

// The ejsonkms command used for encryption and decryption
const ejsonkms = "ejsonkms";

/**
 * Detect file type based on file extension.
 *
 * @param filePath - Path to the file
 * @returns "yaml" for .yaml/.yml files, "json" for all others
 */
function detectFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".yaml":
    case ".yml":
    case ".eyaml":
    case ".eyml":
      return "yaml";
    case ".json":
    case ".ejson":
      return "json";
    default:
      throw new Error(
        `Unsupported file extension '${ext}'. Supported extensions: .json, .ejson, .yaml, .yml, .eyaml, .eyml`,
      );
  }
}

/**
 * Parse content based on file type.
 *
 * @param content - The string content to parse
 * @param fileType - The type of file ("json" or "yaml")
 * @returns The parsed object
 */
function parseContent(
  content: string,
  fileType: FileType,
): Record<string, unknown> {
  if (fileType === "yaml") {
    return yaml.load(content, { schema: yaml.JSON_SCHEMA }) as Record<
      string,
      unknown
    >;
  }
  return JSON.parse(content);
}

/**
 * Validate that a file path is within the allowed workspace directory.
 * Prevents path traversal attacks.
 *
 * @param filePath - The file path to validate
 * @param paramName - The parameter name for error messages
 * @throws Error if path is outside the workspace
 */
function validatePathWithinWorkspace(
  filePath: string,
  paramName: string,
): void {
  const workspaceDir =
    process.env.GITHUB_WORKSPACE ||
    process.env.RUNNER_WORKSPACE ||
    process.cwd();
  const resolvedPath = path.resolve(filePath);
  const resolvedWorkspace = path.resolve(workspaceDir);

  if (
    !resolvedPath.startsWith(resolvedWorkspace + path.sep) &&
    resolvedPath !== resolvedWorkspace
  ) {
    throw new Error(
      `Security error: ${paramName} "${filePath}" resolves to "${resolvedPath}" ` +
        `which is outside the workspace directory "${resolvedWorkspace}". ` +
        `Path traversal is not allowed.`,
    );
  }
}

/**
 * Validate that an environment variable name is safe to use.
 *
 * @param name - The environment variable name to validate
 * @returns true if safe, false if reserved
 */
function isReservedEnvVar(name: string): boolean {
  return RESERVED_ENV_VARS.has(name.toUpperCase());
}

class Action {
  #action;
  #filePath;
  #awsRegion;
  #outFile;
  #populateEnvVars;
  #populateOutputs;
  #prefixEnvVars;
  #prefixOutputs;
  #fileType: FileType;

  /**
   * Create a new Action instance.
   *
   * @param {string} action The action to perform (encrypt or decrypt).
   * @param {string} filePath The path to the JSON file.
   * @param {string} awsRegion AWS region (required for decryption).
   * @param {string} outFile Path to a destination file were the decrypted content should be placed.
   * @param {string} populateEnvVars Optional - Populate environment variables with decrypted content.
   * @param {string} populateOutputs Optional - Populate outputs with decrypted content.
   * @param {string} prefixEnvVars Optional - Add prefix to environment variables.
   * @param {string} prefixOutputs Optional - Add prefix to outputs.
   */
  constructor(
    action,
    filePath,
    awsRegion = "",
    outFile = "",
    populateEnvVars = false,
    populateOutputs = false,
    prefixEnvVars = "",
    prefixOutputs = "",
  ) {
    this.#action = action;
    this.#filePath = filePath;
    this.#awsRegion = awsRegion;
    this.#outFile = outFile;
    this.#populateEnvVars = populateEnvVars;
    this.#prefixEnvVars = prefixEnvVars;
    this.#populateOutputs = populateOutputs;
    this.#prefixOutputs = prefixOutputs;
    this.#fileType = detectFileType(filePath);

    this.#validate();

    core.info(`Detected file type: ${this.#fileType}`);
  }

  /**
   * Validate inputs for security and correctness.
   *
   * @throws {Error} File not exists or path traversal detected
   */
  #validate() {
    // Validate file-path is within workspace (prevent path traversal)
    validatePathWithinWorkspace(this.#filePath, "file-path");

    if (!fs.existsSync(this.#filePath)) {
      throw new Error(`JSON file does not exist at path: ${this.#filePath}`);
    }

    // Validate out-file is within workspace if provided
    if (this.#outFile) {
      validatePathWithinWorkspace(this.#outFile, "out-file");
    }
  }

  /**
   * Validate the existence of the `environment` property in the JSON
   *
   * @throws {Error} Property does not exists
   */
  #validateEnviromentPropertyExistence(decryptedContent) {
    if (lodash.isEmpty(decryptedContent.environment)) {
      throw new Error("Could not find `environment` key in the encrypted file");
    }
  }

  /**
   * Run the action based on the provided action type.
   *
   * @throws {Error} Invalid action to perform
   *
   * @returns {Promise<string|void>} - The result of the action.
   */
  async run() {
    switch (this.#action) {
      case "encrypt":
        return await this.#encrypt();

      case "decrypt":
        return await this.#decrypt();

      default:
        throw new Error(`Invalid action '${this.#action}'`);
    }
  }

  /**
   * Encrypt the JSON file using the ejsonkms command.
   *
   * @throws {Error} An execution error occurs during ejsonkms command
   *
   * @returns {Promise<string>} - The encrypted content.
   */
  async #encrypt() {
    this.#debugFileContent(this.#filePath);

    const args = ["encrypt", this.#filePath];
    const opts = { env: { ...process.env }, silent: true } as exec.ExecOptions;

    try {
      const { stdout, stderr, exitCode } = await exec.getExecOutput(
        ejsonkms,
        args,
        opts,
      );

      if (exitCode > 0) {
        throw new Error(stderr);
      }

      core.info("Encrypted successfully...");
      core.info(stdout.trim());
    } catch (err) {
      if (err instanceof Error) {
        core.setFailed(`[ERROR] Failure on ejsonkms encrypt: ${err.message}`);
      }
    }
  }

  /**
   * Decrypt the JSON file using the ejsonkms command and set the decrypted output.
   *
   * @throws {Error} An execution error occurs during ejsonkms command
   *
   * @returns {Promise<void>}
   */
  async #decrypt() {
    this.#debugFileContent(this.#filePath);

    const args = ["decrypt", "--aws-region", this.#awsRegion, this.#filePath];
    const opts = { env: { ...process.env }, silent: true } as exec.ExecOptions;

    try {
      const { stdout, stderr, exitCode } = await exec.getExecOutput(
        ejsonkms,
        args,
        opts,
      );

      if (exitCode > 0) {
        throw new Error(stderr);
      }

      core.info("Decrypted successfully...");

      const out = stdout.trim();
      if (!lodash.isEmpty(this.#outFile)) {
        fs.writeFileSync(this.#outFile, out, "utf-8");
      }

      core.setSecret(out);
      core.setOutput("decrypted", out);
      const decryptedContent = parseContent(out, this.#fileType);

      if (this.#populateOutputs || this.#populateEnvVars) {
        this.#validateEnviromentPropertyExistence(decryptedContent);
      }

      if (this.#populateOutputs) {
        core.info("Populating outputs...");

        lodash.forOwn(decryptedContent.environment, (value, key) => {
          const keyName = this.#prefixOutputs
            ? `${this.#prefixOutputs}${key}`
            : key;
          core.info(`Setting output ${keyName} ...`);

          core.setSecret(value);
          core.setOutput(keyName, value);
        });
      }

      if (this.#populateEnvVars) {
        core.info("Populating environment variables...");

        lodash.forOwn(decryptedContent.environment, (value, key) => {
          const keyName = this.#prefixEnvVars
            ? `${this.#prefixEnvVars}${key}`
            : key;

          // Check for reserved environment variables to prevent injection attacks
          if (isReservedEnvVar(keyName)) {
            core.warning(
              `Skipping reserved environment variable "${keyName}" to prevent security issues. ` +
                `Reserved variables cannot be overwritten.`,
            );
            return;
          }

          core.info(`Setting environment variable ${keyName} ...`);

          core.setSecret(value);
          core.exportVariable(keyName, value);
        });
      }
    } catch (err) {
      if (err instanceof Error) {
        core.setFailed(`[ERROR] Failure on ejsonkms decrypt: ${err.message}`);
      }
    }
  }

  #debugFileContent(filePath: string) {
    if (process.env.EJSON_DEBUG !== "true") {
      return;
    }

    core.warning(
      "⚠️ EJSON_DEBUG is enabled. File contents will be logged which may expose sensitive data. " +
        "Do NOT use this in production workflows!",
    );

    const content = fs.readFileSync(filePath);

    core.info(`[${this.#action}] File content: ${filePath}`);
    core.info(content.toString());
  }
}

const main = async () => {
  await install();

  const action = new Action(
    core.getInput("action"),
    core.getInput("file-path"),
    core.getInput("aws-region"),
    core.getInput("out-file"),
    core.getBooleanInput("populate-env-vars"),
    core.getBooleanInput("populate-outputs"),
    core.getInput("prefix-env-vars"),
    core.getInput("prefix-outputs"),
  );

  try {
    await action.run();
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(
        `[ERROR] Failure on ejsonkms ${core.getInput("action")}: ${error.message}`,
      );
    }
  }
};

main();
