import { Options } from "./options";
import * as fs from "fs";
import * as vscode from "vscode";

import { isAiFile, isJFile, isZincFile, resolvePaths } from "../tool";
import * as jassParse from "../jass/parse";
import * as jassAst from "../jass/ast";

import * as zincParse from "../zinc/parse";
import * as zincAst from "../zinc/ast";

import * as vjassParse from "../vjass/parse";
import * as vjassAst from "../vjass/ast";


const commonJProgram = jassParse.parse(fs.readFileSync(Options.commonJPath).toString(), {
  needParseNative: true
});
// new Program(Options.commonJPath, fs.readFileSync(Options.commonJPath).toString());

const commonAiProgram = jassParse.parse(fs.readFileSync(Options.commonAiPath).toString(), {
  needParseNative: false
});
// new Program(Options.commonAiPath, fs.readFileSync(Options.commonAiPath).toString());

const blizzardJProgram = jassParse.parse(fs.readFileSync(Options.blizzardJPath).toString(), {
  needParseNative: false
});
// new Program(Options.blizzardJPath, fs.readFileSync(Options.blizzardJPath).toString());


const dzApiJProgram = jassParse.parse(fs.readFileSync(Options.dzApiJPath).toString(), {
  needParseNative: true
});
// new Program(Options.dzApiJPath, fs.readFileSync(Options.dzApiJPath).toString());

// const includePrograms = Options.includes.map(path => {
//   const content = fs.readFileSync(path).toString();
//   const program = new Program(path, content);
//   return program;
// });

/* vjass块 过时
const includeMap = new Map<string, jassAst.Program>();

Options.includes.map(path => {
  const content = fs.readFileSync(path).toString();
  const program = jassParse.parse(content, {
    needParseNative: true
  });
  includeMap.set(path, program);
});

const includeJassPrograms = [...includeMap.values()];


const programs = [commonJProgram, commonAiProgram, dzApiJProgram, blizzardJProgram, ...includeJassPrograms];
const scopes = includePrograms.map(program => program.allScope).flat();
const librarys = includePrograms.map(program => program.librarys).flat();
const types = includePrograms.map(program => program.types).flat();
const structs = includePrograms.map(program => program.allStructs).flat();


const natives = programs.map(program => program.natives).flat();
const functions = programs.map(program => program.functions).flat();
const globals = programs.map(program => program.globals).flat();
*/

const JassMap = new Map<string, jassAst.Program>();
const ZincMap = new Map<string, zincAst.Program>();
const VjassMap = new Map<string, vjassAst.Program>();

/**
 * 解析工作目录下所有j文件
 */
function parseWorkspaceFiles(floders = vscode.workspace.workspaceFolders) {
  if (!floders) {
    return;
  }

  floders.forEach((floder) => {

    const files = resolvePaths([floder.uri.fsPath]);

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath).toString();
      if (isJFile(filePath)) {
        const jassProgram = jassParse.parse(content, {
          needParseLocal: true
        });
        JassMap.set(filePath, jassProgram);
        const vjassProgram = vjassParse.parse(content);
        VjassMap.set(filePath, vjassProgram);
        const zincProgram: zincAst.Program = zincParse.parse(content);
        ZincMap.set(filePath, zincProgram);
      } else if (isAiFile(filePath)) {
        const jassProgram = jassParse.parse(content, {
          needParseLocal: true
        });
        JassMap.set(filePath, jassProgram);
        const vjassProgram = vjassParse.parse(content);
        VjassMap.set(filePath, vjassProgram);
        const zincProgram: zincAst.Program = zincParse.parse(content);
        ZincMap.set(filePath, zincProgram);
      } else if (isZincFile(filePath)) {
        const zincProgram: zincAst.Program = zincParse.parse(content, true);
        ZincMap.set(filePath, zincProgram);
      }

    });

  });
}
parseWorkspaceFiles();




/* 不起作用，暂时不知道有什么用
function watchWorkspaceChange() {
  vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    console.log("工作目录改变")
    parseWorkspaceFiles([...event.added]);
  
    event.removed.forEach((floder) => {
      const files = resolvePaths([floder.uri.fsPath]);
  
      files.forEach((file) => {
  
        workMap.delete(file);
  
      });
  
    });
  
  });
}

watchWorkspaceChange();
*/
function startWatch() {

  //#region jass and zinc
  const watcher = vscode.workspace.createFileSystemWatcher("**/*{.j,.ai,.jass}", false, false, false);
  watcher.onDidCreate((event) => {
    const content = fs.readFileSync(event.fsPath).toString();
    const program = jassParse.parse(content, {
      needParseLocal: true
    });
    JassMap.set(event.fsPath, program);
    const vjassProgram = vjassParse.parse(content);
    VjassMap.set(event.fsPath, vjassProgram);
    const zincProgram: zincAst.Program = zincParse.parse(content);
    ZincMap.set(event.fsPath, zincProgram);
  });
  watcher.onDidDelete((event) => {

    JassMap.delete(event.fsPath);
    VjassMap.delete(event.fsPath);
    ZincMap.delete(event.fsPath);
  });
  // 类似于保存，暂时未发现有其他作用
  watcher.onDidChange((event) => {

    const content = fs.readFileSync(event.fsPath).toString();
    const program = jassParse.parse(content, {
      needParseLocal: true
    });
    JassMap.set(event.fsPath, program);
    const vjassProgram = vjassParse.parse(content);
    VjassMap.set(event.fsPath, vjassProgram);
    const zincProgram: zincAst.Program = zincParse.parse(content);
    ZincMap.set(event.fsPath, zincProgram);
  });
  //#endregion
  //#region zinc
  const zincWatcher = vscode.workspace.createFileSystemWatcher("**/*.zn", false, false, false);
  zincWatcher.onDidCreate((event) => {
    const zincProgram: zincAst.Program = zincParse.parse(fs.readFileSync(event.fsPath).toString());
    ZincMap.set(event.fsPath, zincProgram);
  });
  zincWatcher.onDidDelete((event) => {
    ZincMap.delete(event.fsPath);
  });
  zincWatcher.onDidChange((event) => {
    const zincProgram: zincAst.Program = zincParse.parse(fs.readFileSync(event.fsPath).toString());
    ZincMap.set(event.fsPath, zincProgram);
  });
  //#endregion

  vscode.workspace.onDidChangeTextDocument((event) => {
    
  });

}
startWatch();


export {
  commonJProgram,
  commonAiProgram,
  blizzardJProgram,
  dzApiJProgram,
  JassMap,
  ZincMap,
  VjassMap
};