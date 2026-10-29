import {
  domainFieldsInStandardOrder,
  eip712FieldType,
  encodeEip712Type,
  parseEip712Prehashed,
  parseEip712RawTypedData,
  parseEip712Summary,
} from '../src/utils/eip712';

function typedDataHex(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('hex');
}

describe('parseEip712Summary', () => {
  it('parses utf8 JSON typed data into domain and message summaries', () => {
    const signDataHex = Buffer.from(
      JSON.stringify({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
          ],
          Mail: [
            { name: 'from', type: 'address' },
            { name: 'contents', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 1,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          contents: 'Hello, Bob!',
          tags: ['test', 'mail'],
        },
      }),
      'utf8',
    ).toString('hex');

    expect(parseEip712Summary(signDataHex)).toEqual({
      rawJson: expect.stringContaining('"primaryType": "Mail"'),
      primaryType: 'Mail',
      domain: {
        chainId: '1',
        name: 'Ether Mail',
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        version: '1',
      },
      message: {
        contents: 'Hello, Bob!',
        from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        tags: '["test","mail"]',
      },
      miscasedAddresses: [],
    });
  });

  it('returns prettified JSON in rawJson regardless of input formatting', () => {
    const payload = {
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }],
        Message: [{ name: 'content', type: 'string' }],
      },
      primaryType: 'Message',
      domain: { name: 'Test' },
      message: { content: 'hello' },
    };
    const minified = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'hex',
    );
    const result = parseEip712Summary(minified);
    expect(result?.rawJson).toBe(JSON.stringify(payload, null, 2));
  });

  it('returns null for non-json data', () => {
    expect(parseEip712Summary('deadbeef')).toBeNull();
  });

  it('returns null for empty data', () => {
    expect(parseEip712Summary('')).toBeNull();
  });

  it('returns null for JSON that is not an object', () => {
    const signDataHex = Buffer.from('[]', 'utf8').toString('hex');
    expect(parseEip712Summary(signDataHex)).toBeNull();
  });

  it('uses empty domain and message maps when those fields are not objects', () => {
    const payload = {
      types: {
        EIP712Domain: [],
      },
      domain: 'not-an-object',
      message: ['not', 'an', 'object'],
    };
    const signDataHex = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'hex',
    );

    expect(parseEip712Summary(signDataHex)).toEqual({
      rawJson: JSON.stringify(payload, null, 2),
      primaryType: undefined,
      domain: {},
      message: {},
      miscasedAddresses: [],
    });
  });

  it('keeps a field named __proto__ in the display maps', () => {
    const json =
      '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"__proto__","type":"string"}],"Note":[{"name":"__proto__","type":"string"}]},"primaryType":"Note","domain":{"name":"Notes","__proto__":"hidden"},"message":{"__proto__":"also hidden"}}';
    const summary = parseEip712Summary(
      Buffer.from(json, 'utf8').toString('hex'),
    );

    const own = (map: Record<string, string>, key: string) =>
      Object.getOwnPropertyDescriptor(map, key)?.value;
    expect(own(summary!.domain, '__proto__')).toBe('hidden');
    expect(own(summary!.domain, 'name')).toBe('Notes');
    expect(own(summary!.message, '__proto__')).toBe('also hidden');
  });

  it('stringifies primitive domain and message values for display', () => {
    const payload = {
      types: {
        EIP712Domain: [],
      },
      primaryType: 'EIP712Domain',
      domain: {
        chainId: 1,
        verified: true,
        salt: null,
      },
      message: {},
    };
    const signDataHex = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'hex',
    );

    expect(parseEip712Summary(signDataHex)?.domain).toEqual({
      chainId: '1',
      salt: 'null',
      verified: 'true',
    });
  });

  it('detects EIP-2612 Permit typed data', () => {
    const payload = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 1,
        verifyingContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
      message: {
        owner: '0x2222222222222222222222222222222222222222',
        spender: '0x1111111111111111111111111111111111111111',
        value: '1000000',
        nonce: '7',
        deadline: '1712345678',
      },
    };
    const signDataHex = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'hex',
    );

    expect(parseEip712Summary(signDataHex)?.special).toEqual({
      kind: 'permit',
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1,
      spender: '0x1111111111111111111111111111111111111111',
      amount: 1000000n,
      deadline: '1712345678',
      unlimited: false,
      miscased: [],
    });
  });

  it('detects PermitSingle typed data and flags max uint160 as unlimited', () => {
    const maxUint160 = (2n ** 160n - 1n).toString();
    const payload = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        PermitSingle: [
          { name: 'details', type: 'PermitDetails' },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
        PermitDetails: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' },
        ],
      },
      primaryType: 'PermitSingle',
      domain: {
        name: 'Permit2',
        chainId: 1,
        verifyingContract: '0x000000000022d473030f116ddee9f6b43ac78ba3',
      },
      message: {
        details: {
          token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          amount: maxUint160,
          expiration: '1712345000',
          nonce: '1',
        },
        spender: '0x1111111111111111111111111111111111111111',
        sigDeadline: '1712345678',
      },
    };
    const signDataHex = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'hex',
    );

    expect(parseEip712Summary(signDataHex)?.special).toEqual({
      kind: 'permit-single',
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1,
      spender: '0x1111111111111111111111111111111111111111',
      amount: 2n ** 160n - 1n,
      deadline: '1712345678',
      expiration: '1712345000',
      unlimited: true,
      miscased: [],
    });
  });

  it('detects SafeTx typed data and decodes embedded calldata', () => {
    const payload = {
      types: {
        EIP712Domain: [
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        SafeTx: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
          { name: 'operation', type: 'uint8' },
          { name: 'safeTxGas', type: 'uint256' },
          { name: 'baseGas', type: 'uint256' },
          { name: 'gasPrice', type: 'uint256' },
          { name: 'gasToken', type: 'address' },
          { name: 'refundReceiver', type: 'address' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      primaryType: 'SafeTx',
      domain: {
        chainId: 1,
        verifyingContract: '0x3333333333333333333333333333333333333333',
      },
      message: {
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        value: '0',
        data: '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000000000000000f4240',
        operation: 0,
        safeTxGas: '100000',
        baseGas: '21000',
        gasPrice: '0',
        gasToken: '0x0000000000000000000000000000000000000000',
        refundReceiver: '0x0000000000000000000000000000000000000000',
        nonce: '12',
      },
    };
    const signDataHex = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'hex',
    );

    expect(parseEip712Summary(signDataHex)?.special).toMatchObject({
      kind: 'safe-tx',
      safeAddress: '0x3333333333333333333333333333333333333333',
      chainId: 1,
      to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      operation: 'Call',
      nonce: '12',
      decodedCall: {
        kind: 'erc20-transfer',
        amount: 1000000n,
      },
    });
  });

  it('does not treat incomplete Permit typed data as a special review', () => {
    const payload = {
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }],
        Permit: [{ name: 'owner', type: 'address' }],
      },
      primaryType: 'Permit',
      domain: {
        name: 'Token',
      },
      message: {
        owner: '0x2222222222222222222222222222222222222222',
      },
    };

    expect(parseEip712Summary(typedDataHex(payload))).toMatchObject({
      primaryType: 'Permit',
      special: undefined,
    });
  });

  it('flags max uint256 Permit approvals as unlimited', () => {
    const payload = {
      types: {
        EIP712Domain: [
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      domain: {
        chainId: 1,
        verifyingContract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      },
      message: {
        owner: '0x2222222222222222222222222222222222222222',
        spender: '0x1111111111111111111111111111111111111111',
        value: (2n ** 256n - 1n).toString(),
        nonce: '1',
        deadline: 0,
      },
    };

    expect(parseEip712Summary(typedDataHex(payload))?.special).toMatchObject({
      kind: 'permit',
      tokenContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      unlimited: true,
      deadline: '0',
    });
  });

  it('does not treat incomplete PermitSingle typed data as a special review', () => {
    const payload = {
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }],
        PermitSingle: [{ name: 'spender', type: 'address' }],
      },
      primaryType: 'PermitSingle',
      domain: { name: 'Permit2' },
      message: {
        spender: '0x2222222222222222222222222222222222222222',
      },
    };

    expect(parseEip712Summary(typedDataHex(payload))).toMatchObject({
      primaryType: 'PermitSingle',
      special: undefined,
    });
  });

  it('detects SafeTx delegate calls and preserves fallback values', () => {
    const payload = {
      types: {
        EIP712Domain: [
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        SafeTx: [
          { name: 'to', type: 'address' },
          { name: 'data', type: 'bytes' },
          { name: 'operation', type: 'uint8' },
          { name: 'gasToken', type: 'string' },
          { name: 'refundReceiver', type: 'string' },
        ],
      },
      primaryType: 'SafeTx',
      domain: {
        chainId: '1',
        verifyingContract: '0x3333333333333333333333333333333333333333',
      },
      message: {
        to: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        data: '0x1234',
        operation: 1,
        gasToken: 'native',
        refundReceiver: '',
      },
    };

    expect(parseEip712Summary(typedDataHex(payload))?.special).toMatchObject({
      kind: 'safe-tx',
      to: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      operation: 'Delegate call',
      value: '0',
      data: '0x1234',
      gasToken: 'native',
      refundReceiver: '',
      nonce: '0',
    });
  });

  it('does not treat SafeTx typed data without a target as a special review', () => {
    const payload = {
      types: {
        EIP712Domain: [{ name: 'chainId', type: 'uint256' }],
        SafeTx: [{ name: 'nonce', type: 'uint256' }],
      },
      primaryType: 'SafeTx',
      domain: { chainId: 1 },
      message: { nonce: '1' },
    };

    expect(parseEip712Summary(typedDataHex(payload))).toMatchObject({
      primaryType: 'SafeTx',
      special: undefined,
    });
  });
});

