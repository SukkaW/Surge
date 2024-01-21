interface Node {
  /** @default 0 */
  depth?: number,
  key: string,
  /** @default false */
  word?: boolean,
  children: Record<string, Node>,
  fail?: Node,
  count: number
}

const createNode = (key: string, depth = 0): Node => ({
  depth,
  key,
  word: false,
  children: {},
  fail: undefined,
  count: 0
});

const createKeywordFilter = (keys: string[] | Set<string>) => {
  const root = createNode('root');

  const build = () => {
    const queue: Node[] = [];
    queue.push(root);

    let idx = 0;
    while (queue.length > idx) {
      const beginNode = queue[idx];
      const map = beginNode.children;
      // eslint-disable-next-line guard-for-in -- plain object
      for (const key in beginNode.children) {
        const node = map[key];
        let failNode = beginNode.fail;

        while (failNode && !failNode.children[key]) {
          failNode = failNode.fail;
        }

        if (node) {
          node.fail = failNode?.children[key] || root;

          queue.push(node);
        }
      }

      idx++;
    }
  };

  const put = (key: string, len: number) => {
    let node = root;
    const lastIdx = len - 1;
    node.count++;
    for (let idx = 0; idx < len; idx++) {
      const val = key[idx];
      const nextNode = node.children[val];

      if (nextNode) {
        nextNode.count++;
        node = nextNode;
      } else {
        const newNode = createNode(val, idx + 1);
        newNode.count = 1;
        node.children[val] = newNode;
        node = newNode;
      }

      if (lastIdx === idx && node.depth) {
        node.word = true;
      }
    }
  };

  keys.forEach(k => put(k, k.length));

  build();

  return (text: string) => {
    let node: Node | undefined = root;

    for (let i = 0, textLen = text.length; i < textLen; i++) {
      // const key = text.charAt(i);
      const key = text[i];

      while (node && !node.children[key]) {
        node = node.fail;
      }
      node = node?.children[key] || root;

      if (node.word) {
        return true;
      }
    }

    return false;
  };
};

export default createKeywordFilter;
