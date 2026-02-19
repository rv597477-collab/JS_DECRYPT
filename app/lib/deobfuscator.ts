/* eslint-disable @typescript-eslint/no-explicit-any */
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';

// Handle both ESM and CJS module formats
const traverse = (typeof _traverse === 'function' ? _traverse : (_traverse as any).default) as typeof _traverse;
const generate = (typeof _generate === 'function' ? _generate : (_generate as any).default) as typeof _generate;

export interface DeobfuscatorOptions {
  unpackStringArrays: boolean;
  resolveArrayRotation: boolean;
  replaceProxyFunctions: boolean;
  simplifyExpressions: boolean;
  removeDeadCode: boolean;
  undoControlFlowFlattening: boolean;
  decodeHexUnicode: boolean;
  simplifyObjectAccess: boolean;
  renameVariables: boolean;
  beautifyOutput: boolean;
}

export const defaultDeobfuscatorOptions: DeobfuscatorOptions = {
  unpackStringArrays: true,
  resolveArrayRotation: true,
  replaceProxyFunctions: true,
  simplifyExpressions: true,
  removeDeadCode: true,
  undoControlFlowFlattening: true,
  decodeHexUnicode: true,
  simplifyObjectAccess: true,
  renameVariables: true,
  beautifyOutput: true,
};

export interface DeobfuscationResult {
  code: string;
  timeMs: number;
  transformsApplied: string[];
  errors: string[];
}

export function deobfuscate(source: string, options: DeobfuscatorOptions): DeobfuscationResult {
  const startTime = performance.now();
  const transformsApplied: string[] = [];
  const errors: string[] = [];
  let code = source;

  try {
    // PHASE 1: STRING ARRAY RESOLUTION
    if (options.unpackStringArrays) {
      try {
        const stringResult = resolveStringArrays(code);
        if (stringResult.replacements > 0) {
          code = stringResult.code;
          transformsApplied.push(`Resolved ${stringResult.replacements} encoded strings`);
          if (stringResult.removedNodes > 0) {
            transformsApplied.push(`Removed ${stringResult.removedNodes} decoder infrastructure nodes`);
          }
        }
      } catch (e: any) {
        errors.push(`String resolution error: ${e.message}`);
      }
    }

    // PHASE 2: MULTI-PASS AST TRANSFORMS
    let changed = true;
    let passes = 0;
    const maxPasses = 10;

    while (changed && passes < maxPasses) {
      changed = false;
      passes++;
      const prevCode = code;

      let ast: t.File;
      try {
        ast = parser.parse(code, {
          sourceType: 'unambiguous',
          plugins: ['jsx', 'typescript', 'optionalChaining', 'nullishCoalescingOperator'],
          errorRecovery: true,
        });
      } catch (e: any) {
        errors.push(`Parse error (pass ${passes}): ${e.message}`);
        break;
      }

      if (options.simplifyExpressions) {
        const count = simplifyExpressions(ast);
        if (count > 0 && passes === 1) transformsApplied.push(`Simplified ${count} expressions`);
        if (count > 0) changed = true;
      }

      if (options.replaceProxyFunctions) {
        const count = replaceProxyFunctions(ast);
        if (count > 0 && passes <= 2) transformsApplied.push(`Replaced ${count} proxy function calls`);
        if (count > 0) changed = true;
      }

      if (options.removeDeadCode) {
        const count = removeDeadCode(ast);
        if (count > 0 && passes <= 2) transformsApplied.push(`Removed ${count} dead code branches`);
        if (count > 0) changed = true;
      }

      if (options.undoControlFlowFlattening) {
        const count = undoControlFlowFlattening(ast);
        if (count > 0) {
          transformsApplied.push(`Unflattened ${count} control flow blocks`);
          changed = true;
        }
      }

      if (options.simplifyObjectAccess) {
        const count = simplifyObjectAccess(ast);
        if (count > 0 && passes === 1) transformsApplied.push(`Simplified ${count} object accesses`);
        if (count > 0) changed = true;
      }

      if (options.decodeHexUnicode) {
        const count = decodeHexUnicode(ast);
        if (count > 0 && passes === 1) transformsApplied.push(`Decoded ${count} hex/unicode escapes`);
        if (count > 0) changed = true;
      }

      const output = generate(ast, { comments: false, compact: false });
      code = output.code;
      if (code === prevCode) changed = false;
    }

    // PHASE 3: RENAME VARIABLES
    if (options.renameVariables) {
      try {
        const ast = parser.parse(code, {
          sourceType: 'unambiguous',
          plugins: ['jsx', 'typescript', 'optionalChaining', 'nullishCoalescingOperator'],
          errorRecovery: true,
        });
        const count = renameHexVariables(ast);
        if (count > 0) {
          transformsApplied.push(`Renamed ${count} variables`);
          const output = generate(ast, { comments: false, compact: false });
          code = output.code;
        }
      } catch (e: any) {
        errors.push(`Variable rename error: ${e.message}`);
      }
    }

    // PHASE 4: FINAL BEAUTIFICATION
    if (options.beautifyOutput) {
      try {
        const ast = parser.parse(code, {
          sourceType: 'unambiguous',
          plugins: ['jsx', 'typescript', 'optionalChaining', 'nullishCoalescingOperator'],
          errorRecovery: true,
        });
        const output = generate(ast, {
          comments: false,
          compact: false,
          concise: false,
          retainLines: false,
        });
        code = output.code;
        transformsApplied.push('Beautified output');
      } catch {}
    }
  } catch (e: any) {
    errors.push(`Fatal error: ${e.message}`);
  }

  return {
    code,
    timeMs: performance.now() - startTime,
    transformsApplied: [...new Set(transformsApplied)],
    errors,
  };
}

