import fs from "fs";
import util from "util";
import cp from "child_process";
import lodash from "lodash";
import core from "@actions/core";

const ejson = "/action/ejson-1.4.1";

export default class Action {
  #action;
  #filePath;
  #privateKey;

  constructor(action, filePath, privateKey = "") {
    this.exec = util.promisify(cp.exec);

    this.#action = action;
    this.#filePath = filePath;
    this.#privateKey = privateKey;

    this.#validate();
  }

  #validate() {
    if (!fs.existsSync(this.#filePath)) {
      throw new Error(`JSON file does not exist at path: ${this.#filePath}`);
    }
  }

  async run() {
    switch (this.#action) {
      case "encrypt":
        await this.#encrypt();
        break;

      case "decrypt":
        await this.#decrypt();
        break;

      default:
        throw new Error(`invalid action '${this.#action}'`);
    }
  }

  async #encrypt() {
    const command = `${ejson} encrypt ${this.#filePath}`;
    const opts = { env: { ...process.env } };

    await this.exec(command, opts);
  }

  async #decrypt() {
    this.#configurePrivateKey();

    const command = `${ejson} decrypt ${this.#filePath} > /decrypted.json`;
    const opts = { env: { ...process.env } };

    await this.exec(command, opts);

    const decrypted = fs.readFileSync("/decrypted.json", "utf-8");

    core.setOutput("decrypted", decrypted);

    return decrypted;
  }

  #configurePrivateKey() {
    if (lodash.isEmpty(this.#privateKey)) {
      throw new Error("no provided private key for encryption");
    }

    const data = JSON.parse(fs.readFileSync(this.#filePath, "utf8"));

    const publicKey = data["_public_key"];

    if (!publicKey) {
      throw new Error("not found public key on ejson file");
    }

    const keyPath = `/opt/ejson/keys/${publicKey}`;

    fs.writeFileSync(keyPath, this.#privateKey, "utf-8");
  }
}
