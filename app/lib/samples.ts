export const sampleObfuscatedCode = `// Sample obfuscated code (obfuscator.io style)
var _0x4a2c = ['log', 'Hello,\\x20World!', 'This\\x20is\\x20a\\x20test', 'warn', 'secret\\x20value', 'length'];

(function(_0x2d8f05, _0x4a2c62) {
  var _0x4b5e81 = function(_0x335c5d) {
    while (--_0x335c5d) {
      _0x2d8f05['push'](_0x2d8f05['shift']());
    }
  };
  _0x4b5e81(++_0x4a2c62);
})(_0x4a2c, 0x1a4);

var _0xb4e3 = function(_0x2d8f05, _0x4a2c62) {
  _0x2d8f05 = _0x2d8f05 - 0x0;
  var _0x4b5e81 = _0x4a2c[_0x2d8f05];
  return _0x4b5e81;
};

var _0x28b41c = {
  'nSAzb': function(_0x469a81, _0x12438e) {
    return _0x469a81 !== _0x12438e;
  },
  'bRqFt': function(_0x5a2c97, _0x3f8d21) {
    return _0x5a2c97 + _0x3f8d21;
  },
  'hjHdC': 'completed',
  'kLmNp': function(_0x1a2b3c, _0x4d5e6f) {
    return _0x1a2b3c > _0x4d5e6f;
  }
};

function processData(_0x1d9813) {
  var _0x2a9810 = _0x28b41c['hjHdC'];
  if (_0x28b41c['nSAzb'](_0x2a9810, 'failed')) {
    var _0x3b8721 = _0x28b41c['bRqFt']('Status: ', _0x2a9810);
    console[_0xb4e3('0x0')](_0x3b8721);
  }
  if (_0x28b41c['kLmNp'](_0x1d9813[_0xb4e3('0x5')], 0x0)) {
    console[_0xb4e3('0x0')](_0xb4e3('0x1'));
    console[_0xb4e3('0x0')](_0xb4e3('0x2'));
  } else {
    console[_0xb4e3('0x3')]('No data');
  }
  return _0x2a9810;
}

var _0x5c3d2e = 'secret\\x20value';
processData([0x1, 0x2, 0x3]);
`;

export const sampleCleanCode = `// Example JavaScript code to obfuscate
function greetUser(name) {
  const greeting = "Hello, " + name + "!";
  console.log(greeting);
  return greeting;
}

function calculateSum(numbers) {
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
}

class UserManager {
  constructor() {
    this.users = [];
    this.apiKey = "sk-secret-key-12345";
  }

  addUser(name, email) {
    const user = { name, email, id: Date.now() };
    this.users.push(user);
    console.log("User added:", name);
    return user;
  }

  findUser(email) {
    return this.users.find(u => u.email === email);
  }

  getCount() {
    return this.users.length;
  }
}

const manager = new UserManager();
manager.addUser("Alice", "alice@example.com");
manager.addUser("Bob", "bob@example.com");

const result = calculateSum([10, 20, 30, 40, 50]);
console.log("Sum:", result);
greetUser("World");
`;
