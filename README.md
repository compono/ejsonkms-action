# ejson-action

Simple github action that helps to execute encryption and decryption of json files using the ejson cli. **Current ejson version 1.4.1**.

## Configuration

```yaml
- name: ejson action
  uses: Drafteame/ejson-action@main
  with:
    action: decrypt # [encrypt, decrypt]
    file_path: <path-to-ejson-file>
    private_key: <private-key-string> # needed if encrypt is used as action

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
      uses: Drafteame/ejson-action@main
      id: decrypt
      with:
        action: decrypt
        file_path: <path-to-ejson-file>
        private_key: <private-key-string>

    - name: Decrypted content
      run: |
        echo "Decrypted:"
        echo "${{ steps.decrypt.outputs.decrypted }}"

    - name: Encrypt file
      uses: Drafteame/ejson-action@main
      id: encrypt
      with:
        action: encrypt
        file_path: <path-to-ejson-file>
        private_key: <private-key-string>

    - name: Encrypted content
      run: |
        echo "Encrypted content:"
        cat <path-to-ejson-file>
```
