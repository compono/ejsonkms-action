import fs from "fs";
import lodash from "lodash";
import os from "os";
import path from "path";

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";

async function install() {
  const machine = os.arch();
  let architecture = "";

  switch (machine) {
    case "x64":
      architecture = "amd64";
      break;
    case "arm64":
      architecture = "arm64";
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

  const version = "0.2.7";
  const filename = `ejsonkms_${version}_linux_${architecture}.tar.gz`;
  const url = `https://github.com/envato/ejsonkms/releases/latest/download/${filename}`;

  const downloaded = await tc.downloadTool(url);
  core.debug(`successfully downloaded ejsonkms to ${downloaded}`);

  const extractedPath = await tc.extractTar(downloaded, destination);
  core.debug(`Successfully extracted ${downloaded} to ${extractedPath}`);

  const cachedPath = await tc.cacheDir(destination, "ejsonkms", version);
  core.addPath(cachedPath);
}

// The ejsonkms command used for encryption and decryption
const ejsonkms = "ejsonkms";

class Action {
  #action;
  #filePath;
  #awsRegion;
  #outFile;
  #populateEnvVars;
  #prefixEnvVars;

  /**
   * Create a new Action instance.
   *
   * @param {string} action The action to perform (encrypt or decrypt).
   * @param {string} filePath The path to the JSON file.
   * @param {string} awsRegion AWS region (required for decryption).
   * @param {string} outFile Path to a destination file were the decrypted content should be placed.
   * @param {string} populateEnvVars Optional - Populate environment variables with decrypted content.
   * @param {string} prefixEnvVars Optional - Add prefix to environment variables.
   */
  constructor(
    action,
    filePath,
    awsRegion = "",
    outFile = "",
    populateEnvVars,
    prefixEnvVars = "",
  ) {
    this.#action = action;
    this.#filePath = filePath;
    this.#awsRegion = awsRegion;
    this.#outFile = outFile;
    this.#populateEnvVars = populateEnvVars.toLowerCase() === "true";
    this.#prefixEnvVars = prefixEnvVars;

    this.#validate();
  }

  /**
   * Validate the existence of the JSON file at the specified path.
   *
   * @throws {Error} File not exists
   */
  #validate() {
    if (!fs.existsSync(this.#filePath)) {
      throw new Error(`JSON file does not exist at path: ${this.#filePath}`);
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
        core.error(`[ERROR] Failure on ejsonkms encrypt: ${err.message}`);
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

      const out = stdout.trim();
      if (!lodash.isEmpty(this.#outFile)) {
        fs.writeFileSync(this.#outFile, out, "utf-8");
      }

      core.setOutput("decrypted", out);
      if (this.#populateEnvVars) {
        core.info("Populating environment variables...");
        const decryptedJSON = JSON.parse(out);

        if (lodash.isEmpty(decryptedJSON.environment)) {
          throw new Error("Could not find `environment` key in the EJSON file");
        }

        lodash.forOwn(decryptedJSON.environment, (value, key) => {
          const keyName = this.#prefixEnvVars
            ? `${this.#prefixEnvVars}${key}`
            : key;
          core.info(`Setting environment variable ${keyName} ...`);

          core.setSecret(value);
          core.exportVariable(keyName, value);
        });
      }
      core.info("Decrypted successfully...");
    } catch (err) {
      if (err instanceof Error) {
        core.error(`[ERROR] Failure on ejsonkms decrypt: ${err.message}`);
      }
    }
  }

  #debugFileContent(filePath) {
    if (process.env.EJSON_DEBUG !== "true") {
      return;
    }

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
    core.getInput("populate-env-vars"),
    core.getInput("prefix-env-vars"),
  );

  try {
    await action.run();
  } catch (error) {
    if (error instanceof Error) {
      core.error(
        `[ERROR] Failure on ejsonkms ${core.getInput("action")}: ${error.message}`,
      );
    }
    process.exit(1);
  }
};

main();
