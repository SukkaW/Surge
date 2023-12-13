import type { Path } from 'path-scurry';
import { PathScurry } from 'path-scurry';

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

export const listDir = async (path: string): Promise<TreeTypeArray> => {
  const pw = new PathScurry(path);

  const tree: TreeTypeArray = [];

  const walk = async (entry: Path, node: TreeTypeArray): Promise<VoidOrVoidArray> => {
    const promises: Array<Promise<VoidOrVoidArray>> = [];
    for (const child of await pw.readdir(entry)) {
      if (child.isDirectory()) {
        const newNode: TreeDirectoryType = {
          type: 'directory',
          name: child.name,
          path: child.relative(),
          children: []
        };
        node.push(newNode);
        promises.push(walk(child, newNode.children));
        continue;
      }
      if (child.isFile()) {
        const newNode: TreeFileType = {
          type: 'file',
          name: child.name,
          path: child.relative()
        };
        node.push(newNode);
        continue;
      }
    }
    return Promise.all(promises);
  };

  await walk(pw.cwd, tree);

  return tree;
};