describe('parseEip712Prehashed', () => {
  const DOMAIN_HASH = 'a'.repeat(64);
  const MESSAGE_HASH = 'b'.repeat(64);
  const PREHASHED_HEX = '1901' + DOMAIN_HASH + MESSAGE_HASH;

  it('parses a valid 0x1901-prefixed payload', () => {
    const result = parseEip712Prehashed(PREHASHED_HEX);
    expect(result).toEqual({
      domainSeparatorHash: '0x' + DOMAIN_HASH,
      messageHash: '0x' + MESSAGE_HASH,
    });
  });

  it('accepts 0x-prefixed input', () => {
    const result = parseEip712Prehashed('0x' + PREHASHED_HEX);
    expect(result).toEqual({
      domainSeparatorHash: '0x' + DOMAIN_HASH,
      messageHash: '0x' + MESSAGE_HASH,
    });
  });

  it('returns null for wrong prefix', () => {
    expect(
      parseEip712Prehashed('1900' + DOMAIN_HASH + MESSAGE_HASH),
    ).toBeNull();
  });

  it('returns null for wrong length', () => {
    expect(parseEip712Prehashed('1901' + DOMAIN_HASH)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseEip712Prehashed('')).toBeNull();
  });
});

describe('parseEip712RawTypedData', () => {
  it('parses valid EIP-712 JSON into raw fields', () => {
    const payload = {
      types: { Mail: [{ name: 'from', type: 'address' }] },
      primaryType: 'Mail',
      domain: { name: 'Test', chainId: 1 },
      message: { from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
    };
    const hex = Buffer.from(JSON.stringify(payload), 'utf8').toString('hex');
    const result = parseEip712RawTypedData(hex);
    expect(result).not.toBeNull();
    expect(result!.primaryType).toEqual('Mail');
    expect(result!.domain).toEqual({ name: 'Test', chainId: 1 });
    expect(result!.message).toEqual({
      from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    });
  });

  it('returns null for non-UTF8 hex (binary data)', () => {
    expect(parseEip712RawTypedData('deadbeef')).toBeNull();
  });

  it('returns null for valid UTF8 that is not JSON', () => {
    const hex = Buffer.from('not json', 'utf8').toString('hex');
    expect(parseEip712RawTypedData(hex)).toBeNull();
  });

  it('leaves primaryType empty when the payload names none', () => {
    const payload = {
      types: {},
      domain: {},
      message: {},
    };
    const hex = Buffer.from(JSON.stringify(payload), 'utf8').toString('hex');
    const result = parseEip712RawTypedData(hex);
    expect(result!.primaryType).toEqual('');
  });

  it('returns null for JSON that is not an object', () => {
    const hex = Buffer.from('[1, 2]', 'utf8').toString('hex');
    expect(parseEip712RawTypedData(hex)).toBeNull();
  });

  it.each([
    ['domain is a string', { types: {}, domain: 'x', message: {} }],
    ['types is a string', { types: 'Mail', domain: {}, message: {} }],
    ['message is an array', { types: {}, domain: {}, message: ['x'] }],
    ['domain is missing', { types: {}, message: {} }],
  ])('returns null when %s', (_label, payload) => {
    const hex = Buffer.from(JSON.stringify(payload), 'utf8').toString('hex');
    expect(parseEip712RawTypedData(hex)).toBeNull();
  });
});

describe('encodeEip712Type', () => {
  const mailTypes = {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  };

  it('matches the EIP-712 reference example', () => {
    expect(encodeEip712Type('Mail', mailTypes)).toBe(
      'Mail(Person from,Person to,string contents)Person(string name,address wallet)',
    );
  });

  it('follows array members and sorts referenced types by name', () => {
    const types = {
      PermitBatch: [
        { name: 'details', type: 'PermitDetails[]' },
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' },
      ],
      PermitDetails: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' },
      ],
      Alpha: [{ name: 'x', type: 'uint8' }],
    };
    expect(encodeEip712Type('PermitBatch', types)).toBe(
      'PermitBatch(PermitDetails[] details,address spender,uint256 sigDeadline)' +
        'PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)',
    );
  });

  it('lists each referenced type once and stops on cycles', () => {
    const types = {
      Node: [
        { name: 'next', type: 'Node' },
        { name: 'leaf', type: 'Leaf[2]' },
        { name: 'other', type: 'Leaf' },
      ],
      Leaf: [{ name: 'v', type: 'uint256' }],
    };
    expect(encodeEip712Type('Node', types)).toBe(
      'Node(Node next,Leaf[2] leaf,Leaf other)Leaf(uint256 v)',
    );
  });

  it('returns null when the primary type is not a struct', () => {
    expect(encodeEip712Type('Missing', mailTypes)).toBeNull();
    expect(encodeEip712Type('Mail', { Mail: 'not a list' })).toBeNull();
  });
});

