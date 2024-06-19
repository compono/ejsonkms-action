# ejsonkms-action

Simple github action that helps to execute encryption and decryption of [ejsonkms](https://github.com/envato/ejsonkms) file

## Configuration

```yaml
- name: ejsonkms action
  uses: compono/ejsonkms-action@main
  with:
    action: decrypt # [encrypt, decrypt]
    file-path: <path-to-ejsonkms-file>
    out-file: <path-to-json-file> # File where the decrypted content will be stored (optional)
    aws-region: <region> # AWS region which is required by decrypt mode (optional)
    populate-env-vars: true | false # Populate the environment variables with the decrypted key-pairs content (optional)
```

### Outputs

| Output     | Description                                       |
|------------|---------------------------------------------------|
| **decrypted**  | Decrypted content of the file when the action is performed with the `decrypt` action |

## Usage

```yaml
jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout Repository
      uses: actions/checkout@v4

    - name: Decrypt file
      uses: compono/ejsonkms-action@main
      id: decrypt
      env:
        AWS_REGION: <aws-region>
        AWS_ACCESS_KEY_ID: <key-id>
        AWS_SECRET_ACCESS_KEY: <redacted>
      with:
        action: decrypt
        aws-region: ${{ env.AWS_REGION }}
        file-path: <path-to-ejsonkms-file>
        out-file: <path-to-json-file>

    - name: Decrypted content
      run: |
        echo "Decrypted:"
        echo '${{ steps.decrypt.outputs.decrypted }}'
        echo
        echo

        echo "Stored File:"
        cat <path-to-json-file>
        echo

    - name: Encrypt file
      uses: compono/ejsonkms-action@main
      id: encrypt
      with:
        action: encrypt
        file-path: <path-to-ejsonkms-file>

    - name: Encrypted content
      run: |
        echo "Encrypted content:"
        cat <path-to-ejson-file>
```

## Credits

* Based on the [ejson-action](https://github.com/Drafteame/ejson-action)
