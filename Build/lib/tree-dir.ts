import fsp from 'node:fs/promises';
import { sep } from 'node:path';

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

export const treeDir = async (rootPath: string): Promise<TreeTypeArray> => {
  const tree: TreeTypeArray = [];

  const walk = async (dir: string, node: TreeTypeArray, dirRelativeToRoot = ''): Promise<VoidOrVoidArray> => {
    const promises: Array<Promise<VoidOrVoidArray>> = [];
    for await (const child of await fsp.opendir(dir)) {
      // Ignore hidden files
      if (child.name[0] === '.' || child.name === 'CNAME') {
        continue;
      }

      const childFullPath = child.parentPath + sep + child.name;
      const childRelativeToRoot = dirRelativeToRoot + sep + child.name;

      if (child.isDirectory()) {
        const newNode: TreeDirectoryType = {
          type: 'directory',
          name: child.name,
          path: childRelativeToRoot,
          children: []
        };
        node.push(newNode);
        promises.push(walk(childFullPath, newNode.children, childRelativeToRoot));
        continue;
      }
      if (child.isFile()) {
        const newNode: TreeFileType = {
          type: 'file',
          name: child.name,
          path: childRelativeToRoot
        };
        node.push(newNode);
        continue;
      }
    }
    return Promise.all(promises);
  };

  await walk(rootPath, tree);

  return tree;
};