function resolveStringArrays(sourceCode: string): { code: string; replacements: number; removedNodes: number } {
  let replacements = 0;
  let removedNodes = 0;

  const ast = parser.parse(sourceCode, {
    sourceType: 'unambiguous',
    plugins: ['jsx', 'typescript', 'optionalChaining', 'nullishCoalescingOperator'],
    errorRecovery: true,
  });

  const stringArrayFuncs: Array<{ name: string; path: any; source: string }> = [];
  const decoderFuncs: Array<{ name: string; path: any; source: string; arrayFuncName: string }> = [];
  const rotationIIFEs: Array<{ path: any; source: string }> = [];

  traverse(ast, {
    FunctionDeclaration(path) {
      const name = path.node.id?.name;
      if (!name) return;
      const src = sourceCode.substring(path.node.start!, path.node.end!);
      let hasLargeStringArray = false;
      path.traverse({
        ArrayExpression(arrPath) {
          if (arrPath.node.elements.length > 5 && arrPath.node.elements.every(el => t.isStringLiteral(el))) {
            hasLargeStringArray = true;
            arrPath.stop();
          }
        }
      });
      if (hasLargeStringArray) stringArrayFuncs.push({ name, path, source: src });
    }
  });

  for (const arrFunc of stringArrayFuncs) {
    traverse(ast, {
      FunctionDeclaration(path) {
        const name = path.node.id?.name;
        if (!name || name === arrFunc.name) return;
        const src = sourceCode.substring(path.node.start!, path.node.end!);
        if (src.includes(arrFunc.name)) decoderFuncs.push({ name, path, source: src, arrayFuncName: arrFunc.name });
      },
      ExpressionStatement(path) {
        const expr = path.node.expression;
        if (t.isCallExpression(expr) && t.isFunctionExpression(expr.callee)) {
          const src = sourceCode.substring(path.node.start!, path.node.end!);
          if (src.includes(arrFunc.name) && src.includes('push') && src.includes('shift')) {
            rotationIIFEs.push({ path, source: src });
          }
        }
      }
    });
  }

  for (const decoder of decoderFuncs) {
    const arrFunc = stringArrayFuncs.find(f => f.name === decoder.arrayFuncName);
    if (!arrFunc) continue;

    const rotationIIFE = rotationIIFEs.find(r => r.source.includes(arrFunc.name));
    const executionCode = [arrFunc.source, rotationIIFE?.source, decoder.source].filter(Boolean).join('\n');

    const decoderNames = new Set<string>([decoder.name]);
    traverse(ast, {
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && t.isIdentifier(path.node.init) && decoderNames.has(path.node.init.name)) {
          decoderNames.add(path.node.id.name);
        }
      }
    });

    const calls: Array<{ path: any; args: any[] }> = [];
    traverse(ast, {
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee) && decoderNames.has(path.node.callee.name)) {
          calls.push({ path, args: path.node.arguments });
        }
      }
    });

    for (const call of calls) {
      const argValues = call.args.map((arg: any) => {
        if (t.isNumericLiteral(arg)) return arg.value;
        if (t.isStringLiteral(arg)) return JSON.stringify(arg.value);
        if (t.isUnaryExpression(arg) && arg.operator === '-' && t.isNumericLiteral(arg.argument)) return -arg.argument.value;
        return undefined;
      });
      if (argValues.some(v => v === undefined)) continue;

      try {
        const fn = new Function(`${executionCode}\nreturn ${decoder.name}(${argValues.join(',')});`);
        const result = fn();
        if (typeof result === 'string') {
          call.path.replaceWith(t.stringLiteral(result));
          replacements++;
        }
      } catch {}
    }

    try { arrFunc.path.remove(); removedNodes++; } catch {}
    if (rotationIIFE) try { rotationIIFE.path.remove(); removedNodes++; } catch {}
    try { decoder.path.remove(); removedNodes++; } catch {}
    traverse(ast, {
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && decoderNames.has(path.node.id.name) && t.isIdentifier(path.node.init)) {
          const parent = path.parentPath;
          if (t.isVariableDeclaration(parent?.node) && parent?.node.declarations.length === 1) {
            try { parent.remove(); removedNodes++; } catch {}
          } else {
            try { path.remove(); removedNodes++; } catch {}
          }
        }
      }
    });
  }

  const output = generate(ast, { comments: false, compact: false });
  return { code: output.code, replacements, removedNodes };
}

