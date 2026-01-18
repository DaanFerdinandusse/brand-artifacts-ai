import ts from "typescript";
import path from "node:path";

export type FunctionKind =
  | "function-declaration"
  | "variable-function"
  | "method"
  | "property-function"
  | "accessor";

export interface FunctionMatch {
  name: string;
  kind: FunctionKind;
  text: string;
  startLine: number;
  startColumn: number;
}

function getScriptKind(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".ts":
    case ".mts":
    case ".cts":
      return ts.ScriptKind.TS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function getPropertyNameText(name: ts.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function isFunctionInitializer(initializer: ts.Expression | undefined): boolean {
  return !!initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
}

function makeMatch(
  sourceFile: ts.SourceFile,
  sourceText: string,
  node: ts.Node,
  name: string,
  kind: FunctionKind
): FunctionMatch {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  const position = sourceFile.getLineAndCharacterOfPosition(start);
  return {
    name,
    kind,
    text: sourceText.slice(start, end).trim(),
    startLine: position.line + 1,
    startColumn: position.character + 1,
  };
}

function collectMatches(
  sourceFile: ts.SourceFile,
  sourceText: string,
  functionName: string
): FunctionMatch[] {
  const matches: FunctionMatch[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName && node.body) {
      matches.push(makeMatch(sourceFile, sourceText, node, functionName, "function-declaration"));
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === functionName) {
          if (isFunctionInitializer(declaration.initializer)) {
            matches.push(makeMatch(sourceFile, sourceText, declaration, functionName, "variable-function"));
          }
        }
      }
    }

    if (ts.isMethodDeclaration(node) && getPropertyNameText(node.name) === functionName && node.body) {
      matches.push(makeMatch(sourceFile, sourceText, node, functionName, "method"));
    }

    if (ts.isGetAccessor(node) && getPropertyNameText(node.name) === functionName) {
      matches.push(makeMatch(sourceFile, sourceText, node, functionName, "accessor"));
    }

    if (ts.isSetAccessor(node) && getPropertyNameText(node.name) === functionName) {
      matches.push(makeMatch(sourceFile, sourceText, node, functionName, "accessor"));
    }

    if (ts.isPropertyAssignment(node) && getPropertyNameText(node.name) === functionName) {
      if (isFunctionInitializer(node.initializer)) {
        matches.push(makeMatch(sourceFile, sourceText, node, functionName, "property-function"));
      }
    }

    if (ts.isPropertyDeclaration(node) && getPropertyNameText(node.name) === functionName) {
      if (isFunctionInitializer(node.initializer)) {
        matches.push(makeMatch(sourceFile, sourceText, node, functionName, "property-function"));
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return matches;
}

function collectFunctionNames(sourceFile: ts.SourceFile): string[] {
  const names = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      names.add(node.name.text);
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && isFunctionInitializer(declaration.initializer)) {
          names.add(declaration.name.text);
        }
      }
    }

    if (ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
      const name = getPropertyNameText(node.name);
      if (name) {
        names.add(name);
      }
    }

    if (ts.isPropertyAssignment(node) && isFunctionInitializer(node.initializer)) {
      const name = getPropertyNameText(node.name);
      if (name) {
        names.add(name);
      }
    }

    if (ts.isPropertyDeclaration(node) && isFunctionInitializer(node.initializer)) {
      const name = getPropertyNameText(node.name);
      if (name) {
        names.add(name);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

const kindPriority: Record<FunctionKind, number> = {
  "function-declaration": 4,
  "variable-function": 3,
  method: 2,
  accessor: 2,
  "property-function": 1,
};

export function findFunctionMatches(
  sourceText: string,
  filePath: string,
  functionName: string
): FunctionMatch[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  );

  return collectMatches(sourceFile, sourceText, functionName).sort((a, b) => {
    const priorityDelta = kindPriority[b.kind] - kindPriority[a.kind];
    return priorityDelta !== 0 ? priorityDelta : a.startLine - b.startLine;
  });
}

export function listFunctionNames(sourceText: string, filePath: string): string[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  );

  return collectFunctionNames(sourceFile);
}