describe('eip712FieldType', () => {
  const types = {
    PermitBatch: [
      { name: 'details', type: 'PermitDetails[]' },
      { name: 'spender', type: 'address' },
    ],
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
    ],
  };
  const at = (path: string) => eip712FieldType(types, 'PermitBatch', path);

  it('walks members, structs and array elements', () => {
    expect(at('spender')).toBe('address');
    expect(at('#.details')).toBe('PermitDetails[]');
    expect(at('details.[].token')).toBe('address');
    expect(at('details.[2].amount')).toBe('uint160');
    expect(at('details.[-1].token')).toBe('address');
  });

  it('gives null past a slice, an index into no array, or a member it does not list', () => {
    expect(at('details.[0:2]')).toBeNull();
    expect(at('spender.[0]')).toBeNull();
    expect(at('missing')).toBeNull();
    expect(eip712FieldType(types, 'Nothing', 'spender')).toBeNull();
  });
});

describe('domainFieldsInStandardOrder', () => {
  const declaring = (names: unknown[]) => ({
    types: {
      EIP712Domain: names.map(name => ({ name, type: 'string' })),
      Mail: [{ name: 'contents', type: 'string' }],
    },
    primaryType: 'Mail',
    domain: {},
    message: {},
  });

  it.each([
    ['all five', ['name', 'version', 'chainId', 'verifyingContract', 'salt']],
    ['a subset', ['name', 'chainId', 'salt']],
    ['one', ['verifyingContract']],
    ['none', []],
  ])('accepts %s in EIP-712 order', (_, names) => {
    expect(domainFieldsInStandardOrder(declaring(names))).toBe(true);
  });

  it.each([
    ['reversed', ['verifyingContract', 'chainId', 'version', 'name']],
    ['two swapped', ['name', 'chainId', 'version']],
    ['salt first', ['salt', 'verifyingContract']],
  ])('refuses the standard fields %s', (_, names) => {
    expect(domainFieldsInStandardOrder(declaring(names))).toBe(false);
  });

  // nonStandardDomainFields answers for these.
  it('judges only the standard fields', () => {
    expect(
      domainFieldsInStandardOrder(declaring(['foo', 'name', ['x'], 'chainId'])),
    ).toBe(true);
  });

  it('accepts a domain type that is not declared', () => {
    const data = declaring([]);
    delete (data.types as Record<string, unknown>).EIP712Domain;
    expect(domainFieldsInStandardOrder(data)).toBe(true);
  });
});
