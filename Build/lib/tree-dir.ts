import fsp from 'fs/promises';
import { sep } from 'path';

interface TreeFileType {
  type: 'file',
  name: string,
  path: string
}

interface TreeDirectoryType {
  type: 'directory',
  name: string,
  path: string,
  children: TreeTypeArray
}

export type TreeType = TreeDirectoryType | TreeFileType;
export type TreeTypeArray = TreeType[];

type VoidOrVoidArray = void | VoidOrVoidArray[];

export const treeDir = async (path: string): Promise<TreeTypeArray> => {
  const tree: TreeTypeArray = [];

  const walk = async (dir: string, node: TreeTypeArray): Promise<VoidOrVoidArray> => {
    const promises: Array<Promise<VoidOrVoidArray>> = [];
    for await (const child of await fsp.opendir(dir)) {
      const childFullPath = child.parentPath + sep + child.name;

      if (child.isDirectory()) {
        const newNode: TreeDirectoryType = {
          type: 'directory',
          name: child.name,
          path: childFullPath,
          children: []
        };
        node.push(newNode);
        promises.push(walk(childFullPath, newNode.children));
        continue;
      }
      if (child.isFile()) {
        const newNode: TreeFileType = {
          type: 'file',
          name: child.name,
          path: childFullPath
        };
        node.push(newNode);
        continue;
      }
    }
    return Promise.all(promises);
  };

  await walk(path, tree);

  return tree;
};
