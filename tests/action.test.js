import fs from 'fs';
import util from 'util';
import core from '@actions/core';
import Action from '../src/action.js'; // Adjust the import to your file path
import sinon from 'sinon';

describe('Action', () => {
  let exec;
  let sandbox;

  const mockPrivateKey = 'private_key';
  const mockFilePath = 'path/to/json/file';
  const mockOutFile = 'path/to/output/file';
  const mockPublicKey = 'public_key';

  beforeAll(() => {
    exec = sinon.stub();
    util.promisify = sinon.stub().returns(exec);
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should validate the file path', () => {
      sandbox.stub(fs, 'existsSync').returns(true);

      new Action('encrypt', mockFilePath);

      sinon.assert.calledWith(fs.existsSync, mockFilePath);
    });

    it('should throw an error if file path does not exist', () => {
      sandbox.stub(fs, 'existsSync').returns(false);

      expect(() => new Action('encrypt', mockFilePath)).toThrow(
        'JSON file does not exist at path: path/to/json/file'
      );
    });
  });

  describe('run', () => {
    it('should call #encrypt for the encrypt action', async () => {
      sandbox.stub(fs, 'existsSync').returns(true);

      const actionInstance = new Action('encrypt', mockFilePath);
      const encryptSpy = sandbox
        .stub(actionInstance, 'encrypt')
        .resolves('encrypted content');

      await actionInstance.run();

      sinon.assert.calledOnce(encryptSpy);
    });

    it('should call #decrypt for the decrypt action', async () => {
      sandbox.stub(fs, 'existsSync').returns(true);

      const actionInstance = new Action(
        'decrypt',
        mockFilePath,
        mockPrivateKey
      );
      const decryptSpy = sandbox.stub(actionInstance, 'decrypt').resolves();

      await actionInstance.run();

      sinon.assert.calledOnce(decryptSpy);
    });

    it('should throw an error for an invalid action', async () => {
      sandbox.stub(fs, 'existsSync').returns(true);

      const actionInstance = new Action('invalid', mockFilePath);
      await expect(actionInstance.run()).rejects.toThrow(
        "Invalid action 'invalid'"
      );
    });
  });

  describe('#encrypt', () => {
    it('should execute the encrypt command and log output', async () => {
      sandbox.stub(fs, 'existsSync').returns(true);

      const stdout = 'encrypted content';
      const stderr = '';

      exec.resolves({ stdout, stderr });

      const infoStub = sandbox.stub(core, 'info');

      const actionInstance = new Action('encrypt', mockFilePath);
      await actionInstance.run();

      sinon.assert.calledWith(exec, 'ejson encrypt path/to/json/file', {
        env: { ...process.env },
      });
      sinon.assert.calledWith(infoStub, 'Encrypted successfully...');
      sinon.assert.calledWith(infoStub, stdout);
    });

    it('should throw an error if stderr is not empty', async () => {
      sandbox.stub(fs, 'existsSync').returns(true);

      const stdout = 'encrypted content';
      const stderr = 'some error';

      exec.resolves({ stdout, stderr });

      const actionInstance = new Action('encrypt', mockFilePath);
      await expect(actionInstance.run()).rejects.toThrow(stderr);
    });
  });

  describe('#decrypt', () => {
    it('should execute the decrypt command and log output', async () => {
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify({ _public_key: mockPublicKey }));
      sandbox.stub(fs, 'writeFileSync');

      const stdout = 'decrypted content';
      const stderr = '';

      exec.resolves({ stdout, stderr });

      const infoStub = sandbox.stub(core, 'info');
      const setOutputStub = sandbox.stub(core, 'setOutput');

      const actionInstance = new Action(
        'decrypt',
        mockFilePath,
        mockPrivateKey,
        mockOutFile
      );
      await actionInstance.run();

      sinon.assert.calledWith(exec, 'ejson decrypt path/to/json/file', {
        env: { ...process.env },
      });
      sinon.assert.calledWith(setOutputStub, 'decrypted', stdout);
      sinon.assert.calledWith(infoStub, 'Decrypted successfully...');
      sinon.assert.calledWith(fs.writeFileSync, mockOutFile, stdout, 'utf-8');
    });

    it('should throw an error if stderr is not empty', async () => {
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify({ _public_key: mockPublicKey }));

      const stdout = 'decrypted content';
      const stderr = 'some error';

      exec.resolves({ stdout, stderr });

      const actionInstance = new Action(
        'decrypt',
        mockFilePath,
        mockPrivateKey,
        mockOutFile
      );
      await expect(actionInstance.run()).rejects.toThrow(stderr);
    });
  });

  describe('#configurePrivateKey', () => {
    it('should write the private key to the correct path', () => {
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify({ _public_key: mockPublicKey }));
      sandbox.stub(fs, 'writeFileSync');

      const infoStub = sandbox.stub(core, 'info');

      const actionInstance = new Action(
        'decrypt',
        mockFilePath,
        mockPrivateKey,
        mockOutFile
      );
      actionInstance.configurePrivateKey();

      const keyPath = `/opt/ejson/keys/${mockPublicKey}`;

      sinon.assert.calledWith(
        fs.writeFileSync,
        keyPath,
        mockPrivateKey,
        'utf-8'
      );
      sinon.assert.calledWith(infoStub, `Creating file ${keyPath}`);
    });

    it('should throw an error if no private key is provided', () => {
      sandbox.stub(fs, 'existsSync').returns(true);

      const actionInstance = new Action(
        'decrypt',
        mockFilePath,
        '',
        mockOutFile
      );

      expect(() => actionInstance.configurePrivateKey()).toThrow(
        'No provided private key for encryption'
      );
    });

    it('should throw an error if the public key is not found', () => {
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns(JSON.stringify({}));

      const actionInstance = new Action(
        'decrypt',
        mockFilePath,
        mockPrivateKey,
        mockOutFile
      );

      expect(() => actionInstance.configurePrivateKey()).toThrow(
        'Not found public key in ejson file'
      );
    });
  });

  describe('#debugFileContent', () => {
    it('should log file content if EJSON_DEBUG is true', () => {
      process.env.EJSON_DEBUG = 'true';

      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns('file content');

      const infoStub = sandbox.stub(core, 'info');

      const actionInstance = new Action('encrypt', mockFilePath);
      actionInstance.debugFileContent(mockFilePath);

      sinon.assert.calledWith(
        infoStub,
        `[encrypt] File content: ${mockFilePath}`
      );
      sinon.assert.calledWith(infoStub, 'file content');
    });

    it('should not log file content if EJSON_DEBUG is not true', () => {
      process.env.EJSON_DEBUG = 'false';

      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns('file content');

      const infoStub = sandbox.stub(core, 'info');

      const actionInstance = new Action('encrypt', mockFilePath);
      actionInstance.debugFileContent(mockFilePath);

      sinon.assert.notCalled(infoStub);
    });
  });
});