function replaceProxyFunctions(ast: t.File): number {
  let count = 0;
  const proxyObjects = new Map<string, Map<string, any>>();

  traverse(ast, {
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !t.isObjectExpression(path.node.init)) return;
      const props = new Map<string, any>();
      for (const prop of path.node.init.properties) {
        if (!t.isObjectProperty(prop)) continue;
        const key = t.isStringLiteral(prop.key) ? prop.key.value : t.isIdentifier(prop.key) ? prop.key.name : null;
        if (!key) continue;
        if (t.isStringLiteral(prop.value)) {
          props.set(key, { type: 'string', value: prop.value.value });
        } else if (t.isFunctionExpression(prop.value)) {
          const body = prop.value.body.body;
          if (body.length === 1 && t.isReturnStatement(body[0]) && body[0].argument) {
            const ret = body[0].argument;
            if (t.isBinaryExpression(ret)) props.set(key, { type: 'binary', operator: ret.operator });
            else if (t.isLogicalExpression(ret)) props.set(key, { type: 'logical', operator: ret.operator });
            else if (t.isCallExpression(ret) && t.isIdentifier(ret.callee) && t.isIdentifier(prop.value.params[0]) && ret.callee.name === prop.value.params[0].name) {
              props.set(key, { type: 'call' });
            }
          }
        }
      }
      if (props.size > 0) proxyObjects.set(path.node.id.name, props);
    }
  });

  for (const [objName, props] of proxyObjects) {
    traverse(ast, {
      CallExpression(path) {
        if (!t.isMemberExpression(path.node.callee) || !t.isIdentifier(path.node.callee.object) || path.node.callee.object.name !== objName) return;
        const key = t.isStringLiteral(path.node.callee.property) ? path.node.callee.property.value : t.isIdentifier(path.node.callee.property) && !path.node.callee.computed ? path.node.callee.property.name : null;
        const info = key ? props.get(key) : null;
        if (!info) return;
        if (info.type === 'binary' && path.node.arguments.length === 2) {
          path.replaceWith(t.binaryExpression(info.operator, path.node.arguments[0] as any, path.node.arguments[1] as any)); count++;
        } else if (info.type === 'logical' && path.node.arguments.length === 2) {
          path.replaceWith(t.logicalExpression(info.operator, path.node.arguments[0] as any, path.node.arguments[1] as any)); count++;
        } else if (info.type === 'call' && path.node.arguments.length >= 1) {
          path.replaceWith(t.callExpression(path.node.arguments[0] as any, path.node.arguments.slice(1) as any)); count++;
        }
      },
      MemberExpression(path) {
        if (!t.isIdentifier(path.node.object) || path.node.object.name !== objName) return;
        if (t.isCallExpression(path.parent) && path.parent.callee === path.node) return;
        const key = t.isStringLiteral(path.node.property) ? path.node.property.value : t.isIdentifier(path.node.property) && !path.node.computed ? path.node.property.name : null;
        const info = key ? props.get(key) : null;
        if (info?.type === 'string') {
          path.replaceWith(t.stringLiteral(info.value)); count++;
        }
      }
    });
  }
  return count;
}

