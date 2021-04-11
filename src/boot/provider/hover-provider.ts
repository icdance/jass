import * as vscode from 'vscode';

import { Program, Scope } from './jass';
import { commonJProgram, commonAiProgram, dzApiJProgram, blizzardJProgram, includePrograms } from './data';
import { Types } from "./types";
import { AllKeywords } from './keyword';

/**
 * 扁平化scopes
 * @param scopes 
 * @returns 
 */
const get = (scopes:Scope[]) :Scope[] => {
  return scopes.map(scope => {
    if (scope.scopes.length == 0) {
      return [scope];
    } else {
      return [scope, ...get(scope.scopes)];
    }
  }).flat();
}

const programs = [commonJProgram, commonAiProgram, dzApiJProgram, blizzardJProgram, ...includePrograms];
// const scopes = programs.map(program => program.allScope).flat();
const types = programs.map(program => program.types).flat();
const natives = programs.map(program => program.natives).flat();
const functions = programs.map(program => program.allFunctions).flat();
const globals = programs.map(program => program.allGlobals).flat();
const structs = programs.map(program => program.allStructs).flat();
const all = [...types, ...natives, ...functions, ...globals, ...structs];

class HoverProvider implements vscode.HoverProvider {
  
  // 规定标识符长度
  private _maxLength = 526;

  private isNumber = function (val: string) {
    var regPos = /^\d+(\.\d+)?$/; //非负浮点数
    var regNeg = /^(-(([0-9]+\.[0-9]*[1-9][0-9]*)|([0-9]*[1-9][0-9]*\.[0-9]+)|([0-9]*[1-9][0-9]*)))$/; //负浮点数
    if (regPos.test(val) || regNeg.test(val)) {
      return true;
    } else {
      return false;
    }
  }

  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {

    const key = document.getText(document.getWordRangeAtPosition(position));

    if (key.length > this._maxLength) {
      return null;
    }

    if (this.isNumber(key)) {
      return null;
    }

    if (AllKeywords.includes(key)) {
      return null;
    }

    const type = Types.find(type => type === key);
    if (type) {
      const markdownString = new vscode.MarkdownString().appendCodeblock(type);
      return new vscode.Hover(markdownString);
    }

    const hovers: vscode.MarkdownString[] = [];

    const content = document.getText();

    all.forEach(func => {
      if (key == func.name) {
        hovers.push(new vscode.MarkdownString(func.name).appendCodeblock(func.origin));
      }
    });

    return new vscode.Hover([...hovers]);
  }

}

vscode.languages.registerHoverProvider("jass", new HoverProvider());
