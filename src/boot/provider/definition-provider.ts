/*
流程
先查找當前文件 -> 再去找common等文件 -> 再去找includes文件
一旦找到了就直接返回，不再無畏的往下找
*/

import * as vscode from 'vscode';

import { AllKeywords } from './keyword';
import { Types } from './types';
import { Func, Library, Local, Program, Take } from "../jass/ast";
import data, { parseContent } from "./data";
import { Rangebel } from '../common';
import { Options } from './options';
import { compare, isZincFile } from '../tool';
import { convertPosition, fieldFunctions } from './tool';


const toVsPosition = <T extends Rangebel>(any: T) => {
  const range = new vscode.Range(any.loc.start.line, any.loc.start.position, any.loc.end.line, any.loc.end.position);
  return range ?? new vscode.Position(any.loc.start.line, any.loc.start.position);
};

vscode.languages.registerDefinitionProvider("jass", new class NewDefinitionProvider implements vscode.DefinitionProvider {

  private _maxLength = 255;

  private isNumber = function (val: string) {
    var regPos = /^\d+(\.\d+)?$/; //非负浮点数
    var regNeg = /^(-(([0-9]+\.[0-9]*[1-9][0-9]*)|([0-9]*[1-9][0-9]*\.[0-9]+)|([0-9]*[1-9][0-9]*)))$/; //负浮点数
    if (regPos.test(val) || regNeg.test(val)) {
      return true;
    } else {
      return false;
    }
  }

  provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
    const key = document.getText(document.getWordRangeAtPosition(position));
    console.log(key);
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
      return null;
    }
    console.log(key);

    const fsPath = document.uri.fsPath;

    parseContent(fsPath, document.getText());

    const fieldLibrarys = () => {
      const librarys:Library[] = [];

      if (!Options.isOnlyJass) {
        librarys.push(...data.librarys());

        if (Options.supportZinc) {
          librarys.push(...data.zincLibrarys());
        }
      }
      
      return librarys;
    };

    const fieldGlobals = () => {
      const globals = data.globals();

      data.functions().forEach((func) => {
        if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
          globals.push(...func.getGlobals());
        }
      });

      if (!Options.isOnlyJass) {
        const requires: string[] = [];
        data.librarys().filter((library) => {
          if (compare(library.source, fsPath) && library.loc.contains(convertPosition(position))) {
            requires.push(...library.requires);
            globals.push(...library.globals);
            return false;
          }
          return true;
        }).forEach((library) => {
          if (requires.includes(library.name)) {
            globals.push(...library.globals.filter((func) => func.tag != "private"));
          }
        });
        // 方法内部的globals
        data.libraryFunctions().forEach((func) => {
          if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
            globals.push(...func.getGlobals());
          }
        });

        if (Options.supportZinc) {
          data.zincLibrarys().filter((library) => {
            if (compare(library.source, fsPath) && library.loc.contains(convertPosition(position))) {
              requires.push(...library.requires);
              globals.push(...library.globals);
              return false;
            }
            return true;
          }).forEach((library) => {
            if (requires.includes(library.name)) {
              globals.push(...library.globals.filter((func) => func.tag != "private"));
            }
          });
          // 旧版本的zinc解析，这里不会执行，因为没有解析这部分的代码
          data.zincLibraryFunctions().forEach((func) => {
            if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
              globals.push(...func.getGlobals());
            }
          });
        }
      }
      
      return globals;
    };

    const fieldTakes = () => {
      const takes:{
        take: Take,
        func:Func
      }[] = [];
      data.functions().forEach((func) => {
        if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
          
          takes.push(...func.takes.map((take) => {
            return {take, func};
          }));
        }
      });

      if (!Options.isOnlyJass) {
        data.libraryFunctions().forEach((func) => {
          if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
            takes.push(...func.takes.map((take) => {
              return {take, func};
            }));
          }
        });

        if (Options.supportZinc) {
          data.zincLibraryFunctions().forEach((func) => {
            if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
              takes.push(...func.takes.map((take) => {
                return {take, func};
              }));
            }
          });
        }
      }

      return takes;
    };

    const fieldLocals = () => {
      const locals:Local[] = [];
      data.functions().forEach((func) => {
        if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
          locals.push(...func.locals);
        }
      });

      if (!Options.isOnlyJass) {
        data.libraryFunctions().forEach((func) => {
          if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
            locals.push(...func.locals);
          }
        });

        if (Options.supportZinc) {
          data.zincLibraryFunctions().forEach((func) => {
            if (compare(func.source, fsPath) && func.loc.contains(convertPosition(position))) {
              locals.push(...func.locals);
            }
          });
        }
      }

      return locals;
    };
    const fieldStructs = () => {
      const structs = data.structs();

      if (!Options.isOnlyJass) {
        const requires: string[] = [];
        data.librarys().filter((library) => {
          if (compare(library.source, fsPath) && library.loc.contains(convertPosition(position))) {
            requires.push(...library.requires);
            structs.push(...library.structs);
            return false;
          }
          return true;
        }).forEach((library) => {
          if (requires.includes(library.name)) {
            structs.push(...library.structs.filter((struct) => struct.tag != "private"));
          }
        });

        if (Options.supportZinc) {
          data.zincLibrarys().filter((library) => {
            if (compare(library.source, fsPath) && library.loc.contains(convertPosition(position))) {
              requires.push(...library.requires);
              structs.push(...library.structs);
              return false
            }
            return true;
          }).forEach((library) => {
            if (requires.includes(library.name)) {
              structs.push(...library.structs.filter((struct) => struct.tag != "private"));
            }
          });
        }
      }
      
      return structs;
    };

    const locations = new Array<vscode.Location>();

    [...fieldFunctions(fsPath, position), ...data.natives()].forEach((func) => {
      if (func.name == key) {
        const location = new vscode.Location(vscode.Uri.file(func.source), toVsPosition(func));
        locations.push(location);
      }
    });
    fieldGlobals().forEach((global) => {
      if (global.name == key) {
        const location = new vscode.Location(vscode.Uri.file(global.source), toVsPosition(global));
        locations.push(location);
      }
    });
    fieldLocals().forEach((local) => {
      if (local.name == key) {
        const location = new vscode.Location(vscode.Uri.file(local.source), toVsPosition(local));
        locations.push(location);
      }
    });
    fieldTakes().forEach((funcTake) => {
      if (funcTake.take.name == key) {
        const location = new vscode.Location(vscode.Uri.file(funcTake.func.source), toVsPosition(funcTake.take));
        locations.push(location);
      }
    });
    fieldStructs().forEach((struct) => {
      if (struct.name == key) {
        const location = new vscode.Location(vscode.Uri.file(struct.source), toVsPosition(struct));
        locations.push(location);
      }
    });
    fieldLibrarys().forEach((library) => {
      if (library.name == key) {
        const location = new vscode.Location(vscode.Uri.file(library.source), toVsPosition(library));
        locations.push(location);
      }
    });

    return locations;
  }

}());