function removeDeadCode(ast: t.File): number {
  let count = 0;
  traverse(ast, {
    ConditionalExpression(path) {
      if (t.isBooleanLiteral(path.node.test)) {
        path.replaceWith(path.node.test.value ? path.node.consequent : path.node.alternate); count++;
      } else if (t.isBinaryExpression(path.node.test) && (path.node.test.operator === '===' || path.node.test.operator === '!==') && t.isStringLiteral(path.node.test.left) && t.isStringLiteral(path.node.test.right)) {
        const cond = path.node.test.operator === '===' ? path.node.test.left.value === path.node.test.right.value : path.node.test.left.value !== path.node.test.right.value;
        path.replaceWith(cond ? path.node.consequent : path.node.alternate); count++;
      }
    },
    IfStatement(path) {
      if (t.isBooleanLiteral(path.node.test)) {
        const branch = path.node.test.value ? path.node.consequent : path.node.alternate;
        if (branch) { if (t.isBlockStatement(branch)) path.replaceWithMultiple(branch.body); else path.replaceWith(branch); } else path.remove();
        count++;
      } else if (t.isBinaryExpression(path.node.test) && (path.node.test.operator === '===' || path.node.test.operator === '!==') && t.isStringLiteral(path.node.test.left) && t.isStringLiteral(path.node.test.right)) {
        const cond = path.node.test.operator === '===' ? path.node.test.left.value === path.node.test.right.value : path.node.test.left.value !== path.node.test.right.value;
        const branch = cond ? path.node.consequent : path.node.alternate;
        if (branch) { if (t.isBlockStatement(branch)) path.replaceWithMultiple(branch.body); else path.replaceWith(branch); } else path.remove();
        count++;
      }
    }
  });
  return count;
}

function simplifyExpressions(ast: t.File): number {
  let count = 0;
  traverse(ast, {
    UnaryExpression(path) {
      if (path.node.operator === '!' && t.isArrayExpression(path.node.argument) && path.node.argument.elements.length === 0) {
        path.replaceWith(t.booleanLiteral(false)); count++;
      } else if (path.node.operator === '!' && t.isUnaryExpression(path.node.argument) && path.node.argument.operator === '!') {
        const inner = path.node.argument.argument;
        if (t.isArrayExpression(inner) && inner.elements.length === 0) {
          path.replaceWith(t.booleanLiteral(true)); count++;
        }
      } else if (path.node.operator === 'void' && t.isNumericLiteral(path.node.argument) && path.node.argument.value === 0) {
        path.replaceWith(t.identifier('undefined')); count++;
      }
    },
    BinaryExpression(path) {
      if (t.isNumericLiteral(path.node.left) && t.isNumericLiteral(path.node.right)) {
        let res: any;
        switch(path.node.operator) {
          case '+': res = path.node.left.value + path.node.right.value; break;
          case '-': res = path.node.left.value - path.node.right.value; break;
          case '*': res = path.node.left.value * path.node.right.value; break;
          case '/': res = path.node.left.value / path.node.right.value; break;
        }
        if (typeof res === 'number') { path.replaceWith(t.numericLiteral(res)); count++; }
      }
    },
    NumericLiteral(path) {
      if (path.node.extra?.raw && /^0x/i.test(path.node.extra.raw as string)) {
        delete path.node.extra; count++;
      }
    }
  });
  return count;
}

function undoControlFlowFlattening(ast: t.File): number {
  let count = 0;
  traverse(ast, {
    WhileStatement(path) {
      if (!t.isBlockStatement(path.node.body)) return;
      const sw = path.node.body.body.find(s => t.isSwitchStatement(s)) as t.SwitchStatement;
      if (!sw || !t.isMemberExpression(sw.discriminant)) return;
      const obj = sw.discriminant.object;
      let order: string[] = [];
      if (t.isCallExpression(obj) && t.isMemberExpression(obj.callee) && t.isStringLiteral(obj.callee.object) && t.isIdentifier(obj.callee.property) && obj.callee.property.name === 'split') {
        order = obj.callee.object.value.split('|');
      }
      if (order.length > 0) {
        const cases = new Map();
        sw.cases.forEach(c => cases.set(t.isStringLiteral(c.test) ? c.test.value : t.isNumericLiteral(c.test) ? String(c.test.value) : null, c.consequent.filter(s => !t.isContinueStatement(s) && !t.isBreakStatement(s))));
        const res: any[] = [];
        order.forEach(k => { if (cases.has(k)) res.push(...cases.get(k)); });
        if (res.length > 0) { path.replaceWithMultiple(res); count++; }
      }
    }
  });
  return count;
}

function simplifyObjectAccess(ast: t.File): number {
  let count = 0;
  traverse(ast, {
    MemberExpression(path) {
      if (t.isStringLiteral(path.node.property) && path.node.computed && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(path.node.property.value)) {
        path.node.property = t.identifier(path.node.property.value);
        path.node.computed = false; count++;
      }
    }
  });
  return count;
}

function decodeHexUnicode(ast: t.File): number {
  let count = 0;
  traverse(ast, {
    StringLiteral(path) {
      if (path.node.extra?.raw && (/\\x/i.test(path.node.extra.raw as string) || /\\u/i.test(path.node.extra.raw as string))) {
        delete path.node.extra; count++;
      }
    }
  });
  return count;
}

function renameHexVariables(ast: t.File): number {
  let count = 0;
  const pattern = /^_0x[a-f0-9]+$|^a\d+_0x[a-f0-9]+$/i;
  const counters = { var: 0, func: 0, param: 0 };
  const renamed = new Set<string>();
  traverse(ast, {
    Scope(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        if (renamed.has(name) || !pattern.test(name)) continue;
        let prefix = t.isFunctionDeclaration(binding.path.node) ? 'func' : (binding.path.node.type === 'Identifier' && binding.path.parent && 'params' in binding.path.parent && (binding.path.parent as any).params.some((p:any)=>t.isIdentifier(p)&&p.name===name)) ? 'param' : 'var';
        const newName = `${prefix}${++(counters as any)[prefix]}`;
        renamed.add(name);
        try { path.scope.rename(name, newName); count++; } catch {}
      }
    }
  });
  return count;
}
